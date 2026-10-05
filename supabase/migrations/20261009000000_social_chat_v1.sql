-- Social/Chat v1: username unik, chat global, pertemanan, DM, block, laporan, unread.
-- Aditif dan idempotent: tidak menyentuh data yang sudah ada, RLS aktif di semua tabel baru.
-- Semua penulisan lewat RPC (security definer, identitas dari auth.uid()); klien hanya SELECT (dibatasi RLS).
-- Moderasi memakai sistem izin yang sudah ada: public.has_permission('operations.manage').
-- Nama tampilan sosial terpisah dari public.profiles (profiles hanya terbaca pemiliknya dan bisa berisi nama dari email).
set local lock_timeout = '8s';

-- ---------------------------------------------------------------------------------------------
-- Tabel
-- ---------------------------------------------------------------------------------------------
create table if not exists public.social_profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  username text not null,
  display_name text,
  avatar_id smallint not null default 0,
  created_at timestamptz not null default now(),
  constraint social_username_format check (username ~ '^[a-z0-9_]{3,20}$'),
  constraint social_display_name_len check (
    display_name is null or char_length(btrim(display_name)) between 1 and 40
  ),
  constraint social_avatar_range check (avatar_id between 0 and 99)
);
create unique index if not exists social_profiles_username_key on public.social_profiles (username);
create index if not exists social_profiles_username_prefix
  on public.social_profiles (username text_pattern_ops);

create table if not exists public.social_global_read (
  user_id uuid primary key references auth.users (id) on delete cascade,
  last_read_at timestamptz not null default now()
);

create table if not exists public.social_blocks (
  blocker_id uuid not null references auth.users (id) on delete cascade,
  blocked_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  constraint social_blocks_not_self check (blocker_id <> blocked_id)
);
create index if not exists social_blocks_blocked_idx on public.social_blocks (blocked_id);

-- Satu baris per pasangan (user_low < user_high): mencegah duplikat dan permintaan ganda arah berlawanan.
create table if not exists public.social_friendships (
  id uuid primary key default gen_random_uuid(),
  user_low uuid not null references auth.users (id) on delete cascade,
  user_high uuid not null references auth.users (id) on delete cascade,
  requester_id uuid not null references auth.users (id) on delete cascade,
  status text not null default 'pending',
  created_at timestamptz not null default now(),
  responded_at timestamptz,
  constraint social_friendships_order check (user_low < user_high),
  constraint social_friendships_requester check (requester_id in (user_low, user_high)),
  constraint social_friendships_status check (status in ('pending', 'accepted')),
  constraint social_friendships_pair unique (user_low, user_high)
);
create index if not exists social_friendships_high_idx on public.social_friendships (user_high);

create table if not exists public.global_messages (
  id uuid primary key default gen_random_uuid(),
  sender_id uuid not null references auth.users (id) on delete cascade,
  body text not null,
  reply_to uuid references public.global_messages (id) on delete set null,
  deleted_at timestamptz,
  deleted_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  constraint global_messages_body check (
    char_length(body) <= 500 and (deleted_at is not null or char_length(btrim(body)) >= 1)
  )
);
create index if not exists global_messages_created_idx on public.global_messages (created_at desc, id desc);
create index if not exists global_messages_sender_idx on public.global_messages (sender_id, created_at desc);

create table if not exists public.dm_conversations (
  id uuid primary key default gen_random_uuid(),
  user_low uuid not null references auth.users (id) on delete cascade,
  user_high uuid not null references auth.users (id) on delete cascade,
  low_last_read_at timestamptz not null default now(),
  high_last_read_at timestamptz not null default now(),
  last_message_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  constraint dm_conversations_order check (user_low < user_high),
  constraint dm_conversations_pair unique (user_low, user_high)
);
create index if not exists dm_conversations_high_idx on public.dm_conversations (user_high);

create table if not exists public.dm_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.dm_conversations (id) on delete cascade,
  sender_id uuid not null references auth.users (id) on delete cascade,
  recipient_id uuid not null references auth.users (id) on delete cascade,
  body text not null,
  reply_to uuid references public.dm_messages (id) on delete set null,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  constraint dm_messages_body check (
    char_length(body) <= 1000 and (deleted_at is not null or char_length(btrim(body)) >= 1)
  ),
  constraint dm_messages_not_self check (sender_id <> recipient_id)
);
create index if not exists dm_messages_conv_idx on public.dm_messages (conversation_id, created_at desc, id desc);
create index if not exists dm_messages_sender_idx on public.dm_messages (sender_id, created_at desc);

-- ---------------------------------------------------------------------------------------------
-- RLS + hak akses: klien hanya SELECT; semua penulisan lewat RPC.
-- ---------------------------------------------------------------------------------------------
alter table public.social_profiles enable row level security;
alter table public.social_global_read enable row level security;
alter table public.social_blocks enable row level security;
alter table public.social_friendships enable row level security;
alter table public.global_messages enable row level security;
alter table public.dm_conversations enable row level security;
alter table public.dm_messages enable row level security;

revoke all on table public.social_profiles from public, anon, authenticated;
revoke all on table public.social_global_read from public, anon, authenticated;
revoke all on table public.social_blocks from public, anon, authenticated;
revoke all on table public.social_friendships from public, anon, authenticated;
revoke all on table public.global_messages from public, anon, authenticated;
revoke all on table public.dm_conversations from public, anon, authenticated;
revoke all on table public.dm_messages from public, anon, authenticated;

grant select on public.social_profiles to authenticated;
grant select on public.social_global_read to authenticated;
grant select on public.social_blocks to authenticated;
grant select on public.social_friendships to authenticated;
grant select on public.global_messages to authenticated;
grant select on public.dm_conversations to authenticated;
grant select on public.dm_messages to authenticated;

drop policy if exists social_profiles_select on public.social_profiles;
create policy social_profiles_select on public.social_profiles
  for select to authenticated using (true);

drop policy if exists social_global_read_select_own on public.social_global_read;
create policy social_global_read_select_own on public.social_global_read
  for select to authenticated using ((select auth.uid()) = user_id);

drop policy if exists social_blocks_select_own on public.social_blocks;
create policy social_blocks_select_own on public.social_blocks
  for select to authenticated using ((select auth.uid()) = blocker_id);

drop policy if exists social_friendships_select_member on public.social_friendships;
create policy social_friendships_select_member on public.social_friendships
  for select to authenticated using ((select auth.uid()) in (user_low, user_high));

-- Pesan dari user yang saya blokir tidak terbaca oleh saya.
drop policy if exists global_messages_select on public.global_messages;
create policy global_messages_select on public.global_messages
  for select to authenticated using (
    not exists (
      select 1 from public.social_blocks b
      where b.blocker_id = (select auth.uid()) and b.blocked_id = sender_id
    )
  );

drop policy if exists dm_conversations_select_member on public.dm_conversations;
create policy dm_conversations_select_member on public.dm_conversations
  for select to authenticated using ((select auth.uid()) in (user_low, user_high));

drop policy if exists dm_messages_select_member on public.dm_messages;
create policy dm_messages_select_member on public.dm_messages
  for select to authenticated using ((select auth.uid()) in (sender_id, recipient_id));

-- ---------------------------------------------------------------------------------------------
-- Fungsi internal (tidak diberikan ke klien)
-- ---------------------------------------------------------------------------------------------
create or replace function public.social_blocked_between(p_a uuid, p_b uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.social_blocks
    where (blocker_id = p_a and blocked_id = p_b) or (blocker_id = p_b and blocked_id = p_a)
  )
$$;

-- Penghapusan baris pertemanan dipusatkan di dua fungsi kecil (internal, tidak diberikan ke klien).
create or replace function public.social_drop_pending(p_a uuid, p_b uuid, p_requester uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from public.social_friendships
   where user_low = least(p_a, p_b) and user_high = greatest(p_a, p_b) and status = 'pending' and requester_id = p_requester;
  return found;
end
$$;

create or replace function public.social_end_friendship(p_a uuid, p_b uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from public.social_friendships
   where user_low = least(p_a, p_b) and user_high = greatest(p_a, p_b);
  return found;
end
$$;

-- Pemanggil harus login, tidak disuspend, dan sudah punya username. Mengembalikan auth.uid().
create or replace function public.social_assert_member()
returns uuid
language plpgsql
stable
security definer
set search_path = ''
as $$
declare v_uid uuid := auth.uid();
begin
  if v_uid is null then raise exception 'auth_required'; end if;
  if exists (select 1 from public.profiles where id = v_uid and suspended_at is not null) then
    raise exception 'suspended';
  end if;
  if not exists (select 1 from public.social_profiles where user_id = v_uid) then
    raise exception 'username_required';
  end if;
  return v_uid;
end
$$;

-- ---------------------------------------------------------------------------------------------
-- Username / identitas
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
          'is_moderator', public.has_permission('operations.manage'))
         from public.social_profiles sp where sp.user_id = auth.uid()),
      jsonb_build_object('has_username', false, 'is_moderator', false))
  end
$$;

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
  if v_name = any (array['admin','administrator','moderator','support','system','root','eno','enonihongo','owner','staff']) then
    raise exception 'username_reserved';
  end if;
  if v_disp is not null and (char_length(v_disp) > 40 or position('@' in v_disp) > 0) then
    raise exception 'invalid_display_name';
  end if;
  if exists (select 1 from public.profiles where id = v_uid and suspended_at is not null) then
    raise exception 'suspended';
  end if;
  if exists (select 1 from public.social_profiles where user_id = v_uid) then
    raise exception 'username_already_set';
  end if;
  begin
    insert into public.social_profiles (user_id, username, display_name) values (v_uid, v_name, v_disp);
  exception when unique_violation then
    raise exception 'username_taken';
  end;
  insert into public.social_global_read (user_id) values (v_uid) on conflict (user_id) do nothing;
  return public.social_me();
end
$$;

-- ---------------------------------------------------------------------------------------------
-- Pertemanan + block
-- ---------------------------------------------------------------------------------------------
create or replace function public.social_search_users(p_query text)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_uid uuid := public.social_assert_member();
  v_q text := regexp_replace(lower(btrim(coalesce(p_query, ''))), '[^a-z0-9_]', '', 'g');
begin
  if char_length(v_q) < 2 then return '[]'::jsonb; end if;
  return coalesce((
    select jsonb_agg(r order by r->>'username')
    from (
      select jsonb_build_object(
        'user_id', sp.user_id,
        'username', sp.username,
        'display_name', sp.display_name,
        'avatar_id', sp.avatar_id,
        'relation', case
          when f.status = 'accepted' then 'friend'
          when f.status = 'pending' and f.requester_id = v_uid then 'outgoing'
          when f.status = 'pending' then 'incoming'
          else 'none' end) as r
      from public.social_profiles sp
      left join public.social_friendships f
        on f.user_low = least(sp.user_id, v_uid) and f.user_high = greatest(sp.user_id, v_uid)
      where sp.user_id <> v_uid
        and sp.username like replace(v_q, '_', '\_') || '%'
        and not public.social_blocked_between(v_uid, sp.user_id)
      order by sp.username
      limit 10
    ) s
  ), '[]'::jsonb);
end
$$;

create or replace function public.social_overview()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare v_uid uuid := public.social_assert_member();
begin
  return jsonb_build_object(
    'friends', coalesce((
      select jsonb_agg(jsonb_build_object('user_id', sp.user_id, 'username', sp.username,
               'display_name', sp.display_name, 'avatar_id', sp.avatar_id) order by sp.username)
      from public.social_friendships f
      join public.social_profiles sp on sp.user_id = case when f.user_low = v_uid then f.user_high else f.user_low end
      where f.status = 'accepted' and v_uid in (f.user_low, f.user_high)
        and not exists (select 1 from public.social_blocks b where b.blocker_id = v_uid and b.blocked_id = sp.user_id)
    ), '[]'::jsonb),
    'incoming', coalesce((
      select jsonb_agg(jsonb_build_object('user_id', sp.user_id, 'username', sp.username,
               'display_name', sp.display_name, 'avatar_id', sp.avatar_id) order by f.created_at desc)
      from public.social_friendships f
      join public.social_profiles sp on sp.user_id = f.requester_id
      where f.status = 'pending' and f.requester_id <> v_uid and v_uid in (f.user_low, f.user_high)
        and not public.social_blocked_between(v_uid, sp.user_id)
    ), '[]'::jsonb),
    'outgoing', coalesce((
      select jsonb_agg(jsonb_build_object('user_id', sp.user_id, 'username', sp.username,
               'display_name', sp.display_name, 'avatar_id', sp.avatar_id) order by f.created_at desc)
      from public.social_friendships f
      join public.social_profiles sp on sp.user_id = case when f.user_low = v_uid then f.user_high else f.user_low end
      where f.status = 'pending' and f.requester_id = v_uid
        and not public.social_blocked_between(v_uid, sp.user_id)
    ), '[]'::jsonb),
    'blocked', coalesce((
      select jsonb_agg(jsonb_build_object('user_id', sp.user_id, 'username', sp.username,
               'display_name', sp.display_name, 'avatar_id', sp.avatar_id) order by sp.username)
      from public.social_blocks b
      join public.social_profiles sp on sp.user_id = b.blocked_id
      where b.blocker_id = v_uid
    ), '[]'::jsonb)
  );
end
$$;

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
begin
  select user_id into v_target from public.social_profiles
   where username = lower(btrim(coalesce(p_username, '')));
  if v_target is null then raise exception 'user_not_found'; end if;
  if v_target = v_uid then raise exception 'self_target'; end if;
  if exists (select 1 from public.social_blocks where blocker_id = v_uid and blocked_id = v_target) then
    raise exception 'blocked';
  end if;
  if exists (select 1 from public.social_blocks where blocker_id = v_target and blocked_id = v_uid) then
    raise exception 'user_not_found';
  end if;
  select username into v_me from public.social_profiles where user_id = v_uid;

  select * into v_row from public.social_friendships
   where user_low = least(v_uid, v_target) and user_high = greatest(v_uid, v_target);
  if found then
    if v_row.status = 'accepted' then raise exception 'already_friends'; end if;
    if v_row.requester_id = v_uid then raise exception 'request_exists'; end if;
    -- Permintaan dari arah sebaliknya sudah menunggu: langsung diterima.
    update public.social_friendships set status = 'accepted', responded_at = now() where id = v_row.id;
    insert into public.user_notifications (user_id, title, body, kind)
    values (v_target, 'Pertemanan diterima', '@' || v_me || ' sekarang berteman denganmu.', 'friend_accepted');
    return jsonb_build_object('status', 'accepted');
  end if;

  if (select count(*) from public.social_friendships where requester_id = v_uid and status = 'pending') >= 30 then
    raise exception 'too_many_requests';
  end if;
  begin
    insert into public.social_friendships (user_low, user_high, requester_id)
    values (least(v_uid, v_target), greatest(v_uid, v_target), v_uid);
  exception when unique_violation then
    raise exception 'request_exists';
  end;
  insert into public.user_notifications (user_id, title, body, kind)
  values (v_target, 'Permintaan pertemanan', '@' || v_me || ' ingin berteman denganmu.', 'friend_request');
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
   where user_low = least(v_uid, p_user) and user_high = greatest(v_uid, p_user)
     and status = 'pending' and requester_id = p_user and p_user <> v_uid;
  if v_id is null then raise exception 'no_request'; end if;
  if public.social_blocked_between(v_uid, p_user) then raise exception 'blocked'; end if;
  if p_accept then
    update public.social_friendships set status = 'accepted', responded_at = now() where id = v_id;
    select username into v_me from public.social_profiles where user_id = v_uid;
    insert into public.user_notifications (user_id, title, body, kind)
    values (p_user, 'Pertemanan diterima', '@' || v_me || ' menerima permintaan pertemananmu.', 'friend_accepted');
    return jsonb_build_object('status', 'accepted');
  end if;
  perform public.social_drop_pending(v_uid, p_user, p_user);
  return jsonb_build_object('status', 'rejected');
end
$$;

create or replace function public.friend_request_cancel(p_user uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare v_uid uuid := public.social_assert_member();
begin
  if p_user = v_uid or not public.social_drop_pending(v_uid, p_user, v_uid) then
    raise exception 'no_request';
  end if;
  return jsonb_build_object('status', 'cancelled');
end
$$;

create or replace function public.friend_remove(p_user uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare v_uid uuid := public.social_assert_member();
begin
  delete from public.social_friendships
   where user_low = least(v_uid, p_user) and user_high = greatest(v_uid, p_user)
     and status = 'accepted' and p_user <> v_uid;
  if not found then raise exception 'not_friends'; end if;
  return jsonb_build_object('status', 'removed');
end
$$;

create or replace function public.social_block(p_user uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare v_uid uuid := public.social_assert_member();
begin
  if p_user = v_uid then raise exception 'self_target'; end if;
  if not exists (select 1 from public.social_profiles where user_id = p_user) then
    raise exception 'user_not_found';
  end if;
  insert into public.social_blocks (blocker_id, blocked_id) values (v_uid, p_user)
  on conflict (blocker_id, blocked_id) do nothing;
  -- Pertemanan dan permintaan yang tertunda berakhir saat block.
  perform public.social_end_friendship(v_uid, p_user);
  return jsonb_build_object('status', 'blocked');
end
$$;

create or replace function public.social_unblock(p_user uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare v_uid uuid := public.social_assert_member();
begin
  delete from public.social_blocks where blocker_id = v_uid and blocked_id = p_user;
  return jsonb_build_object('status', 'unblocked');
end
$$;

-- ---------------------------------------------------------------------------------------------
-- Chat global
-- ---------------------------------------------------------------------------------------------
create or replace function public.global_history(
  p_limit integer default 30,
  p_before_at timestamptz default null,
  p_before_id uuid default null
)
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  select coalesce(jsonb_agg(m order by (m->>'created_at') desc, (m->>'id') desc), '[]'::jsonb)
  from (
    select jsonb_build_object(
      'id', g.id,
      'sender_id', g.sender_id,
      'username', sp.username,
      'display_name', sp.display_name,
      'avatar_id', sp.avatar_id,
      'body', g.body,
      'deleted', g.deleted_at is not null,
      'created_at', g.created_at,
      'reply_to', g.reply_to,
      'reply', case when r.id is null then null else jsonb_build_object(
        'id', r.id, 'username', rsp.username, 'body', r.body, 'deleted', r.deleted_at is not null) end
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
  if (select count(*) from public.global_messages
       where sender_id = v_uid and created_at > now() - interval '10 seconds') >= 5 then
    raise exception 'rate_limited';
  end if;
  if exists (select 1 from public.global_messages
              where sender_id = v_uid and body = v_body and deleted_at is null
                and created_at > now() - interval '30 seconds') then
    raise exception 'rate_limited';
  end if;
  if p_reply_to is not null
     and not exists (select 1 from public.global_messages where id = p_reply_to) then
    raise exception 'not_found';
  end if;
  insert into public.global_messages (sender_id, body, reply_to, created_at)
  values (v_uid, v_body, p_reply_to, clock_timestamp()) returning id into v_id;
  return jsonb_build_object('id', v_id);
end
$$;

create or replace function public.global_delete_message(p_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_sender uuid;
begin
  if v_uid is null then raise exception 'auth_required'; end if;
  select sender_id into v_sender from public.global_messages where id = p_id and deleted_at is null;
  if v_sender is null then raise exception 'not_found'; end if;
  if v_sender <> v_uid and not public.has_permission('operations.manage') then
    raise exception 'forbidden';
  end if;
  update public.global_messages set deleted_at = now(), deleted_by = v_uid, body = '' where id = p_id;
  return jsonb_build_object('status', 'deleted');
end
$$;

create or replace function public.global_mark_read()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare v_uid uuid := public.social_assert_member();
begin
  insert into public.social_global_read (user_id, last_read_at) values (v_uid, now())
  on conflict (user_id) do update set last_read_at = excluded.last_read_at;
  return jsonb_build_object('status', 'ok');
end
$$;

-- Laporan memakai tabel moderasi yang sudah ada (content_reports, ditinjau staf dengan operations.manage).
create or replace function public.social_report_message(p_scope text, p_message_id uuid, p_reason text default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := public.social_assert_member();
  v_body text;
  v_sender uuid;
  v_name text;
  v_subject text;
  v_reason text := left(btrim(coalesce(p_reason, '')), 300);
begin
  if p_scope not in ('global', 'dm') then raise exception 'invalid_scope'; end if;
  if p_scope = 'global' then
    select body, sender_id into v_body, v_sender from public.global_messages
     where id = p_message_id and deleted_at is null;
  else
    select body, sender_id into v_body, v_sender from public.dm_messages
     where id = p_message_id and deleted_at is null and v_uid in (sender_id, recipient_id);
  end if;
  if v_sender is null then raise exception 'not_found'; end if;
  if v_sender = v_uid then raise exception 'self_target'; end if;
  v_subject := 'chat:' || p_scope || ':' || p_message_id::text;
  if exists (select 1 from public.content_reports where reporter_id = v_uid and subject = v_subject) then
    return jsonb_build_object('status', 'already_reported');
  end if;
  if (select count(*) from public.content_reports
       where reporter_id = v_uid and category = 'chat' and created_at > now() - interval '24 hours') >= 10 then
    raise exception 'rate_limited';
  end if;
  select username into v_name from public.social_profiles where user_id = v_sender;
  insert into public.content_reports (reporter_id, category, subject, description, priority)
  values (v_uid, 'chat', v_subject,
          '@' || coalesce(v_name, '?') || ': ' || left(v_body, 500)
            || case when v_reason <> '' then E'\nAlasan: ' || v_reason else '' end,
          'normal');
  return jsonb_build_object('status', 'reported');
end
$$;

-- ---------------------------------------------------------------------------------------------
-- DM
-- ---------------------------------------------------------------------------------------------
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
  v_title text;
begin
  if p_to is null or p_to = v_uid then raise exception 'self_target'; end if;
  if v_body = '' then raise exception 'message_empty'; end if;
  if char_length(v_body) > 1000 then raise exception 'message_too_long'; end if;
  if public.social_blocked_between(v_uid, p_to) then raise exception 'blocked'; end if;
  if not exists (
    select 1 from public.social_friendships
     where user_low = least(v_uid, p_to) and user_high = greatest(v_uid, p_to) and status = 'accepted'
  ) then raise exception 'not_friends'; end if;
  if (select count(*) from public.dm_messages
       where sender_id = v_uid and created_at > now() - interval '10 seconds') >= 8 then
    raise exception 'rate_limited';
  end if;

  insert into public.dm_conversations (user_low, user_high)
  values (least(v_uid, p_to), greatest(v_uid, p_to))
  on conflict (user_low, user_high) do update set last_message_at = clock_timestamp()
  returning id into v_conv;

  if p_reply_to is not null
     and not exists (select 1 from public.dm_messages where id = p_reply_to and conversation_id = v_conv) then
    raise exception 'not_found';
  end if;

  -- clock_timestamp(): pesan pertama harus lebih baru dari waktu baca percakapan yang dibuat di transaksi yang sama.
  insert into public.dm_messages (conversation_id, sender_id, recipient_id, body, reply_to, created_at)
  values (v_conv, v_uid, p_to, v_body, p_reply_to, clock_timestamp()) returning id into v_id;

  -- Satu notifikasi per pengirim selama belum dibaca (tanpa spam per pesan).
  select username into v_me from public.social_profiles where user_id = v_uid;
  v_title := 'Pesan baru dari @' || v_me;
  if not exists (select 1 from public.user_notifications
                  where user_id = p_to and kind = 'dm' and read_at is null and title = v_title) then
    insert into public.user_notifications (user_id, title, body, kind)
    values (p_to, v_title, 'Buka obrolan untuk membaca pesan.', 'dm');
  end if;
  return jsonb_build_object('id', v_id, 'conversation_id', v_conv);
end
$$;

create or replace function public.dm_history(
  p_with uuid,
  p_limit integer default 30,
  p_before_at timestamptz default null,
  p_before_id uuid default null
)
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  select coalesce(jsonb_agg(m order by (m->>'created_at') desc, (m->>'id') desc), '[]'::jsonb)
  from (
    select jsonb_build_object(
      'id', d.id,
      'sender_id', d.sender_id,
      'body', d.body,
      'deleted', d.deleted_at is not null,
      'created_at', d.created_at,
      'reply_to', d.reply_to,
      'reply', case when r.id is null then null else jsonb_build_object(
        'id', r.id, 'sender_id', r.sender_id, 'body', r.body, 'deleted', r.deleted_at is not null) end
    ) as m
    from public.dm_conversations c
    join public.dm_messages d on d.conversation_id = c.id
    left join public.dm_messages r on r.id = d.reply_to
    where c.user_low = least(auth.uid(), p_with) and c.user_high = greatest(auth.uid(), p_with)
      and not exists (select 1 from public.social_blocks b where b.blocker_id = auth.uid() and b.blocked_id = p_with)
      and (p_before_at is null
           or (d.created_at, d.id) < (p_before_at, coalesce(p_before_id, 'ffffffff-ffff-ffff-ffff-ffffffffffff'::uuid)))
    order by d.created_at desc, d.id desc
    limit least(greatest(coalesce(p_limit, 30), 1), 50)
  ) t
$$;

create or replace function public.dm_conversation_list()
returns jsonb
language sql
stable
security invoker
set search_path = ''
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
             and u.created_at > case when c.user_low = auth.uid() then c.low_last_read_at else c.high_last_read_at end
           limit 99) q),
      'is_friend', exists (
        select 1 from public.social_friendships f
         where f.user_low = c.user_low and f.user_high = c.user_high and f.status = 'accepted')
    ) as x
    from public.dm_conversations c
    join public.social_profiles o on o.user_id = case when c.user_low = auth.uid() then c.user_high else c.user_low end
    join lateral (
      select m.body, m.deleted_at, m.sender_id from public.dm_messages m
       where m.conversation_id = c.id order by m.created_at desc, m.id desc limit 1) lm on true
    where auth.uid() in (c.user_low, c.user_high)
      and not exists (select 1 from public.social_blocks b where b.blocker_id = auth.uid() and b.blocked_id = o.user_id)
    order by c.last_message_at desc
    limit 50
  ) t
$$;

create or replace function public.dm_delete_message(p_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare v_uid uuid := public.social_assert_member();
begin
  update public.dm_messages set deleted_at = now(), body = ''
   where id = p_id and sender_id = v_uid and deleted_at is null;
  if not found then raise exception 'not_found'; end if;
  return jsonb_build_object('status', 'deleted');
end
$$;

create or replace function public.dm_mark_read(p_with uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare v_uid uuid := public.social_assert_member();
begin
  update public.dm_conversations
     set low_last_read_at = case when user_low = v_uid then now() else low_last_read_at end,
         high_last_read_at = case when user_high = v_uid then now() else high_last_read_at end
   where user_low = least(v_uid, p_with) and user_high = greatest(v_uid, p_with);
  return jsonb_build_object('status', 'ok');
end
$$;

create or replace function public.social_unread_summary()
returns jsonb
language plpgsql
stable
security invoker
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_global integer;
  v_dm integer;
  v_req integer;
begin
  if v_uid is null then return jsonb_build_object('global', 0, 'dm', 0, 'requests', 0); end if;
  select count(*) into v_global from (
    select 1 from public.global_messages g
     where g.sender_id <> v_uid and g.deleted_at is null
       and g.created_at > coalesce((select last_read_at from public.social_global_read where user_id = v_uid), now())
     limit 99) a;
  select count(*) into v_dm from (
    select 1 from public.dm_messages m
     join public.dm_conversations c on c.id = m.conversation_id
     where m.recipient_id = v_uid and m.deleted_at is null
       and m.created_at > case when c.user_low = v_uid then c.low_last_read_at else c.high_last_read_at end
     limit 99) b;
  select count(*) into v_req from public.social_friendships f
   where f.status = 'pending' and f.requester_id <> v_uid and v_uid in (f.user_low, f.user_high);
  return jsonb_build_object('global', v_global, 'dm', v_dm, 'requests', v_req);
end
$$;

-- ---------------------------------------------------------------------------------------------
-- Hak eksekusi: hanya authenticated. Fungsi internal tidak diberikan ke klien.
-- ---------------------------------------------------------------------------------------------
revoke all on function public.social_blocked_between(uuid, uuid) from public, anon, authenticated;
revoke all on function public.social_assert_member() from public, anon, authenticated;
revoke all on function public.social_drop_pending(uuid, uuid, uuid) from public, anon, authenticated;
revoke all on function public.social_end_friendship(uuid, uuid) from public, anon, authenticated;

revoke all on function public.social_me() from public, anon;
revoke all on function public.social_set_username(text, text) from public, anon;
revoke all on function public.social_search_users(text) from public, anon;
revoke all on function public.social_overview() from public, anon;
revoke all on function public.friend_request_send(text) from public, anon;
revoke all on function public.friend_request_respond(uuid, boolean) from public, anon;
revoke all on function public.friend_request_cancel(uuid) from public, anon;
revoke all on function public.friend_remove(uuid) from public, anon;
revoke all on function public.social_block(uuid) from public, anon;
revoke all on function public.social_unblock(uuid) from public, anon;
revoke all on function public.global_history(integer, timestamptz, uuid) from public, anon;
revoke all on function public.global_send_message(text, uuid) from public, anon;
revoke all on function public.global_delete_message(uuid) from public, anon;
revoke all on function public.global_mark_read() from public, anon;
revoke all on function public.social_report_message(text, uuid, text) from public, anon;
revoke all on function public.dm_send(uuid, text, uuid) from public, anon;
revoke all on function public.dm_history(uuid, integer, timestamptz, uuid) from public, anon;
revoke all on function public.dm_conversation_list() from public, anon;
revoke all on function public.dm_delete_message(uuid) from public, anon;
revoke all on function public.dm_mark_read(uuid) from public, anon;
revoke all on function public.social_unread_summary() from public, anon;

grant execute on function public.social_me() to authenticated;
grant execute on function public.social_set_username(text, text) to authenticated;
grant execute on function public.social_search_users(text) to authenticated;
grant execute on function public.social_overview() to authenticated;
grant execute on function public.friend_request_send(text) to authenticated;
grant execute on function public.friend_request_respond(uuid, boolean) to authenticated;
grant execute on function public.friend_request_cancel(uuid) to authenticated;
grant execute on function public.friend_remove(uuid) to authenticated;
grant execute on function public.social_block(uuid) to authenticated;
grant execute on function public.social_unblock(uuid) to authenticated;
grant execute on function public.global_history(integer, timestamptz, uuid) to authenticated;
grant execute on function public.global_send_message(text, uuid) to authenticated;
grant execute on function public.global_delete_message(uuid) to authenticated;
grant execute on function public.global_mark_read() to authenticated;
grant execute on function public.social_report_message(text, uuid, text) to authenticated;
grant execute on function public.dm_send(uuid, text, uuid) to authenticated;
grant execute on function public.dm_history(uuid, integer, timestamptz, uuid) to authenticated;
grant execute on function public.dm_conversation_list() to authenticated;
grant execute on function public.dm_delete_message(uuid) to authenticated;
grant execute on function public.dm_mark_read(uuid) to authenticated;
grant execute on function public.social_unread_summary() to authenticated;

-- ---------------------------------------------------------------------------------------------
-- Realtime (aditif): RLS tetap berlaku untuk penerima postgres_changes.
-- ---------------------------------------------------------------------------------------------
do $$
declare t text;
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    foreach t in array array['global_messages', 'dm_messages', 'social_friendships'] loop
      if not exists (
        select 1 from pg_publication_tables
         where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t
      ) then
        execute format('alter publication supabase_realtime add table public.%I', t);
      end if;
    end loop;
  end if;
end $$;
