create table if not exists public.jlpt_simulation_full_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  level text not null check (level in ('N5','N4','N3','N2','N1')),
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  status text not null default 'in_progress' check (status in ('in_progress','completed')),
  total_score integer,
  passed boolean,
  certificate_token uuid unique,
  created_at timestamptz not null default now()
);
alter table public.jlpt_simulation_full_sessions enable row level security;
revoke all on public.jlpt_simulation_full_sessions from anon;
revoke insert, update, delete on public.jlpt_simulation_full_sessions from authenticated;
grant select on public.jlpt_simulation_full_sessions to authenticated;
drop policy if exists "users read own jlpt full sessions" on public.jlpt_simulation_full_sessions;
create policy "users read own jlpt full sessions" on public.jlpt_simulation_full_sessions for select to authenticated using (auth.uid() = user_id);

create or replace function public.start_jlpt_simulation_full(p_level text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare v_id uuid;
begin
  if auth.uid() is null then raise exception 'authentication required'; end if;
  if p_level not in ('N5','N4','N3','N2','N1') then raise exception 'invalid level'; end if;
  insert into public.jlpt_simulation_full_sessions(user_id,level) values(auth.uid(),p_level) returning id into v_id;
  return v_id;
end;$$;
revoke all on function public.start_jlpt_simulation_full(text) from public, anon;
grant execute on function public.start_jlpt_simulation_full(text) to authenticated;

create or replace function public.complete_jlpt_simulation_full(p_session_id uuid, p_total_score integer, p_passed boolean)
returns table(session_id uuid, certificate_token uuid, completed_at timestamptz)
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then raise exception 'authentication required'; end if;
  if p_total_score < 0 or p_total_score > 180 then raise exception 'invalid score'; end if;
  return query
  update public.jlpt_simulation_full_sessions s
     set completed_at=now(), status='completed', total_score=p_total_score, passed=p_passed,
         certificate_token=case when p_passed then coalesce(s.certificate_token,gen_random_uuid()) else null end
   where s.id=p_session_id and s.user_id=auth.uid() and s.status='in_progress'
   returning s.id,s.certificate_token,s.completed_at;
end;$$;
revoke all on function public.complete_jlpt_simulation_full(uuid,integer,boolean) from public, anon;
grant execute on function public.complete_jlpt_simulation_full(uuid,integer,boolean) to authenticated;
