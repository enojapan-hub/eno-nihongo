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
  v_result public.user_learning_stats;
begin
  if v_user_id is null then raise exception 'User belum login'; end if;

  insert into public.user_stats(user_id) values(v_user_id) on conflict (user_id) do nothing;
  select last_activity_date,current_streak,longest_streak
    into v_prev_date,v_current_streak,v_longest_streak
  from public.user_stats where user_id=v_user_id for update;

  if v_prev_date is null then
    v_current_streak := 1;
  elsif v_prev_date = v_today then
    v_current_streak := greatest(v_current_streak,1);
  elsif v_prev_date = v_today - 1 then
    v_current_streak := greatest(v_current_streak,0)+1;
  else
    v_current_streak := 1;
  end if;
  v_longest_streak := greatest(coalesce(v_longest_streak,0),v_current_streak);

  update public.user_stats set
    total_xp = total_xp + greatest(coalesce(p_xp,0),0),
    reward_points = reward_points + greatest(coalesce(p_points,0),0),
    current_streak = v_current_streak,
    longest_streak = v_longest_streak,
    last_activity_date = v_today,
    updated_at = now()
  where user_id=v_user_id;

  insert into public.user_learning_stats(user_id,display_name,avatar_url,jlpt_level,ui_language)
  select p.id,p.display_name,p.avatar_url,coalesce(p.target_level::text,'N5'),coalesce(p.ui_language,'id')
  from public.profiles p where p.id=v_user_id
  on conflict (user_id) do update set
    display_name=excluded.display_name,
    avatar_url=excluded.avatar_url,
    jlpt_level=excluded.jlpt_level,
    ui_language=excluded.ui_language;

  insert into public.learning_activity(user_id,activity_type,points,xp,metadata)
  values(v_user_id,p_activity_type,greatest(coalesce(p_points,0),0),greatest(coalesce(p_xp,0),0),
    coalesce(p_metadata,'{}'::jsonb) || jsonb_build_object(
      'content_type',p_content_type,'content_id',p_content_id,
      'correct',p_correct,'duration_seconds',greatest(coalesce(p_duration_seconds,0),0)
    ));

  update public.user_learning_stats u set
    xp = s.total_xp,
    total_points = s.reward_points,
    study_minutes = u.study_minutes + case when greatest(coalesce(p_duration_seconds,0),0) >= 60 then greatest(coalesce(p_duration_seconds,0),0)/60 else 0 end,
    lessons_completed = u.lessons_completed + case when p_activity_type='lesson_completed' then 1 else 0 end,
    quizzes_completed = u.quizzes_completed + case when p_activity_type='quiz_completed' then 1 else 0 end,
    correct_answers = u.correct_answers + case when p_activity_type='quiz_answered' and p_correct is true then 1 else 0 end,
    total_answers = u.total_answers + case when p_activity_type='quiz_answered' then 1 else 0 end,
    current_streak = s.current_streak,
    longest_streak = s.longest_streak,
    last_activity_at = now(),
    updated_at = now()
  from public.user_stats s
  where u.user_id=v_user_id and s.user_id=v_user_id
  returning u.* into v_result;

  return v_result;
end;
$$;

grant execute on function public.record_learning_activity(text,text,uuid,integer,integer,boolean,integer,jsonb) to authenticated;

create or replace function public.mark_item_mastered(p_item_type text,p_item_id uuid,p_level public.jlpt_level)
returns public.user_item_progress
language plpgsql
security definer
set search_path=pg_catalog,public,auth
as $$
declare
  v_user_id uuid := auth.uid();
  v_row public.user_item_progress;
  v_already_mastered boolean := false;
begin
  if v_user_id is null then raise exception 'User belum login'; end if;

  select (status='mastered') into v_already_mastered
  from public.user_item_progress
  where user_id=v_user_id and item_type::text=p_item_type and item_id=p_item_id;
  v_already_mastered := coalesce(v_already_mastered,false);

  insert into public.user_item_progress(user_id,item_type,item_id,level,status,repetitions,last_reviewed_at,due_at)
  values(v_user_id,p_item_type::public.item_type,p_item_id,p_level,'mastered',1,now(),now()+interval '7 days')
  on conflict (user_id,item_type,item_id) do update set
    level=excluded.level,status='mastered',
    repetitions=greatest(public.user_item_progress.repetitions,1),
    last_reviewed_at=now(),due_at=now()+interval '7 days',updated_at=now()
  returning * into v_row;

  if not v_already_mastered then
    perform public.record_learning_activity(
      'lesson_completed',p_item_type,p_item_id,5,5,null,60,
      jsonb_build_object('level',p_level::text,'status','mastered')
    );
  end if;
  return v_row;
end;
$$;

grant execute on function public.mark_item_mastered(text,uuid,public.jlpt_level) to authenticated;

create or replace function public.sync_profile_to_learning_stats()
returns trigger language plpgsql security definer set search_path=pg_catalog,public as $$
begin
  insert into public.user_learning_stats(user_id,display_name,avatar_url,jlpt_level,ui_language)
  values(new.id,new.display_name,new.avatar_url,coalesce(new.target_level::text,'N5'),coalesce(new.ui_language,'id'))
  on conflict(user_id) do update set
    display_name=excluded.display_name,avatar_url=excluded.avatar_url,
    jlpt_level=excluded.jlpt_level,ui_language=excluded.ui_language,updated_at=now();
  return new;
end; $$;

drop trigger if exists trg_sync_profile_learning_stats on public.profiles;
create trigger trg_sync_profile_learning_stats after insert or update of display_name,avatar_url,target_level,ui_language on public.profiles
for each row execute function public.sync_profile_to_learning_stats();

insert into public.user_learning_stats(user_id,display_name,avatar_url,jlpt_level,ui_language,xp,total_points,current_streak,longest_streak,lessons_completed,updated_at)
select p.id,p.display_name,p.avatar_url,coalesce(p.target_level::text,'N5'),coalesce(p.ui_language,'id'),
       coalesce(s.total_xp,0),coalesce(s.reward_points,0),coalesce(s.current_streak,0),coalesce(s.longest_streak,0),
       coalesce(pr.mastered_count,0),now()
from public.profiles p
left join public.user_stats s on s.user_id=p.id
left join (select user_id,count(*) filter(where status='mastered')::int mastered_count from public.user_item_progress group by user_id) pr on pr.user_id=p.id
on conflict(user_id) do update set
 display_name=excluded.display_name,avatar_url=excluded.avatar_url,jlpt_level=excluded.jlpt_level,ui_language=excluded.ui_language,
 xp=excluded.xp,total_points=excluded.total_points,current_streak=excluded.current_streak,longest_streak=excluded.longest_streak,
 lessons_completed=greatest(public.user_learning_stats.lessons_completed,excluded.lessons_completed),updated_at=now();

update public.user_item_progress set status='mastered',due_at=coalesce(due_at,now()+interval '7 days'),updated_at=now()
where status='learning' and repetitions>=1;
