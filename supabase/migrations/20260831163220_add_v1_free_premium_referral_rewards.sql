create extension if not exists pgcrypto;

alter table public.profiles add column if not exists plan text not null default 'free' check (plan in ('free','premium','lifetime'));
alter table public.profiles add column if not exists premium_until timestamptz;
alter table public.profiles add column if not exists referral_points integer not null default 0 check (referral_points >= 0);
alter table public.profiles add column if not exists focus_mode boolean not null default false;

create table if not exists public.referral_events (
  id uuid primary key default gen_random_uuid(),
  referrer_id uuid not null references auth.users(id) on delete cascade,
  referred_user_id uuid references auth.users(id) on delete set null,
  referral_code text not null,
  event_type text not null default 'signup' check (event_type in ('signup','share','conversion')),
  points_awarded integer not null default 0 check (points_awarded >= 0),
  created_at timestamptz not null default now(),
  unique(referrer_id, referred_user_id, event_type)
);

create index if not exists referral_events_referrer_idx on public.referral_events(referrer_id, created_at desc);

alter table public.referral_events enable row level security;
drop policy if exists referral_events_select_own on public.referral_events;
create policy referral_events_select_own on public.referral_events for select to authenticated using (referrer_id = auth.uid() or referred_user_id = auth.uid());

create or replace function public.ensure_profile_defaults()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, display_name, avatar_url, referral_code, plan)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name', new.email), new.raw_user_meta_data->>'avatar_url', upper(substr(replace(gen_random_uuid()::text,'-',''),1,8)), 'free')
  on conflict (id) do nothing;
  insert into public.user_stats (user_id) values (new.id) on conflict (user_id) do nothing;
  insert into public.user_settings (user_id) values (new.id) on conflict (user_id) do nothing;
  return new;
end; $$;

drop trigger if exists on_auth_user_created_eno_defaults on auth.users;
create trigger on_auth_user_created_eno_defaults after insert on auth.users for each row execute function public.ensure_profile_defaults();

create or replace function public.is_premium(p_user_id uuid default auth.uid())
returns boolean language sql stable security definer set search_path = public as $$
  select exists(select 1 from public.profiles p where p.id = p_user_id and (p.plan in ('premium','lifetime') or p.premium_until > now()));
$$;

revoke all on function public.is_premium(uuid) from public;
grant execute on function public.is_premium(uuid) to authenticated;

create or replace function public.award_referral_signup(p_code text)
returns integer language plpgsql security definer set search_path = public as $$
declare v_referrer uuid; v_points integer := 100;
begin
  if auth.uid() is null then raise exception 'not_authenticated'; end if;
  select id into v_referrer from public.profiles where upper(referral_code)=upper(trim(p_code)) and id <> auth.uid();
  if v_referrer is null then return 0; end if;
  insert into public.referral_events(referrer_id,referred_user_id,referral_code,event_type,points_awarded)
  values(v_referrer,auth.uid(),upper(trim(p_code)),'signup',v_points)
  on conflict (referrer_id,referred_user_id,event_type) do nothing;
  if found then
    update public.profiles set referral_points=referral_points+v_points, updated_at=now() where id=v_referrer;
    return v_points;
  end if;
  return 0;
end; $$;

revoke all on function public.award_referral_signup(text) from public;
grant execute on function public.award_referral_signup(text) to authenticated;

update public.profiles set plan='free' where plan is null;
update public.kanji set is_published=true where is_published=false;
update public.vocabulary set is_published=true where is_published=false;
update public.grammar_points set is_published=true where is_published=false;
update public.reading_passages set is_published=true where is_published=false;
update public.questions set is_published=true where is_published=false;
update public.listening_items set is_published=true where is_published=false and audio_url is not null;
