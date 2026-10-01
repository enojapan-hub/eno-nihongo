create or replace function public.record_learning_activity(
  p_activity_type text,
  p_content_type text,
  p_content_id uuid,
  p_points integer default 0,
  p_xp integer default 0,
  p_correct boolean default null,
  p_duration_seconds integer default 0,
  p_metadata jsonb default '{}'::jsonb
)
returns public.user_learning_stats
language plpgsql
security definer
set search_path = pg_catalog, public, auth
as $$
declare
  v_user_id uuid := auth.uid();
  v_today date := (now() at time zone 'Asia/Tokyo')::date;
  v_prev_date date;
  v_current_streak integer := 0;
  v_longest_streak integer := 0;
  v_effective_points integer := greatest(coalesce(p_points,0),0);
  v_effective_xp integer := greatest(coalesce(p_xp,0),0);
  v_count_lesson integer := 0;
  v_result public.user_learning_stats;
begin
  if v_user_id is null then raise exception 'User belum login'; end if;

  if p_activity_type='lesson_completed' and p_content_id is not null and exists(
    select 1 from public.learning_activity la
    where la.user_id=v_user_id and la.activity_type='lesson_completed'
      and la.metadata->>'content_id'=p_content_id::text
      and la.metadata->>'content_type'=coalesce(p_content_type,'')
  ) then
    v_effective_points := 0;
    v_effective_xp := 0;
    v_count_lesson := 0;
  elsif p_activity_type='lesson_completed' then
    v_count_lesson := 1;
  end if;

  insert into public.user_stats(user_id) values(v_user_id) on conflict (user_id) do nothing;
  select last_activity_date,current_streak,longest_streak into v_prev_date,v_current_streak,v_longest_streak
  from public.user_stats where user_id=v_user_id for update;

  if v_prev_date is null then v_current_streak:=1;
  elsif v_prev_date=v_today then v_current_streak:=greatest(v_current_streak,1);
  elsif v_prev_date=v_today-1 then v_current_streak:=greatest(v_current_streak,0)+1;
  else v_current_streak:=1; end if;
  v_longest_streak:=greatest(coalesce(v_longest_streak,0),v_current_streak);

  update public.user_stats set
    total_xp=total_xp+v_effective_xp,
    reward_points=reward_points+v_effective_points,
    current_streak=v_current_streak,longest_streak=v_longest_streak,
    last_activity_date=v_today,updated_at=now()
  where user_id=v_user_id;

  insert into public.user_learning_stats(user_id,display_name,avatar_url,jlpt_level,ui_language)
  select p.id,p.display_name,p.avatar_url,coalesce(p.target_level::text,'N5'),coalesce(p.ui_language,'id')
  from public.profiles p where p.id=v_user_id
  on conflict(user_id) do update set display_name=excluded.display_name,avatar_url=excluded.avatar_url,jlpt_level=excluded.jlpt_level,ui_language=excluded.ui_language;

  insert into public.learning_activity(user_id,activity_type,points,xp,metadata)
  values(v_user_id,p_activity_type,v_effective_points,v_effective_xp,
    coalesce(p_metadata,'{}'::jsonb)||jsonb_build_object('content_type',p_content_type,'content_id',p_content_id,'correct',p_correct,'duration_seconds',greatest(coalesce(p_duration_seconds,0),0)));

  update public.user_learning_stats u set
    xp=s.total_xp,total_points=s.reward_points,
    study_minutes=u.study_minutes+case when greatest(coalesce(p_duration_seconds,0),0)>=60 then greatest(coalesce(p_duration_seconds,0),0)/60 else 0 end,
    lessons_completed=u.lessons_completed+v_count_lesson,
    quizzes_completed=u.quizzes_completed+case when p_activity_type='quiz_completed' then 1 else 0 end,
    correct_answers=u.correct_answers+case when p_activity_type='quiz_answered' and p_correct is true then 1 else 0 end,
    total_answers=u.total_answers+case when p_activity_type='quiz_answered' then 1 else 0 end,
    current_streak=s.current_streak,longest_streak=s.longest_streak,last_activity_at=now(),updated_at=now()
  from public.user_stats s where u.user_id=v_user_id and s.user_id=v_user_id returning u.* into v_result;
  return v_result;
end; $$;

create or replace function public.force_mastered_progress()
returns trigger language plpgsql set search_path=pg_catalog,public as $$
begin
  if new.status='learning' and new.repetitions>=1 then
    new.status='mastered';
    new.due_at:=coalesce(new.due_at,now()+interval '7 days');
  end if;
  new.updated_at:=now();
  return new;
end; $$;

drop trigger if exists trg_force_mastered_progress on public.user_item_progress;
create trigger trg_force_mastered_progress before insert or update of status,repetitions on public.user_item_progress
for each row execute function public.force_mastered_progress();

with mastery as (
  select user_id,count(*)::int c from public.user_item_progress where status='mastered' group by user_id
), quiz as (
  select user_id,coalesce(sum(correct_count),0)::int correct from public.quiz_attempts group by user_id
), calc as (
  select p.id user_id, coalesce(m.c,0) mastery_count, coalesce(q.correct,0) correct_count,
         coalesce(m.c,0)*5 + coalesce(q.correct,0)*10 earned
  from public.profiles p left join mastery m on m.user_id=p.id left join quiz q on q.user_id=p.id
)
update public.user_stats s set
  reward_points=greatest(s.reward_points,c.earned),
  total_xp=greatest(s.total_xp,c.earned),updated_at=now()
from calc c where c.user_id=s.user_id;

insert into public.user_learning_stats(user_id,display_name,avatar_url,jlpt_level,ui_language,xp,total_points,current_streak,longest_streak,lessons_completed,quizzes_completed,correct_answers,total_answers,updated_at)
select p.id,p.display_name,p.avatar_url,coalesce(p.target_level::text,'N5'),coalesce(p.ui_language,'id'),
       coalesce(s.total_xp,0),coalesce(s.reward_points,0),coalesce(s.current_streak,0),coalesce(s.longest_streak,0),
       coalesce(m.c,0),coalesce(q.attempts,0),coalesce(q.correct,0),coalesce(q.total,0),now()
from public.profiles p
left join public.user_stats s on s.user_id=p.id
left join (select user_id,count(*)::int c from public.user_item_progress where status='mastered' group by user_id) m on m.user_id=p.id
left join (select user_id,count(*)::int attempts,coalesce(sum(correct_count),0)::int correct,coalesce(sum(total_questions),0)::int total from public.quiz_attempts group by user_id) q on q.user_id=p.id
on conflict(user_id) do update set
 display_name=excluded.display_name,avatar_url=excluded.avatar_url,jlpt_level=excluded.jlpt_level,ui_language=excluded.ui_language,
 xp=excluded.xp,total_points=excluded.total_points,current_streak=excluded.current_streak,longest_streak=excluded.longest_streak,
 lessons_completed=excluded.lessons_completed,quizzes_completed=excluded.quizzes_completed,correct_answers=excluded.correct_answers,total_answers=excluded.total_answers,updated_at=now();
