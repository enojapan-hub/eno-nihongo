create or replace function public.create_or_replace_study_plan(
  p_target_level public.jlpt_level,
  p_target_date date,
  p_daily_minutes integer default 45
) returns public.study_plans
language plpgsql
security definer
set search_path = pg_catalog, public, auth
as $$
declare
  v_user uuid := auth.uid();
  v_plan public.study_plans;
begin
  if v_user is null then raise exception 'not authenticated'; end if;
  if p_target_date <= current_date then raise exception 'target_date must be in the future'; end if;

  update public.study_plans set status='cancelled', updated_at=now()
  where user_id=v_user and status='active';

  insert into public.study_plans(user_id,target_level,target_date,daily_minutes)
  values(v_user,p_target_level,p_target_date,greatest(10,least(coalesce(p_daily_minutes,45),360)))
  returning * into v_plan;

  update public.profiles set target_level=p_target_level, updated_at=now() where id=v_user;
  return v_plan;
end;
$$;

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
  v_review int;
  v_kanji int;
  v_vocab int;
  v_grammar int;
  v_quiz int;
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

  v_days_left := greatest(1, v_plan.target_date - p_study_date);
  v_factor := case
    when v_accuracy < 0.60 then 0.65
    when v_accuracy < 0.75 then 0.80
    when v_accuracy > 0.90 and v_due < v_plan.preferred_review then 1.15
    else 1.0 end;

  if v_days_left <= 21 then v_factor := least(1.25, v_factor + 0.10); end if;

  v_review := least(300, greatest(v_plan.preferred_review, v_due));
  if v_accuracy < 0.75 then v_review := least(300, greatest(v_review, ceil(v_plan.preferred_review*1.5)::int)); end if;
  v_kanji := greatest(0, round(v_plan.preferred_new_kanji*v_factor)::int);
  v_vocab := greatest(0, round(v_plan.preferred_new_vocabulary*v_factor)::int);
  v_grammar := greatest(0, round(v_plan.preferred_new_grammar*v_factor)::int);
  v_quiz := greatest(5, round(v_plan.preferred_quiz * case when v_accuracy < 0.75 then 1.3 else 1.0 end)::int);

  insert into public.daily_study_tasks(user_id,plan_id,study_date,task_type,target_count,priority,reason,metadata)
  values
    (v_user,v_plan.id,p_study_date,'review',v_review,100,'Ulangan materi yang sudah jatuh tempo',jsonb_build_object('due_items',v_due,'recent_accuracy',v_accuracy)),
    (v_user,v_plan.id,p_study_date,'new_kanji',v_kanji,80,'Materi Kanji baru disesuaikan dengan performa',jsonb_build_object('adaptive_factor',v_factor)),
    (v_user,v_plan.id,p_study_date,'new_vocabulary',v_vocab,75,'Kosakata baru disesuaikan dengan performa',jsonb_build_object('adaptive_factor',v_factor)),
    (v_user,v_plan.id,p_study_date,'new_grammar',v_grammar,70,'Bunpou baru disesuaikan dengan performa',jsonb_build_object('adaptive_factor',v_factor)),
    (v_user,v_plan.id,p_study_date,'quiz',v_quiz,60,'Kuis untuk mengukur retensi dan akurasi',jsonb_build_object('recent_accuracy',v_accuracy))
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

revoke all on function public.create_or_replace_study_plan(public.jlpt_level,date,integer) from public, anon;
revoke all on function public.generate_daily_study_tasks(date) from public, anon;
grant execute on function public.create_or_replace_study_plan(public.jlpt_level,date,integer) to authenticated;
grant execute on function public.generate_daily_study_tasks(date) to authenticated;
