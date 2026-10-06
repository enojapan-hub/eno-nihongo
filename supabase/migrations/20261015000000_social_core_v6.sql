-- Social Core v6 (aditif, idempoten, tanpa penghapusan data pengguna). Menutup sisa batch v5:
-- (1) notifikasi mention Global (server, dedupe, block/akun-aware, tanpa isi pesan),
-- (2) notifikasi permintaan teman/DM yang sudah tidak valid tidak lagi menawarkan aksi,
-- (3) nama tampilan tidak bisa meniru identitas resmi (hanya saat UPDATE; pendaftaran tidak pernah gagal),
-- (4) is_premium() disamakan dengan semantik entitlement kanonik (tidak ada pemanggil; mencegah drift),
-- (5) retensi minimal social_request_log lewat pg_cron yang sudah ada.
-- Dinonaktifkan dengan aman: unschedule 'social-prune-logs'; lepas trigger trg_profiles_official_name;
-- mention: hapus blok mention di global_send_message. Data pengguna tidak disentuh.

-- ---------------------------------------------------------------------------------------------
-- (4) is_premium: kedaluwarsa dihormati; peran Guru/staf tetap Premium; hanya untuk diri sendiri.
-- ---------------------------------------------------------------------------------------------
create or replace function public.is_premium(p_user_id uuid default auth.uid())
returns boolean language sql stable set search_path = 'pg_catalog', 'public', 'auth'
as $$
  select case
    when auth.uid() is null or p_user_id is distinct from auth.uid() then false
    else exists (
      select 1 from public.profiles p
       where p.id = auth.uid()
         and (p.role in ('owner', 'admin', 'editor', 'teacher')
              or p.plan = 'lifetime'
              or (p.plan = 'premium' and (p.premium_until is null or p.premium_until > now()))))
  end
$$;

-- ---------------------------------------------------------------------------------------------
-- (2) Notifikasi permintaan teman: selesai/dibatalkan/ditolak/diblokir -> dibaca dan tanpa aksi.
-- ---------------------------------------------------------------------------------------------
create or replace function public.social_resolve_request_notifications(p_target uuid, p_requester uuid)
returns void language sql security definer set search_path = ''
as $$
  update public.user_notifications n
     set read_at = coalesce(n.read_at, now()), action_url = null
   where n.user_id = p_target and n.kind = 'friend_request' and n.action_url is not null
     and n.body = '@' || coalesce((select username from public.social_profiles where user_id = p_requester), '') || ' ingin berteman denganmu.'
$$;
revoke all on function public.social_resolve_request_notifications(uuid, uuid) from public, anon, authenticated;

create or replace function public.friend_request_cancel(p_user uuid)
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare v_uid uuid := public.social_assert_member();
begin
  if p_user = v_uid or not public.social_drop_pending(v_uid, p_user, v_uid) then raise exception 'no_request'; end if;
  perform public.social_resolve_request_notifications(p_user, v_uid);
  return jsonb_build_object('status', 'cancelled');
end
$$;

create or replace function public.friend_request_respond(p_user uuid, p_accept boolean)
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare v_uid uuid := public.social_assert_member(); v_id uuid; v_me text;
begin
  select id into v_id from public.social_friendships
   where user_low = least(v_uid, p_user) and user_high = greatest(v_uid, p_user)
     and status = 'pending' and requester_id = p_user and p_user <> v_uid;
  if v_id is null then raise exception 'no_request'; end if;
  if public.social_blocked_between(v_uid, p_user) then raise exception 'blocked'; end if;
  if p_accept then
    update public.social_friendships set status = 'accepted', responded_at = now() where id = v_id;
    select username into v_me from public.social_profiles where user_id = v_uid;
    perform public.social_resolve_request_notifications(v_uid, p_user);
    insert into public.user_notifications (user_id, title, body, kind, action_url)
    values (p_user, 'Pertemanan diterima', '@' || v_me || ' menerima permintaan pertemananmu.', 'friend_accepted', 'chat:profile:' || v_uid::text);
    return jsonb_build_object('status', 'accepted');
  end if;
  perform public.social_drop_pending(v_uid, p_user, p_user);
  perform public.social_resolve_request_notifications(v_uid, p_user);
  return jsonb_build_object('status', 'rejected');
end
$$;

-- Jalur terima-otomatis di friend_request_send (permintaan silang) ikut menyelesaikan notifikasi.
do $$
declare d text;
begin
  select pg_get_functiondef('public.friend_request_send(text)'::regprocedure) into d;
  if position('social_resolve_request_notifications' in d) = 0 then
    execute replace(d,
      'update public.social_friendships set status = ''accepted'', responded_at = now() where id = v_row.id;',
      'update public.social_friendships set status = ''accepted'', responded_at = now() where id = v_row.id; perform public.social_resolve_request_notifications(v_uid, v_target);');
  end if;
end $$;

create or replace function public.social_block(p_user uuid)
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare v_uid uuid := public.social_assert_member();
begin
  if p_user = v_uid then raise exception 'self_target'; end if;
  if not exists (select 1 from public.social_profiles where user_id = p_user) then raise exception 'user_not_found'; end if;
  if public.social_is_staff(p_user) then raise exception 'protected_target'; end if;
  insert into public.social_blocks (blocker_id, blocked_id) values (v_uid, p_user) on conflict (blocker_id, blocked_id) do nothing;
  perform public.social_end_friendship(v_uid, p_user);
  perform public.social_resolve_request_notifications(v_uid, p_user);
  perform public.social_resolve_request_notifications(p_user, v_uid);
  return jsonb_build_object('status', 'blocked');
end
$$;

-- Hapus percakapan: notifikasi DM dari lawan bicara itu ikut dibaca (tanpa bunyi/badge hantu).
create or replace function public.dm_conversation_hide(p_with uuid)
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare
  v_uid uuid := public.social_assert_member();
  v_conv uuid;
  v_now timestamptz := clock_timestamp();
begin
  select id into v_conv from public.dm_conversations
   where user_low = least(v_uid, p_with) and user_high = greatest(v_uid, p_with);
  if v_conv is null then raise exception 'not_found'; end if;
  insert into public.dm_conversation_hidden (user_id, conversation_id, hidden_at) values (v_uid, v_conv, v_now)
  on conflict (user_id, conversation_id) do update set hidden_at = excluded.hidden_at;
  update public.dm_conversations
     set low_last_read_at = case when user_low = v_uid then v_now else low_last_read_at end,
         high_last_read_at = case when user_high = v_uid then v_now else high_last_read_at end
   where id = v_conv;
  update public.user_notifications set read_at = now()
   where user_id = v_uid and kind = 'dm' and read_at is null and action_url = 'chat:dm:' || p_with::text;
  return jsonb_build_object('status', 'hidden');
end
$$;

-- ---------------------------------------------------------------------------------------------
-- (1) Mention Global: notifikasi server-side, maks 5 target unik, tanpa isi pesan, tanpa duplikat.
-- ---------------------------------------------------------------------------------------------
create or replace function public.global_send_message(p_body text, p_reply_to uuid default null)
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare
  v_uid uuid := public.social_assert_writer();
  v_body text := btrim(coalesce(p_body, ''));
  v_id uuid;
  v_slow integer;
  v_me text;
  v_name text;
  v_target uuid;
  v_note text;
begin
  if v_body = '' or public.social_effectively_empty(v_body) then raise exception 'message_empty'; end if;
  if char_length(v_body) > 500 then raise exception 'message_too_long'; end if;
  perform public.social_assert_clean(v_body);
  perform public.social_assert_link_allowed(v_uid, v_body);
  if (select count(*) from public.global_messages where sender_id = v_uid and created_at > now() - interval '10 seconds') >= 5
     or (select count(*) from public.global_messages where sender_id = v_uid and created_at > now() - interval '1 minute') >= 20 then
    raise exception 'rate_limited';
  end if;
  select slow_mode_seconds into v_slow from public.social_global_config where id = 1;
  if coalesce(v_slow, 0) > 0 and not public.social_is_staff(v_uid)
     and exists (select 1 from public.global_messages where sender_id = v_uid and created_at > clock_timestamp() - make_interval(secs => v_slow)) then
    raise exception 'slow_mode';
  end if;
  if exists (
       select 1 from (select body from public.global_messages
                       where sender_id = v_uid and deleted_at is null and created_at > now() - interval '60 seconds'
                       order by created_at desc limit 5) r
        where public.social_normalize_text(r.body) = public.social_normalize_text(v_body)) then
    raise exception 'duplicate_message';
  end if;
  if p_reply_to is not null and not exists (select 1 from public.global_messages where id = p_reply_to) then raise exception 'not_found'; end if;
  insert into public.global_messages (sender_id, body, reply_to, created_at) values (v_uid, v_body, p_reply_to, clock_timestamp()) returning id into v_id;

  -- Mention: hanya username utuh, target valid (ada, aktif, tidak diblokir dua arah), bukan diri sendiri.
  select username into v_me from public.social_profiles where user_id = v_uid;
  v_note := '@' || v_me || ' menyebutmu di Global Chat.';
  for v_name in
    select distinct m[2] from regexp_matches(v_body, '(^|[\s(])@([a-z0-9_]{3,20})(?![a-z0-9_@])', 'g') as m limit 5
  loop
    select sp.user_id into v_target from public.social_profiles sp
      join public.profiles pr on pr.id = sp.user_id
     where sp.username = v_name and pr.suspended_at is null;
    if v_target is null or v_target = v_uid or public.social_blocked_between(v_uid, v_target) then continue; end if;
    if exists (select 1 from public.user_notifications
                where user_id = v_target and kind = 'mention' and read_at is null and body = v_note) then continue; end if;
    insert into public.user_notifications (user_id, title, body, kind, action_url)
    values (v_target, 'Kamu disebut', v_note, 'mention', 'chat:global:' || v_id::text);
  end loop;
  return jsonb_build_object('id', v_id);
end
$$;
revoke all on function public.global_send_message(text, uuid) from public, anon;
grant execute on function public.global_send_message(text, uuid) to authenticated;

-- ---------------------------------------------------------------------------------------------
-- (3) Nama tampilan tidak boleh meniru identitas resmi (UPDATE oleh non-staf). Pendaftaran tidak diblokir.
-- ---------------------------------------------------------------------------------------------
create or replace function public.profiles_guard_official_name()
returns trigger language plpgsql set search_path = ''
as $$
begin
  if new.display_name is distinct from old.display_name
     and old.role not in ('owner', 'admin')
     and public.social_official_lookalike(new.display_name) then
    raise exception 'Nama tampilan tidak tersedia.';
  end if;
  return new;
end
$$;
do $$
begin
  if not exists (select 1 from pg_trigger where tgname = 'trg_profiles_official_name' and tgrelid = 'public.profiles'::regclass) then
    create trigger trg_profiles_official_name before update of display_name on public.profiles
      for each row execute function public.profiles_guard_official_name();
  end if;
end $$;

-- ---------------------------------------------------------------------------------------------
-- (5) Retensi minimal: log rate-limit permintaan teman > 30 hari (jendela rate limit hanya 24 jam).
-- Tidak menyentuh pesan, laporan, audit, atau riwayat username.
-- ---------------------------------------------------------------------------------------------
create or replace function public.social_prune_logs()
returns integer language plpgsql security definer set search_path = ''
as $$
declare v_n integer;
begin
  delete from public.social_request_log where created_at < now() - interval '30 days';
  get diagnostics v_n = row_count;
  return v_n;
end
$$;
revoke all on function public.social_prune_logs() from public, anon, authenticated;

do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron')
     and not exists (select 1 from cron.job where jobname = 'social-prune-logs') then
    perform cron.schedule('social-prune-logs', '17 3 * * *', 'select public.social_prune_logs()');
  end if;
end $$;
