-- Integration flow sosial inti. Berjalan dalam SATU transaksi yang SELALU di-rollback (RAISE EXCEPTION di akhir),
-- sehingga tidak meninggalkan data. Jalankan: psql / execute_sql. Hasil ada di pesan galat "FLOW_OK {...}".
-- Urutan: member dibuat → auto-friend Owner → Owner tidak di Leaderboard → kartu Owner (Verified/official) →
-- DM normal + unread → kebijakan DM → mute → idempotensi client_id → link ditolak (member) / boleh (Owner, Guru) →
-- block → DM ditolak + backfill menghormati block → privasi profil/online + pratinjau publik → akun nonaktif.
do $$
declare
  o uuid; a uuid := gen_random_uuid(); t uuid := gen_random_uuid(); b uuid := gen_random_uuid();
  r jsonb; res jsonb := '{}'::jsonb; n1 int; n2 int; v_err text;
  msgs_before int; notifs_before int;

begin
  select id into o from public.profiles where role = 'owner' limit 1;
  if o is null then raise exception 'FLOW_FAIL no owner'; end if;

  -- 1) member baru → trigger auto-friend (tanpa permintaan/persetujuan)
  insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
  select '00000000-0000-0000-0000-000000000000', x.id, 'authenticated', 'authenticated', 'flow.' || x.n || '@example.invalid', '', now(), '{}'::jsonb, '{}'::jsonb, now(), now()
    from (values (a, 'a'), (t, 't'), (b, 'b')) as x(id, n);
  update public.profiles set role = 'teacher' where id = t;
  update public.profiles set plan = 'premium', premium_until = now() + interval '30 days' where id = b;
  res := res || jsonb_build_object('auto_friend_new_member',
     (select count(*) from public.social_friendships where status = 'accepted' and user_low = least(o, a) and user_high = greatest(o, a)));
  if (select count(*) from public.social_friendships where status = 'pending' and a in (user_low, user_high)) <> 0 then raise exception 'FLOW_FAIL pending created'; end if;

  -- 2) Owner tidak masuk Leaderboard; peringkat berurutan tanpa celah
  select count(*) into n1 from public.get_leaderboard(100) where user_id = o;
  select count(*) into n2 from public.get_competition_leaderboard('weekly', 100) where user_id = o;
  res := res || jsonb_build_object('owner_in_leaderboard', n1, 'owner_in_competition', n2,
     'rank_gaps', (select count(*) from (select rank, row_number() over (order by rank) rn from public.get_leaderboard(100)) q where rank <> rn));

  -- username untuk a, t, b (lewat RPC, sebagai pengguna masing-masing)
  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  set local role authenticated;
  perform public.social_set_username('flow_a', null);
  reset role;
  perform set_config('request.jwt.claims', json_build_object('sub', t, 'role', 'authenticated')::text, true);
  set local role authenticated;
  perform public.social_set_username('flow_t', null);
  reset role;
  perform set_config('request.jwt.claims', json_build_object('sub', b, 'role', 'authenticated')::text, true);
  set local role authenticated;
  perform public.social_set_username('flow_b', null);
  reset role;

  -- 3) kartu Owner dilihat member: official, friend, DM boleh; hapus pertemanan Owner ditolak
  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  set local role authenticated;
  r := public.social_profile_card(o);
  res := res || jsonb_build_object('owner_card', jsonb_build_object('official', r->'official', 'relation', r->'relation', 'dm_blocked', r->'dm_blocked', 'has_email', r ? 'email'));
  begin perform public.friend_remove(o); exception when others then res := res || jsonb_build_object('unfriend_owner', sqlerrm); end;

  -- 4) DM normal → unread bertambah untuk Owner
  perform public.dm_send_message(o, 'halo owner', null, gen_random_uuid());
  reset role;
  perform set_config('request.jwt.claims', json_build_object('sub', o, 'role', 'authenticated')::text, true);
  set local role authenticated;
  res := res || jsonb_build_object('owner_unread_dm', (public.social_unread_summary()->>'dm')::int);
  -- Owner juga tunduk pada kebijakan DM: a menonaktifkan DM → Owner ditolak
  reset role;
  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  set local role authenticated;
  perform public.social_update_settings(null, null, null, null, 'none');
  reset role;
  perform set_config('request.jwt.claims', json_build_object('sub', o, 'role', 'authenticated')::text, true);
  set local role authenticated;
  begin perform public.dm_send_message(a, 'balasan owner', null, null); exception when others then res := res || jsonb_build_object('owner_blocked_by_policy', sqlerrm); end;
  reset role;
  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  set local role authenticated;
  begin perform public.dm_send_message(o, 'saat dm nonaktif', null, null); exception when others then res := res || jsonb_build_object('self_dm_off', sqlerrm); end;
  perform public.social_update_settings(null, null, null, null, 'friends');

  -- 5) idempotensi client_id: dua kali kirim = satu pesan
  declare cid uuid := gen_random_uuid(); r1 jsonb; r2 jsonb;
  begin
    r1 := public.dm_send_message(o, 'pesan idempoten', null, cid);
    r2 := public.dm_send_message(o, 'pesan idempoten', null, cid);
    res := res || jsonb_build_object('idempotent_same_id', (r1->>'id') = (r2->>'id'), 'duplicate_flag', r2->'duplicate');
  end;

  -- 6) mute percakapan: tetap tersimpan, hanya ditandai
  perform public.dm_set_mute(o, true);
  res := res || jsonb_build_object('muted_in_list', (select (x->>'muted')::boolean from jsonb_array_elements(public.dm_conversation_list()) x where (x->>'user_id')::uuid = o));
  perform public.dm_set_mute(o, false);

  -- 7) link: member ditolak (0 pesan/0 notifikasi), Premium juga ditolak; Owner & Guru boleh
  reset role;
  select count(*) into msgs_before from public.dm_messages where sender_id = a;
  select count(*) into notifs_before from public.user_notifications where user_id = o;
  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  set local role authenticated;
  begin perform public.dm_send_message(o, 'cek https://example.com', null, null); exception when others then res := res || jsonb_build_object('free_dm_link', sqlerrm); end;
  begin perform public.global_send_message('kunjungi www.example.com', null); exception when others then res := res || jsonb_build_object('free_global_link', sqlerrm); end;
  begin perform public.global_send_message('example . com', null); exception when others then res := res || jsonb_build_object('free_spaced', sqlerrm); end;
  perform public.global_send_message('halo semua, ini teks biasa', null);
  reset role;
  res := res || jsonb_build_object('rejected_link_rows',
     (select count(*) from public.dm_messages where sender_id = a) - msgs_before,
     'rejected_link_notifs', (select count(*) from public.user_notifications where user_id = o) - notifs_before);
  perform set_config('request.jwt.claims', json_build_object('sub', b, 'role', 'authenticated')::text, true);
  set local role authenticated;
  begin perform public.global_send_message('premium example.com', null); exception when others then res := res || jsonb_build_object('premium_link', sqlerrm); end;
  perform public.global_send_message('premium teks biasa', null);
  reset role;
  perform set_config('request.jwt.claims', json_build_object('sub', t, 'role', 'authenticated')::text, true);
  set local role authenticated;
  perform public.global_send_message('guru boleh https://example.com', null);
  reset role;
  perform set_config('request.jwt.claims', json_build_object('sub', o, 'role', 'authenticated')::text, true);
  set local role authenticated;
  perform public.global_send_message('owner boleh https://example.com', null);
  reset role;
  res := res || jsonb_build_object('link_allowed_owner_teacher',
     (select count(*) from public.global_messages where sender_id in (o, t) and body like '%https://example.com%'));

  -- 8) privasi profil: a menyembunyikan negara/XP/online; t melihat kartu a; pratinjau publik a melihat hal yang sama
  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  set local role authenticated;
  perform public.social_update_settings(false, false, true, false, null);
  reset role;
  perform set_config('request.jwt.claims', json_build_object('sub', t, 'role', 'authenticated')::text, true);
  set local role authenticated;
  r := public.social_profile_card(a);
  res := res || jsonb_build_object('privacy_seen_by_other', jsonb_build_object('country', r->'country', 'xp', r->'xp', 'show_online', r->'show_online', 'jlpt_visible', (r->>'level') is not null));
  reset role;
  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  set local role authenticated;
  r := public.social_profile_card(a, true);
  res := res || jsonb_build_object('preview_public', jsonb_build_object('country', r->'country', 'xp', r->'xp', 'show_online', r->'show_online'));

  -- 9) block: pertemanan putus, DM ditolak, backfill menghormati block
  perform public.social_block(o);
  begin perform public.dm_send_message(o, 'setelah block', null, null); exception when others then res := res || jsonb_build_object('dm_after_block', sqlerrm); end;
  reset role;
  res := res || jsonb_build_object('backfill_after_block', public.social_backfill_owner_friends());
  res := res || jsonb_build_object('friendship_after_block',
     (select count(*) from public.social_friendships where user_low = least(o, a) and user_high = greatest(o, a)));

  -- 10) akun nonaktif: tidak bisa kirim; kartu 'unavailable'
  update public.profiles set suspended_at = now() where id = b;
  perform set_config('request.jwt.claims', json_build_object('sub', b, 'role', 'authenticated')::text, true);
  set local role authenticated;
  begin perform public.global_send_message('saat nonaktif', null); exception when others then res := res || jsonb_build_object('suspended_send', sqlerrm); end;
  reset role;
  perform set_config('request.jwt.claims', json_build_object('sub', t, 'role', 'authenticated')::text, true);
  set local role authenticated;
  res := res || jsonb_build_object('suspended_card_relation', public.social_profile_card(b)->'relation',
                                   'suspended_show_online', public.social_profile_card(b)->'show_online');
  reset role;

  raise exception 'FLOW_OK %', res::text;
end $$;
