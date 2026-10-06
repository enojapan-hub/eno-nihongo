-- Konsistensi permission Admin Operasional + audience pengumuman (aditif, idempoten, tanpa perubahan RLS/GRANT tabel).
-- (1) publish/delete pengumuman dan admin_log_event memakai gate role lama (editor/admin/owner), sedangkan daftar/simpan
--     pengumuman (v8) dan policy tabel memakai has_permission('operations.manage'). Disamakan ke satu sumber izin.
-- (2) publish_admin_announcement mengirim notifikasi ke SEMUA profil tanpa menghormati kolom audience
--     ('all' | 'premium' | 'teacher'). Penerima kini dipilih server berdasarkan audience:
--       all     -> semua akun aktif
--       premium -> entitlement Premium kanonik (sama dengan get_my_membership: role owner/admin/editor/teacher,
--                  lifetime, atau premium aktif/belum kedaluwarsa); Free/kedaluwarsa tidak termasuk
--       teacher -> role teacher saja
--     Akun disuspend (suspended_at) tidak menerima notifikasi.
-- (3) Idempoten: publish ulang pengumuman yang sudah terbit tidak mengirim notifikasi lagi.
-- Pengumuman lama tidak dipublish ulang; 0 notifikasi pengumuman historis di produksi.

create or replace function public.publish_admin_announcement(p_id uuid)
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  a record;
  v_n integer := 0;
begin
  if v_uid is null or not public.has_permission('operations.manage', null) then raise exception 'forbidden'; end if;
  update public.admin_announcements
     set status = 'published', published_at = now(), updated_at = now()
   where id = p_id and status <> 'published'
  returning id, title, body, audience into a;
  if a.id is null then
    if exists (select 1 from public.admin_announcements where id = p_id) then
      return jsonb_build_object('ok', true, 'already_published', true, 'recipients', 0);
    end if;
    raise exception 'not found';
  end if;
  insert into public.user_notifications (user_id, title, body, kind, created_at)
  select p.id, a.title, a.body, 'announcement', now()
    from public.profiles p
   where p.suspended_at is null
     and (a.audience = 'all'
          or (a.audience = 'premium'
              and (p.role in ('owner', 'admin', 'editor', 'teacher')
                   or p.plan = 'lifetime'
                   or (p.plan = 'premium' and (p.premium_until is null or p.premium_until > now()))))
          or (a.audience = 'teacher' and p.role = 'teacher'));
  get diagnostics v_n = row_count;
  insert into public.admin_audit_log (actor_id, action, entity_type, entity_id, metadata)
  values (v_uid, 'publish', 'announcement', p_id::text, jsonb_build_object('audience', a.audience, 'recipients', v_n));
  return jsonb_build_object('ok', true, 'recipients', v_n);
end
$$;
revoke all on function public.publish_admin_announcement(uuid) from public, anon;
grant execute on function public.publish_admin_announcement(uuid) to authenticated;

create or replace function public.delete_admin_announcement(p_id uuid)
returns void language plpgsql security definer set search_path = ''
as $$
begin
  if auth.uid() is null or not public.has_permission('operations.manage', null) then raise exception 'forbidden'; end if;
  delete from public.admin_announcements where id = p_id;
  insert into public.admin_audit_log (actor_id, action, entity_type, entity_id) values (auth.uid(), 'delete', 'announcement', p_id::text);
end
$$;
revoke all on function public.delete_admin_announcement(uuid) from public, anon;
grant execute on function public.delete_admin_announcement(uuid) to authenticated;

create or replace function public.admin_log_event(p_action text, p_entity_type text, p_entity_id text default null, p_metadata jsonb default '{}'::jsonb)
returns void language plpgsql security definer set search_path = ''
as $$
begin
  if auth.uid() is null or not public.has_permission('operations.manage', null) then raise exception 'forbidden'; end if;
  insert into public.admin_audit_log (actor_id, action, entity_type, entity_id, metadata)
  values (auth.uid(), p_action, p_entity_type, p_entity_id, coalesce(p_metadata, '{}'::jsonb));
end
$$;
revoke all on function public.admin_log_event(text, text, text, jsonb) from public, anon;
grant execute on function public.admin_log_event(text, text, text, jsonb) to authenticated;
