-- Practice quizzes are scored on the server and are no longer treated as full simulations.
--
-- Before: the client inserted quiz_attempts rows itself (score, correct_count, xp_earned and
-- attempt_kind all caller-supplied). Any attempt without quiz_id but with a level was rewritten to
-- 'simulation_full' by enforce_simulation_membership, so a practice quiz (a) paid out simulation
-- points via award_simulation_attempt_points and (b) used up the Free plan's one full simulation
-- per month; the second practice quiz of the month was rejected and the client hid the error.
--
-- This migration is backward compatible with the current client (it only adds a function and
-- stops the misclassification). Direct writes are closed in 20261003150000_lock_direct_quiz_attempt_writes.sql,
-- which must be applied only once the client that calls submit_practice_quiz is deployed.

create or replace function public.submit_practice_quiz(
  p_level public.jlpt_level,
  p_skill public.content_skill,
  p_answers jsonb,
  p_duration_seconds integer default 0
)
returns public.quiz_attempts
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_graded jsonb;
  v_attempt public.quiz_attempts;
  v_total integer;
  v_correct integer;
  v_score numeric(5,2);
  v_xp integer;
  v_duration integer := least(greatest(coalesce(p_duration_seconds, 0), 0), 86400);
  v_row record;
begin
  if v_uid is null then
    raise exception 'Authentication required';
  end if;
  if p_level is null then
    raise exception 'Level is required';
  end if;
  if jsonb_typeof(coalesce(p_answers, 'null'::jsonb)) <> 'array' or jsonb_array_length(p_answers) > 20 then
    raise exception 'Answers must be an array of at most 20 items';
  end if;

  -- Grade against the published question bank; the caller never supplies correctness.
  select coalesce(jsonb_agg(jsonb_build_object(
           'question_id', g.question_id,
           'selected_index', g.selected_index,
           'is_correct', g.is_correct) order by g.question_id), '[]'::jsonb)
    into v_graded
  from (
    select distinct on (q.id)
           q.id as question_id,
           a.selected_index,
           (a.selected_index = q.correct_index) as is_correct
    from (
      select case when (e->>'questionId') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
                  then (e->>'questionId')::uuid end as question_id,
             case when jsonb_typeof(e->'selectedIndex') = 'number'
                  then least(greatest(floor((e->>'selectedIndex')::numeric), -1), 3)::integer end as selected_index
      from jsonb_array_elements(p_answers) e
    ) a
    join public.questions q on q.id = a.question_id
    where a.selected_index is not null
      and q.is_published
      and q.level = p_level
      and (p_skill is null or q.skill = p_skill)
    order by q.id
  ) g;

  v_total := jsonb_array_length(v_graded);
  if v_total = 0 then
    raise exception 'No valid answers submitted';
  end if;
  select count(*) into v_correct from jsonb_array_elements(v_graded) e where (e->>'is_correct')::boolean;

  v_score := round((v_correct::numeric / v_total::numeric) * 100, 2);
  v_xp := least(v_correct * 10, 200);

  insert into public.quiz_attempts(
    user_id, quiz_id, level, skill, attempt_kind,
    total_questions, correct_count, score, xp_earned, duration_seconds, completed_at)
  values (
    v_uid, null, p_level, p_skill, 'quiz',
    v_total, v_correct, v_score, v_xp, v_duration, now())
  returning * into v_attempt;

  insert into public.quiz_answers(attempt_id, user_id, question_id, selected_index, is_correct)
  select v_attempt.id, v_uid, x.question_id, x.selected_index, x.is_correct
  from jsonb_to_recordset(v_graded) as x(question_id uuid, selected_index integer, is_correct boolean);

  -- Activity log only: record_learning_activity ignores caller-supplied points/XP for these types.
  perform public.record_learning_activity(
    'quiz_completed', coalesce(p_skill::text, 'quiz'), null::uuid, 0, 0, null::boolean, v_duration,
    jsonb_build_object('level', p_level::text, 'total', v_total, 'correct', v_correct, 'score', v_score));
  for v_row in
    select x.question_id, x.is_correct
    from jsonb_to_recordset(v_graded) as x(question_id uuid, selected_index integer, is_correct boolean)
  loop
    perform public.record_learning_activity(
      'quiz_answered', coalesce(p_skill::text, 'quiz'), v_row.question_id, 0, 0, v_row.is_correct, 0,
      jsonb_build_object('level', p_level::text));
  end loop;

  return v_attempt;
end
$$;

revoke all on function public.submit_practice_quiz(public.jlpt_level, public.content_skill, jsonb, integer) from public, anon;
grant execute on function public.submit_practice_quiz(public.jlpt_level, public.content_skill, jsonb, integer) to authenticated;

-- Stop reclassifying quiz attempts as simulations. Full simulations use their own
-- jlpt_simulation_* tables and RPCs; the monthly Free limit and Premium-only checks stay as they were.
create or replace function public.enforce_simulation_membership()
returns trigger
language plpgsql
security definer
set search_path to 'pg_catalog', 'public'
as $function$
declare
  v_plan text;
  v_used int;
begin
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
$function$;
