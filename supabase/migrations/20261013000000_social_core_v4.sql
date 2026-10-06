-- Social core v4: Owner di luar Leaderboard + auto-friend, privasi online/profil, kebijakan DM, mute,
-- idempotensi kirim DM, larangan link untuk member, batas penerima DM, kartu profil (jumlah teman, bergabung).
-- Additive: kolom/tabel/fungsi baru; fungsi lama diganti dengan perilaku yang sama + tambahan. RLS tidak dilemahkan.

-- ---------------------------------------------------------------------------------------------
-- Skema
-- ---------------------------------------------------------------------------------------------
alter table public.social_settings
  add column if not exists show_online boolean not null default true,
  add column if not exists show_country boolean not null default true,
  add column if not exists show_jlpt boolean not null default true,
  add column if not exists show_xp boolean not null default true,
  add column if not exists dm_policy text not null default 'friends';
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'social_settings_dm_policy' and conrelid = 'public.social_settings'::regclass) then
    alter table public.social_settings add constraint social_settings_dm_policy
      check (dm_policy in ('friends', 'started_by_me', 'none'));
  end if;
end $$;

alter table public.dm_messages add column if not exists client_id uuid;
create unique index if not exists dm_messages_sender_client_key on public.dm_messages (sender_id, client_id) where client_id is not null;

create table if not exists public.social_dm_mutes (
  user_id uuid not null references auth.users (id) on delete cascade,
  other_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, other_id),
  constraint social_dm_mutes_not_self check (user_id <> other_id)
);
alter table public.social_dm_mutes enable row level security;
revoke all on table public.social_dm_mutes from public, anon, authenticated;

-- ---------------------------------------------------------------------------------------------
-- Owner: auto-friend (server-side, idempotent, menghormati block & akun nonaktif)
-- ---------------------------------------------------------------------------------------------
create or replace function public.social_owner_befriend(p_user uuid)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_n integer := 0;
  o record;
begin
  if exists (select 1 from public.profiles where id = p_user and (suspended_at is not null or role = 'owner')) then
    return 0;
  end if;
  for o in select id from public.profiles where role = 'owner' and suspended_at is null and id <> p_user loop
    if public.social_blocked_between(o.id, p_user) then continue; end if;
    insert into public.social_friendships (user_low, user_high, requester_id, status, responded_at)
    values (least(o.id, p_user), greatest(o.id, p_user), o.id, 'accepted', now())
    on conflict (user_low, user_high) do update set status = 'accepted', responded_at = now()
      where public.social_friendships.status = 'pending';
    if found then v_n := v_n + 1; end if;
  end loop;
  return v_n;
end
$$;
revoke all on function public.social_owner_befriend(uuid) from public, anon, authenticated;

create or replace function public.social_backfill_owner_friends()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_elig integer := 0; v_already integer := 0; v_new integer := 0;
  v_blocked integer := 0; v_susp integer := 0; v_failed integer := 0;
  o record; m record;
begin
  for o in select id from public.profiles where role = 'owner' and suspended_at is null loop
    for m in select id, suspended_at from public.profiles where role <> 'owner' loop
      if m.suspended_at is not null then v_susp := v_susp + 1; continue; end if;
      v_elig := v_elig + 1;
      if exists (select 1 from public.social_friendships
                  where user_low = least(o.id, m.id) and user_high = greatest(o.id, m.id) and status = 'accepted') then
        v_already := v_already + 1; continue;
      end if;
      if public.social_blocked_between(o.id, m.id) then v_blocked := v_blocked + 1; continue; end if;
      begin
        insert into public.social_friendships (user_low, user_high, requester_id, status, responded_at)
        values (least(o.id, m.id), greatest(o.id, m.id), o.id, 'accepted', now())
        on conflict (user_low, user_high) do update set status = 'accepted', responded_at = now()
          where public.social_friendships.status = 'pending';
        v_new := v_new + 1;
      exception when others then
        v_failed := v_failed + 1;
      end;
    end loop;
  end loop;
  return jsonb_build_object('eligible', v_elig, 'already_friend', v_already, 'created', v_new,
                            'skipped_blocked', v_blocked, 'skipped_suspended', v_susp, 'failed', v_failed);
end
$$;
revoke all on function public.social_backfill_owner_friends() from public, anon, authenticated;

create or replace function public.social_profiles_auto_friend()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- Pembuatan akun tidak boleh pernah gagal karena fitur sosial.
  begin
    if tg_op = 'INSERT' then
      if new.role is distinct from 'owner' then perform public.social_owner_befriend(new.id); end if;
    else
      perform public.social_backfill_owner_friends();
    end if;
  exception when others then
    raise warning 'social auto-friend gagal: %', sqlerrm;
  end;
  return null;
end
$$;
revoke all on function public.social_profiles_auto_friend() from public, anon, authenticated;

do $$
begin
  if not exists (select 1 from pg_trigger where tgname = 'trg_social_auto_friend_new' and tgrelid = 'public.profiles'::regclass) then
    create trigger trg_social_auto_friend_new after insert on public.profiles
      for each row execute function public.social_profiles_auto_friend();
  end if;
  if not exists (select 1 from pg_trigger where tgname = 'trg_social_auto_friend_owner' and tgrelid = 'public.profiles'::regclass) then
    create trigger trg_social_auto_friend_owner after update of role on public.profiles
      for each row when (new.role = 'owner' and old.role is distinct from new.role)
      execute function public.social_profiles_auto_friend();
  end if;
end $$;

-- Hubungan Owner ↔ member bersifat otomatis: tidak boleh dihapus (mencegah putaran hapus → auto-friend).
create or replace function public.friend_remove(p_user uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare v_uid uuid := public.social_assert_member();
begin
  if p_user is null or p_user = v_uid then raise exception 'self_target'; end if;
  if exists (select 1 from public.profiles where id in (v_uid, p_user) and role = 'owner') then
    raise exception 'owner_friendship_locked';
  end if;
  if not exists (select 1 from public.social_friendships
                  where user_low = least(v_uid, p_user) and user_high = greatest(v_uid, p_user) and status = 'accepted') then
    raise exception 'not_friends';
  end if;
  perform public.social_end_friendship(v_uid, p_user);
  return jsonb_build_object('status', 'removed');
end
$$;
revoke all on function public.friend_remove(uuid) from public, anon;
grant execute on function public.friend_remove(uuid) to authenticated;

-- ---------------------------------------------------------------------------------------------
-- Owner tidak masuk Leaderboard publik: difilter SEBELUM peringkat dihitung (tanpa celah nomor).
-- XP/progres Owner tidak diubah.
-- ---------------------------------------------------------------------------------------------
create or replace function public.get_leaderboard(p_limit integer default 50)
returns table(rank bigint, user_id uuid, display_name text, avatar_url text, jlpt_level text, total_points integer, xp integer, study_minutes integer, lessons_completed integer, quizzes_completed integer, correct_answers integer, total_answers integer, current_streak integer, longest_streak integer, last_activity_at timestamp with time zone)
language sql
stable
security definer
set search_path to 'pg_catalog', 'public', 'auth'
as $function$
  select
    row_number() over (order by uls.total_points desc, uls.xp desc, uls.last_activity_at asc nulls last) as rank,
    uls.user_id, uls.display_name, uls.avatar_url, uls.jlpt_level,
    uls.total_points, uls.xp, uls.study_minutes, uls.lessons_completed,
    uls.quizzes_completed, uls.correct_answers, uls.total_answers,
    uls.current_streak, uls.longest_streak, uls.last_activity_at
  from public.user_learning_stats uls
  where not exists (select 1 from public.profiles pr where pr.id = uls.user_id and pr.role = 'owner')
  order by uls.total_points desc, uls.xp desc, uls.last_activity_at asc nulls last
  limit greatest(1, least(coalesce(p_limit,50),100));
$function$;

create or replace function public.get_competition_leaderboard(p_period text default 'weekly'::text, p_limit integer default 50)
returns table(rank bigint, user_id uuid, display_name text, avatar_url text, jlpt_level text, period_xp bigint, total_xp integer, total_points integer, current_streak integer)
language sql
stable
security definer
set search_path to 'pg_catalog', 'public', 'auth'
as $function$
with bounds as (
  select case when p_period='monthly' then date_trunc('month',now() at time zone 'Asia/Tokyo')
              else date_trunc('week',now() at time zone 'Asia/Tokyo') end as start_jst
), agg as (
  select p.id user_id,p.display_name,p.avatar_url,coalesce(p.target_level::text,'N5') jlpt_level,
         coalesce(sum(la.xp) filter(where la.created_at >= ((b.start_jst at time zone 'Asia/Tokyo'))),0)::bigint period_xp
  from public.profiles p cross join bounds b
  left join public.learning_activity la on la.user_id=p.id
  where p.role is distinct from 'owner'
  group by p.id,p.display_name,p.avatar_url,p.target_level
)
select row_number() over(order by a.period_xp desc,coalesce(s.total_xp,0) desc,a.user_id),a.user_id,a.display_name,a.avatar_url,a.jlpt_level,a.period_xp,coalesce(s.total_xp,0),coalesce(s.reward_points,0),coalesce(s.current_streak,0)
from agg a left join public.user_stats s on s.user_id=a.user_id
order by a.period_xp desc,coalesce(s.total_xp,0) desc,a.user_id
limit greatest(1,least(coalesce(p_limit,50),100));
$function$;

-- ---------------------------------------------------------------------------------------------
-- Larangan link untuk member (Owner dan Guru boleh). Premium tidak memberi izin link.
-- Deteksi: skema, www., domain dengan TLD umum (termasuk subdomain/path), IPv4 dengan port/path,
-- serta penyamaran sederhana ("contoh . com", "contoh[.]com", "contoh dot com", titik penuh lebar).
-- Kalimat biasa ("Oke. Id kamu?") tidak terdeteksi karena spasi setelah titik tidak dihapus.
-- ---------------------------------------------------------------------------------------------
create or replace function public.social_contains_link(p_text text)
returns boolean
language plpgsql
immutable
set search_path = ''
as $$
declare
  t text;
  tld constant text := 'com|net|org|id|co|io|me|app|dev|xyz|info|biz|site|online|shop|store|link|tv|cc|us|uk|jp|ly|gl|ai|gg|ru|cn|top|club|vip|live|page|click|sg|my|asia|edu|gov|web|blog|tech|cloud|wiki';
begin
  t := lower(normalize(coalesce(p_text, ''), NFKC));
  t := translate(t, '。．｡', '...');
  t := regexp_replace(t, '\s*[\[\(\{<]\s*(\.|dot|titik)\s*[\]\)\}>]\s*', '.', 'g');
  t := regexp_replace(t, '([a-z0-9-])\s+(dot|titik)\s+(' || tld || ')(?![a-z0-9])', '\1.\3', 'g');
  t := regexp_replace(t, '([a-z0-9-])\s+\.\s*(' || tld || ')(?![a-z0-9])', '\1.\2', 'g');
  if t ~ '(https?|ftp|wss?)\s*:\s*//' then return true; end if;
  if t ~ '\mwww\.' then return true; end if;
  if t ~ ('\m[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)*\.(' || tld || ')(?![a-z0-9-])') then return true; end if;
  if t ~ '\m(25[0-5]|2[0-4][0-9]|1?[0-9]{1,2})(\.(25[0-5]|2[0-4][0-9]|1?[0-9]{1,2})){3}(:[0-9]{2,5}|/)' then return true; end if;
  return false;
end
$$;
revoke all on function public.social_contains_link(text) from public, anon, authenticated;

create or replace function public.social_assert_link_allowed(p_uid uuid, p_body text)
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if exists (select 1 from public.profiles where id = p_uid and role in ('owner', 'teacher')) then return; end if;
  if public.social_contains_link(p_body) then raise exception 'link_not_allowed'; end if;
end
$$;
revoke all on function public.social_assert_link_allowed(uuid, text) from public, anon, authenticated;

-- ---------------------------------------------------------------------------------------------
-- Kebijakan DM (satu sumber kebenaran untuk dm_send dan Profile Card). null = boleh.
-- Block selalu menang; Owner tunduk pada aturan yang sama.
-- ---------------------------------------------------------------------------------------------
create or replace function public.social_dm_allowed(p_from uuid, p_to uuid)
returns text
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_my text;
  v_pol text;
begin
  if public.social_blocked_between(p_from, p_to) then return 'blocked'; end if;
  if not exists (select 1 from public.social_profiles where user_id = p_to)
     or exists (select 1 from public.profiles where id = p_to and suspended_at is not null) then
    return 'user_unavailable';
  end if;
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
revoke all on function public.social_dm_allowed(uuid, uuid) from public, anon, authenticated;

-- ---------------------------------------------------------------------------------------------
-- Kirim pesan: global (+ larangan link) dan DM (+ kebijakan DM, link, idempotensi, batas penerima)
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
  perform public.social_assert_link_allowed(v_uid, v_body);
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
revoke all on function public.global_send_message(text, uuid) from public, anon;
grant execute on function public.global_send_message(text, uuid) to authenticated;

-- Inti kirim DM (dengan client_id untuk idempotensi). dm_send lama menjadi pembungkus: tidak ada jalur tanpa aturan baru.
create or replace function public.dm_send_message(p_to uuid, p_body text, p_reply_to uuid default null, p_client_id uuid default null)
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
  v_reason text;
begin
  if p_to is null or p_to = v_uid then raise exception 'self_target'; end if;
  if p_client_id is not null then
    select id, conversation_id into v_id, v_conv from public.dm_messages where sender_id = v_uid and client_id = p_client_id;
    if v_id is not null then return jsonb_build_object('id', v_id, 'conversation_id', v_conv, 'duplicate', true); end if;
  end if;
  if v_body = '' then raise exception 'message_empty'; end if;
  if char_length(v_body) > 1000 then raise exception 'message_too_long'; end if;
  perform public.social_assert_clean(v_body);
  perform public.social_assert_link_allowed(v_uid, v_body);
  v_reason := public.social_dm_allowed(v_uid, p_to);
  if v_reason is not null then raise exception '%', v_reason; end if;
  if (select count(*) from public.dm_messages where sender_id = v_uid and created_at > now() - interval '10 seconds') >= 8
     or (select count(*) from public.dm_messages where sender_id = v_uid and created_at > now() - interval '1 minute') >= 40 then
    raise exception 'rate_limited';
  end if;
  -- Anti-sebar: terlalu banyak penerima BARU dalam semenit.
  if not exists (select 1 from public.dm_messages where sender_id = v_uid and recipient_id = p_to and created_at > now() - interval '1 minute')
     and (select count(distinct recipient_id) from public.dm_messages where sender_id = v_uid and created_at > now() - interval '1 minute') >= 6 then
    raise exception 'rate_limited';
  end if;
  if exists (select 1 from public.dm_messages where sender_id = v_uid and recipient_id = p_to and body = v_body and deleted_at is null and created_at > now() - interval '30 seconds') then
    raise exception 'rate_limited';
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
create or replace function public.dm_send(p_to uuid, p_body text, p_reply_to uuid default null)
returns jsonb
language sql
security definer
set search_path = ''
as $$ select public.dm_send_message(p_to, p_body, p_reply_to, null) $$;
revoke all on function public.dm_send(uuid, text, uuid) from public, anon;
grant execute on function public.dm_send(uuid, text, uuid) to authenticated;

-- ---------------------------------------------------------------------------------------------
-- Pengaturan: social_me (+ privasi), social_update_settings, mute DM, daftar percakapan (+ muted)
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
      jsonb_build_object('has_username', false, 'is_moderator', false,
                         'allow_friend_requests', true, 'sound_enabled', true,
                         'show_online', true, 'show_country', true, 'show_jlpt', true, 'show_xp', true,
                         'dm_policy', 'friends', 'next_username_change_at', null))
  end
$$;
revoke all on function public.social_me() from public, anon;
grant execute on function public.social_me() to authenticated;

create or replace function public.social_update_settings(
  p_show_online boolean default null,
  p_show_country boolean default null,
  p_show_jlpt boolean default null,
  p_show_xp boolean default null,
  p_dm_policy text default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare v_uid uuid := public.social_assert_member();
begin
  if p_dm_policy is not null and p_dm_policy not in ('friends', 'started_by_me', 'none') then
    raise exception 'invalid_setting';
  end if;
  insert into public.social_settings (user_id) values (v_uid) on conflict (user_id) do nothing;
  update public.social_settings set
    show_online = coalesce(p_show_online, show_online),
    show_country = coalesce(p_show_country, show_country),
    show_jlpt = coalesce(p_show_jlpt, show_jlpt),
    show_xp = coalesce(p_show_xp, show_xp),
    dm_policy = coalesce(p_dm_policy, dm_policy),
    updated_at = now()
   where user_id = v_uid;
  return public.social_me();
end
$$;
revoke all on function public.social_update_settings(boolean, boolean, boolean, boolean, text) from public, anon;
grant execute on function public.social_update_settings(boolean, boolean, boolean, boolean, text) to authenticated;

create or replace function public.social_mute_remove(p_user uuid, p_other uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from public.social_dm_mutes where user_id = p_user and other_id = p_other;
  return found;
end
$$;
revoke all on function public.social_mute_remove(uuid, uuid) from public, anon, authenticated;

create or replace function public.dm_set_mute(p_user uuid, p_muted boolean)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare v_uid uuid := public.social_assert_member();
begin
  if p_user is null or p_user = v_uid then raise exception 'self_target'; end if;
  if coalesce(p_muted, false) then
    insert into public.social_dm_mutes (user_id, other_id) values (v_uid, p_user) on conflict do nothing;
  else
    perform public.social_mute_remove(v_uid, p_user);
  end if;
  return jsonb_build_object('muted', coalesce(p_muted, false));
end
$$;
revoke all on function public.dm_set_mute(uuid, boolean) from public, anon;
grant execute on function public.dm_set_mute(uuid, boolean) to authenticated;

create or replace function public.dm_conversation_list()
returns jsonb
language sql
stable
security definer
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
         where f.user_low = c.user_low and f.user_high = c.user_high and f.status = 'accepted'),
      'muted', exists (select 1 from public.social_dm_mutes mu where mu.user_id = auth.uid() and mu.other_id = o.user_id)
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
revoke all on function public.dm_conversation_list() from public, anon;
grant execute on function public.dm_conversation_list() to authenticated;

-- ---------------------------------------------------------------------------------------------
-- Profile Card: privasi dihormati di server (+ pratinjau publik untuk diri sendiri), jumlah teman,
-- bulan bergabung, status resmi, alasan DM tidak tersedia. Tanpa email/role mentah/izin.
-- ---------------------------------------------------------------------------------------------
-- Dua bentuk: (uuid) memanggil (uuid, false); tanpa default agar RPC tidak ambigu.
create or replace function public.social_profile_card(p_user uuid, p_public boolean)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  sp public.social_profiles%rowtype;
  s public.social_settings%rowtype;
  v_name text;
  v_level text;
  v_xp integer;
  v_rel text;
  v_member boolean;
  v_photo text;
  v_bio text;
  v_country text;
  v_role text;
  v_created timestamptz;
  v_susp timestamptz;
  v_apply boolean;
  v_friends integer;
  v_dm text;
  f public.social_friendships%rowtype;
begin
  if v_uid is null then raise exception 'auth_required'; end if;
  select * into sp from public.social_profiles where user_id = p_user;
  select display_name, jlpt_level, xp into v_name, v_level, v_xp from public.user_learning_stats where user_id = p_user;
  select public.social_safe_photo(avatar_url), bio, country, role, created_at, suspended_at
    into v_photo, v_bio, v_country, v_role, v_created, v_susp
    from public.profiles where id = p_user;
  if sp.user_id is null and v_name is null and v_level is null and v_role is null then raise exception 'user_not_found'; end if;
  select * into s from public.social_settings where user_id = p_user;
  v_apply := p_user <> v_uid or coalesce(p_public, false);
  v_member := exists (select 1 from public.social_profiles where user_id = v_uid);
  if p_user = v_uid then
    v_rel := 'self';
  elsif v_susp is not null then
    v_rel := 'unavailable';
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
  select count(*) into v_friends
    from public.social_friendships f2
    join public.profiles pr on pr.id = case when f2.user_low = p_user then f2.user_high else f2.user_low end
   where f2.status = 'accepted' and p_user in (f2.user_low, f2.user_high) and pr.suspended_at is null;
  if v_rel = 'friend' then v_dm := public.social_dm_allowed(v_uid, p_user); end if;
  return jsonb_build_object(
    'has_username', sp.user_id is not null,
    'username', sp.username,
    'display_name', coalesce(sp.display_name, v_name),
    'avatar_id', coalesce(sp.avatar_id, 0),
    'photo', v_photo,
    'bio', v_bio,
    'country', case when not v_apply or coalesce(s.show_country, true) then v_country end,
    'xp', case when not v_apply or coalesce(s.show_xp, true) then coalesce(v_xp, 0) end,
    'level', case when not v_apply or coalesce(s.show_jlpt, true) then v_level end,
    'show_online', v_susp is null and (not v_apply or coalesce(s.show_online, true)),
    'official', v_role = 'owner',
    'friends', v_friends,
    'joined', to_char(v_created at time zone 'UTC', 'YYYY-MM'),
    'relation', v_rel,
    'dm_blocked', v_dm,
    'viewer_has_username', v_member,
    'can_request', v_rel = 'none' and sp.user_id is not null and v_member
                   and coalesce(s.allow_friend_requests, true));
end
$$;
revoke all on function public.social_profile_card(uuid, boolean) from public, anon;
grant execute on function public.social_profile_card(uuid, boolean) to authenticated;
create or replace function public.social_profile_card(p_user uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$ select public.social_profile_card(p_user, false) $$;
revoke all on function public.social_profile_card(uuid) from public, anon;
grant execute on function public.social_profile_card(uuid) to authenticated;

-- ---------------------------------------------------------------------------------------------
-- Backfill Owner ↔ member (idempotent; hasil dihitung)
-- ---------------------------------------------------------------------------------------------
select public.social_backfill_owner_friends();
