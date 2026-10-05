-- Social/Chat v2: profil sosial, username dapat diubah (cooldown 30 hari + riwayat internal), filter pesan
-- server-side, privasi permintaan teman, anti-spam tambahan, laporan pengguna, notifikasi rapi.
-- Aditif di atas Social/Chat v1; tidak ada sistem friendship/chat/notifikasi/laporan kedua.
-- Semua tabel baru bersifat internal: RLS aktif dan TIDAK ada hak akses klien (hanya lewat RPC security definer).
set local lock_timeout = '8s';

-- ---------------------------------------------------------------------------------------------
-- Tabel internal
-- ---------------------------------------------------------------------------------------------
-- Pengaturan privat per pengguna. Baris belum ada = default (username belum pernah diganti, terima permintaan).
create table if not exists public.social_settings (
  user_id uuid primary key references auth.users (id) on delete cascade,
  allow_friend_requests boolean not null default true,
  username_changed_at timestamptz,
  updated_at timestamptz not null default now()
);

-- Riwayat perubahan username: hanya untuk moderator (RPC), tidak pernah publik.
create table if not exists public.social_username_history (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  old_username text not null,
  new_username text not null,
  changed_at timestamptz not null default now()
);
create index if not exists social_username_history_user_idx
  on public.social_username_history (user_id, changed_at desc);

-- Aturan kata terlarang yang dapat dirawat moderator tanpa mengubah logika chat.
create table if not exists public.social_moderation_terms (
  id integer generated always as identity primary key,
  term text not null,
  language text not null default 'id',
  category text not null default 'profanity',
  match_type text not null default 'word',
  severity smallint not null default 1,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  constraint social_terms_match check (match_type in ('word', 'phrase', 'substring')),
  constraint social_terms_term check (char_length(btrim(term)) between 2 and 60),
  constraint social_terms_unique unique (term, language)
);

-- Catatan permintaan teman untuk anti-spam (kirim -> batal -> kirim).
create table if not exists public.social_request_log (
  id bigint generated always as identity primary key,
  requester_id uuid not null references auth.users (id) on delete cascade,
  target_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);
create index if not exists social_request_log_requester_idx
  on public.social_request_log (requester_id, created_at desc);
create index if not exists social_request_log_pair_idx
  on public.social_request_log (requester_id, target_id, created_at desc);

alter table public.social_settings enable row level security;
alter table public.social_username_history enable row level security;
alter table public.social_moderation_terms enable row level security;
alter table public.social_request_log enable row level security;

revoke all on table public.social_settings from public, anon, authenticated;
revoke all on table public.social_username_history from public, anon, authenticated;
revoke all on table public.social_moderation_terms from public, anon, authenticated;
revoke all on table public.social_request_log from public, anon, authenticated;

-- ---------------------------------------------------------------------------------------------
-- Seed aturan kata (bisa diubah moderator). Sengaja tidak memuat kata yang juga kata sehari-hari
-- (mis. "anjing", "babi", "asu") agar tidak salah blokir; moderator dapat menambahkannya.
-- ---------------------------------------------------------------------------------------------
insert into public.social_moderation_terms (term, language, category, match_type) values
  ('bangsat','id','profanity','word'),('bajingan','id','profanity','word'),('brengsek','id','profanity','word'),
  ('keparat','id','profanity','word'),('kontol','id','sexual','word'),('memek','id','sexual','word'),
  ('pepek','id','sexual','word'),('ngentot','id','sexual','word'),('ngewe','id','sexual','word'),
  ('jancok','id','profanity','word'),('jancuk','id','profanity','word'),('tolol','id','insult','word'),
  ('goblok','id','insult','word'),('bangke','id','insult','word'),('lonte','id','harassment','word'),
  ('sundal','id','harassment','word'),('pantek','id','profanity','word'),('kimak','id','profanity','word'),
  ('cina babi','id','hate','phrase'),
  ('fuck','en','profanity','word'),('motherfucker','en','profanity','word'),('shit','en','profanity','word'),
  ('bitch','en','harassment','word'),('asshole','en','insult','word'),('bastard','en','insult','word'),
  ('cunt','en','sexual','word'),('whore','en','harassment','word'),('slut','en','harassment','word'),
  ('faggot','en','hate','word'),('nigger','en','hate','word'),('nigga','en','hate','word'),
  ('retard','en','hate','word'),('pussy','en','sexual','word'),('dickhead','en','insult','word'),
  ('死ね','ja','harassment','substring'),('くたばれ','ja','harassment','substring'),
  ('ちんこ','ja','sexual','substring'),('ちんぽ','ja','sexual','substring'),('まんこ','ja','sexual','substring'),
  ('淫乱','ja','sexual','substring'),('ファック','ja','profanity','substring'),('ビッチ','ja','harassment','substring'),
  ('クソ野郎','ja','insult','substring'),('糞野郎','ja','insult','substring'),
  ('キチガイ','ja','hate','substring'),('きちがい','ja','hate','substring'),('ガイジ','ja','hate','substring'),
  ('池沼','ja','hate','substring')
on conflict (term, language) do nothing;

-- ---------------------------------------------------------------------------------------------
-- Fungsi internal (tidak diberikan ke klien)
-- ---------------------------------------------------------------------------------------------
create or replace function public.social_username_reserved(p_name text)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select p_name = any (array['admin','administrator','moderator','support','system','root','eno','enonihongo','owner','staff'])
$$;

-- Normalisasi untuk pencocokan: NFKC, huruf kecil, buang karakter tak terlihat, leet sederhana, huruf berulang diringkas.
create or replace function public.social_normalize_text(p_text text)
returns text
language sql
immutable
set search_path = ''
as $$
  select regexp_replace(
    regexp_replace(
      translate(lower(normalize(coalesce(p_text, ''), NFKC)), '013457@$!', 'oieastasi'),
      '[​-‍⁠﻿­]', '', 'g'),
    '([a-z])\1+', '\1', 'g')
$$;

-- Menolak teks yang memuat istilah terlarang. Word-boundary untuk Latin (termasuk huruf yang dipisah
-- spasi/tanda baca dan akhiran umum), substring untuk Jepang. Dipakai semua jalur pesan sosial.
create or replace function public.social_assert_clean(p_text text, p_code text default 'message_rejected')
returns void
language plpgsql
stable
set search_path = ''
as $$
declare
  t text := public.social_normalize_text(p_text);
  jtext text := regexp_replace(normalize(lower(coalesce(p_text, '')), NFKC), '[\s\.\-_*・、。,!?~]+', '', 'g');
  spaced text := btrim(regexp_replace(t, '[^[:alnum:]]+', ' ', 'g'));
  squash text := regexp_replace(t, '[^[:alnum:]]+', '', 'g');
  tok text;
  buf text := '';
  joined text[] := '{}';
  r record;
  ct text;
begin
  if spaced <> '' then
    foreach tok in array regexp_split_to_array(spaced, ' ') loop
      if char_length(tok) = 1 and tok ~ '^[a-z]$' then
        buf := buf || tok;
      else
        if buf <> '' then joined := joined || buf; buf := ''; end if;
        joined := joined || tok;
      end if;
    end loop;
    if buf <> '' then joined := joined || buf; end if;
  end if;

  for r in select term, match_type from public.social_moderation_terms where active loop
    if r.match_type = 'substring' then
      if position(normalize(lower(r.term), NFKC) in jtext) > 0 then raise exception '%', p_code; end if;
    elsif r.match_type = 'phrase' then
      ct := public.social_normalize_text(r.term);
      if position(' ' || ct || ' ' in ' ' || spaced || ' ') > 0 then raise exception '%', p_code; end if;
    else
      ct := public.social_normalize_text(r.term);
      if exists (
        select 1 from unnest(joined) j
         where j = ct
            or (left(j, char_length(ct)) = ct
                and substring(j from char_length(ct) + 1) = any (array['nya','mu','ku','lah','kah','an','in','s','es','ed','er','ing']))
      ) then raise exception '%', p_code; end if;
      if char_length(ct) >= 6 and position(ct in squash) > 0 then raise exception '%', p_code; end if;
    end if;
  end loop;
end
$$;

-- ---------------------------------------------------------------------------------------------
-- Identitas, username, privasi
-- ---------------------------------------------------------------------------------------------
create or replace function public.social_me()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when auth.uid() is null then null
    else coalesce(
      (select jsonb_build_object(
          'has_username', true,
          'user_id', sp.user_id,
          'username', sp.username,
          'display_name', sp.display_name,
          'avatar_id', sp.avatar_id,
          'is_moderator', public.has_permission('operations.manage'),
          'allow_friend_requests', coalesce(ss.allow_friend_requests, true),
          'next_username_change_at',
            case when ss.username_changed_at is not null and now() < ss.username_changed_at + interval '30 days'
                 then ss.username_changed_at + interval '30 days' end)
         from public.social_profiles sp
         left join public.social_settings ss on ss.user_id = sp.user_id
        where sp.user_id = auth.uid()),
      jsonb_build_object('has_username', false, 'is_moderator', false,
                         'allow_friend_requests', true, 'next_username_change_at', null))
  end
$$;

-- Username pertama kali TIDAK dihitung sebagai "mengganti" (username_changed_at tetap null).
create or replace function public.social_set_username(p_username text, p_display_name text default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_name text := lower(btrim(coalesce(p_username, '')));
  v_disp text := nullif(btrim(coalesce(p_display_name, '')), '');
begin
  if v_uid is null then raise exception 'auth_required'; end if;
  if v_name !~ '^[a-z0-9_]{3,20}$' then raise exception 'invalid_username'; end if;
  if public.social_username_reserved(v_name) then raise exception 'username_reserved'; end if;
  if v_disp is not null and (char_length(v_disp) > 40 or position('@' in v_disp) > 0) then
    raise exception 'invalid_display_name';
  end if;
  if exists (select 1 from public.profiles where id = v_uid and suspended_at is not null) then
    raise exception 'suspended';
  end if;
  if exists (select 1 from public.social_profiles where user_id = v_uid) then
    raise exception 'username_already_set';
  end if;
  perform public.social_assert_clean(v_name, 'username_not_allowed');
  if v_disp is not null then perform public.social_assert_clean(v_disp, 'username_not_allowed'); end if;
  begin
    insert into public.social_profiles (user_id, username, display_name) values (v_uid, v_name, v_disp);
  exception when unique_violation then
    raise exception 'username_taken';
  end;
  insert into public.social_global_read (user_id) values (v_uid) on conflict (user_id) do nothing;
  return public.social_me();
end
$$;

-- Ganti username: maksimal 1x per 30 hari (ditentukan server), riwayat internal, tanpa menyentuh data lain.
create or replace function public.social_change_username(p_username text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := public.social_assert_member();
  v_new text := lower(btrim(coalesce(p_username, '')));
  v_old text;
  v_changed timestamptz;
begin
  if v_new !~ '^[a-z0-9_]{3,20}$' then raise exception 'invalid_username'; end if;
  -- Kunci baris sendiri: dua permintaan serentak dari akun yang sama berjalan berurutan.
  select username into v_old from public.social_profiles where user_id = v_uid for update;
  if v_new = v_old then raise exception 'username_unchanged'; end if;
  if public.social_username_reserved(v_new) then raise exception 'username_reserved'; end if;
  perform public.social_assert_clean(v_new, 'username_not_allowed');
  select username_changed_at into v_changed from public.social_settings where user_id = v_uid;
  if v_changed is not null and now() < v_changed + interval '30 days' then
    raise exception 'username_cooldown';
  end if;
  begin
    update public.social_profiles set username = v_new where user_id = v_uid;
  exception when unique_violation then
    raise exception 'username_taken';
  end;
  insert into public.social_username_history (user_id, old_username, new_username) values (v_uid, v_old, v_new);
  insert into public.social_settings (user_id, username_changed_at) values (v_uid, now())
  on conflict (user_id) do update set username_changed_at = excluded.username_changed_at, updated_at = now();
  return public.social_me();
end
$$;

create or replace function public.social_set_privacy(p_allow_friend_requests boolean)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare v_uid uuid := public.social_assert_member();
begin
  insert into public.social_settings (user_id, allow_friend_requests)
  values (v_uid, coalesce(p_allow_friend_requests, true))
  on conflict (user_id) do update set allow_friend_requests = excluded.allow_friend_requests, updated_at = now();
  return public.social_me();
end
$$;

-- ---------------------------------------------------------------------------------------------
-- Profile card (data sosial yang aman saja: tanpa email/role/izin)
-- ---------------------------------------------------------------------------------------------
create or replace function public.social_profile_card(p_user uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  sp public.social_profiles%rowtype;
  v_name text;
  v_level text;
  v_rel text;
  v_member boolean;
  v_allow boolean;
  f public.social_friendships%rowtype;
begin
  if v_uid is null then raise exception 'auth_required'; end if;
  select * into sp from public.social_profiles where user_id = p_user;
  select display_name, jlpt_level into v_name, v_level from public.user_learning_stats where user_id = p_user;
  if sp.user_id is null and v_name is null and v_level is null then raise exception 'user_not_found'; end if;
  v_member := exists (select 1 from public.social_profiles where user_id = v_uid);
  if p_user = v_uid then
    v_rel := 'self';
  elsif exists (select 1 from public.social_blocks where blocker_id = v_uid and blocked_id = p_user) then
    v_rel := 'blocked';
  elsif exists (select 1 from public.social_blocks where blocker_id = p_user and blocked_id = v_uid) then
    v_rel := 'unavailable';
  else
    select * into f from public.social_friendships
     where user_low = least(v_uid, p_user) and user_high = greatest(v_uid, p_user);
    v_rel := case when f.id is null then 'none'
                  when f.status = 'accepted' then 'friend'
                  when f.requester_id = v_uid then 'outgoing'
                  else 'incoming' end;
  end if;
  select coalesce(allow_friend_requests, true) into v_allow from public.social_settings where user_id = p_user;
  return jsonb_build_object(
    'has_username', sp.user_id is not null,
    'username', sp.username,
    'display_name', coalesce(sp.display_name, v_name),
    'avatar_id', coalesce(sp.avatar_id, 0),
    'level', v_level,
    'relation', v_rel,
    'viewer_has_username', v_member,
    'can_request', v_rel = 'none' and sp.user_id is not null and v_member and coalesce(v_allow, true));
end
$$;

-- ---------------------------------------------------------------------------------------------
-- Pertemanan: privasi + anti-spam + notifikasi rapi
-- ---------------------------------------------------------------------------------------------
create or replace function public.friend_request_send(p_username text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := public.social_assert_member();
  v_target uuid;
  v_me text;
  v_row public.social_friendships%rowtype;
  v_body text;
begin
  select user_id into v_target from public.social_profiles where username = lower(btrim(coalesce(p_username, '')));
  if v_target is null then raise exception 'user_not_found'; end if;
  if v_target = v_uid then raise exception 'self_target'; end if;
  if exists (select 1 from public.social_blocks where blocker_id = v_uid and blocked_id = v_target) then raise exception 'blocked'; end if;
  if exists (select 1 from public.social_blocks where blocker_id = v_target and blocked_id = v_uid) then raise exception 'user_not_found'; end if;
  select username into v_me from public.social_profiles where user_id = v_uid;
  select * into v_row from public.social_friendships where user_low = least(v_uid, v_target) and user_high = greatest(v_uid, v_target);
  if found then
    if v_row.status = 'accepted' then raise exception 'already_friends'; end if;
    if v_row.requester_id = v_uid then raise exception 'request_exists'; end if;
    update public.social_friendships set status = 'accepted', responded_at = now() where id = v_row.id;
    insert into public.user_notifications (user_id, title, body, kind, action_url)
    values (v_target, 'Pertemanan diterima', '@' || v_me || ' sekarang berteman denganmu.', 'friend_accepted', 'chat:profile:' || v_uid::text);
    return jsonb_build_object('status', 'accepted');
  end if;
  if not coalesce((select allow_friend_requests from public.social_settings where user_id = v_target), true) then
    raise exception 'requests_disabled';
  end if;
  -- Anti-spam: total 30 permintaan/24 jam dan maksimal 3 ke orang yang sama/24 jam (kirim-batal-kirim).
  if (select count(*) from public.social_request_log where requester_id = v_uid and created_at > now() - interval '24 hours') >= 30
     or (select count(*) from public.social_friendships where requester_id = v_uid and status = 'pending') >= 30 then
    raise exception 'too_many_requests';
  end if;
  if (select count(*) from public.social_request_log
       where requester_id = v_uid and target_id = v_target and created_at > now() - interval '24 hours') >= 3 then
    raise exception 'too_many_requests';
  end if;
  begin
    insert into public.social_friendships (user_low, user_high, requester_id)
    values (least(v_uid, v_target), greatest(v_uid, v_target), v_uid);
  exception when unique_violation then
    raise exception 'request_exists';
  end;
  insert into public.social_request_log (requester_id, target_id) values (v_uid, v_target);
  v_body := '@' || v_me || ' ingin berteman denganmu.';
  if not exists (select 1 from public.user_notifications
                  where user_id = v_target and kind = 'friend_request' and read_at is null and body = v_body) then
    insert into public.user_notifications (user_id, title, body, kind, action_url)
    values (v_target, 'Permintaan pertemanan', v_body, 'friend_request', 'chat:friends');
  end if;
  return jsonb_build_object('status', 'pending');
end
$$;

create or replace function public.friend_request_respond(p_user uuid, p_accept boolean)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := public.social_assert_member();
  v_id uuid;
  v_me text;
begin
  select id into v_id from public.social_friendships
   where user_low = least(v_uid, p_user) and user_high = greatest(v_uid, p_user) and status = 'pending' and requester_id = p_user and p_user <> v_uid;
  if v_id is null then raise exception 'no_request'; end if;
  if public.social_blocked_between(v_uid, p_user) then raise exception 'blocked'; end if;
  if p_accept then
    update public.social_friendships set status = 'accepted', responded_at = now() where id = v_id;
    select username into v_me from public.social_profiles where user_id = v_uid;
    insert into public.user_notifications (user_id, title, body, kind, action_url)
    values (p_user, 'Pertemanan diterima', '@' || v_me || ' menerima permintaan pertemananmu.', 'friend_accepted', 'chat:profile:' || v_uid::text);
    return jsonb_build_object('status', 'accepted');
  end if;
  perform public.social_drop_pending(v_uid, p_user, p_user);
  return jsonb_build_object('status', 'rejected');
end
$$;

-- ---------------------------------------------------------------------------------------------
-- Pesan: filter server-side + anti-spam tambahan + notifikasi DM per pengirim
-- ---------------------------------------------------------------------------------------------
create or replace function public.global_send_message(p_body text, p_reply_to uuid default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := public.social_assert_member();
  v_body text := btrim(coalesce(p_body, ''));
  v_id uuid;
begin
  if v_body = '' then raise exception 'message_empty'; end if;
  if char_length(v_body) > 500 then raise exception 'message_too_long'; end if;
  perform public.social_assert_clean(v_body);
  if (select count(*) from public.global_messages where sender_id = v_uid and created_at > now() - interval '10 seconds') >= 5
     or (select count(*) from public.global_messages where sender_id = v_uid and created_at > now() - interval '1 minute') >= 20 then
    raise exception 'rate_limited';
  end if;
  if exists (select 1 from public.global_messages where sender_id = v_uid and body = v_body and deleted_at is null and created_at > now() - interval '30 seconds') then raise exception 'rate_limited'; end if;
  if p_reply_to is not null and not exists (select 1 from public.global_messages where id = p_reply_to) then raise exception 'not_found'; end if;
  insert into public.global_messages (sender_id, body, reply_to, created_at) values (v_uid, v_body, p_reply_to, clock_timestamp()) returning id into v_id;
  return jsonb_build_object('id', v_id);
end
$$;

create or replace function public.dm_send(p_to uuid, p_body text, p_reply_to uuid default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := public.social_assert_member();
  v_body text := btrim(coalesce(p_body, ''));
  v_conv uuid;
  v_id uuid;
  v_me text;
  v_url text;
begin
  if p_to is null or p_to = v_uid then raise exception 'self_target'; end if;
  if v_body = '' then raise exception 'message_empty'; end if;
  if char_length(v_body) > 1000 then raise exception 'message_too_long'; end if;
  perform public.social_assert_clean(v_body);
  if public.social_blocked_between(v_uid, p_to) then raise exception 'blocked'; end if;
  if not exists (select 1 from public.social_friendships where user_low = least(v_uid, p_to) and user_high = greatest(v_uid, p_to) and status = 'accepted') then raise exception 'not_friends'; end if;
  if (select count(*) from public.dm_messages where sender_id = v_uid and created_at > now() - interval '10 seconds') >= 8
     or (select count(*) from public.dm_messages where sender_id = v_uid and created_at > now() - interval '1 minute') >= 40 then
    raise exception 'rate_limited';
  end if;
  if exists (select 1 from public.dm_messages where sender_id = v_uid and recipient_id = p_to and body = v_body and deleted_at is null and created_at > now() - interval '30 seconds') then
    raise exception 'rate_limited';
  end if;
  insert into public.dm_conversations (user_low, user_high) values (least(v_uid, p_to), greatest(v_uid, p_to))
  on conflict (user_low, user_high) do update set last_message_at = clock_timestamp() returning id into v_conv;
  if p_reply_to is not null and not exists (select 1 from public.dm_messages where id = p_reply_to and conversation_id = v_conv) then raise exception 'not_found'; end if;
  insert into public.dm_messages (conversation_id, sender_id, recipient_id, body, reply_to, created_at) values (v_conv, v_uid, p_to, v_body, p_reply_to, clock_timestamp()) returning id into v_id;
  select username into v_me from public.social_profiles where user_id = v_uid;
  v_url := 'chat:dm:' || v_uid::text;
  -- Satu notifikasi per pengirim selama belum dibaca; judul memakai username terkini.
  if not exists (select 1 from public.user_notifications where user_id = p_to and kind = 'dm' and read_at is null and action_url = v_url) then
    insert into public.user_notifications (user_id, title, body, kind, action_url)
    values (p_to, 'Pesan baru dari @' || v_me, 'Buka obrolan untuk membaca pesan.', 'dm', v_url);
  end if;
  return jsonb_build_object('id', v_id, 'conversation_id', v_conv);
end
$$;

-- ---------------------------------------------------------------------------------------------
-- Laporan pengguna (memakai content_reports yang sudah ada) + alat moderator
-- ---------------------------------------------------------------------------------------------
create or replace function public.social_report_user(p_user uuid, p_reason text default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := public.social_assert_member();
  v_name text;
  v_disp text;
  v_subject text;
  v_hist text;
  v_reason text := left(btrim(coalesce(p_reason, '')), 300);
begin
  if p_user = v_uid then raise exception 'self_target'; end if;
  select username, display_name into v_name, v_disp from public.social_profiles where user_id = p_user;
  if v_name is null then raise exception 'user_not_found'; end if;
  v_subject := 'chat:user:' || p_user::text;
  if exists (select 1 from public.content_reports where reporter_id = v_uid and subject = v_subject) then
    return jsonb_build_object('status', 'already_reported');
  end if;
  if (select count(*) from public.content_reports
       where reporter_id = v_uid and category = 'chat' and created_at > now() - interval '24 hours') >= 10 then
    raise exception 'rate_limited';
  end if;
  select string_agg(old_username || ' > ' || new_username, '; ' order by changed_at desc) into v_hist
    from (select old_username, new_username, changed_at from public.social_username_history
           where user_id = p_user order by changed_at desc limit 3) h;
  insert into public.content_reports (reporter_id, category, subject, description, priority)
  values (v_uid, 'chat', v_subject,
          'Pengguna @' || v_name || coalesce(' (' || v_disp || ')', '')
            || coalesce(E'\nRiwayat username: ' || v_hist, '')
            || case when v_reason <> '' then E'\nAlasan: ' || v_reason else '' end,
          'normal');
  return jsonb_build_object('status', 'reported');
end
$$;

create or replace function public.social_admin_username_history(p_user uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.has_permission('operations.manage') then raise exception 'forbidden'; end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object('old_username', old_username, 'new_username', new_username, 'changed_at', changed_at)
                     order by changed_at desc)
      from public.social_username_history where user_id = p_user), '[]'::jsonb);
end
$$;

create or replace function public.social_admin_terms_list()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.has_permission('operations.manage') then raise exception 'forbidden'; end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object('term', term, 'language', language, 'category', category,
                                        'match_type', match_type, 'active', active) order by language, term)
      from public.social_moderation_terms), '[]'::jsonb);
end
$$;

create or replace function public.social_admin_term_upsert(
  p_term text, p_language text default 'id', p_category text default 'profanity',
  p_match_type text default 'word', p_active boolean default true)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.has_permission('operations.manage') then raise exception 'forbidden'; end if;
  insert into public.social_moderation_terms (term, language, category, match_type, active)
  values (lower(btrim(p_term)), coalesce(p_language, 'id'), coalesce(p_category, 'profanity'),
          coalesce(p_match_type, 'word'), coalesce(p_active, true))
  on conflict (term, language) do update
    set category = excluded.category, match_type = excluded.match_type, active = excluded.active;
  return jsonb_build_object('status', 'ok');
end
$$;

-- ---------------------------------------------------------------------------------------------
-- Hak eksekusi
-- ---------------------------------------------------------------------------------------------
revoke all on function public.social_username_reserved(text) from public, anon, authenticated;
revoke all on function public.social_normalize_text(text) from public, anon, authenticated;
revoke all on function public.social_assert_clean(text, text) from public, anon, authenticated;

revoke all on function public.social_me() from public, anon;
revoke all on function public.social_set_username(text, text) from public, anon;
revoke all on function public.social_change_username(text) from public, anon;
revoke all on function public.social_set_privacy(boolean) from public, anon;
revoke all on function public.social_profile_card(uuid) from public, anon;
revoke all on function public.friend_request_send(text) from public, anon;
revoke all on function public.friend_request_respond(uuid, boolean) from public, anon;
revoke all on function public.global_send_message(text, uuid) from public, anon;
revoke all on function public.dm_send(uuid, text, uuid) from public, anon;
revoke all on function public.social_report_user(uuid, text) from public, anon;
revoke all on function public.social_admin_username_history(uuid) from public, anon;
revoke all on function public.social_admin_terms_list() from public, anon;
revoke all on function public.social_admin_term_upsert(text, text, text, text, boolean) from public, anon;

grant execute on function public.social_me() to authenticated;
grant execute on function public.social_set_username(text, text) to authenticated;
grant execute on function public.social_change_username(text) to authenticated;
grant execute on function public.social_set_privacy(boolean) to authenticated;
grant execute on function public.social_profile_card(uuid) to authenticated;
grant execute on function public.friend_request_send(text) to authenticated;
grant execute on function public.friend_request_respond(uuid, boolean) to authenticated;
grant execute on function public.global_send_message(text, uuid) to authenticated;
grant execute on function public.dm_send(uuid, text, uuid) to authenticated;
grant execute on function public.social_report_user(uuid, text) to authenticated;
grant execute on function public.social_admin_username_history(uuid) to authenticated;
grant execute on function public.social_admin_terms_list() to authenticated;
grant execute on function public.social_admin_term_upsert(text, text, text, text, boolean) to authenticated;
