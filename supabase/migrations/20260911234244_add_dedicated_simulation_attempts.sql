create table if not exists public.jlpt_simulation_attempts (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references auth.users(id) on delete cascade,
 level text not null check (level in ('N5','N4','N3','N2','N1')),
 section text not null check (section in ('vocabulary','grammar','reading','listening','full')),
 total_questions integer not null check (total_questions >= 0),
 correct_count integer not null check (correct_count >= 0 and correct_count <= total_questions),
 duration_seconds integer not null default 0 check (duration_seconds >= 0),
 completed_at timestamptz not null default now(),
 created_at timestamptz not null default now()
);
alter table public.jlpt_simulation_attempts enable row level security;
drop policy if exists "users read own simulation attempts" on public.jlpt_simulation_attempts;
create policy "users read own simulation attempts" on public.jlpt_simulation_attempts for select to authenticated using ((select auth.uid()) = user_id);
drop policy if exists "users insert own simulation attempts" on public.jlpt_simulation_attempts;
create policy "users insert own simulation attempts" on public.jlpt_simulation_attempts for insert to authenticated with check ((select auth.uid()) = user_id);
revoke update, delete on public.jlpt_simulation_attempts from anon, authenticated;
grant select, insert on public.jlpt_simulation_attempts to authenticated;
create index if not exists jlpt_simulation_attempts_user_idx on public.jlpt_simulation_attempts(user_id,completed_at desc);
