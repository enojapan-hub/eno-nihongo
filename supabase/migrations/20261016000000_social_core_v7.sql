-- Social Core v7 (aditif, idempoten, tanpa penghapusan data). Tidak mengulang v5/v6.
-- (1) Admin Operasional → Laporan: tabel content_reports tidak punya hak klien (benar), sehingga daftar yang dibaca
--     langsung dari klien selalu gagal. Diganti RPC moderator minimal (auth.uid(), kolom eksplisit, dibatasi).
-- (2) Aturan badge final dari role/langganan tepercaya: Owner/Admin/Guru tidak pernah Diamond/Free.
-- (3) Nama tampilan kanonik = profiles.display_name; social_profiles.display_name menjadi cermin yang selalu
--     disinkronkan (chat/DM/Friends/kartu langsung memakai nama terbaru; username dan ID tidak berubah).
-- Nonaktifkan dengan aman: lepas trigger trg_profiles_mirror_display_name / trg_social_profiles_display_name.

-- ---------------------------------------------------------------------------------------------
-- (1) RPC laporan umum (non-chat) untuk moderator; chat tetap lewat social_admin_reports.
-- ---------------------------------------------------------------------------------------------
create or replace function public.admin_list_reports(p_status text default null, p_limit integer default 100)
returns jsonb language plpgsql stable security definer set search_path = ''
as $$
declare v_status text := nullif(btrim(coalesce(p_status, '')), '');
begin
  perform public.social_assert_moderator();
  if v_status is not null and v_status not in ('open', 'reviewing', 'resolved', 'rejected') then raise exception 'invalid_setting'; end if;
  return coalesce((
    select jsonb_agg(x order by (x->>'created_at') desc)
    from (
      select jsonb_build_object(
        'id', r.id, 'category', r.category, 'subject', r.subject, 'description', left(r.description, 1000),
        'status', r.status, 'priority', r.priority, 'created_at', r.created_at, 'resolution_note', r.resolution_note) as x
      from public.content_reports r
      where r.category <> 'chat' and (v_status is null or r.status = v_status)
      order by r.created_at desc
      limit least(greatest(coalesce(p_limit, 100), 1), 200)
    ) t), '[]'::jsonb);
end
$$;
revoke all on function public.admin_list_reports(text, integer) from public, anon;
grant execute on function public.admin_list_reports(text, integer) to authenticated;

create or replace function public.admin_update_report(p_id uuid, p_status text, p_note text default null)
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare v_uid uuid := public.social_assert_moderator();
begin
  if p_status not in ('reviewing', 'resolved', 'rejected') then raise exception 'invalid_setting'; end if;
  update public.content_reports
     set status = p_status, resolution_note = nullif(left(btrim(coalesce(p_note, '')), 300), ''),
         assigned_to = v_uid, updated_at = now()
   where id = p_id and category <> 'chat';
  if not found then raise exception 'not_found'; end if;
  insert into public.admin_audit_log (actor_id, action, entity_type, entity_id, metadata)
  values (v_uid, 'update_report', 'content_report', p_id::text, jsonb_build_object('status', p_status));
  return jsonb_build_object('status', p_status);
end
$$;
revoke all on function public.admin_update_report(uuid, text, text) from public, anon;
grant execute on function public.admin_update_report(uuid, text, text) to authenticated;

-- ---------------------------------------------------------------------------------------------
-- (2) Badge final: diamond hanya untuk anggota biasa dengan Premium berbayar aktif.
--     Entitlement Guru tetap dari role (get_my_membership/is_premium); badge visualnya hanya SENSEI.
-- ---------------------------------------------------------------------------------------------
create or replace function public.social_badges(p_users uuid[])
returns jsonb language plpgsql stable security definer set search_path = ''
as $$
declare v_result jsonb;
begin
  if auth.uid() is null then raise exception 'auth_required'; end if;
  if p_users is null or cardinality(p_users) = 0 then return '{}'::jsonb; end if;
  if cardinality(p_users) > 100 then raise exception 'too_many_users'; end if;
  select coalesce(jsonb_object_agg(b.id::text, jsonb_build_object(
           'verified', b.verified, 'admin', b.admin, 'sensei', b.sensei, 'diamond', b.diamond, 'photo', b.photo)), '{}'::jsonb)
    into v_result
    from (
      select p.id,
             p.role = 'owner' as verified,
             p.role = 'admin' as admin,
             p.role = 'teacher' as sensei,
             (p.role not in ('owner', 'admin', 'teacher')
              and (p.plan = 'lifetime' or (p.plan = 'premium' and (p.premium_until is null or p.premium_until > now())))) as diamond,
             public.social_safe_photo(p.avatar_url) as photo
        from public.profiles p
       where p.id = any (p_users)
    ) b;
  return v_result;
end
$$;

-- ---------------------------------------------------------------------------------------------
-- (3) Cermin nama tampilan (hanya kolom display_name; tidak menyentuh username, ID, XP, relasi, pesan).
-- ---------------------------------------------------------------------------------------------
create or replace function public.social_mirror_display_name()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  -- social_profiles membatasi 1-40 karakter; profil boleh 60: cermin dipotong agar simpan profil tidak pernah gagal.
  update public.social_profiles set display_name = nullif(left(btrim(coalesce(new.display_name, '')), 40), '')
   where user_id = new.id and display_name is distinct from nullif(left(btrim(coalesce(new.display_name, '')), 40), '');
  return new;
end
$$;
revoke all on function public.social_mirror_display_name() from public, anon, authenticated;

create or replace function public.social_profile_default_display_name()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  new.display_name := coalesce(nullif(left(btrim(coalesce((select display_name from public.profiles where id = new.user_id), '')), 40), ''), new.display_name);
  return new;
end
$$;
revoke all on function public.social_profile_default_display_name() from public, anon, authenticated;

do $$
begin
  if not exists (select 1 from pg_trigger where tgname = 'trg_profiles_mirror_display_name' and tgrelid = 'public.profiles'::regclass) then
    create trigger trg_profiles_mirror_display_name after update of display_name on public.profiles
      for each row execute function public.social_mirror_display_name();
  end if;
  if not exists (select 1 from pg_trigger where tgname = 'trg_social_profiles_display_name' and tgrelid = 'public.social_profiles'::regclass) then
    create trigger trg_social_profiles_display_name before insert on public.social_profiles
      for each row execute function public.social_profile_default_display_name();
  end if;
end $$;

-- Sinkron satu kali baris yang sudah ada (hanya kolom display_name; idempoten).
update public.social_profiles s set display_name = nullif(left(btrim(coalesce(p.display_name, '')), 40), '')
  from public.profiles p
 where p.id = s.user_id and s.display_name is distinct from nullif(left(btrim(coalesce(p.display_name, '')), 40), '');
