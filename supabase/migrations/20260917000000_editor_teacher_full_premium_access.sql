-- Editor and teacher accounts receive all learning Premium entitlements.
-- Administrative permissions remain limited to owner and admin roles.

create or replace function public.is_premium(p_user_id uuid default auth.uid())
returns boolean
language sql
stable
security invoker
set search_path = pg_catalog, public, auth
as $$
  select case
    when auth.uid() is null or p_user_id is distinct from auth.uid() then false
    else exists (
      select 1
      from public.profiles p
      where p.id = auth.uid()
        and (
          p.role in ('owner', 'admin', 'editor', 'teacher')
          or p.plan in ('premium', 'lifetime')
          or p.premium_until > now()
        )
    )
  end;
$$;

create or replace function public.get_my_membership()
returns jsonb
language plpgsql
security invoker
set search_path = pg_catalog, public, auth
as $$
declare
  p public.profiles;
  v_plan text;
  v_active boolean;
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  select * into p from public.profiles where id = auth.uid();
  v_plan := coalesce(p.plan, 'free');
  v_active := p.role in ('owner', 'admin', 'editor', 'teacher')
    or v_plan = 'lifetime'
    or (v_plan = 'premium' and (p.premium_until is null or p.premium_until > now()));
  return jsonb_build_object(
    'plan', case when v_plan = 'lifetime' then 'lifetime' when v_active then 'premium' else 'free' end,
    'premium_until', p.premium_until,
    'country', p.country,
    'onboarding_completed', p.onboarding_completed
  );
end;
$$;

create or replace function public.can_start_full_simulation()
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, auth
as $$
declare
  p public.profiles;
  v_plan text;
  v_used int;
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  select * into p from public.profiles where id = auth.uid();
  v_plan := case
    when p.role in ('owner', 'admin', 'editor', 'teacher') then 'premium'
    when p.plan = 'lifetime' then 'lifetime'
    when p.plan = 'premium' and (p.premium_until is null or p.premium_until > now()) then 'premium'
    else 'free'
  end;
  select count(*) into v_used
  from public.quiz_attempts
  where user_id = auth.uid()
    and attempt_kind = 'simulation_full'
    and completed_at >= (date_trunc('month', now() at time zone 'Asia/Tokyo') at time zone 'Asia/Tokyo');
  return jsonb_build_object(
    'allowed', v_plan in ('premium', 'lifetime') or v_used < 1,
    'plan', v_plan,
    'used_this_month', v_used,
    'monthly_limit', case when v_plan = 'free' then 1 else null end,
    'monthly_exam', v_plan in ('premium', 'lifetime')
  );
end;
$$;

create or replace function public.enforce_simulation_membership()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_plan text;
  v_used int;
begin
  if new.attempt_kind = 'quiz' and new.quiz_id is null and new.level is not null then
    new.attempt_kind := 'simulation_full';
  end if;
  select case
    when p.role in ('owner', 'admin', 'editor', 'teacher') then 'premium'
    when p.plan = 'lifetime' then 'lifetime'
    when p.plan = 'premium' and (p.premium_until is null or p.premium_until > now()) then 'premium'
    else 'free'
  end into v_plan
  from public.profiles p
  where p.id = new.user_id;
  if new.attempt_kind = 'simulation_full' and v_plan = 'free' then
    select count(*) into v_used
    from public.quiz_attempts q
    where q.user_id = new.user_id
      and q.attempt_kind = 'simulation_full'
      and q.completed_at >= (date_trunc('month', now() at time zone 'Asia/Tokyo') at time zone 'Asia/Tokyo');
    if v_used >= 1 then
      raise exception 'Akun Free hanya dapat mengerjakan 1 simulasi penuh per bulan.';
    end if;
  end if;
  if new.attempt_kind = 'monthly_exam' and v_plan = 'free' then
    raise exception 'ENO Monthly Exam hanya untuk Premium atau Lifetime.';
  end if;
  return new;
end;
$$;

create or replace function public.get_visible_eno_monthly_exams()
returns table(
  id uuid, title text, level text, exam_month date, opens_at timestamptz, closes_at timestamptz,
  duration_minutes integer, passing_score integer, status text, premium_only boolean,
  is_entitled boolean, attempts_used bigint
)
language sql
stable
security definer
set search_path = public
as $$
  select
    e.id, e.title, e.level, e.exam_month, e.opens_at, e.closes_at, e.duration_minutes,
    e.passing_score, e.status, e.premium_only,
    case
      when e.premium_only = false then true
      when p.role in ('admin', 'owner', 'editor', 'teacher') then true
      when p.plan = 'lifetime' then true
      when p.plan = 'premium' and (p.premium_until is null or p.premium_until > now()) then true
      else false
    end,
    (
      select count(*)
      from public.eno_monthly_exam_attempts a
      where a.exam_id = e.id
        and a.user_id = auth.uid()
        and a.status <> 'invalidated'
    )
  from public.eno_monthly_exams e
  join public.profiles p on p.id = auth.uid()
  where e.status in ('published', 'closed')
  order by e.exam_month desc, e.level;
$$;

create or replace function public.start_eno_monthly_exam(p_exam_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  e public.eno_monthly_exams;
  p public.profiles;
  v_used int;
  v_attempt public.eno_monthly_exam_attempts;
  v_entitled boolean;
begin
  if auth.uid() is null then raise exception 'Login required'; end if;
  select * into e from public.eno_monthly_exams where id = p_exam_id;
  if not found or e.status <> 'published' then raise exception 'Exam unavailable'; end if;
  if now() < e.opens_at or now() > e.closes_at then raise exception 'Exam is outside active window'; end if;
  select * into p from public.profiles where id = auth.uid();
  v_entitled := not e.premium_only
    or p.role in ('admin', 'owner', 'editor', 'teacher')
    or p.plan = 'lifetime'
    or (p.plan = 'premium' and (p.premium_until is null or p.premium_until > now()));
  if not v_entitled then raise exception 'Premium required'; end if;
  select count(*) into v_used
  from public.eno_monthly_exam_attempts
  where exam_id = p_exam_id
    and user_id = auth.uid()
    and status <> 'invalidated';
  if v_used >= e.max_attempts then raise exception 'Attempt limit reached'; end if;
  insert into public.eno_monthly_exam_attempts(exam_id, user_id, attempt_no, status)
  values (p_exam_id, auth.uid(), v_used + 1, 'in_progress')
  returning * into v_attempt;
  return jsonb_build_object(
    'attempt_id', v_attempt.id,
    'duration_minutes', e.duration_minutes,
    'closes_at', e.closes_at
  );
end;
$$;
