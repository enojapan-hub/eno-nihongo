-- Admin Operasional v8: integrasi RPC pengumuman/media. Seluruhnya di-rollback (raise exception di akhir).
-- Jalankan: psql -f supabase/tests/admin_ops_flow.sql  -> harus berakhir dengan 'FLOW_OK n checks'.
do $$
declare
  v_owner uuid; v_member uuid; v_n int := 0; v_r jsonb; v_id uuid; v_ok boolean;
begin
  select id into v_owner from public.profiles where role = 'owner' order by created_at limit 1;
  select p.id into v_member from public.profiles p
   where p.role = 'student' order by p.created_at limit 1;
  if v_owner is null or v_member is null then raise exception 'FIXTURE_MISSING'; end if;

  -- helper: jalankan sebagai user / anon
  -- OWNER
  perform set_config('request.jwt.claims', json_build_object('sub', v_owner, 'role', 'authenticated')::text, true);
  set local role authenticated;
  v_r := public.admin_create_announcement('  FLOW_ANN judul  ', 'FLOW_ANN isi', 'premium');
  v_id := (v_r->>'id')::uuid; v_n := v_n + 1;
  if v_id is null then raise exception 'create_failed'; end if;
  v_r := public.admin_list_announcements(50); v_n := v_n + 1;
  if jsonb_typeof(v_r) <> 'array' or not exists (select 1 from jsonb_array_elements(v_r) e where e->>'id' = v_id::text and e->>'status' = 'draft' and e->>'audience' = 'premium' and e->>'title' = 'FLOW_ANN judul') then raise exception 'list_missing_created'; end if;
  v_n := v_n + 1;
  if exists (select 1 from jsonb_array_elements(v_r) e where e ? 'created_by') then raise exception 'unexpected_column'; end if;
  v_n := v_n + 1;
  v_r := public.admin_list_media(10); v_n := v_n + 1;
  if jsonb_typeof(v_r) <> 'array' then raise exception 'media_list_shape'; end if;
  v_n := v_n + 1;
  -- validasi input
  v_ok := false; begin perform public.admin_create_announcement('x', 'y', 'bogus'); exception when others then v_ok := true; end;
  if not v_ok then raise exception 'audience_not_validated'; end if; v_n := v_n + 1;
  v_ok := false; begin perform public.admin_create_announcement('  ', 'y'); exception when others then v_ok := true; end;
  if not v_ok then raise exception 'empty_title_not_validated'; end if; v_n := v_n + 1;
  v_ok := false; begin perform public.admin_create_announcement(repeat('a', 201), 'y'); exception when others then v_ok := true; end;
  if not v_ok then raise exception 'long_title_not_validated'; end if; v_n := v_n + 1;
  -- RPC lama tetap bekerja untuk owner (publish tidak dijalankan: akan memberi notifikasi ke semua pengguna)
  reset role;
  if not exists (select 1 from public.admin_audit_log where actor_id = v_owner and action = 'create_announcement' and entity_id = v_id::text) then raise exception 'audit_missing'; end if;
  v_n := v_n + 1;

  -- MEMBER biasa: semua ditolak
  perform set_config('request.jwt.claims', json_build_object('sub', v_member, 'role', 'authenticated')::text, true);
  set local role authenticated;
  v_ok := false; begin perform public.admin_list_announcements(10); exception when others then v_ok := true; end;
  if not v_ok then raise exception 'member_list_ann_allowed'; end if; v_n := v_n + 1;
  v_ok := false; begin perform public.admin_create_announcement('FLOW_ANN m', 'm'); exception when others then v_ok := true; end;
  if not v_ok then raise exception 'member_create_allowed'; end if; v_n := v_n + 1;
  v_ok := false; begin perform public.admin_list_media(10); exception when others then v_ok := true; end;
  if not v_ok then raise exception 'member_list_media_allowed'; end if; v_n := v_n + 1;
  -- tidak ada akses tabel langsung (draft tidak bocor)
  v_ok := false; begin perform 1 from public.admin_announcements limit 1; exception when insufficient_privilege then v_ok := true; end;
  if not v_ok then raise exception 'member_direct_ann_read'; end if; v_n := v_n + 1;
  v_ok := false; begin perform 1 from public.media_library limit 1; exception when insufficient_privilege then v_ok := true; end;
  if not v_ok then raise exception 'member_direct_media_read'; end if; v_n := v_n + 1;
  reset role;

  -- ANON: execute ditolak
  perform set_config('request.jwt.claims', json_build_object('role', 'anon')::text, true);
  set local role anon;
  v_ok := false; begin perform public.admin_list_announcements(10); exception when insufficient_privilege then v_ok := true; end;
  if not v_ok then raise exception 'anon_list_ann_allowed'; end if; v_n := v_n + 1;
  v_ok := false; begin perform public.admin_create_announcement('a', 'b'); exception when insufficient_privilege then v_ok := true; end;
  if not v_ok then raise exception 'anon_create_allowed'; end if; v_n := v_n + 1;
  v_ok := false; begin perform public.admin_list_media(10); exception when insufficient_privilege then v_ok := true; end;
  if not v_ok then raise exception 'anon_list_media_allowed'; end if; v_n := v_n + 1;
  reset role;

  raise exception 'FLOW_OK % checks', v_n;
end
$$;
