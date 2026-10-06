-- Social Profile v3: foto publik aman, bio, negara/XP di kartu, badge publik, preferensi suara pesan.
-- Additive: 1 kolom profiles (bio), 1 kolom social_settings (sound_enabled), fungsi baru/diganti.
-- Tidak ada perubahan RLS, role/premium, atau tabel lain.

-- ---------------------------------------------------------------------------------------------
-- Bio (opsional, <=160, teks polos, tanpa spasi/baris kosong di tepi)
-- ---------------------------------------------------------------------------------------------
alter table public.profiles add column if not exists bio text;
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'profiles_bio_check' and conrelid = 'public.profiles'::regclass) then
    alter table public.profiles add constraint profiles_bio_check
      check (bio is null or (char_length(bio) between 1 and 160
                             and bio ~ '\S'
                             and bio = btrim(bio, E' \t\r\n')));
  end if;
end $$;

-- ---------------------------------------------------------------------------------------------
-- Preferensi "Suara pesan" (default aktif)
-- ---------------------------------------------------------------------------------------------
alter table public.social_settings add column if not exists sound_enabled boolean not null default true;

-- ---------------------------------------------------------------------------------------------
-- Foto publik: hanya URL dari sumber tepercaya (foto Google atau bucket avatars proyek ini).
-- URL lain (pelacak, domain acak) tidak pernah dikirim ke penonton.
-- ---------------------------------------------------------------------------------------------
create or replace function public.social_safe_photo(p_url text)
returns text
language sql
immutable
set search_path = ''
as $$
  select case
    when p_url is null or char_length(p_url) > 600 then null
    when p_url ~ '^https://lh[0-9]{1,2}\.googleusercontent\.com/[A-Za-z0-9_./=:%+~-]+$' then p_url
    when p_url ~ '^https://[a-z0-9]{20}\.supabase\.co/storage/v1/object/public/avatars/[A-Za-z0-9_./%+~-]+$' then p_url
    else null
  end
$$;
revoke all on function public.social_safe_photo(text) from public, anon, authenticated;

-- ---------------------------------------------------------------------------------------------
-- social_badges: untuk setiap id yang ada mengembalikan 3 boolean + foto aman.
--   verified = role 'owner', sensei = role 'teacher',
--   diamond  = membership berbayar aktif (aturan sama dengan get_my_membership).
-- "Free" tidak disimpan: klien menurunkannya (bukan owner dan bukan diamond).
-- ---------------------------------------------------------------------------------------------
create or replace function public.social_badges(p_users uuid[])
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_result jsonb;
begin
  if auth.uid() is null then raise exception 'auth_required'; end if;
  if p_users is null or cardinality(p_users) = 0 then return '{}'::jsonb; end if;
  if cardinality(p_users) > 100 then raise exception 'too_many_users'; end if;
  select coalesce(jsonb_object_agg(b.id::text, jsonb_build_object(
           'verified', b.verified, 'sensei', b.sensei, 'diamond', b.diamond, 'photo', b.photo)), '{}'::jsonb)
    into v_result
    from (
      select p.id,
             p.role = 'owner' as verified,
             p.role = 'teacher' as sensei,
             (p.plan = 'lifetime' or (p.plan = 'premium' and (p.premium_until is null or p.premium_until > now()))) as diamond,
             public.social_safe_photo(p.avatar_url) as photo
        from public.profiles p
       where p.id = any (p_users)
    ) b;
  return v_result;
end
$$;
revoke all on function public.social_badges(uuid[]) from public, anon;
grant execute on function public.social_badges(uuid[]) to authenticated;

-- ---------------------------------------------------------------------------------------------
-- social_me: tambah sound_enabled
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
          'next_username_change_at',
            case when ss.username_changed_at is not null and now() < ss.username_changed_at + interval '30 days'
                 then ss.username_changed_at + interval '30 days' end)
         from public.social_profiles sp
         left join public.social_settings ss on ss.user_id = sp.user_id
        where sp.user_id = auth.uid()),
      jsonb_build_object('has_username', false, 'is_moderator', false,
                         'allow_friend_requests', true, 'sound_enabled', true,
                         'next_username_change_at', null))
  end
$$;
revoke all on function public.social_me() from public, anon;
grant execute on function public.social_me() to authenticated;

create or replace function public.social_set_sound(p_enabled boolean)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare v_uid uuid := public.social_assert_member();
begin
  insert into public.social_settings (user_id, sound_enabled)
  values (v_uid, coalesce(p_enabled, true))
  on conflict (user_id) do update set sound_enabled = excluded.sound_enabled, updated_at = now();
  return public.social_me();
end
$$;
revoke all on function public.social_set_sound(boolean) from public, anon;
grant execute on function public.social_set_sound(boolean) to authenticated;

-- ---------------------------------------------------------------------------------------------
-- social_profile_card: tambah foto aman, bio, negara, xp (data publik; tanpa email/role/izin)
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
  v_xp integer;
  v_rel text;
  v_member boolean;
  v_allow boolean;
  v_photo text;
  v_bio text;
  v_country text;
  f public.social_friendships%rowtype;
begin
  if v_uid is null then raise exception 'auth_required'; end if;
  select * into sp from public.social_profiles where user_id = p_user;
  select display_name, jlpt_level, xp into v_name, v_level, v_xp from public.user_learning_stats where user_id = p_user;
  if sp.user_id is null and v_name is null and v_level is null then raise exception 'user_not_found'; end if;
  select public.social_safe_photo(avatar_url), bio, country into v_photo, v_bio, v_country
    from public.profiles where id = p_user;
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
    'photo', v_photo,
    'bio', v_bio,
    'country', v_country,
    'xp', coalesce(v_xp, 0),
    'level', v_level,
    'relation', v_rel,
    'viewer_has_username', v_member,
    'can_request', v_rel = 'none' and sp.user_id is not null and v_member and coalesce(v_allow, true));
end
$$;
revoke all on function public.social_profile_card(uuid) from public, anon;
grant execute on function public.social_profile_card(uuid) to authenticated;
