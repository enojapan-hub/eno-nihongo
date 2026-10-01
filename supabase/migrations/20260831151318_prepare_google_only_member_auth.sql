-- Google-only authentication is configured at the Supabase Auth/provider layer.
-- This migration prepares profile persistence for OAuth users without creating
-- credentials or touching auth.users directly.
create index if not exists profiles_role_idx on public.profiles(role);
create index if not exists profiles_target_level_idx on public.profiles(target_level);

-- Ensure future Google-authenticated users can persist their basic profile.
comment on table public.profiles is 'Persistent member profile for authenticated ENO JAPAN users; OAuth identity is managed by Supabase Auth.';
