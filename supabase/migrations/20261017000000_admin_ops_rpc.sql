-- Admin Operasional v8 (aditif, idempoten, tanpa perubahan RLS/GRANT tabel).
-- admin_announcements dan media_library punya RLS aktif tetapi TIDAK punya hak tabel untuk klien,
-- sehingga daftar/simpan yang dibaca langsung dari klien selalu ditolak ("permission denied").
-- Diganti RPC minimal dengan izin pusat has_permission('operations.manage') (sama dengan policy tabel,
-- admin_register_media, dan policy storage admin-media). Publish/hapus pengumuman dan register/hapus media
-- tidak diubah. Bucket/policy storage tidak diubah (pengiriman file publik tetap).

create or replace function public.admin_list_announcements(p_limit integer default 100)
returns jsonb language plpgsql stable security definer set search_path = ''
as $$
begin
  if auth.uid() is null or not public.has_permission('operations.manage', null) then raise exception 'forbidden'; end if;
  return coalesce((
    select jsonb_agg(x order by (x->>'created_at') desc)
    from (
      select jsonb_build_object(
        'id', a.id, 'title', a.title, 'body', a.body, 'status', a.status, 'audience', a.audience,
        'published_at', a.published_at, 'scheduled_at', a.scheduled_at, 'expires_at', a.expires_at,
        'created_at', a.created_at) as x
      from public.admin_announcements a
      order by a.created_at desc
      limit least(greatest(coalesce(p_limit, 100), 1), 200)
    ) t), '[]'::jsonb);
end
$$;
revoke all on function public.admin_list_announcements(integer) from public, anon;
grant execute on function public.admin_list_announcements(integer) to authenticated;

create or replace function public.admin_create_announcement(p_title text, p_body text, p_audience text default 'all')
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare
  v_title text := btrim(coalesce(p_title, ''));
  v_body text := btrim(coalesce(p_body, ''));
  v_aud text := coalesce(nullif(btrim(coalesce(p_audience, '')), ''), 'all');
  v_id uuid;
begin
  if auth.uid() is null or not public.has_permission('operations.manage', null) then raise exception 'forbidden'; end if;
  if v_title = '' or v_body = '' then raise exception 'title and body required'; end if;
  if char_length(v_title) > 200 or char_length(v_body) > 5000 then raise exception 'text too long'; end if;
  if v_aud not in ('all', 'premium', 'teacher') then raise exception 'invalid audience'; end if;
  insert into public.admin_announcements (title, body, status, audience, created_by)
  values (v_title, v_body, 'draft', v_aud, auth.uid()) returning id into v_id;
  insert into public.admin_audit_log (actor_id, action, entity_type, entity_id, metadata)
  values (auth.uid(), 'create_announcement', 'announcement', v_id::text, jsonb_build_object('title', v_title, 'audience', v_aud));
  return jsonb_build_object('id', v_id);
end
$$;
revoke all on function public.admin_create_announcement(text, text, text) from public, anon;
grant execute on function public.admin_create_announcement(text, text, text) to authenticated;

create or replace function public.admin_list_media(p_limit integer default 500)
returns jsonb language plpgsql stable security definer set search_path = ''
as $$
begin
  if auth.uid() is null or not public.has_permission('operations.manage', null) then raise exception 'forbidden'; end if;
  return coalesce((
    select jsonb_agg(x order by (x->>'created_at') desc)
    from (
      select jsonb_build_object(
        'id', m.id, 'title', m.title, 'url', m.url, 'media_type', m.media_type,
        'mime_type', m.mime_type, 'created_at', m.created_at) as x
      from public.media_library m
      order by m.created_at desc
      limit least(greatest(coalesce(p_limit, 500), 1), 500)
    ) t), '[]'::jsonb);
end
$$;
revoke all on function public.admin_list_media(integer) from public, anon;
grant execute on function public.admin_list_media(integer) to authenticated;
