-- CI-only minimal dependency schema for referral integration; never deploy.
create type public.jlpt_level as enum ('N5','N4','N3','N2','N1');
create type public.content_skill as enum ('kanji','vocabulary','grammar','reading','listening');
create type public.progress_status as enum ('new','learning','review','mastered');
create table public.profiles (
 id uuid primary key, display_name text, avatar_url text, target_level public.jlpt_level default 'N5',
 referral_code text unique, role text default 'student', plan text default 'free',
 premium_until timestamptz, created_at timestamptz default now(), updated_at timestamptz default now()
);
create table public.user_stats (
 user_id uuid primary key references public.profiles(id), total_xp integer default 0,
 reward_points integer not null default 0, current_streak integer default 0,
 updated_at timestamptz default now()
);
create table public.referrals (
 id uuid primary key default gen_random_uuid(),
 referrer_id uuid not null references public.profiles(id),
 referred_user_id uuid references public.profiles(id),
 code text not null, status text not null default 'pending',
 points_awarded integer default 0, created_at timestamptz default now(),
 unique(referrer_id,referred_user_id)
);
create table public.reward_grants (
 id uuid primary key default gen_random_uuid(), user_id uuid not null references public.profiles(id),
 reward_kind text not null, premium_days integer default 0, points_spent integer default 0,
 metadata jsonb not null default '{}'::jsonb, created_at timestamptz default now()
);
create table public.referral_events (
 id uuid primary key default gen_random_uuid(), referrer_id uuid not null references public.profiles(id),
 referred_user_id uuid not null references public.profiles(id), referral_code text,
 event_type text not null, points_awarded integer default 0,
 unique(referrer_id,referred_user_id,event_type)
);
create table public.point_redemptions (
 id uuid primary key default gen_random_uuid(), user_id uuid references public.profiles(id),
 reward_type text, points_spent integer, status text
);
create table public.user_item_progress (
 id uuid primary key default gen_random_uuid(), user_id uuid not null references public.profiles(id),
 item_type public.content_skill not null, item_id uuid not null, level public.jlpt_level not null,
 status public.progress_status default 'new', repetitions integer default 0,
 last_reviewed_at timestamptz, due_at timestamptz,
 unique(user_id,item_type,item_id)
);
create table public.learning_activity (
 id uuid primary key default gen_random_uuid(), user_id uuid not null references public.profiles(id),
 activity_type text not null, points integer default 0, xp integer default 0,
 metadata jsonb default '{}'::jsonb, created_at timestamptz default now()
);
create or replace function public.record_learning_activity(
 p_activity_type text, p_content_type text, p_content_id uuid,
 p_points integer default 0, p_xp integer default 0, p_correct boolean default null,
 p_duration_seconds integer default 0, p_metadata jsonb default '{}'::jsonb
) returns void language plpgsql security definer set search_path=pg_catalog,public,auth as $$
begin
 insert into public.learning_activity(user_id,activity_type,points,xp,metadata)
 values(auth.uid(),p_activity_type,p_points,p_xp,
 coalesce(p_metadata,'{}'::jsonb) || jsonb_build_object('content_type',p_content_type,'content_id',p_content_id));
end; $$;
