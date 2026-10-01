create or replace function public.ensure_active_study_plan()
returns public.study_plans
language plpgsql
security definer
set search_path='pg_catalog','public','auth'
as $$
declare
  v_user uuid := auth.uid();
  v_profile public.profiles;
  v_plan public.study_plans;
  v_target date;
begin
  if v_user is null then raise exception 'not authenticated'; end if;
  select * into v_profile from public.profiles where id=v_user;
  if not found then raise exception 'profile not found'; end if;
  select * into v_plan from public.study_plans where user_id=v_user and status='active' order by created_at desc limit 1;
  if found then return v_plan; end if;
  v_target := case when current_date <= date '2026-12-06' then date '2026-12-06' else current_date + 120 end;
  insert into public.study_plans(user_id,target_level,start_date,target_date,daily_minutes,status,preferred_new_kanji,preferred_new_vocabulary,preferred_new_grammar,preferred_review,preferred_quiz)
  values(v_user,coalesce(v_profile.target_level,'N5'),current_date,v_target,45,'active',5,10,2,15,10)
  returning * into v_plan;
  return v_plan;
end;$$;

grant execute on function public.ensure_active_study_plan() to authenticated;

insert into public.study_plans(user_id,target_level,start_date,target_date,daily_minutes,status,preferred_new_kanji,preferred_new_vocabulary,preferred_new_grammar,preferred_review,preferred_quiz)
select p.id,coalesce(p.target_level,'N5'),current_date,date '2026-12-06',45,'active',5,10,2,15,10
from public.profiles p
where not exists(select 1 from public.study_plans s where s.user_id=p.id and s.status='active');

create or replace function public.get_my_dashboard_metrics()
returns jsonb
language plpgsql
security definer
set search_path='pg_catalog','public','auth'
as $$
declare
  v_user uuid := auth.uid();
  v_level public.jlpt_level;
  v_result jsonb;
  v_last record;
begin
  if v_user is null then raise exception 'not authenticated'; end if;
  select coalesce(target_level,'N5') into v_level from public.profiles where id=v_user;

  select uip.item_type::text as item_type,uip.item_id,uip.level::text as level,uip.last_reviewed_at
  into v_last
  from public.user_item_progress uip
  where uip.user_id=v_user
  order by uip.last_reviewed_at desc nulls last,uip.updated_at desc
  limit 1;

  v_result := jsonb_build_object(
    'level',v_level::text,
    'progress',jsonb_build_object(
      'kanji',jsonb_build_object('done',(select count(*) from public.user_item_progress where user_id=v_user and level=v_level and item_type='kanji' and status='mastered'),'total',(select count(*) from public.kanji where level=v_level and is_published=true)),
      'vocabulary',jsonb_build_object('done',(select count(*) from public.user_item_progress where user_id=v_user and level=v_level and item_type='vocabulary' and status='mastered'),'total',(select count(*) from public.vocabulary where level=v_level and is_published=true)),
      'grammar',jsonb_build_object('done',(select count(*) from public.user_item_progress where user_id=v_user and level=v_level and item_type='grammar' and status='mastered'),'total',(select count(*) from public.grammar_points where level=v_level and is_published=true)),
      'reading',jsonb_build_object('done',(select count(*) from public.user_item_progress where user_id=v_user and level=v_level and item_type='reading' and status='mastered'),'total',(select count(*) from public.reading_passages where level=v_level and is_published=true)),
      'listening',jsonb_build_object('done',(select count(*) from public.user_item_progress where user_id=v_user and level=v_level and item_type='listening' and status='mastered'),'total',(select count(*) from public.listening_items where level=v_level and is_published=true))
    ),
    'weekly',(select coalesce(jsonb_agg(jsonb_build_object('date',d::date,'xp',coalesce(x.xp,0),'minutes',coalesce(x.minutes,0),'activities',coalesce(x.activities,0)) order by d), '[]'::jsonb)
      from generate_series((now() at time zone 'Asia/Tokyo')::date-6,(now() at time zone 'Asia/Tokyo')::date,interval '1 day') d
      left join lateral (
        select coalesce(sum(la.xp),0)::int xp,
               coalesce(sum(greatest(coalesce((la.metadata->>'duration_seconds')::int,0),0))/60,0)::int minutes,
               count(*)::int activities
        from public.learning_activity la
        where la.user_id=v_user and (la.created_at at time zone 'Asia/Tokyo')::date=d::date
      ) x on true),
    'last',case when v_last.item_id is null then null else jsonb_build_object('type',v_last.item_type,'id',v_last.item_id,'level',v_last.level,'at',v_last.last_reviewed_at) end
  );
  return v_result;
end;$$;

grant execute on function public.get_my_dashboard_metrics() to authenticated;

create or replace function public.get_competition_leaderboard(p_period text default 'weekly', p_limit integer default 50)
returns table(rank bigint,user_id uuid,display_name text,avatar_url text,jlpt_level text,period_xp bigint,total_xp integer,total_points integer,current_streak integer)
language sql
stable
security definer
set search_path='pg_catalog','public','auth'
as $$
with bounds as (
  select case when p_period='monthly' then date_trunc('month',now() at time zone 'Asia/Tokyo')
                   else date_trunc('week',now() at time zone 'Asia/Tokyo') end as start_jst
), agg as (
  select p.id user_id,p.display_name,p.avatar_url,coalesce(p.target_level::text,'N5') jlpt_level,
         coalesce(sum(la.xp) filter(where la.created_at >= ((b.start_jst at time zone 'Asia/Tokyo'))),0)::bigint period_xp
  from public.profiles p cross join bounds b
  left join public.learning_activity la on la.user_id=p.id
  group by p.id,p.display_name,p.avatar_url,p.target_level
)
select row_number() over(order by a.period_xp desc,coalesce(s.total_xp,0) desc,a.user_id),a.user_id,a.display_name,a.avatar_url,a.jlpt_level,a.period_xp,coalesce(s.total_xp,0),coalesce(s.reward_points,0),coalesce(s.current_streak,0)
from agg a left join public.user_stats s on s.user_id=a.user_id
order by a.period_xp desc,coalesce(s.total_xp,0) desc,a.user_id
limit greatest(1,least(coalesce(p_limit,50),100));
$$;

grant execute on function public.get_competition_leaderboard(text,integer) to authenticated;
