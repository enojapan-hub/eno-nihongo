-- Admin Operasional v9: izin operations.manage + audience pengumuman. Seluruhnya di-rollback.
-- Jalankan: psql -f supabase/tests/admin_announcement_flow.sql  -> harus berakhir dengan 'FLOW_OK n checks'.
do $$
declare
  v_owner uuid; v_admin uuid; v_teacher uuid; v_sa uuid; v_sx uuid; v_sf uuid; v_ss uuid;
  v_a_all uuid; v_a_prem uuid; v_a_teach uuid; v_a_pub uuid; v_a_del uuid;
  v_n int := 0; v_r jsonb; v_ok boolean; v_cnt int; v_exp int;
begin
  select id into v_owner from public.profiles where role = 'owner' order by created_at limit 1;
  select id into v_admin from public.profiles where role = 'admin' order by created_at limit 1;
  select id into v_teacher from public.profiles where role = 'teacher' order by created_at limit 1;
  select id into v_sa from public.profiles where role = 'student' order by created_at limit 1;
  select id into v_sx from public.profiles where role = 'student' and id <> v_sa order by created_at limit 1;
  select id into v_sf from public.profiles where role = 'student' and id not in (v_sa, v_sx) order by created_at limit 1;
  select id into v_ss from public.profiles where role = 'student' and id not in (v_sa, v_sx, v_sf) order by created_at limit 1;
  if v_owner is null or v_admin is null or v_teacher is null or v_ss is null then raise exception 'FIXTURE_MISSING'; end if;

  -- fixture entitlement (dalam transaksi, di-rollback): aktif, kedaluwarsa, free, disuspend
  update public.profiles set plan = 'premium', premium_until = now() + interval '30 days' where id = v_sa;
  update public.profiles set plan = 'premium', premium_until = now() - interval '1 day' where id = v_sx;
  update public.profiles set plan = 'free', premium_until = null where id = v_sf;
  update public.profiles set suspended_at = now() where id = v_ss;

  insert into public.admin_announcements (title, body, status, audience) values ('FLOW_PUB_ALL', 'b', 'draft', 'all') returning id into v_a_all;
  insert into public.admin_announcements (title, body, status, audience) values ('FLOW_PUB_PREM', 'b', 'draft', 'premium') returning id into v_a_prem;
  insert into public.admin_announcements (title, body, status, audience) values ('FLOW_PUB_TEACH', 'b', 'draft', 'teacher') returning id into v_a_teach;
  insert into public.admin_announcements (title, body, status, audience, published_at) values ('FLOW_PUB_OLD', 'b', 'published', 'all', now()) returning id into v_a_pub;
  insert into public.admin_announcements (title, body, status, audience) values ('FLOW_PUB_DEL', 'b', 'draft', 'all') returning id into v_a_del;

  -- ANON ditolak
  perform set_config('request.jwt.claims', json_build_object('role', 'anon')::text, true);
  set local role anon;
  v_ok := false; begin perform public.publish_admin_announcement(v_a_teach); exception when insufficient_privilege then v_ok := true; end;
  if not v_ok then raise exception 'anon_publish_allowed'; end if; v_n := v_n + 1;
  v_ok := false; begin perform public.admin_log_event('x', 'y'); exception when insufficient_privilege then v_ok := true; end;
  if not v_ok then raise exception 'anon_log_allowed'; end if; v_n := v_n + 1;
  v_ok := false; begin perform public.delete_admin_announcement(v_a_del); exception when insufficient_privilege then v_ok := true; end;
  if not v_ok then raise exception 'anon_delete_allowed'; end if; v_n := v_n + 1;
  reset role;

  -- MEMBER dan GURU (tanpa operations.manage) ditolak, tanpa mutasi
  perform set_config('request.jwt.claims', json_build_object('sub', v_sa, 'role', 'authenticated')::text, true);
  set local role authenticated;
  v_ok := false; begin perform public.publish_admin_announcement(v_a_teach); exception when others then v_ok := true; end;
  if not v_ok then raise exception 'member_publish_allowed'; end if; v_n := v_n + 1;
  v_ok := false; begin perform public.admin_log_event('x', 'y'); exception when others then v_ok := true; end;
  if not v_ok then raise exception 'member_log_allowed'; end if; v_n := v_n + 1;
  v_ok := false; begin perform public.delete_admin_announcement(v_a_del); exception when others then v_ok := true; end;
  if not v_ok then raise exception 'member_delete_allowed'; end if; v_n := v_n + 1;
  reset role;
  perform set_config('request.jwt.claims', json_build_object('sub', v_teacher, 'role', 'authenticated')::text, true);
  set local role authenticated;
  v_ok := false; begin perform public.publish_admin_announcement(v_a_teach); exception when others then v_ok := true; end;
  if not v_ok then raise exception 'teacher_publish_allowed'; end if; v_n := v_n + 1;
  reset role;
  if (select status from public.admin_announcements where id = v_a_teach) <> 'draft'
     or exists (select 1 from public.user_notifications where title like 'FLOW_PUB_%')
     or not exists (select 1 from public.admin_announcements where id = v_a_del) then raise exception 'unauthorized_mutation'; end if;
  v_n := v_n + 1;

  -- OWNER: audience teacher -> hanya guru
  perform set_config('request.jwt.claims', json_build_object('sub', v_owner, 'role', 'authenticated')::text, true);
  set local role authenticated;
  v_r := public.publish_admin_announcement(v_a_teach);
  reset role;
  select count(*) into v_exp from public.profiles where role = 'teacher' and suspended_at is null;
  if (v_r->>'recipients')::int <> v_exp or v_exp = 0 then raise exception 'teacher_recipient_count'; end if; v_n := v_n + 1;
  if exists (select 1 from public.user_notifications n join public.profiles p on p.id = n.user_id where n.title = 'FLOW_PUB_TEACH' and p.role <> 'teacher')
     or (select count(*) from public.user_notifications where title = 'FLOW_PUB_TEACH' and kind = 'announcement') <> v_exp then raise exception 'teacher_audience_leak'; end if;
  v_n := v_n + 1;

  -- audience premium: aktif + guru + staf; kedaluwarsa dan free tidak
  perform set_config('request.jwt.claims', json_build_object('sub', v_admin, 'role', 'authenticated')::text, true);
  set local role authenticated;
  v_r := public.publish_admin_announcement(v_a_prem);
  reset role;
  if not exists (select 1 from public.user_notifications where title = 'FLOW_PUB_PREM' and user_id = v_sa) then raise exception 'premium_active_missing'; end if; v_n := v_n + 1;
  if exists (select 1 from public.user_notifications where title = 'FLOW_PUB_PREM' and user_id in (v_sx, v_sf, v_ss)) then raise exception 'premium_audience_leak'; end if; v_n := v_n + 1;
  if not exists (select 1 from public.user_notifications where title = 'FLOW_PUB_PREM' and user_id = v_teacher)
     or not exists (select 1 from public.user_notifications where title = 'FLOW_PUB_PREM' and user_id = v_owner) then raise exception 'premium_staff_missing'; end if; v_n := v_n + 1;
  select count(*) into v_exp from public.profiles p where p.suspended_at is null
     and (p.role in ('owner','admin','editor','teacher') or p.plan = 'lifetime' or (p.plan = 'premium' and (p.premium_until is null or p.premium_until > now())));
  if (v_r->>'recipients')::int <> v_exp then raise exception 'premium_recipient_count'; end if; v_n := v_n + 1;

  -- audience all: semua akun aktif (suspended tidak)
  perform set_config('request.jwt.claims', json_build_object('sub', v_owner, 'role', 'authenticated')::text, true);
  set local role authenticated;
  v_r := public.publish_admin_announcement(v_a_all);
  reset role;
  select count(*) into v_exp from public.profiles where suspended_at is null;
  if (v_r->>'recipients')::int <> v_exp then raise exception 'all_recipient_count'; end if; v_n := v_n + 1;
  if exists (select 1 from public.user_notifications where title = 'FLOW_PUB_ALL' and user_id = v_ss) then raise exception 'suspended_notified'; end if; v_n := v_n + 1;

  -- duplikat nol + idempoten (publish ulang tidak menambah notifikasi)
  if exists (select 1 from public.user_notifications where title like 'FLOW_PUB_%' group by user_id, title having count(*) > 1) then raise exception 'duplicate_notification'; end if; v_n := v_n + 1;
  select count(*) into v_cnt from public.user_notifications where title like 'FLOW_PUB_%';
  perform set_config('request.jwt.claims', json_build_object('sub', v_owner, 'role', 'authenticated')::text, true);
  set local role authenticated;
  v_r := public.publish_admin_announcement(v_a_all);
  if coalesce((v_r->>'already_published')::boolean, false) is not true then raise exception 'not_idempotent'; end if; v_n := v_n + 1;
  v_r := public.publish_admin_announcement(v_a_pub);
  if coalesce((v_r->>'already_published')::boolean, false) is not true then raise exception 'historical_republished'; end if; v_n := v_n + 1;
  v_ok := false; begin perform public.publish_admin_announcement(gen_random_uuid()); exception when others then v_ok := true; end;
  if not v_ok then raise exception 'unknown_id_not_rejected'; end if; v_n := v_n + 1;
  reset role;
  if (select count(*) from public.user_notifications where title like 'FLOW_PUB_%') <> v_cnt then raise exception 'republish_added_notifications'; end if; v_n := v_n + 1;

  -- audit publish + admin_log_event + delete oleh yang berwenang
  if not exists (select 1 from public.admin_audit_log where actor_id = v_admin and action = 'publish' and entity_id = v_a_prem::text and (metadata->>'audience') = 'premium') then raise exception 'publish_audit_missing'; end if; v_n := v_n + 1;
  perform set_config('request.jwt.claims', json_build_object('sub', v_admin, 'role', 'authenticated')::text, true);
  set local role authenticated;
  perform public.admin_log_event('flow_event', 'announcement', v_a_del::text, '{"k":1}'::jsonb);
  perform public.delete_admin_announcement(v_a_del);
  reset role;
  if not exists (select 1 from public.admin_audit_log where actor_id = v_admin and action = 'flow_event') then raise exception 'log_event_missing'; end if; v_n := v_n + 1;
  if exists (select 1 from public.admin_announcements where id = v_a_del) then raise exception 'delete_failed'; end if; v_n := v_n + 1;

  raise exception 'FLOW_OK % checks', v_n;
end
$$;
