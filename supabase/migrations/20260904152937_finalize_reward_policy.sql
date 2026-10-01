create or replace function public.award_item_activity()
returns trigger language plpgsql security definer set search_path='public' as $$ begin return new; end $$;

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
returns public.user_learning_stats language plpgsql security definer set search_path='pg_catalog,public,auth' as $$
declare
  v_user_id uuid:=auth.uid();
  v_today date:=(now() at time zone 'Asia/Tokyo')::date;
  v_prev_date date; v_current_streak int:=0; v_longest_streak int:=0;
  v_effective_points int:=0; v_effective_xp int:=greatest(coalesce(p_xp,0),0);
  v_count_lesson int:=0; v_result public.user_learning_stats;
begin
  if v_user_id is null then raise exception 'User belum login'; end if;

  -- Material and ordinary quizzes never award reward points.
  if p_activity_type in ('daily_target_completed','simulation_section_completed','simulation_full_completed') then
    v_effective_points:=greatest(coalesce(p_points,0),0);
  end if;
  -- Answer-level quiz events are analytics only; XP is awarded once at quiz completion.
  if p_activity_type='quiz_answered' then v_effective_xp:=0; end if;

  -- Material XP is idempotent per item.
  if p_activity_type='lesson_completed' and p_content_id is not null and exists(
    select 1 from public.learning_activity la where la.user_id=v_user_id and la.activity_type='lesson_completed'
      and la.metadata->>'content_id'=p_content_id::text and la.metadata->>'content_type'=coalesce(p_content_type,'')
  ) then
    v_effective_xp:=0;
  elsif p_activity_type='lesson_completed' then v_count_lesson:=1; end if;

  insert into public.user_stats(user_id) values(v_user_id) on conflict(user_id) do nothing;
  select last_activity_date,current_streak,longest_streak into v_prev_date,v_current_streak,v_longest_streak from public.user_stats where user_id=v_user_id for update;
  if v_prev_date is null then v_current_streak:=1;
  elsif v_prev_date=v_today then v_current_streak:=greatest(v_current_streak,1);
  elsif v_prev_date=v_today-1 then v_current_streak:=greatest(v_current_streak,0)+1;
  else v_current_streak:=1; end if;
  v_longest_streak:=greatest(coalesce(v_longest_streak,0),v_current_streak);

  update public.user_stats set total_xp=total_xp+v_effective_xp,reward_points=reward_points+v_effective_points,current_streak=v_current_streak,longest_streak=v_longest_streak,last_activity_date=v_today,updated_at=now() where user_id=v_user_id;

  insert into public.user_learning_stats(user_id,display_name,avatar_url,jlpt_level,ui_language)
  select p.id,p.display_name,p.avatar_url,coalesce(p.target_level::text,'N5'),coalesce(p.ui_language,'id') from public.profiles p where p.id=v_user_id
  on conflict(user_id) do update set display_name=excluded.display_name,avatar_url=excluded.avatar_url,jlpt_level=excluded.jlpt_level,ui_language=excluded.ui_language;

  insert into public.learning_activity(user_id,activity_type,points,xp,metadata)
  values(v_user_id,p_activity_type,v_effective_points,v_effective_xp,coalesce(p_metadata,'{}'::jsonb)||jsonb_build_object('content_type',p_content_type,'content_id',p_content_id,'correct',p_correct,'duration_seconds',greatest(coalesce(p_duration_seconds,0),0)));

  update public.user_learning_stats u set
    xp=s.total_xp,total_points=s.reward_points,
    study_minutes=u.study_minutes+case when greatest(coalesce(p_duration_seconds,0),0)>=60 then greatest(coalesce(p_duration_seconds,0),0)/60 else 0 end,
    lessons_completed=u.lessons_completed+v_count_lesson,
    quizzes_completed=u.quizzes_completed+case when p_activity_type in ('quiz_completed','simulation_section_completed','simulation_full_completed') then 1 else 0 end,
    correct_answers=u.correct_answers+case when p_activity_type='quiz_answered' and p_correct is true then 1 else 0 end,
    total_answers=u.total_answers+case when p_activity_type='quiz_answered' then 1 else 0 end,
    current_streak=s.current_streak,longest_streak=s.longest_streak,last_activity_at=now(),updated_at=now()
  from public.user_stats s where u.user_id=v_user_id and s.user_id=v_user_id returning u.* into v_result;
  return v_result;
end $$;

-- Simulation attempts (quiz_id null) are the only attempts that can grant points.
create or replace function public.award_simulation_attempt_points()
returns trigger language plpgsql security definer set search_path='pg_catalog,public' as $$
declare v_points int; v_exists boolean;
begin
  if new.quiz_id is not null or new.level is null then return new; end if;
  select exists(select 1 from public.learning_activity where user_id=new.user_id and activity_type='simulation_full_completed' and metadata->>'attempt_id'=new.id::text) into v_exists;
  if v_exists then return new; end if;
  v_points:=least(100,greatest(20,new.total_questions*2));
  insert into public.learning_activity(user_id,activity_type,points,xp,metadata)
  values(new.user_id,'simulation_full_completed',v_points,0,jsonb_build_object('attempt_id',new.id::text,'level',new.level::text,'total',new.total_questions,'correct',new.correct_count,'duration_seconds',new.duration_seconds));
  insert into public.user_stats(user_id,reward_points) values(new.user_id,v_points)
  on conflict(user_id) do update set reward_points=public.user_stats.reward_points+v_points,updated_at=now();
  insert into public.user_notifications(user_id,title,body,kind,action_url)
  values(new.user_id,'Simulasi selesai','Kamu mendapat +'||v_points||' Poin dari Simulasi JLPT '||new.level::text||'.','reward','/progress');
  return new;
end $$;
drop trigger if exists trg_award_simulation_attempt_points on public.quiz_attempts;
create trigger trg_award_simulation_attempt_points after insert on public.quiz_attempts for each row execute function public.award_simulation_attempt_points();
