-- Social Core v5 (additive, idempotent, tanpa penghapusan data).
-- Perlindungan Owner/Admin (block/report), DM tanpa batas untuk Owner, capabilities di Profile Card,
-- Guru = Premium efektif di identitas sosial, anti-peniruan username resmi, hapus percakapan per-pengguna,
-- anti-flood + slow mode + pengumuman tersemat, edit pesan, suspend sosial, antrean moderasi + audit.
-- Tidak menyentuh XP, progres, langganan, pembayaran, atau tabel belajar.

-- ---------------------------------------------------------------------------------------------
-- Skema tambahan
-- ---------------------------------------------------------------------------------------------
alter table public.social_settings add column if not exists social_suspended_at timestamptz;
alter table public.social_settings add column if not exists social_suspended_reason text;
alter table public.global_messages add column if not exists edited_at timestamptz;
alter table public.dm_messages add column if not exists edited_at timestamptz;
alter table public.content_reports add column if not exists chat_category text;
alter table public.content_reports add column if not exists target_user_id uuid;

create table if not exists public.dm_conversation_hidden (
  user_id uuid not null references auth.users(id) on delete cascade,
  conversation_id uuid not null references public.dm_conversations(id) on delete cascade,
  hidden_at timestamptz not null default now(),
  primary key (user_id, conversation_id)
);
alter table public.dm_conversation_hidden enable row level security;
do $$ begin
  if not exists (select 1 from pg_policy where polrelid = 'public.dm_conversation_hidden'::regclass and polname = 'dm_hidden_select_own') then
    create policy dm_hidden_select_own on public.dm_conversation_hidden for select to authenticated using (user_id = auth.uid());
  end if;
end $$;

-- dm_history (SQL biasa, bukan definer) membaca baris milik sendiri; RLS membatasi ke auth.uid(). Tulis hanya lewat RPC.
grant select on public.dm_conversation_hidden to authenticated;
revoke all on public.dm_conversation_hidden from anon;

create table if not exists public.social_global_config (
  id smallint primary key default 1 check (id = 1),
  slow_mode_seconds integer not null default 0 check (slow_mode_seconds in (0, 5, 10, 30)),
  pinned_text text check (pinned_text is null or char_length(pinned_text) <= 300),
  pinned_by uuid references auth.users(id) on delete set null,
  pinned_at timestamptz,
  updated_at timestamptz not null default now()
);
alter table public.social_global_config enable row level security;
insert into public.social_global_config (id) values (1) on conflict (id) do nothing;
revoke all on public.social_global_config from anon, authenticated;

create index if not exists content_reports_chat_status_idx on public.content_reports (status, created_at desc) where category = 'chat';

-- ---------------------------------------------------------------------------------------------
-- Helper internal (tidak diberikan ke klien)
-- ---------------------------------------------------------------------------------------------
create or replace function public.social_is_staff(p_user uuid)
returns boolean language sql stable security definer set search_path = ''
as $$ select exists (select 1 from public.profiles where id = p_user and role in ('owner', 'admin')) $$;
revoke all on function public.social_is_staff(uuid) from public, anon, authenticated;

create or replace function public.social_is_owner(p_user uuid)
returns boolean language sql stable security definer set search_path = ''
as $$ select exists (select 1 from public.profiles where id = p_user and role = 'owner') $$;
revoke all on function public.social_is_owner(uuid) from public, anon, authenticated;

-- Penulis sosial: anggota ber-username dan tidak terkena suspend sosial.
create or replace function public.social_assert_writer()
returns uuid language plpgsql stable security definer set search_path = ''
as $$
declare v_uid uuid := public.social_assert_member();
begin
  if exists (select 1 from public.social_settings where user_id = v_uid and social_suspended_at is not null) then
    raise exception 'social_suspended';
  end if;
  return v_uid;
end
$$;
revoke all on function public.social_assert_writer() from public, anon, authenticated;

-- Teks efektif kosong: hanya spasi/kontrol/zero-width setelah normalisasi (aksara Jepang tidak terpengaruh).
create or replace function public.social_effectively_empty(p_text text)
returns boolean language sql immutable set search_path = ''
as $$ select regexp_replace(normalize(coalesce(p_text, ''), NFKC), '[\s[:cntrl:]​-‏ -‮⁠﻿­ㅤ]', '', 'g') = '' $$;

-- Tiruan identitas resmi (ENO NIHONGO / Admin / Owner / Official), termasuk konfusabel Unicode umum.
create or replace function public.social_official_lookalike(p_text text)
returns boolean language plpgsql immutable set search_path = ''
as $$
declare
  s text := regexp_replace(
              translate(public.social_normalize_text(p_text), 'аеорсухіјѕԁɡοντ', 'aeopcyxijsdgovt'),
              '[^a-z0-9]', '', 'g');
  kw text;
begin
  if s = '' then return false; end if;
  if position('enonihongo' in s) > 0 or position('enonihon' in s) > 0 then return true; end if;
  if position('eno' in s) > 0 then
    foreach kw in array array['admin', 'ofical', 'owner', 'staf', 'suport', 'resmi', 'moderator', 'oficial'] loop
      if position(kw in s) > 0 then return true; end if;
    end loop;
  end if;
  if s ~ '^(admin|owner|oficial|ofical|moderator|staf)(eno)?$' then return true; end if;
  return false;
end
$$;

-- ---------------------------------------------------------------------------------------------
-- Username: wajib untuk semua akun; peniruan identitas resmi ditolak di server.
-- Pengaturan awal TIDAK terkena cooldown (cooldown hanya pada social_change_username).
-- ---------------------------------------------------------------------------------------------
create or replace function public.social_set_username(p_username text, p_display_name text default null)
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_name text := lower(btrim(coalesce(p_username, '')));
  v_disp text := nullif(btrim(coalesce(p_display_name, '')), '');
begin
  if v_uid is null then raise exception 'auth_required'; end if;
  if v_name !~ '^[a-z0-9_]{3,20}$' then raise exception 'invalid_username'; end if;
  if public.social_username_reserved(v_name) then raise exception 'username_reserved'; end if;
  if v_disp is not null and (char_length(v_disp) > 40 or position('@' in v_disp) > 0) then raise exception 'invalid_display_name'; end if;
  if exists (select 1 from public.profiles where id = v_uid and suspended_at is not null) then raise exception 'suspended'; end if;
  if exists (select 1 from public.social_profiles where user_id = v_uid) then raise exception 'username_already_set'; end if;
  if not public.social_is_staff(v_uid) then
    if public.social_official_lookalike(v_name) or (v_disp is not null and public.social_official_lookalike(v_disp)) then
      raise exception 'username_reserved';
    end if;
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

create or replace function public.social_change_username(p_username text)
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare
  v_uid uuid := public.social_assert_member();
  v_new text := lower(btrim(coalesce(p_username, '')));
  v_old text;
  v_changed timestamptz;
begin
  if v_new !~ '^[a-z0-9_]{3,20}$' then raise exception 'invalid_username'; end if;
  select username into v_old from public.social_profiles where user_id = v_uid for update;
  if v_new = v_old then raise exception 'username_unchanged'; end if;
  if public.social_username_reserved(v_new) then raise exception 'username_reserved'; end if;
  if not public.social_is_staff(v_uid) and public.social_official_lookalike(v_new) then raise exception 'username_reserved'; end if;
  perform public.social_assert_clean(v_new, 'username_not_allowed');
  select username_changed_at into v_changed from public.social_settings where user_id = v_uid;
  if v_changed is not null and now() < v_changed + interval '30 days' then raise exception 'username_cooldown'; end if;
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

-- ---------------------------------------------------------------------------------------------
-- Block / Report: Owner & Admin tidak bisa diblokir atau dilaporkan (server-side, dari role tepercaya).
-- ---------------------------------------------------------------------------------------------
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
  return jsonb_build_object('status', 'blocked');
end
$$;

-- Mesin laporan tunggal: scope user|global|dm, kategori spam|harassment|inappropriate|other.
create or replace function public.social_report_submit(p_scope text, p_target uuid, p_category text, p_reason text)
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare
  v_uid uuid := public.social_assert_member();
  v_cat text := lower(btrim(coalesce(p_category, 'other')));
  v_reason text := left(btrim(coalesce(p_reason, '')), 300);
  v_sender uuid;
  v_body text;
  v_name text;
  v_disp text;
  v_subject text;
  v_hist text;
  v_desc text;
begin
  if v_cat not in ('spam', 'harassment', 'inappropriate', 'other') then raise exception 'invalid_category'; end if;
  if p_scope not in ('user', 'global', 'dm') then raise exception 'invalid_scope'; end if;
  if p_scope = 'user' then
    v_sender := p_target;
    if not exists (select 1 from public.social_profiles where user_id = v_sender) then raise exception 'user_not_found'; end if;
  elsif p_scope = 'global' then
    select sender_id, body into v_sender, v_body from public.global_messages where id = p_target and deleted_at is null;
  else
    select sender_id, body into v_sender, v_body from public.dm_messages where id = p_target and deleted_at is null and v_uid in (sender_id, recipient_id);
  end if;
  if v_sender is null then raise exception 'not_found'; end if;
  if v_sender = v_uid then raise exception 'self_target'; end if;
  if public.social_is_staff(v_sender) then raise exception 'protected_target'; end if;
  v_subject := case when p_scope = 'user' then 'chat:user:' || v_sender::text else 'chat:' || p_scope || ':' || p_target::text end;
  if exists (select 1 from public.content_reports where reporter_id = v_uid and subject = v_subject) then
    return jsonb_build_object('status', 'already_reported');
  end if;
  if (select count(*) from public.content_reports where reporter_id = v_uid and category = 'chat' and created_at > now() - interval '24 hours') >= 10 then
    raise exception 'rate_limited';
  end if;
  select username, display_name into v_name, v_disp from public.social_profiles where user_id = v_sender;
  if p_scope = 'user' then
    select string_agg(old_username || ' > ' || new_username, '; ' order by changed_at desc) into v_hist
      from (select old_username, new_username, changed_at from public.social_username_history where user_id = v_sender order by changed_at desc limit 3) h;
    v_desc := 'Pengguna @' || coalesce(v_name, '?') || coalesce(' (' || v_disp || ')', '') || coalesce(E'\nRiwayat username: ' || v_hist, '');
  else
    v_desc := '@' || coalesce(v_name, '?') || ': ' || left(v_body, 500);
  end if;
  if v_reason <> '' then v_desc := v_desc || E'\nAlasan: ' || v_reason; end if;
  insert into public.content_reports (reporter_id, category, subject, description, priority, chat_category, target_user_id)
  values (v_uid, 'chat', v_subject, v_desc, case when v_cat = 'harassment' then 'high' else 'normal' end, v_cat, v_sender);
  return jsonb_build_object('status', 'reported');
end
$$;
revoke all on function public.social_report_submit(text, uuid, text, text) from public, anon;
grant execute on function public.social_report_submit(text, uuid, text, text) to authenticated;

-- Jalur lama menjadi pembungkus tipis agar tidak ada jalur laporan tanpa aturan baru.
create or replace function public.social_report_user(p_user uuid, p_reason text default null)
returns jsonb language sql security definer set search_path = ''
as $$ select public.social_report_submit('user', p_user, 'other', p_reason) $$;
create or replace function public.social_report_message(p_scope text, p_message_id uuid, p_reason text default null)
returns jsonb language plpgsql security definer set search_path = ''
as $$
begin
  if p_scope not in ('global', 'dm') then raise exception 'invalid_scope'; end if;
  return public.social_report_submit(p_scope, p_message_id, 'other', p_reason);
end
$$;

-- ---------------------------------------------------------------------------------------------
-- Kebijakan DM: Owner boleh mengirim ke setiap anggota valid tanpa pertemanan/policy; Admin tidak.
-- Validasi status akun target (tidak ada/di-suspend) tetap berlaku untuk semua.
-- ---------------------------------------------------------------------------------------------
create or replace function public.social_dm_allowed(p_from uuid, p_to uuid)
returns text language plpgsql stable security definer set search_path = ''
as $$
declare
  v_my text;
  v_pol text;
begin
  if not exists (select 1 from public.social_profiles where user_id = p_to)
     or exists (select 1 from public.profiles where id = p_to and suspended_at is not null) then
    return 'user_unavailable';
  end if;
  if public.social_is_owner(p_from) then return null; end if;
  if public.social_blocked_between(p_from, p_to) then return 'blocked'; end if;
  if not exists (select 1 from public.social_friendships
                  where user_low = least(p_from, p_to) and user_high = greatest(p_from, p_to) and status = 'accepted') then
    return 'not_friends';
  end if;
  select dm_policy into v_my from public.social_settings where user_id = p_from;
  if coalesce(v_my, 'friends') = 'none' then return 'dm_disabled_self'; end if;
  select dm_policy into v_pol from public.social_settings where user_id = p_to;
  v_pol := coalesce(v_pol, 'friends');
  if v_pol = 'none' then return 'dm_disabled'; end if;
  if v_pol = 'started_by_me' and not exists (
       select 1 from public.dm_messages m
         join public.dm_conversations c on c.id = m.conversation_id
        where c.user_low = least(p_from, p_to) and c.user_high = greatest(p_from, p_to) and m.sender_id = p_to) then
    return 'dm_not_accepted';
  end if;
  return null;
end
$$;

-- ---------------------------------------------------------------------------------------------
-- Identitas publik: Guru (teacher) = Premium efektif; Admin dikenali dari role tepercaya.
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
             (p.role = 'teacher' or p.plan = 'lifetime' or (p.plan = 'premium' and (p.premium_until is null or p.premium_until > now()))) as diamond,
             public.social_safe_photo(p.avatar_url) as photo
        from public.profiles p
       where p.id = any (p_users)
    ) b;
  return v_result;
end
$$;

-- ---------------------------------------------------------------------------------------------
-- Profile Card: role, Premium efektif, dan capabilities dari server (satu mesin izin).
-- ---------------------------------------------------------------------------------------------
create or replace function public.social_profile_card(p_user uuid, p_public boolean)
returns jsonb language plpgsql stable security definer set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  sp public.social_profiles%rowtype;
  s public.social_settings%rowtype;
  v_name text; v_level text; v_xp integer; v_rel text; v_member boolean;
  v_photo text; v_bio text; v_country text; v_role text; v_created timestamptz; v_susp timestamptz;
  v_plan text; v_until timestamptz;
  v_apply boolean; v_friends integer; v_dm text; v_viewer_owner boolean; v_staff boolean;
  v_premium boolean; v_can_msg boolean; v_can_req boolean;
  f public.social_friendships%rowtype;
begin
  if v_uid is null then raise exception 'auth_required'; end if;
  select * into sp from public.social_profiles where user_id = p_user;
  select display_name, jlpt_level, xp into v_name, v_level, v_xp from public.user_learning_stats where user_id = p_user;
  select public.social_safe_photo(avatar_url), bio, country, role, created_at, suspended_at, plan, premium_until
    into v_photo, v_bio, v_country, v_role, v_created, v_susp, v_plan, v_until
    from public.profiles where id = p_user;
  if sp.user_id is null and v_name is null and v_level is null and v_role is null then raise exception 'user_not_found'; end if;
  select * into s from public.social_settings where user_id = p_user;
  v_apply := p_user <> v_uid or coalesce(p_public, false);
  v_member := exists (select 1 from public.social_profiles where user_id = v_uid);
  v_viewer_owner := public.social_is_owner(v_uid);
  v_staff := v_role in ('owner', 'admin');
  if p_user = v_uid then
    v_rel := 'self';
  elsif v_susp is not null then
    v_rel := 'unavailable';
  elsif not v_staff and exists (select 1 from public.social_blocks where blocker_id = v_uid and blocked_id = p_user) then
    v_rel := 'blocked';
  elsif not v_staff and exists (select 1 from public.social_blocks where blocker_id = p_user and blocked_id = v_uid) and not v_viewer_owner then
    v_rel := 'unavailable';
  else
    select * into f from public.social_friendships
     where user_low = least(v_uid, p_user) and user_high = greatest(v_uid, p_user);
    v_rel := case when f.id is null then 'none'
                  when f.status = 'accepted' then 'friend'
                  when f.requester_id = v_uid then 'outgoing'
                  else 'incoming' end;
  end if;
  select count(*) into v_friends
    from public.social_friendships f2
    join public.profiles pr on pr.id = case when f2.user_low = p_user then f2.user_high else f2.user_low end
   where f2.status = 'accepted' and p_user in (f2.user_low, f2.user_high) and pr.suspended_at is null;
  if v_rel in ('friend', 'none', 'incoming', 'outgoing') and (v_rel = 'friend' or v_viewer_owner) then
    v_dm := public.social_dm_allowed(v_uid, p_user);
  end if;
  v_can_msg := v_member and v_rel in ('friend', 'none', 'incoming', 'outgoing') and (v_rel = 'friend' or v_viewer_owner) and v_dm is null
               and not exists (select 1 from public.social_settings where user_id = v_uid and social_suspended_at is not null);
  v_can_req := v_rel = 'none' and sp.user_id is not null and v_member and coalesce(s.allow_friend_requests, true)
               and v_role is distinct from 'owner' and not v_viewer_owner;
  v_premium := v_role = 'teacher' or v_plan = 'lifetime' or (v_plan = 'premium' and (v_until is null or v_until > now()));
  return jsonb_build_object(
    'has_username', sp.user_id is not null,
    'username', sp.username,
    'display_name', coalesce(sp.display_name, v_name),
    'avatar_id', coalesce(sp.avatar_id, 0),
    'photo', v_photo,
    'bio', v_bio,
    'country', case when not v_apply or coalesce(s.show_country, true) then v_country end,
    'xp', case when v_role = 'owner' then null when not v_apply or coalesce(s.show_xp, true) then coalesce(v_xp, 0) end,
    'level', case when v_role = 'owner' then null when not v_apply or coalesce(s.show_jlpt, true) then v_level end,
    'show_online', v_susp is null and (not v_apply or coalesce(s.show_online, true)),
    'official', v_role = 'owner',
    'role', case when v_role in ('owner', 'admin', 'teacher') then v_role end,
    'premium', v_premium,
    'friends', v_friends,
    'joined', to_char(v_created at time zone 'UTC', 'YYYY-MM'),
    'relation', v_rel,
    'dm_blocked', v_dm,
    'viewer_has_username', v_member,
    'can_request', v_can_req,
    'capabilities', jsonb_build_object(
      'can_message', coalesce(v_can_msg, false),
      'can_friend', coalesce(v_can_req, false),
      'can_unfriend', v_rel = 'friend' and v_role is distinct from 'owner' and not v_viewer_owner,
      'can_block', v_member and v_rel in ('none', 'friend', 'incoming', 'outgoing') and not v_staff,
      'can_report', v_member and v_rel <> 'self' and not v_staff));
end
$$;

-- ---------------------------------------------------------------------------------------------
-- Hapus percakapan (per-pengguna): hanya menyembunyikan untuk akun sendiri, data bersama utuh.
-- Pesan baru setelah hidden_at otomatis memulihkan percakapan.
-- ---------------------------------------------------------------------------------------------
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
  return jsonb_build_object('status', 'hidden');
end
$$;
revoke all on function public.dm_conversation_hide(uuid) from public, anon;
grant execute on function public.dm_conversation_hide(uuid) to authenticated;

create or replace function public.dm_conversation_list()
returns jsonb language sql stable security definer set search_path = ''
as $$
  select coalesce(jsonb_agg(x order by (x->>'last_message_at') desc), '[]'::jsonb)
  from (
    select jsonb_build_object(
      'user_id', o.user_id,
      'username', o.username,
      'display_name', o.display_name,
      'avatar_id', o.avatar_id,
      'last_message_at', c.last_message_at,
      'last_body', case when lm.deleted_at is null then lm.body else null end,
      'last_deleted', lm.deleted_at is not null,
      'last_sender_id', lm.sender_id,
      'unread', (
        select count(*) from (
          select 1 from public.dm_messages u
           where u.conversation_id = c.id and u.sender_id <> auth.uid() and u.deleted_at is null
             and u.created_at > greatest(case when c.user_low = auth.uid() then c.low_last_read_at else c.high_last_read_at end,
                                         coalesce(h.hidden_at, '-infinity'::timestamptz))
           limit 99) q),
      'is_friend', exists (
        select 1 from public.social_friendships f
         where f.user_low = c.user_low and f.user_high = c.user_high and f.status = 'accepted'),
      'muted', exists (select 1 from public.social_dm_mutes mu where mu.user_id = auth.uid() and mu.other_id = o.user_id)
    ) as x
    from public.dm_conversations c
    join public.social_profiles o on o.user_id = case when c.user_low = auth.uid() then c.user_high else c.user_low end
    left join public.dm_conversation_hidden h on h.conversation_id = c.id and h.user_id = auth.uid()
    join lateral (
      select m.body, m.deleted_at, m.sender_id from public.dm_messages m
       where m.conversation_id = c.id and m.created_at > coalesce(h.hidden_at, '-infinity'::timestamptz)
       order by m.created_at desc, m.id desc limit 1) lm on true
    where auth.uid() in (c.user_low, c.user_high)
      and not exists (select 1 from public.social_blocks b where b.blocker_id = auth.uid() and b.blocked_id = o.user_id)
    order by c.last_message_at desc
    limit 50
  ) t
$$;

create or replace function public.dm_history(p_with uuid, p_limit integer default 30, p_before_at timestamptz default null, p_before_id uuid default null)
returns jsonb language sql stable set search_path = ''
as $$
  select coalesce(jsonb_agg(m order by (m->>'created_at') desc, (m->>'id') desc), '[]'::jsonb)
  from (
    select jsonb_build_object(
      'id', d.id, 'sender_id', d.sender_id, 'body', d.body, 'deleted', d.deleted_at is not null, 'created_at', d.created_at,
      'edited_at', d.edited_at, 'reply_to', d.reply_to,
      'reply', case when r.id is null then null else jsonb_build_object('id', r.id, 'sender_id', r.sender_id, 'body', r.body, 'deleted', r.deleted_at is not null) end
    ) as m
    from public.dm_conversations c
    join public.dm_messages d on d.conversation_id = c.id
    left join public.dm_conversation_hidden h on h.conversation_id = c.id and h.user_id = auth.uid()
    left join public.dm_messages r on r.id = d.reply_to and r.created_at > coalesce(h.hidden_at, '-infinity'::timestamptz)
    where c.user_low = least(auth.uid(), p_with) and c.user_high = greatest(auth.uid(), p_with)
      and d.created_at > coalesce(h.hidden_at, '-infinity'::timestamptz)
      and not exists (select 1 from public.social_blocks b where b.blocker_id = auth.uid() and b.blocked_id = p_with)
      and (p_before_at is null or (d.created_at, d.id) < (p_before_at, coalesce(p_before_id, 'ffffffff-ffff-ffff-ffff-ffffffffffff'::uuid)))
    order by d.created_at desc, d.id desc
    limit least(greatest(coalesce(p_limit, 30), 1), 50)
  ) t
$$;

create or replace function public.global_history(p_limit integer default 30, p_before_at timestamptz default null, p_before_id uuid default null)
returns jsonb language sql stable set search_path = ''
as $$
  select coalesce(jsonb_agg(m order by (m->>'created_at') desc, (m->>'id') desc), '[]'::jsonb)
  from (
    select jsonb_build_object(
      'id', g.id, 'sender_id', g.sender_id, 'username', sp.username, 'display_name', sp.display_name, 'avatar_id', sp.avatar_id,
      'body', g.body, 'deleted', g.deleted_at is not null, 'created_at', g.created_at, 'edited_at', g.edited_at, 'reply_to', g.reply_to,
      'reply', case when r.id is null then null else jsonb_build_object('id', r.id, 'username', rsp.username, 'body', r.body, 'deleted', r.deleted_at is not null) end
    ) as m
    from public.global_messages g
    join public.social_profiles sp on sp.user_id = g.sender_id
    left join public.global_messages r on r.id = g.reply_to
    left join public.social_profiles rsp on rsp.user_id = r.sender_id
    where p_before_at is null
       or (g.created_at, g.id) < (p_before_at, coalesce(p_before_id, 'ffffffff-ffff-ffff-ffff-ffffffffffff'::uuid))
    order by g.created_at desc, g.id desc
    limit least(greatest(coalesce(p_limit, 30), 1), 50)
  ) t
$$;

-- ---------------------------------------------------------------------------------------------
-- Moderator (Owner/Admin atau izin operations.manage) untuk aksi moderasi sosial.
-- ---------------------------------------------------------------------------------------------
create or replace function public.social_assert_moderator()
returns uuid language plpgsql stable security definer set search_path = ''
as $$
declare v_uid uuid := auth.uid();
begin
  if v_uid is null then raise exception 'auth_required'; end if;
  if not (public.social_is_staff(v_uid) or public.has_permission('operations.manage')) then raise exception 'forbidden'; end if;
  return v_uid;
end
$$;
revoke all on function public.social_assert_moderator() from public, anon, authenticated;

-- ---------------------------------------------------------------------------------------------
-- Kirim pesan: validasi efektif-kosong, anti-flood (identik/mirip), slow mode, suspend sosial.
-- ---------------------------------------------------------------------------------------------
create or replace function public.global_send_message(p_body text, p_reply_to uuid default null)
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare
  v_uid uuid := public.social_assert_writer();
  v_body text := btrim(coalesce(p_body, ''));
  v_id uuid;
  v_slow integer;
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
  return jsonb_build_object('id', v_id);
end
$$;
revoke all on function public.global_send_message(text, uuid) from public, anon;
grant execute on function public.global_send_message(text, uuid) to authenticated;

create or replace function public.dm_send_message(p_to uuid, p_body text, p_reply_to uuid default null, p_client_id uuid default null)
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare
  v_uid uuid := public.social_assert_writer();
  v_body text := btrim(coalesce(p_body, ''));
  v_conv uuid;
  v_id uuid;
  v_me text;
  v_url text;
  v_reason text;
begin
  if p_to is null or p_to = v_uid then raise exception 'self_target'; end if;
  if p_client_id is not null then
    select id, conversation_id into v_id, v_conv from public.dm_messages where sender_id = v_uid and client_id = p_client_id;
    if v_id is not null then return jsonb_build_object('id', v_id, 'conversation_id', v_conv, 'duplicate', true); end if;
  end if;
  if v_body = '' or public.social_effectively_empty(v_body) then raise exception 'message_empty'; end if;
  if char_length(v_body) > 1000 then raise exception 'message_too_long'; end if;
  perform public.social_assert_clean(v_body);
  perform public.social_assert_link_allowed(v_uid, v_body);
  v_reason := public.social_dm_allowed(v_uid, p_to);
  if v_reason is not null then raise exception '%', v_reason; end if;
  if (select count(*) from public.dm_messages where sender_id = v_uid and created_at > now() - interval '10 seconds') >= 8
     or (select count(*) from public.dm_messages where sender_id = v_uid and created_at > now() - interval '1 minute') >= 40 then
    raise exception 'rate_limited';
  end if;
  if not exists (select 1 from public.dm_messages where sender_id = v_uid and recipient_id = p_to and created_at > now() - interval '1 minute')
     and (select count(distinct recipient_id) from public.dm_messages where sender_id = v_uid and created_at > now() - interval '1 minute') >= 6 then
    raise exception 'rate_limited';
  end if;
  if exists (
       select 1 from (select body from public.dm_messages
                       where sender_id = v_uid and recipient_id = p_to and deleted_at is null and created_at > now() - interval '30 seconds'
                       order by created_at desc limit 5) r
        where public.social_normalize_text(r.body) = public.social_normalize_text(v_body)) then
    raise exception 'duplicate_message';
  end if;
  insert into public.dm_conversations (user_low, user_high) values (least(v_uid, p_to), greatest(v_uid, p_to))
  on conflict (user_low, user_high) do update set last_message_at = clock_timestamp() returning id into v_conv;
  if p_reply_to is not null and not exists (select 1 from public.dm_messages where id = p_reply_to and conversation_id = v_conv) then raise exception 'not_found'; end if;
  insert into public.dm_messages (conversation_id, sender_id, recipient_id, body, reply_to, client_id, created_at)
  values (v_conv, v_uid, p_to, v_body, p_reply_to, p_client_id, clock_timestamp()) returning id into v_id;
  select username into v_me from public.social_profiles where user_id = v_uid;
  v_url := 'chat:dm:' || v_uid::text;
  if not exists (select 1 from public.user_notifications where user_id = p_to and kind = 'dm' and read_at is null and action_url = v_url) then
    insert into public.user_notifications (user_id, title, body, kind, action_url)
    values (p_to, 'Pesan baru dari @' || v_me, 'Buka obrolan untuk membaca pesan.', 'dm', v_url);
  end if;
  return jsonb_build_object('id', v_id, 'conversation_id', v_conv);
end
$$;
revoke all on function public.dm_send_message(uuid, text, uuid, uuid) from public, anon;
grant execute on function public.dm_send_message(uuid, text, uuid, uuid) to authenticated;

-- Pendaftaran permintaan teman ikut aturan suspend sosial.
do $$
declare d text;
begin
  select pg_get_functiondef('public.friend_request_send(text)'::regprocedure) into d;
  if position('social_assert_writer' in d) = 0 then
    execute replace(d, 'public.social_assert_member()', 'public.social_assert_writer()');
  end if;
end $$;

-- ---------------------------------------------------------------------------------------------
-- Edit pesan sendiri dalam 15 menit (validasi ulang penuh). Hapus pesan: moderator tercatat di audit.
-- ---------------------------------------------------------------------------------------------
create or replace function public.global_edit_message(p_id uuid, p_body text)
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare
  v_uid uuid := public.social_assert_writer();
  v_body text := btrim(coalesce(p_body, ''));
  v_created timestamptz;
begin
  if v_body = '' or public.social_effectively_empty(v_body) then raise exception 'message_empty'; end if;
  if char_length(v_body) > 500 then raise exception 'message_too_long'; end if;
  perform public.social_assert_clean(v_body);
  perform public.social_assert_link_allowed(v_uid, v_body);
  select created_at into v_created from public.global_messages where id = p_id and sender_id = v_uid and deleted_at is null;
  if v_created is null then raise exception 'not_found'; end if;
  if now() > v_created + interval '15 minutes' then raise exception 'edit_expired'; end if;
  update public.global_messages set body = v_body, edited_at = now() where id = p_id;
  return jsonb_build_object('status', 'edited');
end
$$;
revoke all on function public.global_edit_message(uuid, text) from public, anon;
grant execute on function public.global_edit_message(uuid, text) to authenticated;

create or replace function public.dm_edit_message(p_id uuid, p_body text)
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare
  v_uid uuid := public.social_assert_writer();
  v_body text := btrim(coalesce(p_body, ''));
  v_created timestamptz;
begin
  if v_body = '' or public.social_effectively_empty(v_body) then raise exception 'message_empty'; end if;
  if char_length(v_body) > 1000 then raise exception 'message_too_long'; end if;
  perform public.social_assert_clean(v_body);
  perform public.social_assert_link_allowed(v_uid, v_body);
  select created_at into v_created from public.dm_messages where id = p_id and sender_id = v_uid and deleted_at is null;
  if v_created is null then raise exception 'not_found'; end if;
  if now() > v_created + interval '15 minutes' then raise exception 'edit_expired'; end if;
  update public.dm_messages set body = v_body, edited_at = now() where id = p_id;
  return jsonb_build_object('status', 'edited');
end
$$;
revoke all on function public.dm_edit_message(uuid, text) from public, anon;
grant execute on function public.dm_edit_message(uuid, text) to authenticated;

create or replace function public.global_delete_message(p_id uuid)
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_sender uuid;
begin
  if v_uid is null then raise exception 'auth_required'; end if;
  select sender_id into v_sender from public.global_messages where id = p_id and deleted_at is null;
  if v_sender is null then raise exception 'not_found'; end if;
  if v_sender <> v_uid and not public.has_permission('operations.manage') then raise exception 'forbidden'; end if;
  update public.global_messages set deleted_at = now(), deleted_by = v_uid, body = '' where id = p_id;
  if v_sender <> v_uid then
    insert into public.admin_audit_log (actor_id, action, entity_type, entity_id, metadata)
    values (v_uid, 'social_moderator_delete', 'global_message', p_id::text, jsonb_build_object('target_user', v_sender));
  end if;
  return jsonb_build_object('status', 'deleted');
end
$$;

-- ---------------------------------------------------------------------------------------------
-- Global: slow mode + satu pengumuman tersemat (Owner/Admin), dengan audit.
-- ---------------------------------------------------------------------------------------------
create or replace function public.global_config()
returns jsonb language sql stable security definer set search_path = ''
as $$
  select case when auth.uid() is null then null else (
    select jsonb_build_object(
      'slow_mode_seconds', c.slow_mode_seconds,
      'pinned', case when c.pinned_text is null then null else jsonb_build_object('text', c.pinned_text, 'at', c.pinned_at) end)
    from public.social_global_config c where c.id = 1) end
$$;
revoke all on function public.global_config() from public, anon;
grant execute on function public.global_config() to authenticated;

create or replace function public.global_set_slow_mode(p_seconds integer)
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare v_uid uuid := public.social_assert_moderator();
begin
  if p_seconds is null or p_seconds not in (0, 5, 10, 30) then raise exception 'invalid_setting'; end if;
  update public.social_global_config set slow_mode_seconds = p_seconds, updated_at = now() where id = 1;
  insert into public.admin_audit_log (actor_id, action, entity_type, entity_id, metadata)
  values (v_uid, 'social_slow_mode', 'global_chat', '1', jsonb_build_object('seconds', p_seconds));
  return public.global_config();
end
$$;
revoke all on function public.global_set_slow_mode(integer) from public, anon;
grant execute on function public.global_set_slow_mode(integer) to authenticated;

create or replace function public.global_set_pin(p_text text)
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare
  v_uid uuid := public.social_assert_moderator();
  v_text text := btrim(coalesce(p_text, ''));
begin
  if v_text = '' or public.social_effectively_empty(v_text) then
    update public.social_global_config set pinned_text = null, pinned_by = null, pinned_at = null, updated_at = now() where id = 1;
    insert into public.admin_audit_log (actor_id, action, entity_type, entity_id, metadata)
    values (v_uid, 'social_unpin', 'global_chat', '1', '{}'::jsonb);
  else
    if char_length(v_text) > 300 then raise exception 'message_too_long'; end if;
    perform public.social_assert_clean(v_text);
    perform public.social_assert_link_allowed(v_uid, v_text);
    update public.social_global_config set pinned_text = v_text, pinned_by = v_uid, pinned_at = now(), updated_at = now() where id = 1;
    insert into public.admin_audit_log (actor_id, action, entity_type, entity_id, metadata)
    values (v_uid, 'social_pin', 'global_chat', '1', jsonb_build_object('length', char_length(v_text)));
  end if;
  return public.global_config();
end
$$;
revoke all on function public.global_set_pin(text) from public, anon;
grant execute on function public.global_set_pin(text) to authenticated;

-- ---------------------------------------------------------------------------------------------
-- Suspend sosial (terpisah dari ban autentikasi) + antrean moderasi + penyelesaian laporan.
-- ---------------------------------------------------------------------------------------------
create or replace function public.social_admin_suspend(p_user uuid, p_suspend boolean, p_reason text default null)
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare v_uid uuid := public.social_assert_moderator();
begin
  if p_user is null or not exists (select 1 from public.profiles where id = p_user) then raise exception 'user_not_found'; end if;
  if p_user = v_uid or public.social_is_staff(p_user) then raise exception 'protected_target'; end if;
  insert into public.social_settings (user_id) values (p_user) on conflict (user_id) do nothing;
  update public.social_settings
     set social_suspended_at = case when p_suspend then now() else null end,
         social_suspended_reason = case when p_suspend then left(btrim(coalesce(p_reason, '')), 200) else null end,
         updated_at = now()
   where user_id = p_user;
  insert into public.admin_audit_log (actor_id, action, entity_type, entity_id, metadata)
  values (v_uid, case when p_suspend then 'social_suspend' else 'social_unsuspend' end, 'social_user', p_user::text,
          jsonb_build_object('reason', left(btrim(coalesce(p_reason, '')), 200)));
  return jsonb_build_object('status', case when p_suspend then 'suspended' else 'active' end);
end
$$;
revoke all on function public.social_admin_suspend(uuid, boolean, text) from public, anon;
grant execute on function public.social_admin_suspend(uuid, boolean, text) to authenticated;

create or replace function public.social_admin_reports(p_status text default 'open', p_limit integer default 50)
returns jsonb language plpgsql stable security definer set search_path = ''
as $$
declare v_status text := coalesce(nullif(btrim(p_status), ''), 'open');
begin
  perform public.social_assert_moderator();
  if v_status not in ('open', 'reviewing', 'resolved', 'rejected') then raise exception 'invalid_setting'; end if;
  return coalesce((
    select jsonb_agg(x order by (x->>'created_at') desc)
    from (
      select jsonb_build_object(
        'id', r.id, 'status', r.status, 'category', coalesce(r.chat_category, 'other'),
        'subject', r.subject, 'evidence', left(r.description, 600), 'created_at', r.created_at,
        'reporter', rp.username, 'target_id', r.target_user_id, 'target', tp.username,
        'target_social_suspended', exists (select 1 from public.social_settings ss where ss.user_id = r.target_user_id and ss.social_suspended_at is not null),
        'resolution_note', r.resolution_note) as x
      from public.content_reports r
      left join public.social_profiles rp on rp.user_id = r.reporter_id
      left join public.social_profiles tp on tp.user_id = r.target_user_id
      where r.category = 'chat' and r.status = v_status
      order by r.created_at desc
      limit least(greatest(coalesce(p_limit, 50), 1), 100)
    ) t), '[]'::jsonb);
end
$$;
revoke all on function public.social_admin_reports(text, integer) from public, anon;
grant execute on function public.social_admin_reports(text, integer) to authenticated;

create or replace function public.social_admin_report_resolve(p_id uuid, p_action text, p_note text default null)
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare
  v_uid uuid := public.social_assert_moderator();
  v_target uuid;
  v_status text;
begin
  if p_action not in ('reviewing', 'resolve', 'reject', 'suspend') then raise exception 'invalid_setting'; end if;
  select target_user_id into v_target from public.content_reports where id = p_id and category = 'chat';
  if not found then raise exception 'not_found'; end if;
  v_status := case p_action when 'reviewing' then 'reviewing' when 'reject' then 'rejected' else 'resolved' end;
  if p_action = 'suspend' then
    perform public.social_admin_suspend(v_target, true, p_note);
  end if;
  update public.content_reports
     set status = v_status, resolution_note = nullif(left(btrim(coalesce(p_note, '')), 300), ''), assigned_to = v_uid, updated_at = now()
   where id = p_id;
  insert into public.admin_audit_log (actor_id, action, entity_type, entity_id, metadata)
  values (v_uid, 'social_report_' || p_action, 'content_report', p_id::text, jsonb_build_object('status', v_status));
  return jsonb_build_object('status', v_status);
end
$$;
revoke all on function public.social_admin_report_resolve(uuid, text, text) from public, anon;
grant execute on function public.social_admin_report_resolve(uuid, text, text) to authenticated;

-- Mention: pencarian EKSAK satu username (tanpa autocomplete); null bila tidak ada/terblokir.
create or replace function public.social_user_by_username(p_username text)
returns jsonb language plpgsql stable security definer set search_path = ''
as $$
declare v_uid uuid := auth.uid(); v_name text := lower(btrim(coalesce(p_username, ''))); v_id uuid;
begin
  if v_uid is null then raise exception 'auth_required'; end if;
  if v_name !~ '^[a-z0-9_]{3,20}$' then return null; end if;
  select user_id into v_id from public.social_profiles where username = v_name;
  if v_id is null or public.social_blocked_between(v_uid, v_id) then return null; end if;
  return jsonb_build_object('user_id', v_id);
end
$$;
revoke all on function public.social_user_by_username(text) from public, anon;
grant execute on function public.social_user_by_username(text) to authenticated;

-- social_me: tambahan flag DM tanpa batas (Owner, dari role server) dan status suspend sosial.
create or replace function public.social_me()
returns jsonb language sql stable security definer set search_path = ''
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
          'is_moderator', public.has_permission('operations.manage') or public.social_is_staff(sp.user_id),
          'unrestricted_dm', public.social_is_owner(sp.user_id),
          'social_suspended', ss.social_suspended_at is not null,
          'allow_friend_requests', coalesce(ss.allow_friend_requests, true),
          'sound_enabled', coalesce(ss.sound_enabled, true),
          'show_online', coalesce(ss.show_online, true),
          'show_country', coalesce(ss.show_country, true),
          'show_jlpt', coalesce(ss.show_jlpt, true),
          'show_xp', coalesce(ss.show_xp, true),
          'dm_policy', coalesce(ss.dm_policy, 'friends'),
          'next_username_change_at',
            case when ss.username_changed_at is not null and now() < ss.username_changed_at + interval '30 days'
                 then ss.username_changed_at + interval '30 days' end)
         from public.social_profiles sp
         left join public.social_settings ss on ss.user_id = sp.user_id
        where sp.user_id = auth.uid()),
      jsonb_build_object('has_username', false, 'is_moderator', false, 'social_suspended', false,
                         'allow_friend_requests', true, 'sound_enabled', true,
                         'show_online', true, 'show_country', true, 'show_jlpt', true, 'show_xp', true,
                         'dm_policy', 'friends', 'next_username_change_at', null))
  end
$$;
