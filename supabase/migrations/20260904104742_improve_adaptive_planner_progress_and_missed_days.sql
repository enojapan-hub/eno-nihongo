create or replace function public.generate_daily_study_tasks(p_study_date date default current_date)
returns setof public.daily_study_tasks
language plpgsql
security definer
set search_path = pg_catalog, public, auth
as $$
declare
  v_user uuid := auth.uid();
  v_plan public.study_plans;
  v_due int := 0;
  v_accuracy numeric := 1.0;
  v_days_left int := 1;
  v_factor numeric := 1.0;
  v_missed int := 0;
  v_review int;
  v_kanji int;
  v_vocab int;
  v_grammar int;
  v_quiz int;
  v_estimated_minutes numeric;
  v_cap_factor numeric := 1.0;
begin
  if v_user is null then raise exception 'not authenticated'; end if;

  select * into v_plan from public.study_plans
  where user_id=v_user and status='active'
  order by created_at desc limit 1;
  if not found then return; end if;

  select count(*) into v_due
  from public.user_item_progress
  where user_id=v_user
    and due_at is not null
    and due_at <= (p_study_date::timestamp + interval '1 day')
    and status <> 'mastered';

  select coalesce(sum(correct_count)::numeric / nullif(sum(total_questions),0),1.0)
  into v_accuracy
  from public.quiz_attempts
  where user_id=v_user
    and completed_at >= now() - interval '14 days'
    and (level is null or level=v_plan.target_level);

  select count(*) into v_missed
  from public.daily_study_tasks t
  where t.user_id=v_user
    and t.plan_id=v_plan.id
    and t.study_date >= greatest(v_plan.start_date, p_study_date - 14)
    and t.study_date < p_study_date
    and t.target_count > 0
    and t.completed_count < t.target_count;

  v_days_left := greatest(1, v_plan.target_date - p_study_date);
  v_factor := case
    when v_accuracy < 0.60 then 0.65
    when v_accuracy < 0.75 then 0.80
    when v_accuracy > 0.90 and v_due < v_plan.preferred_review then 1.15
    else 1.0 end;

  if v_days_left <= 21 then v_factor := least(1.25, v_factor + 0.10); end if;
  if v_missed >= 5 then v_factor := least(1.25, v_factor + 0.10);
  elsif v_missed >= 2 then v_factor := least(1.20, v_factor + 0.05);
  end if;

  v_review := least(300, greatest(v_plan.preferred_review, v_due));
  if v_accuracy < 0.75 then v_review := least(300, greatest(v_review, ceil(v_plan.preferred_review*1.5)::int)); end if;
  v_kanji := greatest(0, round(v_plan.preferred_new_kanji*v_factor)::int);
  v_vocab := greatest(0, round(v_plan.preferred_new_vocabulary*v_factor)::int);
  v_grammar := greatest(0, round(v_plan.preferred_new_grammar*v_factor)::int);
  v_quiz := greatest(5, round(v_plan.preferred_quiz * case when v_accuracy < 0.75 then 1.3 else 1.0 end)::int);

  -- Approximate workload: review 0.5 min, kanji 2 min, vocabulary 0.75 min,
  -- grammar 5 min, quiz 0.6 min per item. Keep within the user's daily time budget.
  v_estimated_minutes := (v_review*0.5) + (v_kanji*2.0) + (v_vocab*0.75) + (v_grammar*5.0) + (v_quiz*0.6);
  if v_estimated_minutes > v_plan.daily_minutes and v_estimated_minutes > 0 then
    v_cap_factor := greatest(0.45, v_plan.daily_minutes::numeric / v_estimated_minutes);
    v_review := greatest(5, round(v_review*v_cap_factor)::int);
    v_kanji := greatest(1, round(v_kanji*v_cap_factor)::int);
    v_vocab := greatest(5, round(v_vocab*v_cap_factor)::int);
    v_grammar := greatest(1, round(v_grammar*v_cap_factor)::int);
    v_quiz := greatest(5, round(v_quiz*v_cap_factor)::int);
  end if;

  insert into public.daily_study_tasks(user_id,plan_id,study_date,task_type,target_count,priority,reason,metadata)
  values
    (v_user,v_plan.id,p_study_date,'review',v_review,100,'Ulangan materi yang sudah jatuh tempo',jsonb_build_object('due_items',v_due,'recent_accuracy',v_accuracy,'missed_tasks_14d',v_missed)),
    (v_user,v_plan.id,p_study_date,'new_kanji',v_kanji,80,'Materi Kanji baru disesuaikan dengan performa',jsonb_build_object('adaptive_factor',v_factor,'time_cap_factor',v_cap_factor)),
    (v_user,v_plan.id,p_study_date,'new_vocabulary',v_vocab,75,'Kosakata baru disesuaikan dengan performa',jsonb_build_object('adaptive_factor',v_factor,'time_cap_factor',v_cap_factor)),
    (v_user,v_plan.id,p_study_date,'new_grammar',v_grammar,70,'Bunpou baru disesuaikan dengan performa',jsonb_build_object('adaptive_factor',v_factor,'time_cap_factor',v_cap_factor)),
    (v_user,v_plan.id,p_study_date,'quiz',v_quiz,60,'Kuis untuk mengukur retensi dan akurasi',jsonb_build_object('recent_accuracy',v_accuracy,'missed_tasks_14d',v_missed))
  on conflict(user_id,plan_id,study_date,task_type) do update
  set target_count=excluded.target_count,
      priority=excluded.priority,
      reason=excluded.reason,
      metadata=excluded.metadata,
      updated_at=now();

  return query select * from public.daily_study_tasks
  where user_id=v_user and plan_id=v_plan.id and study_date=p_study_date
  order by priority desc, task_type;
end;
$$;

create or replace function public.sync_daily_study_task_progress(p_study_date date default current_date)
returns setof public.daily_study_tasks
language plpgsql
security definer
set search_path = pg_catalog, public, auth
as $$
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
  select id into v_plan_id from public.study_plans
  where user_id=v_user and status='active' order by created_at desc limit 1;
  if v_plan_id is null then return; end if;

  select count(distinct item_id) filter(where item_type='kanji'),
         count(distinct item_id) filter(where item_type='vocabulary'),
         count(distinct item_id) filter(where item_type='grammar'),
         count(distinct item_id)
  into v_kanji,v_vocab,v_grammar,v_review
  from public.user_item_progress
  where user_id=v_user and last_reviewed_at >= v_start and last_reviewed_at < v_end;

  select coalesce(sum(total_questions),0)::int into v_quiz
  from public.quiz_attempts
  where user_id=v_user and completed_at >= v_start and completed_at < v_end;

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
        else t.completed_count end >= t.target_count and t.target_count > 0 then coalesce(t.completed_at,now()) else null end,
      updated_at=now()
  where t.user_id=v_user and t.plan_id=v_plan_id and t.study_date=p_study_date;

  return query select * from public.daily_study_tasks
  where user_id=v_user and plan_id=v_plan_id and study_date=p_study_date
  order by priority desc,task_type;
end;
$$;

revoke all on function public.generate_daily_study_tasks(date) from public, anon;
revoke all on function public.sync_daily_study_task_progress(date) from public, anon;
grant execute on function public.generate_daily_study_tasks(date) to authenticated;
grant execute on function public.sync_daily_study_task_progress(date) to authenticated;
