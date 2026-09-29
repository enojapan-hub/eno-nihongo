-- Weekly Adaptive Study Planner: study days per week + a real weekly plan.
-- Additive: existing plans default to 7 study days (= previous daily behaviour).

alter table public.study_plans add column if not exists study_days_per_week smallint not null default 7;
alter table public.study_plans drop constraint if exists study_plans_study_days_per_week_check;
alter table public.study_plans add constraint study_plans_study_days_per_week_check check (study_days_per_week between 1 and 7);

-- Weekday offsets (0 = Monday .. 6 = Sunday) of the active study days, spread evenly over the week.
create or replace function public.study_active_offsets(p_days int)
returns int[]
language sql
immutable
set search_path to 'pg_catalog', 'public'
as $$
  select coalesce(array_agg(distinct floor(i * 7.0 / greatest(1, least(7, p_days)))::int order by floor(i * 7.0 / greatest(1, least(7, p_days)))::int), array[]::int[])
  from generate_series(0, greatest(1, least(7, p_days)) - 1) as i;
$$;

drop function if exists public.create_or_replace_study_plan(jlpt_level, date, integer);
create or replace function public.create_or_replace_study_plan(p_target_level jlpt_level, p_target_date date, p_daily_minutes integer default 45, p_study_days integer default 7)
returns public.study_plans
language plpgsql
set search_path to 'pg_catalog', 'public', 'auth'
as $$
declare
  v_user uuid := auth.uid();
  v_plan public.study_plans;
begin
  if v_user is null then raise exception 'not authenticated'; end if;
  if p_target_date <= current_date then raise exception 'target_date must be in the future'; end if;

  update public.study_plans set status = 'cancelled', updated_at = now()
  where user_id = v_user and status = 'active';

  insert into public.study_plans(user_id, target_level, target_date, daily_minutes, study_days_per_week)
  values (v_user, p_target_level, p_target_date, greatest(10, least(coalesce(p_daily_minutes, 45), 360)), greatest(1, least(coalesce(p_study_days, 7), 7)))
  returning * into v_plan;

  update public.profiles set target_level = p_target_level, updated_at = now() where id = v_user;
  return v_plan;
end;
$$;

-- Generates the whole week (Mon..Sun, JST) for the active plan.
-- * only the active study days get tasks; the workload of a week is base x active days
-- * quota tasks (new kanji / vocabulary / grammar / quiz) that were missed on past active days are
--   redistributed over the remaining active days of the week, at most 1.5x the base per day
-- * review stays due-driven and only exists for today
create or replace function public.generate_weekly_study_plan(p_date date default null)
returns setof public.daily_study_tasks
language plpgsql
set search_path to 'pg_catalog', 'public', 'auth'
as $$
declare
  v_user uuid := auth.uid();
  v_today date := coalesce(p_date, (now() at time zone 'Asia/Tokyo')::date);
  v_plan public.study_plans;
  v_week_start date;
  v_active date[] := array[]::date[];
  v_past date[] := array[]::date[];
  v_rest date[] := array[]::date[];
  d date;
  o int;
  i int;
  k int;
  v_due int := 0;
  v_acc numeric := 1.0;
  v_days_left int;
  v_factor numeric := 1.0;
  v_review int;
  b_kanji int; b_vocab int; b_grammar int; b_quiz int;
  v_minutes numeric;
  v_cap numeric;
  w int; done_past int; r int; per int; extra int; capday int;
  t_kanji int; t_vocab int; t_grammar int; t_quiz int;
  v_limit numeric;
  f numeric;
begin
  if v_user is null then raise exception 'not authenticated'; end if;

  select * into v_plan from public.study_plans where user_id = v_user and status = 'active' order by created_at desc limit 1;
  if not found then return; end if;

  v_week_start := v_today - (extract(isodow from v_today)::int - 1);
  foreach o in array public.study_active_offsets(v_plan.study_days_per_week) loop
    d := v_week_start + o;
    if d >= v_plan.start_date and d <= v_plan.target_date then v_active := v_active || d; end if;
  end loop;

  -- drop stale not-yet-started tasks on days that are no longer active study days
  delete from public.daily_study_tasks
  where user_id = v_user and plan_id = v_plan.id
    and study_date >= v_today and study_date <= v_week_start + 6
    and not (study_date = any(v_active))
    and completed_count = 0;

  if cardinality(v_active) = 0 then
    return query select * from public.daily_study_tasks where user_id = v_user and plan_id = v_plan.id and study_date between v_week_start and v_week_start + 6 order by study_date, priority desc;
    return;
  end if;

  foreach d in array v_active loop
    if d < v_today then v_past := v_past || d; else v_rest := v_rest || d; end if;
  end loop;
  k := cardinality(v_rest);

  -- base amounts per study day (same adaptivity as the previous daily generator, minus the missed-task bump)
  select count(*) into v_due from public.user_item_progress
  where user_id = v_user and due_at is not null and due_at <= (v_today::timestamp + interval '1 day') and status <> 'mastered';
  select coalesce(sum(correct_count)::numeric / nullif(sum(total_questions), 0), 1.0) into v_acc
  from public.quiz_attempts
  where user_id = v_user and completed_at >= now() - interval '14 days' and (level is null or level = v_plan.target_level);
  v_days_left := greatest(1, v_plan.target_date - v_today);
  v_factor := case
    when v_acc < 0.60 then 0.65
    when v_acc < 0.75 then 0.80
    when v_acc > 0.90 and v_due < v_plan.preferred_review then 1.15
    else 1.0 end;
  if v_days_left <= 21 then v_factor := least(1.25, v_factor + 0.10); end if;
  v_review := least(300, greatest(v_plan.preferred_review, v_due));
  if v_acc < 0.75 then v_review := least(300, greatest(v_review, ceil(v_plan.preferred_review * 1.5)::int)); end if;
  b_kanji := greatest(0, round(v_plan.preferred_new_kanji * v_factor)::int);
  b_vocab := greatest(0, round(v_plan.preferred_new_vocabulary * v_factor)::int);
  b_grammar := greatest(0, round(v_plan.preferred_new_grammar * v_factor)::int);
  b_quiz := greatest(5, round(v_plan.preferred_quiz * case when v_acc < 0.75 then 1.3 else 1.0 end)::int);
  v_minutes := (v_review * 0.5) + (b_kanji * 2.0) + (b_vocab * 0.75) + (b_grammar * 5.0) + (b_quiz * 0.6);
  if v_minutes > v_plan.daily_minutes and v_minutes > 0 then
    v_cap := greatest(0.45, v_plan.daily_minutes::numeric / v_minutes);
    v_review := greatest(5, round(v_review * v_cap)::int);
    b_kanji := greatest(1, round(b_kanji * v_cap)::int);
    b_vocab := greatest(5, round(b_vocab * v_cap)::int);
    b_grammar := greatest(1, round(b_grammar * v_cap)::int);
    b_quiz := greatest(5, round(b_quiz * v_cap)::int);
  end if;

  -- past active days of this week without a row: create them with the base amounts, then sync what was really done
  foreach d in array v_past loop
    insert into public.daily_study_tasks(user_id, plan_id, study_date, task_type, target_count, priority, reason, metadata)
    values
      (v_user, v_plan.id, d, 'new_kanji', b_kanji, 80, 'Materi Kanji baru', jsonb_build_object('weekly', true)),
      (v_user, v_plan.id, d, 'new_vocabulary', b_vocab, 75, 'Kosakata baru', jsonb_build_object('weekly', true)),
      (v_user, v_plan.id, d, 'new_grammar', b_grammar, 70, 'Bunpou baru', jsonb_build_object('weekly', true)),
      (v_user, v_plan.id, d, 'quiz', b_quiz, 60, 'Kuis retensi', jsonb_build_object('weekly', true))
    on conflict (user_id, plan_id, study_date, task_type) do nothing;
    perform public.sync_daily_study_task_progress(d);
  end loop;

  -- remaining quota over today + future active days (missed work is spread, capped at 1.5x base per day)
  foreach d in array v_rest loop
    i := array_position(v_rest, d);
    t_kanji := 0; t_vocab := 0; t_grammar := 0; t_quiz := 0;

    select coalesce(sum(target_count), 0) + b_kanji * k, coalesce(sum(least(completed_count, target_count)), 0) into w, done_past
      from public.daily_study_tasks where user_id = v_user and plan_id = v_plan.id and task_type = 'new_kanji' and study_date = any(v_past);
    r := greatest(0, w - done_past); per := r / k; extra := r % k; capday := ceil(b_kanji * 1.5)::int;
    t_kanji := least(capday, per + case when i <= extra then 1 else 0 end);

    select coalesce(sum(target_count), 0) + b_vocab * k, coalesce(sum(least(completed_count, target_count)), 0) into w, done_past
      from public.daily_study_tasks where user_id = v_user and plan_id = v_plan.id and task_type = 'new_vocabulary' and study_date = any(v_past);
    r := greatest(0, w - done_past); per := r / k; extra := r % k; capday := ceil(b_vocab * 1.5)::int;
    t_vocab := least(capday, per + case when i <= extra then 1 else 0 end);

    select coalesce(sum(target_count), 0) + b_grammar * k, coalesce(sum(least(completed_count, target_count)), 0) into w, done_past
      from public.daily_study_tasks where user_id = v_user and plan_id = v_plan.id and task_type = 'new_grammar' and study_date = any(v_past);
    r := greatest(0, w - done_past); per := r / k; extra := r % k; capday := ceil(b_grammar * 1.5)::int;
    t_grammar := least(capday, per + case when i <= extra then 1 else 0 end);

    select coalesce(sum(target_count), 0) + b_quiz * k, coalesce(sum(least(completed_count, target_count)), 0) into w, done_past
      from public.daily_study_tasks where user_id = v_user and plan_id = v_plan.id and task_type = 'quiz' and study_date = any(v_past);
    r := greatest(0, w - done_past); per := r / k; extra := r % k; capday := ceil(b_quiz * 1.5)::int;
    t_quiz := least(capday, per + case when i <= extra then 1 else 0 end);

    -- keep a catch-up day inside 1.25x of the daily time budget
    v_minutes := (case when d = v_today then v_review else 0 end * 0.5) + (t_kanji * 2.0) + (t_vocab * 0.75) + (t_grammar * 5.0) + (t_quiz * 0.6);
    v_limit := v_plan.daily_minutes * 1.25;
    if v_minutes > v_limit and v_minutes > 0 then
      f := v_limit / v_minutes;
      t_kanji := greatest(case when b_kanji > 0 then 1 else 0 end, floor(t_kanji * f)::int);
      t_vocab := greatest(case when b_vocab > 0 then 1 else 0 end, floor(t_vocab * f)::int);
      t_grammar := greatest(case when b_grammar > 0 then 1 else 0 end, floor(t_grammar * f)::int);
      t_quiz := greatest(case when b_quiz > 0 then 1 else 0 end, floor(t_quiz * f)::int);
    end if;

    insert into public.daily_study_tasks(user_id, plan_id, study_date, task_type, target_count, priority, reason, metadata)
    values
      (v_user, v_plan.id, d, 'new_kanji', t_kanji, 80, 'Materi Kanji baru disesuaikan dengan performa', jsonb_build_object('weekly', true, 'base', b_kanji, 'catch_up', t_kanji > b_kanji, 'adaptive_factor', v_factor)),
      (v_user, v_plan.id, d, 'new_vocabulary', t_vocab, 75, 'Kosakata baru disesuaikan dengan performa', jsonb_build_object('weekly', true, 'base', b_vocab, 'catch_up', t_vocab > b_vocab, 'adaptive_factor', v_factor)),
      (v_user, v_plan.id, d, 'new_grammar', t_grammar, 70, 'Bunpou baru disesuaikan dengan performa', jsonb_build_object('weekly', true, 'base', b_grammar, 'catch_up', t_grammar > b_grammar, 'adaptive_factor', v_factor)),
      (v_user, v_plan.id, d, 'quiz', t_quiz, 60, 'Kuis untuk mengukur retensi dan akurasi', jsonb_build_object('weekly', true, 'base', b_quiz, 'catch_up', t_quiz > b_quiz, 'recent_accuracy', v_acc))
    on conflict (user_id, plan_id, study_date, task_type) do update
      set target_count = excluded.target_count, priority = excluded.priority, reason = excluded.reason, metadata = excluded.metadata, updated_at = now();

    if d = v_today then
      insert into public.daily_study_tasks(user_id, plan_id, study_date, task_type, target_count, priority, reason, metadata)
      values (v_user, v_plan.id, d, 'review', v_review, 100, 'Ulangan materi yang sudah jatuh tempo', jsonb_build_object('weekly', true, 'due_items', v_due, 'recent_accuracy', v_acc))
      on conflict (user_id, plan_id, study_date, task_type) do update
        set target_count = excluded.target_count, priority = excluded.priority, reason = excluded.reason, metadata = excluded.metadata, updated_at = now();
    end if;
  end loop;

  return query select * from public.daily_study_tasks
    where user_id = v_user and plan_id = v_plan.id and study_date between v_week_start and v_week_start + 6
    order by study_date, priority desc;
end;
$$;

-- Backwards compatible entry point: same signature, now backed by the weekly plan.
create or replace function public.generate_daily_study_tasks(p_study_date date default current_date)
returns setof public.daily_study_tasks
language plpgsql
set search_path to 'pg_catalog', 'public', 'auth'
as $$
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  perform public.generate_weekly_study_plan(p_study_date);
  return query select * from public.daily_study_tasks
    where user_id = auth.uid() and study_date = p_study_date
    order by priority desc, task_type;
end;
$$;
