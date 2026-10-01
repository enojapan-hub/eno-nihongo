create or replace function public.sync_daily_study_task_progress(p_study_date date default current_date)
returns setof public.daily_study_tasks
language plpgsql
security definer
set search_path to 'pg_catalog','public','auth'
as $function$
declare
  v_user uuid := auth.uid();
  v_plan_id uuid;
  v_start timestamptz := p_study_date::timestamp;
  v_end timestamptz := (p_study_date + 1)::timestamp;
  v_kanji int := 0;
  v_vocab int := 0;
  v_grammar int := 0;
  v_review int := 0;
  v_quiz int := 0;
begin
  if v_user is null then raise exception 'not authenticated'; end if;

  select id into v_plan_id
  from public.study_plans
  where user_id=v_user and status='active'
  order by created_at desc
  limit 1;

  if v_plan_id is null then return; end if;

  select
    count(distinct item_id) filter(where item_type='kanji' and created_at >= v_start and created_at < v_end),
    count(distinct item_id) filter(where item_type='vocabulary' and created_at >= v_start and created_at < v_end),
    count(distinct item_id) filter(where item_type='grammar' and created_at >= v_start and created_at < v_end),
    count(distinct item_id) filter(where created_at < v_start)
  into v_kanji,v_vocab,v_grammar,v_review
  from public.user_item_progress
  where user_id=v_user
    and last_reviewed_at >= v_start
    and last_reviewed_at < v_end;

  select coalesce(sum(total_questions),0)::int into v_quiz
  from public.quiz_attempts
  where user_id=v_user
    and completed_at >= v_start
    and completed_at < v_end;

  update public.daily_study_tasks t
  set completed_count = least(t.target_count, case t.task_type
      when 'new_kanji' then v_kanji
      when 'new_vocabulary' then v_vocab
      when 'new_grammar' then v_grammar
      when 'review' then v_review
      when 'quiz' then v_quiz
      else t.completed_count end),
      completed_at = case when case t.task_type
        when 'new_kanji' then v_kanji
        when 'new_vocabulary' then v_vocab
        when 'new_grammar' then v_grammar
        when 'review' then v_review
        when 'quiz' then v_quiz
        else t.completed_count end >= t.target_count and t.target_count > 0
        then coalesce(t.completed_at,now()) else null end,
      updated_at=now()
  where t.user_id=v_user
    and t.plan_id=v_plan_id
    and t.study_date=p_study_date;

  return query
  select * from public.daily_study_tasks
  where user_id=v_user
    and plan_id=v_plan_id
    and study_date=p_study_date
  order by priority desc,task_type;
end;
$function$;

revoke all on function public.sync_daily_study_task_progress(date) from public, anon;
grant execute on function public.sync_daily_study_task_progress(date) to authenticated;
