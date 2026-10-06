-- Simpan profil: nama/bio/avatar semua role + keamanan helper. Seluruhnya di-rollback.
-- Jalankan: psql -f supabase/tests/profile_save_flow.sql  -> harus berakhir dengan 'FLOW_OK n checks'.
do $$
declare
  v_owner uuid; v_admin uuid; v_teacher uuid; v_s1 uuid; v_s2 uuid;
  v_n int := 0; v_ok boolean; v_cnt int; v_name text; v_msg text; v_soc text;
begin
  select id into v_owner from public.profiles where role = 'owner' order by created_at limit 1;
  select id into v_admin from public.profiles where role = 'admin' order by created_at limit 1;
  select id into v_teacher from public.profiles where role = 'teacher' order by created_at limit 1;
  select id into v_s1 from public.profiles where role = 'student' order by created_at limit 1;
  select id into v_s2 from public.profiles where role = 'student' and id <> v_s1 order by created_at limit 1;
  if v_owner is null or v_admin is null or v_teacher is null or v_s2 is null then raise exception 'FIXTURE_MISSING'; end if;

  -- A/B: nama sendiri berhasil untuk SEMUA role (sebelumnya student/teacher gagal)
  for v_name, v_cnt in
    select 'owner', 1 union all select 'admin', 2 union all select 'teacher', 3 union all select 'student', 4
  loop
    perform set_config('request.jwt.claims', json_build_object('sub',
      case v_name when 'owner' then v_owner when 'admin' then v_admin when 'teacher' then v_teacher else v_s1 end,
      'role', 'authenticated')::text, true);
    set local role authenticated;
    update public.profiles set display_name = 'Flow Nama ' || v_name
     where id = case v_name when 'owner' then v_owner when 'admin' then v_admin when 'teacher' then v_teacher else v_s1 end;
    get diagnostics v_cnt = row_count;
    reset role;
    if v_cnt <> 1 then raise exception 'own_name_update_failed_%', v_name; end if;
    v_n := v_n + 1;
  end loop;

  -- bio dan avatar sendiri (student)
  perform set_config('request.jwt.claims', json_build_object('sub', v_s1, 'role', 'authenticated')::text, true);
  set local role authenticated;
  update public.profiles set bio = 'flow bio', avatar_url = 'https://example.test/flow.png' where id = v_s1;
  get diagnostics v_cnt = row_count;
  reset role;
  if v_cnt <> 1 then raise exception 'bio_avatar_update_failed'; end if; v_n := v_n + 1;

  -- F: social_profiles.display_name = cermin (<= 40) bila baris sosial ada
  select display_name into v_soc from public.social_profiles where user_id = v_s1;
  if found and v_soc is distinct from 'Flow Nama student' then raise exception 'social_mirror_not_synced'; end if;
  v_n := v_n + 1;
  -- nama 60 karakter tidak gagal; cermin dipotong 40
  perform set_config('request.jwt.claims', json_build_object('sub', v_s1, 'role', 'authenticated')::text, true);
  set local role authenticated;
  update public.profiles set display_name = repeat('n', 60) where id = v_s1;
  reset role;
  select display_name into v_soc from public.social_profiles where user_id = v_s1;
  if found and char_length(v_soc) <> 40 then raise exception 'social_mirror_not_truncated'; end if; v_n := v_n + 1;

  -- G: perlindungan peniruan identitas tetap berlaku untuk non-staf
  foreach v_name in array array['Admin ENO', 'Owner ENO', 'ENO Resmi', 'enonihongo', 'Ｅｎｏ Ｓｔａｆ'] loop
    perform set_config('request.jwt.claims', json_build_object('sub', v_s1, 'role', 'authenticated')::text, true);
    set local role authenticated;
    v_ok := false;
    begin update public.profiles set display_name = v_name where id = v_s1;
    exception when others then v_ok := (sqlerrm = 'Nama tampilan tidak tersedia.'); end;
    reset role;
    if not v_ok then raise exception 'impersonation_allowed_%', v_name; end if;
    v_n := v_n + 1;
  end loop;
  perform set_config('request.jwt.claims', json_build_object('sub', v_teacher, 'role', 'authenticated')::text, true);
  set local role authenticated;
  v_ok := false;
  begin update public.profiles set display_name = 'Staf Resmi ENO' where id = v_teacher;
  exception when others then v_ok := (sqlerrm = 'Nama tampilan tidak tersedia.'); end;
  reset role;
  if not v_ok then raise exception 'teacher_impersonation_allowed'; end if; v_n := v_n + 1;
  -- nama wajar tetap lolos
  perform set_config('request.jwt.claims', json_build_object('sub', v_s1, 'role', 'authenticated')::text, true);
  set local role authenticated;
  update public.profiles set display_name = 'Budi Santoso' where id = v_s1;
  get diagnostics v_cnt = row_count;
  reset role;
  if v_cnt <> 1 then raise exception 'normal_name_blocked'; end if; v_n := v_n + 1;

  -- D: pengguna A tidak dapat mengubah profil B (RLS: 0 baris)
  select display_name into v_name from public.profiles where id = v_s2;
  perform set_config('request.jwt.claims', json_build_object('sub', v_s1, 'role', 'authenticated')::text, true);
  set local role authenticated;
  update public.profiles set display_name = 'Diretas', bio = 'diretas', avatar_url = 'https://evil.test/x.png' where id = v_s2;
  get diagnostics v_cnt = row_count;
  reset role;
  if v_cnt <> 0 then raise exception 'cross_user_update_allowed'; end if;
  if (select display_name from public.profiles where id = v_s2) is distinct from v_name then raise exception 'cross_user_changed'; end if;
  v_n := v_n + 1;

  -- E: anon tidak dapat mengubah profil (0 baris atau ditolak)
  perform set_config('request.jwt.claims', json_build_object('role', 'anon')::text, true);
  set local role anon;
  v_cnt := 0;
  begin update public.profiles set display_name = 'Anon' where id = v_s2; get diagnostics v_cnt = row_count;
  exception when others then v_cnt := 0; end;
  reset role;
  if v_cnt <> 0 or (select display_name from public.profiles where id = v_s2) is distinct from v_name then raise exception 'anon_update_allowed'; end if;
  v_n := v_n + 1;

  -- eskalasi hak tetap diblokir (kolom akses/langganan)
  perform set_config('request.jwt.claims', json_build_object('sub', v_s1, 'role', 'authenticated')::text, true);
  set local role authenticated;
  v_ok := false;
  begin update public.profiles set role = 'owner' where id = v_s1; exception when others then v_ok := true; end;
  if not v_ok then raise exception 'role_escalation_allowed'; end if; v_n := v_n + 1;
  v_ok := false;
  begin update public.profiles set plan = 'lifetime' where id = v_s1; exception when others then v_ok := true; end;
  reset role;
  if not v_ok then raise exception 'plan_escalation_allowed'; end if; v_n := v_n + 1;

  -- H: helper internal tetap tidak dapat dieksekusi klien; fungsi penjaga dikunci
  if has_function_privilege('authenticated', 'public.social_normalize_text(text)', 'execute')
     or has_function_privilege('anon', 'public.social_normalize_text(text)', 'execute') then raise exception 'normalize_exposed'; end if; v_n := v_n + 1;
  if has_function_privilege('authenticated', 'public.profiles_guard_official_name()', 'execute')
     or has_function_privilege('anon', 'public.profiles_guard_official_name()', 'execute') then raise exception 'guard_exposed'; end if; v_n := v_n + 1;
  perform set_config('request.jwt.claims', json_build_object('sub', v_s1, 'role', 'authenticated')::text, true);
  set local role authenticated;
  v_ok := false;
  begin perform public.social_normalize_text('x'); exception when insufficient_privilege then v_ok := true; end;
  reset role;
  if not v_ok then raise exception 'normalize_callable_by_client'; end if; v_n := v_n + 1;

  -- I: tidak ada duplikasi
  if exists (select 1 from public.social_profiles group by user_id having count(*) > 1) then raise exception 'dup_social'; end if; v_n := v_n + 1;
  if exists (select 1 from public.profiles group by id having count(*) > 1) then raise exception 'dup_profiles'; end if; v_n := v_n + 1;

  raise exception 'FLOW_OK % checks', v_n;
end
$$;
