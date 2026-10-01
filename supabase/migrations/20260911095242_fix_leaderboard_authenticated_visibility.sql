create or replace function public.get_leaderboard(p_limit integer default 50)
returns table(rank bigint, user_id uuid, display_name text, avatar_url text, jlpt_level text, total_points integer, xp integer, study_minutes integer, lessons_completed integer, quizzes_completed integer, correct_answers integer, total_answers integer, current_streak integer, longest_streak integer, last_activity_at timestamptz)
language sql
stable
security definer
set search_path = pg_catalog, public, auth
as $function$
  select
    row_number() over (order by uls.total_points desc, uls.xp desc, uls.last_activity_at asc nulls last) as rank,
    uls.user_id, uls.display_name, uls.avatar_url, uls.jlpt_level,
    uls.total_points, uls.xp, uls.study_minutes, uls.lessons_completed,
    uls.quizzes_completed, uls.correct_answers, uls.total_answers,
    uls.current_streak, uls.longest_streak, uls.last_activity_at
  from public.user_learning_stats uls
  order by uls.total_points desc, uls.xp desc, uls.last_activity_at asc nulls last
  limit greatest(1, least(coalesce(p_limit,50),100));
$function$;

create or replace function public.get_competition_leaderboard(p_period text default 'weekly', p_limit integer default 50)
returns table(rank bigint, user_id uuid, display_name text, avatar_url text, jlpt_level text, period_xp bigint, total_xp integer, total_points integer, current_streak integer)
language sql
stable
security definer
set search_path = pg_catalog, public, auth
as $function$
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
$function$;

revoke all on function public.get_leaderboard(integer) from public, anon;
revoke all on function public.get_competition_leaderboard(text,integer) from public, anon;
grant execute on function public.get_leaderboard(integer) to authenticated, service_role;
grant execute on function public.get_competition_leaderboard(text,integer) to authenticated, service_role;

comment on function public.get_leaderboard(integer) is 'Authenticated leaderboard read boundary. SECURITY DEFINER intentionally bypasses own-row RLS while exposing only public leaderboard fields.';
comment on function public.get_competition_leaderboard(text,integer) is 'Authenticated competition leaderboard read boundary. SECURITY DEFINER intentionally bypasses own-row RLS while exposing only public leaderboard fields.';
