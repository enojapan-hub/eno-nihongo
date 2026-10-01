create table if not exists public.study_plans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  target_level public.jlpt_level not null,
  start_date date not null default current_date,
  target_date date not null,
  daily_minutes integer not null default 45 check (daily_minutes between 10 and 360),
  status text not null default 'active' check (status in ('active','paused','completed','cancelled')),
  preferred_new_kanji integer not null default 5 check (preferred_new_kanji between 0 and 50),
  preferred_new_vocabulary integer not null default 20 check (preferred_new_vocabulary between 0 and 200),
  preferred_new_grammar integer not null default 2 check (preferred_new_grammar between 0 and 20),
  preferred_review integer not null default 15 check (preferred_review between 0 and 300),
  preferred_quiz integer not null default 10 check (preferred_quiz between 0 and 100),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists study_plans_one_active_per_user on public.study_plans(user_id) where status='active';
create index if not exists study_plans_user_idx on public.study_plans(user_id, status);

create table if not exists public.daily_study_tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  plan_id uuid not null references public.study_plans(id) on delete cascade,
  study_date date not null default current_date,
  task_type text not null check (task_type in ('new_kanji','new_vocabulary','new_grammar','review','quiz','reading','listening')),
  target_count integer not null check (target_count >= 0),
  completed_count integer not null default 0 check (completed_count >= 0),
  priority integer not null default 50 check (priority between 0 and 100),
  reason text,
  metadata jsonb not null default '{}'::jsonb,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id, plan_id, study_date, task_type)
);
create index if not exists daily_study_tasks_user_date_idx on public.daily_study_tasks(user_id, study_date);

alter table public.study_plans enable row level security;
alter table public.daily_study_tasks enable row level security;

drop policy if exists study_plans_select_own on public.study_plans;
create policy study_plans_select_own on public.study_plans for select to authenticated using ((select auth.uid()) = user_id);
drop policy if exists study_plans_insert_own on public.study_plans;
create policy study_plans_insert_own on public.study_plans for insert to authenticated with check ((select auth.uid()) = user_id);
drop policy if exists study_plans_update_own on public.study_plans;
create policy study_plans_update_own on public.study_plans for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
drop policy if exists study_plans_delete_own on public.study_plans;
create policy study_plans_delete_own on public.study_plans for delete to authenticated using ((select auth.uid()) = user_id);

drop policy if exists daily_study_tasks_select_own on public.daily_study_tasks;
create policy daily_study_tasks_select_own on public.daily_study_tasks for select to authenticated using ((select auth.uid()) = user_id);
drop policy if exists daily_study_tasks_insert_own on public.daily_study_tasks;
create policy daily_study_tasks_insert_own on public.daily_study_tasks for insert to authenticated with check ((select auth.uid()) = user_id);
drop policy if exists daily_study_tasks_update_own on public.daily_study_tasks;
create policy daily_study_tasks_update_own on public.daily_study_tasks for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
drop policy if exists daily_study_tasks_delete_own on public.daily_study_tasks;
create policy daily_study_tasks_delete_own on public.daily_study_tasks for delete to authenticated using ((select auth.uid()) = user_id);

revoke all on public.study_plans from anon;
revoke all on public.daily_study_tasks from anon;
grant select,insert,update,delete on public.study_plans to authenticated;
grant select,insert,update,delete on public.daily_study_tasks to authenticated;
