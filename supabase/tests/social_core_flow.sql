-- Integration flow sosial inti (v4 + v5). Berjalan dalam SATU transaksi yang SELALU di-rollback
-- (RAISE EXCEPTION di akhir), sehingga tidak meninggalkan data. Jalankan: psql / execute_sql.
-- Hasil: galat "FLOW_OK {...}" bila semua pemeriksaan lulus, "FLOW_FAIL [...]" bila ada yang gagal.
-- Cakupan (v4-v6): username wajib (akun baru/lama tanpa username/OAuth = RPC yang sama, tanpa cooldown awal,
-- ditolak: duplikat/reserved/invalid/tiruan resmi) → auto-friend Owner → leaderboard → perlindungan
-- Owner/Admin (block/report) → capabilities kartu → DM Owner tanpa batas, Admin/member tidak →
-- client_id/efektif-kosong/link → hapus percakapan per-pengguna + pemulihan + unread → suspend sosial
-- → antrean moderasi + audit → slow mode/pin/edit → Guru Premium efektif → data belajar utuh.

create or replace function pg_temp.as_user(u uuid, q text) returns text language plpgsql as $$
declare r text;
begin
  perform set_config('request.jwt.claims', json_build_object('sub', u, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  begin execute q; r := 'ok'; exception when others then r := sqlerrm; end;
  execute 'reset role';
  return r;
end $$;

create or replace function pg_temp.q_user(u uuid, q text) returns jsonb language plpgsql as $$
declare v jsonb;
begin
  perform set_config('request.jwt.claims', json_build_object('sub', u, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  begin execute q into v; exception when others then v := jsonb_build_object('error', sqlerrm); end;
  execute 'reset role';
  return v;
end $$;

do $$
declare
  o uuid;
  a uuid := gen_random_uuid(); c uuid := gen_random_uuid(); t uuid := gen_random_uuid();
  b uuid := gen_random_uuid(); d uuid := gen_random_uuid(); x uuid := gen_random_uuid();
  r jsonb; r2 jsonb; chk jsonb := '{}'::jsonb; failed text[] := '{}'; k text;
  n1 int; n2 int; msgs_before int; xp_before int; xp_after int; v_msg uuid; v_gm uuid; v_conv_msgs int; v_report uuid;
begin
  select id into o from public.profiles where role = 'owner' limit 1;
  if o is null then raise exception 'FLOW_FAIL no owner'; end if;

  insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
  select '00000000-0000-0000-0000-000000000000', u.id, 'authenticated', 'authenticated', 'flow.' || u.n || '@example.invalid', '', now(), '{}'::jsonb, '{}'::jsonb, now(), now()
    from (values (a, 'a'), (c, 'c'), (t, 't'), (b, 'b'), (d, 'd'), (x, 'x')) as u(id, n);
  update public.profiles set role = 'teacher' where id = t;
  update public.profiles set role = 'admin' where id = d;
  update public.profiles set plan = 'premium', premium_until = now() + interval '30 days' where id = b;
  select xp into xp_before from public.user_learning_stats where user_id = a;

  -- A) Username wajib: akun tanpa username ditolak untuk fitur sosial, tetapi bisa belajar (profil ada)
  r := pg_temp.q_user(x, 'select public.social_me()');
  chk := chk || jsonb_build_object('old_account_has_username_false', (r->>'has_username')::boolean = false);
  chk := chk || jsonb_build_object('no_username_cannot_send', pg_temp.as_user(x, $q$select public.global_send_message('halo', null)$q$) = 'username_required');
  -- format/reserved/tiruan resmi ditolak server
  chk := chk || jsonb_build_object('invalid_rejected', pg_temp.as_user(a, $q$select public.social_set_username('ab', null)$q$) = 'invalid_username');
  chk := chk || jsonb_build_object('reserved_rejected', pg_temp.as_user(a, $q$select public.social_set_username('admin', null)$q$) = 'username_reserved');
  chk := chk || jsonb_build_object('lookalike_leet_rejected', pg_temp.as_user(a, $q$select public.social_set_username('3n0_n1h0ngo', null)$q$) = 'username_reserved');
  chk := chk || jsonb_build_object('lookalike_admin_eno_rejected', pg_temp.as_user(a, $q$select public.social_set_username('admin_eno', null)$q$) = 'username_reserved');
  chk := chk || jsonb_build_object('lookalike_display_rejected', pg_temp.as_user(a, $q$select public.social_set_username('flow_a', 'Official ENO')$q$) = 'username_reserved');
  chk := chk || jsonb_build_object('normal_name_ok', not public.social_official_lookalike('sakura_01') and not public.social_official_lookalike('eno_fan'));
  -- pengaturan awal sukses (tanpa cooldown) dan tidak membuat username kedua
  chk := chk || jsonb_build_object('initial_ok', pg_temp.as_user(a, $q$select public.social_set_username('flow_a', null)$q$) = 'ok');
  chk := chk || jsonb_build_object('second_set_rejected', pg_temp.as_user(a, $q$select public.social_set_username('flow_a2', null)$q$) = 'username_already_set');
  perform pg_temp.as_user(c, $q$select public.social_set_username('flow_c', null)$q$);
  perform pg_temp.as_user(t, $q$select public.social_set_username('flow_t', null)$q$);
  perform pg_temp.as_user(b, $q$select public.social_set_username('flow_b', null)$q$);
  perform pg_temp.as_user(d, $q$select public.social_set_username('adminenonihongo', null)$q$);
  chk := chk || jsonb_build_object('admin_may_use_official_name', (select username from public.social_profiles where user_id = d) = 'adminenonihongo');
  chk := chk || jsonb_build_object('duplicate_rejected', pg_temp.as_user(x, $q$select public.social_set_username('flow_c', null)$q$) = 'username_taken');
  chk := chk || jsonb_build_object('first_change_no_cooldown', pg_temp.as_user(c, $q$select public.social_change_username('flow_c2')$q$) = 'ok');
  chk := chk || jsonb_build_object('second_change_cooldown', pg_temp.as_user(c, $q$select public.social_change_username('flow_c3')$q$) = 'username_cooldown');
  chk := chk || jsonb_build_object('me_after_set', (pg_temp.q_user(a, 'select public.social_me()')->>'has_username')::boolean);

  -- B) Owner: auto-friend, tidak di Leaderboard
  chk := chk || jsonb_build_object('owner_autofriend_a', exists (select 1 from public.social_friendships where status = 'accepted' and user_low = least(o, a) and user_high = greatest(o, a)));
  chk := chk || jsonb_build_object('no_pending_for_a', (select count(*) from public.social_friendships where status = 'pending' and a in (user_low, user_high)) = 0);
  select count(*) into n1 from public.get_leaderboard(100) where user_id = o;
  select count(*) into n2 from public.get_competition_leaderboard('weekly', 100) where user_id = o;
  chk := chk || jsonb_build_object('owner_not_in_leaderboard', n1 = 0 and n2 = 0);
  chk := chk || jsonb_build_object('rank_no_gaps', (select count(*) from (select rank, row_number() over (order by rank) rn from public.get_leaderboard(100)) q where rank <> rn) = 0);

  -- C) Perlindungan Owner/Admin
  chk := chk || jsonb_build_object('block_owner_rejected', pg_temp.as_user(a, format('select public.social_block(%L)', o)) = 'protected_target');
  chk := chk || jsonb_build_object('block_admin_rejected', pg_temp.as_user(a, format('select public.social_block(%L)', d)) = 'protected_target');
  chk := chk || jsonb_build_object('report_owner_rejected', pg_temp.as_user(a, format('select public.social_report_user(%L, null)', o)) = 'protected_target');
  chk := chk || jsonb_build_object('report_admin_direct_rejected', pg_temp.as_user(a, format($q$select public.social_report_submit('user', %L, 'spam', null)$q$, d)) = 'protected_target');
  chk := chk || jsonb_build_object('unfriend_owner_rejected', pg_temp.as_user(a, format('select public.friend_remove(%L)', o)) = 'owner_friendship_locked');
  chk := chk || jsonb_build_object('block_member_ok', pg_temp.as_user(a, format('select public.social_block(%L)', c)) = 'ok');
  perform pg_temp.as_user(a, format('select public.social_unblock(%L)', c));
  chk := chk || jsonb_build_object('invalid_category_rejected', pg_temp.as_user(a, format($q$select public.social_report_submit('user', %L, 'xyz', null)$q$, c)) = 'invalid_category');
  chk := chk || jsonb_build_object('report_member_ok', pg_temp.as_user(a, format($q$select public.social_report_submit('user', %L, 'spam', 'iklan')$q$, c)) = 'ok');
  chk := chk || jsonb_build_object('report_category_stored', exists (select 1 from public.content_reports where reporter_id = a and chat_category = 'spam' and target_user_id = c));
  chk := chk || jsonb_build_object('active_blocks_on_staff_zero', (select count(*) from public.social_blocks b2 join public.profiles p on p.id = b2.blocked_id where p.role in ('owner', 'admin')) = 0);

  -- D) Capabilities Profile Card dari server
  r := pg_temp.q_user(a, format('select public.social_profile_card(%L)', o));
  chk := chk || jsonb_build_object('owner_card_caps', (r->>'role') = 'owner' and (r->'capabilities'->>'can_message')::boolean and not (r->'capabilities'->>'can_friend')::boolean
        and not (r->'capabilities'->>'can_unfriend')::boolean and not (r->'capabilities'->>'can_block')::boolean and not (r->'capabilities'->>'can_report')::boolean);
  chk := chk || jsonb_build_object('owner_card_no_xp', (r->'xp') = 'null'::jsonb and (r->'level') = 'null'::jsonb);
  r := pg_temp.q_user(a, format('select public.social_profile_card(%L)', d));
  chk := chk || jsonb_build_object('admin_card_caps', (r->>'role') = 'admin' and not (r->'capabilities'->>'can_block')::boolean and not (r->'capabilities'->>'can_report')::boolean
        and (r->'capabilities'->>'can_friend')::boolean and not (r->'capabilities'->>'can_message')::boolean);
  r := pg_temp.q_user(a, format('select public.social_profile_card(%L)', t));
  chk := chk || jsonb_build_object('sensei_card', (r->>'role') = 'teacher' and (r->>'premium')::boolean);
  r := pg_temp.q_user(a, format('select public.social_profile_card(%L)', c));
  chk := chk || jsonb_build_object('free_card', (r->>'role') is null and not (r->>'premium')::boolean and (r->'capabilities'->>'can_block')::boolean and (r->'capabilities'->>'can_report')::boolean);
  r := pg_temp.q_user(a, format('select public.social_profile_card(%L)', b));
  chk := chk || jsonb_build_object('premium_card', (r->>'role') is null and (r->>'premium')::boolean);

  -- E) DM: Owner tanpa batas; Admin dan member biasa tetap mengikuti kebijakan
  perform pg_temp.as_user(c, $q$select public.social_update_settings(null, null, null, null, 'none')$q$);
  chk := chk || jsonb_build_object('owner_dm_policy_none_ok', pg_temp.as_user(o, format($q$select public.dm_send_message(%L, 'halo dari owner', null, %L)$q$, c, gen_random_uuid())) = 'ok');
  chk := chk || jsonb_build_object('owner_card_can_message_nonfriend', (pg_temp.q_user(o, format('select public.social_profile_card(%L)', c))->'capabilities'->>'can_message')::boolean);
  chk := chk || jsonb_build_object('admin_dm_no_bypass', pg_temp.as_user(d, format($q$select public.dm_send_message(%L, 'halo', null, null)$q$, c)) in ('not_friends', 'dm_disabled'));
  chk := chk || jsonb_build_object('member_dm_non_friend_rejected', pg_temp.as_user(a, format($q$select public.dm_send_message(%L, 'halo', null, null)$q$, c)) = 'not_friends');
  chk := chk || jsonb_build_object('owner_dm_no_username_target_rejected', pg_temp.as_user(o, format($q$select public.dm_send_message(%L, 'halo', null, null)$q$, x)) = 'user_unavailable');
  update public.profiles set suspended_at = now() where id = x;
  chk := chk || jsonb_build_object('owner_dm_suspended_rejected', pg_temp.as_user(o, format($q$select public.dm_send_message(%L, 'halo', null, null)$q$, x)) = 'user_unavailable');
  update public.profiles set suspended_at = null where id = x;
  perform pg_temp.as_user(c, $q$select public.social_update_settings(null, null, null, null, 'friends')$q$);

  -- F) Idempotensi, pesan efektif-kosong, link
  declare cid uuid := gen_random_uuid(); r1 jsonb; r3 jsonb;
  begin
    r1 := pg_temp.q_user(a, format($q$select public.dm_send_message(%L, 'pesan idempoten', null, %L)$q$, o, cid));
    r3 := pg_temp.q_user(a, format($q$select public.dm_send_message(%L, 'pesan idempoten', null, %L)$q$, o, cid));
    chk := chk || jsonb_build_object('idempotent', (r1->>'id') = (r3->>'id') and (r3->>'duplicate')::boolean,
      'single_stored', (select count(*) from public.dm_messages where sender_id = a and client_id = cid) = 1);
  end;
  chk := chk || jsonb_build_object('zero_width_empty_rejected', pg_temp.as_user(a, format($q$select public.dm_send_message(%L, %L, null, null)$q$, o, E'​ ⁠')) = 'message_empty');
  chk := chk || jsonb_build_object('japanese_ok', pg_temp.as_user(a, format($q$select public.dm_send_message(%L, 'こんにちは、先生。元気ですか?', null, null)$q$, o)) = 'ok');
  chk := chk || jsonb_build_object('duplicate_message_rejected', pg_temp.as_user(a, format($q$select public.dm_send_message(%L, 'PESAAN Idempoten', null, null)$q$, o)) = 'duplicate_message');
  chk := chk || jsonb_build_object('free_dm_link', pg_temp.as_user(a, format($q$select public.dm_send_message(%L, 'lihat https://contoh.com ya', null, null)$q$, o)) = 'link_not_allowed');
  chk := chk || jsonb_build_object('member_link_fullwidth_rejected', pg_temp.as_user(a, format($q$select public.dm_send_message(%L, 'lihat contohｃｏｍ atau example．com', null, null)$q$, o)) = 'link_not_allowed');
  chk := chk || jsonb_build_object('owner_link_ok', pg_temp.as_user(o, format($q$select public.dm_send_message(%L, 'info: https://enonihongo.com', null, null)$q$, a)) = 'ok');
  chk := chk || jsonb_build_object('teacher_link_ok', pg_temp.as_user(t, format($q$select public.dm_send_message(%L, 'materi: https://contoh.com', null, null)$q$, o)) = 'ok');
  chk := chk || jsonb_build_object('too_long_rejected', pg_temp.as_user(a, format($q$select public.dm_send_message(%L, repeat('a', 1001), null, null)$q$, o)) = 'message_too_long');
  chk := chk || jsonb_build_object('no_duplicate_client_id', (select count(*) from (select sender_id, client_id from public.dm_messages where client_id is not null group by 1, 2 having count(*) > 1) q) = 0);

  -- G) Hapus percakapan per-pengguna, pemulihan oleh pesan baru, tanpa unread hantu
  chk := chk || jsonb_build_object('owner_unread_dm', (pg_temp.q_user(o, 'select public.social_unread_summary()')->>'dm')::int >= 1);
  select count(*) into v_conv_msgs from public.dm_messages m join public.dm_conversations cv on cv.id = m.conversation_id
   where cv.user_low = least(a, o) and cv.user_high = greatest(a, o);
  chk := chk || jsonb_build_object('conv_visible_before', jsonb_array_length(pg_temp.q_user(a, 'select public.dm_conversation_list()')) >= 1);
  chk := chk || jsonb_build_object('hide_ok', pg_temp.as_user(a, format('select public.dm_conversation_hide(%L)', o)) = 'ok');
  chk := chk || jsonb_build_object('no_stale_dm_notification', (select count(*) from public.user_notifications where user_id = a and kind = 'dm' and read_at is null and action_url = 'chat:dm:' || o::text) = 0);
  chk := chk || jsonb_build_object('hidden_for_a', not exists (select 1 from jsonb_array_elements(pg_temp.q_user(a, 'select public.dm_conversation_list()')) e where e->>'user_id' = o::text));
  chk := chk || jsonb_build_object('visible_for_owner', exists (select 1 from jsonb_array_elements(pg_temp.q_user(o, 'select public.dm_conversation_list()')) e where e->>'user_id' = a::text));
  chk := chk || jsonb_build_object('no_phantom_unread', (pg_temp.q_user(a, 'select public.social_unread_summary()')->>'dm')::int = 0);
  chk := chk || jsonb_build_object('shared_data_intact', (select count(*) from public.dm_messages m join public.dm_conversations cv on cv.id = m.conversation_id
        where cv.user_low = least(a, o) and cv.user_high = greatest(a, o)) = v_conv_msgs);
  chk := chk || jsonb_build_object('hide_only_own_state', (select count(*) from public.dm_conversation_hidden where conversation_id in (select id from public.dm_conversations where user_low = least(a, o) and user_high = greatest(a, o))) = 1);
  chk := chk || jsonb_build_object('hide_nonexistent_rejected', pg_temp.as_user(a, format('select public.dm_conversation_hide(%L)', b)) = 'not_found');
  perform pg_temp.as_user(o, format($q$select public.dm_send_message(%L, 'pesan baru setelah dihapus', null, null)$q$, a));
  r := pg_temp.q_user(a, 'select public.dm_conversation_list()');
  chk := chk || jsonb_build_object('restored_on_new_message', exists (select 1 from jsonb_array_elements(r) e where e->>'user_id' = o::text and (e->>'unread')::int = 1));
  chk := chk || jsonb_build_object('history_after_hide_only', jsonb_array_length(pg_temp.q_user(a, format('select public.dm_history(%L)', o))) = 1);

  -- H) Suspend sosial + antrean moderasi + audit
  chk := chk || jsonb_build_object('member_cannot_suspend', pg_temp.as_user(a, format('select public.social_admin_suspend(%L, true, null)', c)) = 'forbidden');
  chk := chk || jsonb_build_object('cannot_suspend_admin', pg_temp.as_user(o, format('select public.social_admin_suspend(%L, true, null)', d)) = 'protected_target');
  chk := chk || jsonb_build_object('suspend_ok', pg_temp.as_user(o, format($q$select public.social_admin_suspend(%L, true, 'spam')$q$, b)) = 'ok');
  chk := chk || jsonb_build_object('suspended_global_rejected', pg_temp.as_user(b, $q$select public.global_send_message('halo semua', null)$q$) = 'social_suspended');
  chk := chk || jsonb_build_object('suspended_dm_rejected', pg_temp.as_user(b, format($q$select public.dm_send_message(%L, 'halo', null, null)$q$, o)) = 'social_suspended');
  chk := chk || jsonb_build_object('suspended_request_rejected', pg_temp.as_user(b, $q$select public.friend_request_send('flow_c')$q$) = 'social_suspended');
  chk := chk || jsonb_build_object('suspended_me_flag', (pg_temp.q_user(b, 'select public.social_me()')->>'social_suspended')::boolean);
  chk := chk || jsonb_build_object('suspended_can_still_learn', exists (select 1 from public.profiles where id = b and suspended_at is null));
  chk := chk || jsonb_build_object('unsuspend_ok', pg_temp.as_user(d, format('select public.social_admin_suspend(%L, false, null)', b)) = 'ok');
  chk := chk || jsonb_build_object('unsuspended_send_ok', pg_temp.as_user(b, $q$select public.global_send_message('halo lagi', null)$q$) = 'ok');
  r := pg_temp.q_user(o, $q$select public.social_admin_reports('open', 20)$q$);
  chk := chk || jsonb_build_object('queue_has_report', jsonb_array_length(r) >= 1 and (r->0->>'category') is not null);
  chk := chk || jsonb_build_object('queue_forbidden_for_member', (pg_temp.q_user(a, $q$select public.social_admin_reports('open', 20)$q$)->>'error') = 'forbidden');
  select id into v_report from public.content_reports where reporter_id = a and chat_category = 'spam' limit 1;
  chk := chk || jsonb_build_object('resolve_suspend_ok', pg_temp.as_user(o, format($q$select public.social_admin_report_resolve(%L, 'suspend', 'terbukti')$q$, v_report)) = 'ok');
  chk := chk || jsonb_build_object('resolve_effect', (select status from public.content_reports where id = v_report) = 'resolved'
        and exists (select 1 from public.social_settings where user_id = c and social_suspended_at is not null));
  perform pg_temp.as_user(o, format('select public.social_admin_suspend(%L, false, null)', c));

  -- I) Slow mode, pin, edit pesan
  chk := chk || jsonb_build_object('slow_forbidden_member', pg_temp.as_user(a, $q$select public.global_set_slow_mode(5)$q$) = 'forbidden');
  chk := chk || jsonb_build_object('slow_invalid_rejected', pg_temp.as_user(o, $q$select public.global_set_slow_mode(7)$q$) = 'invalid_setting');
  perform pg_temp.as_user(o, $q$select public.global_set_slow_mode(30)$q$);
  chk := chk || jsonb_build_object('slow_first_ok', pg_temp.as_user(a, $q$select public.global_send_message('pesan satu', null)$q$) = 'ok');
  chk := chk || jsonb_build_object('slow_second_rejected', pg_temp.as_user(a, $q$select public.global_send_message('pesan dua yang berbeda', null)$q$) = 'slow_mode');
  chk := chk || jsonb_build_object('owner_exempt_from_slow', pg_temp.as_user(o, $q$select public.global_send_message('owner 1', null)$q$) = 'ok'
        and pg_temp.as_user(o, $q$select public.global_send_message('owner 2 beda', null)$q$) = 'ok');
  perform pg_temp.as_user(o, $q$select public.global_set_slow_mode(0)$q$);
  chk := chk || jsonb_build_object('pin_forbidden_member', pg_temp.as_user(a, $q$select public.global_set_pin('promo')$q$) = 'forbidden');
  perform pg_temp.as_user(o, $q$select public.global_set_pin('Selamat datang di ENO NIHONGO')$q$);
  chk := chk || jsonb_build_object('pin_set', (pg_temp.q_user(a, 'select public.global_config()')->'pinned'->>'text') = 'Selamat datang di ENO NIHONGO');
  perform pg_temp.as_user(o, $q$select public.global_set_pin('')$q$);
  chk := chk || jsonb_build_object('pin_cleared', (pg_temp.q_user(a, 'select public.global_config()')->'pinned') = 'null'::jsonb);
  select id into v_gm from public.global_messages where sender_id = a order by created_at desc limit 1;
  chk := chk || jsonb_build_object('edit_call_ok', pg_temp.as_user(a, format($q$select public.global_edit_message(%L, 'pesan satu (revisi)')$q$, v_gm)) = 'ok');
  -- Dipisah dari pemanggilan di atas: snapshot satu pernyataan tidak melihat tulisan fungsi di pernyataan yang sama.
  chk := chk || jsonb_build_object('edit_stored', exists (select 1 from public.global_messages where id = v_gm and edited_at is not null and body = 'pesan satu (revisi)'));
  chk := chk || jsonb_build_object('edit_other_rejected', pg_temp.as_user(c, format($q$select public.global_edit_message(%L, 'bajak')$q$, v_gm)) = 'not_found');
  chk := chk || jsonb_build_object('edit_empty_rejected', pg_temp.as_user(a, format($q$select public.global_edit_message(%L, %L)$q$, v_gm, E'​')) = 'message_empty');
  chk := chk || jsonb_build_object('edit_link_rejected', pg_temp.as_user(a, format($q$select public.global_edit_message(%L, 'https://contoh.com')$q$, v_gm)) = 'link_not_allowed');
  update public.global_messages set created_at = now() - interval '20 minutes' where id = v_gm;
  chk := chk || jsonb_build_object('edit_expired', pg_temp.as_user(a, format($q$select public.global_edit_message(%L, 'terlambat')$q$, v_gm)) = 'edit_expired');
  chk := chk || jsonb_build_object('mention_lookup', (pg_temp.q_user(a, $q$select public.social_user_by_username('flow_t')$q$)->>'user_id') = t::text
        and (pg_temp.q_user(a, $q$select public.social_user_by_username('tidak_ada_xyz')$q$)) is null);

  -- J) Guru = Premium efektif (tanpa langganan palsu); Owner Verified saja; Admin dari role
  r := pg_temp.q_user(a, format('select public.social_badges(array[%L, %L, %L, %L]::uuid[])', t, o, d, c));
  chk := chk || jsonb_build_object('guru_none_premium', (r->(t::text)->>'diamond')::boolean and (r->(t::text)->>'sensei')::boolean);
  chk := chk || jsonb_build_object('owner_verified', (r->(o::text)->>'verified')::boolean);
  chk := chk || jsonb_build_object('admin_badge', (r->(d::text)->>'admin')::boolean and not (r->(d::text)->>'verified')::boolean);
  chk := chk || jsonb_build_object('free_not_premium', not (r->(c::text)->>'diamond')::boolean);
  update public.profiles set plan = 'premium', premium_until = now() - interval '2 days' where id = t;
  chk := chk || jsonb_build_object('guru_expired_premium', (pg_temp.q_user(a, format('select public.social_badges(array[%L]::uuid[])', t))->(t::text)->>'diamond')::boolean);
  update public.profiles set plan = 'premium', premium_until = now() + interval '30 days' where id = t;
  chk := chk || jsonb_build_object('guru_active_premium', (pg_temp.q_user(a, format('select public.social_badges(array[%L]::uuid[])', t))->(t::text)->>'diamond')::boolean);
  update public.profiles set role = 'student' where id = t;
  chk := chk || jsonb_build_object('revoked_guru_with_sub_premium', (pg_temp.q_user(a, format('select public.social_badges(array[%L]::uuid[])', t))->(t::text)->>'diamond')::boolean);
  update public.profiles set plan = 'free', premium_until = null where id = t;
  chk := chk || jsonb_build_object('revoked_guru_no_sub_free', not (pg_temp.q_user(a, format('select public.social_badges(array[%L]::uuid[])', t))->(t::text)->>'diamond')::boolean);
  update public.profiles set role = 'teacher' where id = t;
  chk := chk || jsonb_build_object('backend_membership_guru', (pg_temp.q_user(t, 'select public.get_my_membership()')->>'plan') = 'premium'
        and (select plan from public.profiles where id = t) = 'free');

  -- L) Mute, privasi profil/online + pratinjau publik, tautan tidak tersimpan, backfill idempoten
  perform pg_temp.as_user(a, format('select public.dm_set_mute(%L, true)', o));
  chk := chk || jsonb_build_object('muted_in_list', exists (select 1 from jsonb_array_elements(pg_temp.q_user(a, 'select public.dm_conversation_list()')) e where e->>'user_id' = o::text and (e->>'muted')::boolean));
  perform pg_temp.as_user(a, $q$select public.social_update_settings(false, false, false, false, null)$q$);
  r := pg_temp.q_user(c, format('select public.social_profile_card(%L)', a));
  chk := chk || jsonb_build_object('privacy_seen_by_other', (r->'country') = 'null'::jsonb and (r->'xp') = 'null'::jsonb and (r->'level') = 'null'::jsonb and not (r->>'show_online')::boolean);
  r := pg_temp.q_user(a, format('select public.social_profile_card(%L, true)', a));
  chk := chk || jsonb_build_object('preview_public', (r->'xp') = 'null'::jsonb and (r->'level') = 'null'::jsonb and not (r->>'show_online')::boolean);
  r := pg_temp.q_user(a, format('select public.social_profile_card(%L)', a));
  chk := chk || jsonb_build_object('self_sees_own', (r->'xp') <> 'null'::jsonb);
  chk := chk || jsonb_build_object('link_allowed_owner_teacher', (select count(*) from public.dm_messages where body like '%https://%' and sender_id in (o, t)) >= 2);
  chk := chk || jsonb_build_object('rejected_link_rows', (select count(*) from public.dm_messages m join public.profiles p on p.id = m.sender_id
        where p.role not in ('owner', 'teacher') and (m.body ilike '%https://%' or m.body ilike '%example．com%')) = 0);
  r := public.social_backfill_owner_friends();
  chk := chk || jsonb_build_object('backfill_idempotent', (r->>'created')::int = 0 and (r->>'failed')::int = 0);
  chk := chk || jsonb_build_object('no_self_or_dup_friendship', (select count(*) from public.social_friendships where user_low = user_high) = 0
        and (select count(*) from (select user_low, user_high from public.social_friendships group by 1, 2 having count(*) > 1) q) = 0);
  chk := chk || jsonb_build_object('no_orphan_messages', (select count(*) from public.dm_messages m where not exists (select 1 from public.dm_conversations c2 where c2.id = m.conversation_id)) = 0);

  -- M) v6: mention Global, notifikasi usang, matriks Premium, evidence laporan, nama resmi, retensi, hak eksekusi
  perform pg_temp.as_user(a, $q$select public.global_send_message('halo @flow_c2 dan @flow_t cek', null)$q$);
  chk := chk || jsonb_build_object('mention_notified_c', (select count(*) from public.user_notifications where user_id = c and kind = 'mention' and read_at is null) = 1);
  chk := chk || jsonb_build_object('mention_notified_t', (select count(*) from public.user_notifications where user_id = t and kind = 'mention' and read_at is null) = 1);
  chk := chk || jsonb_build_object('mention_note_privacy', not exists (select 1 from public.user_notifications where kind = 'mention' and user_id in (c, t) and (body like '%cek%' or body like '%halo%'))
        and not exists (select 1 from public.user_notifications where kind = 'mention' and user_id in (c, t) and action_url !~ '^chat:global:[0-9a-f-]{36}$'));
  perform pg_temp.as_user(a, $q$select public.global_send_message('tes lagi @flow_c2 ya', null)$q$);
  chk := chk || jsonb_build_object('mention_dedupe', (select count(*) from public.user_notifications where user_id = c and kind = 'mention') = 1);
  perform pg_temp.as_user(d, $q$select public.global_send_message('catatan sendiri @adminenonihongo', null)$q$);
  chk := chk || jsonb_build_object('mention_self_none', (select count(*) from public.user_notifications where user_id = d and kind = 'mention') = 0);
  perform pg_temp.as_user(d, $q$select public.global_send_message('kontak a@b.com dan @tidak_ada_xyz serta @ab', null)$q$);
  chk := chk || jsonb_build_object('mention_invalid_none', (select count(*) from public.user_notifications where kind = 'mention') = 2);
  update public.user_notifications set read_at = now() where user_id = c and kind = 'mention';
  perform pg_temp.as_user(c, format('select public.social_block(%L)', t));
  perform pg_temp.as_user(t, $q$select public.global_send_message('uji blokir @flow_c2', null)$q$);
  chk := chk || jsonb_build_object('mention_blocked_none', (select count(*) from public.user_notifications where user_id = c and kind = 'mention' and read_at is null) = 0);
  perform pg_temp.as_user(c, format('select public.social_unblock(%L)', t));
  update public.profiles set suspended_at = now() where id = b;
  perform pg_temp.as_user(o, $q$select public.global_send_message('hai @flow_b suspended', null)$q$);
  chk := chk || jsonb_build_object('mention_suspended_none', (select count(*) from public.user_notifications where user_id = b and kind = 'mention') = 0);
  update public.profiles set suspended_at = null where id = b;

  perform pg_temp.as_user(a, $q$select public.friend_request_send('flow_t')$q$);
  chk := chk || jsonb_build_object('req_notified', (select count(*) from public.user_notifications where user_id = t and kind = 'friend_request' and read_at is null and action_url = 'chat:friends') = 1);
  perform pg_temp.as_user(a, format('select public.friend_request_cancel(%L)', t));
  chk := chk || jsonb_build_object('cancel_resolves_notification', (select count(*) from public.user_notifications where user_id = t and kind = 'friend_request' and (read_at is null or action_url is not null)) = 0);
  perform pg_temp.as_user(a, $q$select public.friend_request_send('flow_t')$q$);
  perform pg_temp.as_user(t, format('select public.friend_request_respond(%L, false)', a));
  chk := chk || jsonb_build_object('reject_resolves_notification', (select count(*) from public.user_notifications where user_id = t and kind = 'friend_request' and (read_at is null or action_url is not null)) = 0);
  perform pg_temp.as_user(a, $q$select public.friend_request_send('flow_t')$q$);
  perform pg_temp.as_user(t, format('select public.friend_request_respond(%L, true)', a));
  chk := chk || jsonb_build_object('accept_resolves_notification', (select count(*) from public.user_notifications where user_id = t and kind = 'friend_request' and (read_at is null or action_url is not null)) = 0
        and exists (select 1 from public.social_friendships where status = 'accepted' and user_low = least(a, t) and user_high = greatest(a, t)));
  chk := chk || jsonb_build_object('stale_request_actions_zero', (select count(*) from public.user_notifications n where n.kind = 'friend_request' and n.action_url is not null
        and not exists (select 1 from public.social_friendships f where f.status = 'pending' and f.requester_id <> n.user_id and n.user_id in (f.user_low, f.user_high))) = 0);

  -- is_premium / entitlement (kedaluwarsa dihormati; Guru = peran)
  update public.profiles set plan = 'premium', premium_until = now() + interval '30 days' where id = c;
  chk := chk || jsonb_build_object('normal_active_premium', (pg_temp.q_user(c, 'select to_jsonb(public.is_premium())'))::text = 'true' and (pg_temp.q_user(c, 'select public.get_my_membership()')->>'plan') = 'premium');
  update public.profiles set plan = 'premium', premium_until = now() - interval '2 days' where id = c;
  chk := chk || jsonb_build_object('normal_expired_free', (pg_temp.q_user(c, 'select to_jsonb(public.is_premium())'))::text = 'false' and (pg_temp.q_user(c, 'select public.get_my_membership()')->>'plan') = 'free');
  update public.profiles set plan = 'free', premium_until = null where id = c;
  chk := chk || jsonb_build_object('normal_none_free', (pg_temp.q_user(c, 'select to_jsonb(public.is_premium())'))::text = 'false');
  update public.profiles set plan = 'lifetime', premium_until = null where id = c;
  chk := chk || jsonb_build_object('normal_lifetime_premium', (pg_temp.q_user(c, 'select to_jsonb(public.is_premium())'))::text = 'true');
  update public.profiles set plan = 'free', premium_until = null where id = c;
  chk := chk || jsonb_build_object('is_premium_self_only', (pg_temp.q_user(c, format('select to_jsonb(public.is_premium(%L))', t)))::text = 'false');
  update public.profiles set role = 'teacher', plan = 'free', premium_until = null where id = t;
  chk := chk || jsonb_build_object('guru_none_is_premium', (pg_temp.q_user(t, 'select to_jsonb(public.is_premium())'))::text = 'true');
  update public.profiles set plan = 'premium', premium_until = now() - interval '2 days' where id = t;
  chk := chk || jsonb_build_object('guru_expired_is_premium', (pg_temp.q_user(t, 'select to_jsonb(public.is_premium())'))::text = 'true');
  update public.profiles set plan = 'premium', premium_until = now() + interval '30 days' where id = t;
  chk := chk || jsonb_build_object('guru_active_is_premium', (pg_temp.q_user(t, 'select to_jsonb(public.is_premium())'))::text = 'true');
  update public.profiles set role = 'student' where id = t;
  chk := chk || jsonb_build_object('revoked_active_is_premium', (pg_temp.q_user(t, 'select to_jsonb(public.is_premium())'))::text = 'true');
  update public.profiles set plan = 'premium', premium_until = now() - interval '2 days' where id = t;
  chk := chk || jsonb_build_object('revoked_expired_free', (pg_temp.q_user(t, 'select to_jsonb(public.is_premium())'))::text = 'false' and not (pg_temp.q_user(a, format('select public.social_badges(array[%L]::uuid[])', t))->(t::text)->>'diamond')::boolean);
  update public.profiles set role = 'teacher', plan = 'free', premium_until = null where id = t;

  -- Evidence laporan tetap ada walau pesan dihapus; hanya moderator; Admin tidak bisa menelusuri DM privat
  perform pg_temp.as_user(c, $q$select public.global_send_message('pesan c yang akan dilaporkan', null)$q$);
  select id into v_gm from public.global_messages where sender_id = c order by created_at desc limit 1;
  chk := chk || jsonb_build_object('report_global_ok', pg_temp.as_user(a, format($q$select public.social_report_submit('global', %L, 'harassment', 'kasar')$q$, v_gm)) = 'ok');
  perform pg_temp.as_user(c, format('select public.global_delete_message(%L)', v_gm));
  chk := chk || jsonb_build_object('source_message_blanked', (select body from public.global_messages where id = v_gm) = '');
  r := pg_temp.q_user(o, $q$select public.social_admin_reports('open', 50)$q$);
  chk := chk || jsonb_build_object('evidence_survives_delete', exists (select 1 from jsonb_array_elements(r) e where e->>'evidence' like '%pesan c yang akan dilaporkan%' and e->>'category' = 'harassment'));
  chk := chk || jsonb_build_object('evidence_no_reporter_email', not (r::text ~* '@[a-z0-9-]+\.[a-z]{2,}'));
  chk := chk || jsonb_build_object('evidence_member_forbidden', (pg_temp.q_user(a, $q$select public.social_admin_reports('open', 50)$q$)->>'error') = 'forbidden');
  chk := chk || jsonb_build_object('reports_table_not_directly_readable', (pg_temp.q_user(o, $q$select to_jsonb(count(*)) from public.content_reports$q$)->>'error') is not null);
  chk := chk || jsonb_build_object('admin_cannot_browse_dm', (pg_temp.q_user(d, format($q$select to_jsonb(count(*)) from public.dm_messages where recipient_id = %L$q$, c)))::text = '0');

  -- Nama tampilan tidak boleh meniru identitas resmi (UPDATE), staf dikecualikan
  declare v_err text;
  begin
    begin update public.profiles set display_name = 'ENO NIHONGO Official' where id = a; v_err := 'none';
    exception when others then v_err := sqlerrm; end;
    chk := chk || jsonb_build_object('display_name_lookalike_rejected', v_err = 'Nama tampilan tidak tersedia.');
    update public.profiles set display_name = 'Sakura Chan' where id = a;
    chk := chk || jsonb_build_object('display_name_normal_ok', (select display_name from public.profiles where id = a) = 'Sakura Chan');
    update public.profiles set display_name = 'Admin ENO NIHONGO' where id = d;
    chk := chk || jsonb_build_object('display_name_admin_exempt', (select display_name from public.profiles where id = d) = 'Admin ENO NIHONGO');
  end;

  -- Retensi log rate-limit saja
  insert into public.social_request_log (requester_id, target_id, created_at) values (a, c, now() - interval '35 days'), (a, c, now() - interval '1 day');
  chk := chk || jsonb_build_object('prune_removed_old', public.social_prune_logs() >= 1);
  chk := chk || jsonb_build_object('prune_kept_recent', (select count(*) from public.social_request_log where created_at < now() - interval '30 days') = 0
        and (select count(*) from public.social_request_log where created_at > now() - interval '2 days') >= 1);

  -- Hak eksekusi
  chk := chk || jsonb_build_object('internal_v6_not_executable_by_clients',
     not has_function_privilege('anon', 'public.social_prune_logs()', 'execute') and not has_function_privilege('authenticated', 'public.social_prune_logs()', 'execute')
     and not has_function_privilege('authenticated', 'public.social_resolve_request_notifications(uuid, uuid)', 'execute')
     and not has_function_privilege('anon', 'public.social_resolve_request_notifications(uuid, uuid)', 'execute'));
  chk := chk || jsonb_build_object('privileged_rpc_not_anon', not has_function_privilege('anon', 'public.social_admin_suspend(uuid, boolean, text)', 'execute')
     and not has_function_privilege('anon', 'public.social_admin_reports(text, integer)', 'execute')
     and not has_function_privilege('anon', 'public.global_set_pin(text)', 'execute')
     and not has_function_privilege('anon', 'public.dm_conversation_hide(uuid)', 'execute'));

  -- K) Data belajar tidak berubah; audit tercatat
  select xp into xp_after from public.user_learning_stats where user_id = a;
  chk := chk || jsonb_build_object('learning_xp_unchanged', xp_before is not distinct from xp_after);
  chk := chk || jsonb_build_object('audit_logged', (select count(*) from public.admin_audit_log where actor_id in (o, d) and action like 'social_%') >= 7);

  for k in select key from jsonb_each(chk) where value <> 'true'::jsonb loop failed := failed || k; end loop;
  if array_length(failed, 1) is not null then raise exception 'FLOW_FAIL %', failed::text; end if;
  raise exception 'FLOW_OK %', (select count(*) || ' checks' from jsonb_each(chk));
end $$;
