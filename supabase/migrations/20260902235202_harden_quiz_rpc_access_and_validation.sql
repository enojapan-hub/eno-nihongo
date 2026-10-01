revoke execute on function public.record_quiz_attempt(uuid,jlpt_level,content_skill,integer,integer,integer) from public, anon;
grant execute on function public.record_quiz_attempt(uuid,jlpt_level,content_skill,integer,integer,integer) to authenticated;

create or replace function public.submit_quiz_attempt(p_quiz_id uuid, p_level jlpt_level, p_skill content_skill, p_answers jsonb, p_duration_seconds integer default 0)
returns public.quiz_attempts
language plpgsql
security definer
set search_path = public
as $$
declare
  v_attempt public.quiz_attempts;
  v_total integer;
  v_correct integer;
  v_xp integer;
  v_score numeric(5,2);
  v_quiz_level jlpt_level;
  v_quiz_skill content_skill;
begin
  if (select auth.uid()) is null then
    raise exception 'Authentication required';
  end if;

  if p_quiz_id is null then
    raise exception 'Quiz is required';
  end if;

  if coalesce(p_duration_seconds,0) < 0 then
    raise exception 'Invalid duration';
  end if;

  select q.level, q.skill
    into v_quiz_level, v_quiz_skill
  from public.quizzes q
  where q.id = p_quiz_id
    and q.is_published = true;

  if v_quiz_level is null or v_quiz_skill is null then
    raise exception 'Quiz not found or not published';
  end if;

  if v_quiz_level <> p_level or v_quiz_skill <> p_skill then
    raise exception 'Quiz level or skill mismatch';
  end if;

  if jsonb_typeof(coalesce(p_answers,'[]'::jsonb)) <> 'array' then
    raise exception 'Answers must be an array';
  end if;

  select count(*) into v_total
  from jsonb_array_elements(coalesce(p_answers,'[]'::jsonb)) a
  where (a ? 'questionId') and (a ? 'selectedIndex');

  if v_total = 0 then
    raise exception 'No valid answers submitted';
  end if;

  select count(*) into v_correct
  from jsonb_array_elements(coalesce(p_answers,'[]'::jsonb)) a
  join public.questions q on q.id=(a->>'questionId')::uuid
  where q.is_published=true
    and q.level = p_level
    and q.skill = p_skill
    and (a->>'selectedIndex')::integer=q.correct_index;

  v_score:=round((v_correct::numeric/v_total::numeric)*100,2);
  v_xp:=v_correct*10;

  insert into public.quiz_attempts(user_id,quiz_id,level,skill,total_questions,correct_count,score,xp_earned,duration_seconds)
  values((select auth.uid()),p_quiz_id,p_level,p_skill,v_total,v_correct,v_score,v_xp,greatest(coalesce(p_duration_seconds,0),0))
  returning * into v_attempt;

  insert into public.quiz_answers(attempt_id,user_id,question_id,selected_index,is_correct)
  select v_attempt.id,(select auth.uid()),(a->>'questionId')::uuid,(a->>'selectedIndex')::integer,(a->>'selectedIndex')::integer=q.correct_index
  from jsonb_array_elements(coalesce(p_answers,'[]'::jsonb)) a
  join public.questions q on q.id=(a->>'questionId')::uuid
  where q.is_published=true
    and q.level=p_level
    and q.skill=p_skill;

  return v_attempt;
end;
$$;

revoke execute on function public.submit_quiz_attempt(uuid,jlpt_level,content_skill,jsonb,integer) from public, anon;
grant execute on function public.submit_quiz_attempt(uuid,jlpt_level,content_skill,jsonb,integer) to authenticated;
