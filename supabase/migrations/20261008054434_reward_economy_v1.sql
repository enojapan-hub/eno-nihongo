-- Reward economy v1: keep XP for account/league progression and Points for ranking/spending.
-- This migration is intentionally not applied from this PR.

create or replace function public.award_referral_signup(p_code text)
returns integer
language plpgsql
security definer
set search_path = pg_catalog, public, auth
as $$
declare
  v_user uuid := (select auth.uid());
  v_referrer uuid;
  v_code text := upper(trim(p_code));
  v_joined_at timestamptz;
begin
  if v_user is null then raise exception 'not_authenticated'; end if;
  -- Serialize concurrent signup attempts for the same referred account.
  perform pg_advisory_xact_lock(hashtextextended('referral_signup:' || v_user::text, 0));
  -- Only newly registered accounts can attach a referral, before their first learning activity.
  select created_at into v_joined_at from public.profiles where id = v_user;
  if v_joined_at is null or v_joined_at < now() - interval '7 days' then return 0; end if;
  if exists(select 1 from public.learning_activity where user_id = v_user) then return 0; end if;
  select id into v_referrer
  from public.profiles
  where upper(referral_code)=v_code and id <> v_user;
  if v_referrer is null then return 0; end if;

  if exists(select 1 from public.referrals where referred_user_id=v_user) then return 0; end if;

  insert into public.referrals(referrer_id,referred_user_id,code,status,points_awarded)
  values(v_referrer,v_user,v_code,'pending',0);
  return 1;
end;
$$;
revoke all on function public.award_referral_signup(text) from public, anon;
grant execute on function public.award_referral_signup(text) to authenticated;

create or replace function public.activate_referral_reward()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, auth
as $$
declare
  v_ref public.referrals%rowtype;
begin
  -- Ignore passive/system activity; only validated learning events may unlock a reward.
  if new.activity_type not in ('lesson_completed') then return new; end if;

  select * into v_ref
  from public.referrals
  where referred_user_id=new.user_id and status='pending'
  order by created_at asc
  limit 1
  for update;

  if v_ref.id is null then return new; end if;

  update public.referrals set status='completed' where id=v_ref.id and status='pending';
  if not found then return new; end if;

  update public.profiles
  set plan = case when plan='lifetime' then plan else 'premium' end,
      premium_until = case
        when plan='lifetime' then premium_until
        else greatest(coalesce(premium_until,now()),now()) + interval '30 days'
      end,
      updated_at=now()
  where id=v_ref.referrer_id;

  insert into public.reward_grants(user_id,reward_kind,premium_days,points_spent,metadata)
  values(v_ref.referrer_id,'referral_premium',30,0,jsonb_build_object('referral_id',v_ref.id,'referred_user_id',new.user_id));

  insert into public.referral_events(referrer_id,referred_user_id,referral_code,event_type,points_awarded)
  values(v_ref.referrer_id,new.user_id,v_ref.code,'conversion',0)
  on conflict (referrer_id,referred_user_id,event_type) do nothing;

  return new;
end;
$$;
revoke all on function public.activate_referral_reward() from public, anon, authenticated;

drop trigger if exists trg_activate_referral_reward on public.learning_activity;
create trigger trg_activate_referral_reward
after insert on public.learning_activity
for each row execute function public.activate_referral_reward();

create or replace function public.redeem_points_for_premium(p_points integer default 1000)
returns integer
language plpgsql
security definer
set search_path = pg_catalog, public, auth
as $$
declare
  v_user uuid := (select auth.uid());
  v_days integer;
  v_balance integer;
begin
  if v_user is null then raise exception 'not_authenticated'; end if;
  v_days := case p_points when 1000 then 7 else null end;
  if v_days is null then raise exception 'invalid_points'; end if;

  select reward_points into v_balance from public.user_stats where user_id=v_user for update;
  if coalesce(v_balance,0) < p_points then return 0; end if;

  update public.user_stats
  set reward_points=reward_points-p_points,updated_at=now()
  where user_id=v_user;

  update public.profiles
  set plan=case when plan='lifetime' then plan else 'premium' end,
      premium_until=case when plan='lifetime' then premium_until else greatest(coalesce(premium_until,now()),now())+make_interval(days=>v_days) end,
      updated_at=now()
  where id=v_user;

  insert into public.point_redemptions(user_id,reward_type,points_spent,status)
  values(v_user,'premium_7d',p_points,'completed');

  insert into public.reward_grants(user_id,reward_kind,premium_days,points_spent,metadata)
  values(v_user,'points_premium',v_days,p_points,jsonb_build_object('source','reward_points'));

  return v_days;
end;
$$;
revoke all on function public.redeem_points_for_premium(integer) from public, anon;
grant execute on function public.redeem_points_for_premium(integer) to authenticated;

-- Preserve the existing RPC signature and its dependents; only replace its body.
create or replace function public.get_competition_leaderboard(p_period text default 'weekly', p_limit integer default 50)
returns table(rank bigint,user_id uuid,display_name text,avatar_url text,jlpt_level text,period_xp bigint,total_xp integer,total_points integer,current_streak integer)
language sql
stable
security definer
set search_path = pg_catalog, public, auth
as $$
with bounds as (
  select case when p_period='monthly'
    then date_trunc('month',now() at time zone 'Asia/Tokyo')
    else date_trunc('week',now() at time zone 'Asia/Tokyo') end as start_jst
), agg as (
  select p.id user_id,p.display_name,p.avatar_url,coalesce(p.target_level::text,'N5') jlpt_level,
    coalesce(sum(la.xp) filter(where la.created_at >= (b.start_jst at time zone 'Asia/Tokyo')),0)::bigint period_xp,
    coalesce(sum(la.points) filter(where la.created_at >= (b.start_jst at time zone 'Asia/Tokyo')),0)::bigint period_points
  from public.profiles p cross join bounds b
  left join public.learning_activity la on la.user_id=p.id
  where p.role is distinct from 'owner'
  group by p.id,p.display_name,p.avatar_url,p.target_level
)
select row_number() over(order by a.period_points desc,coalesce(s.reward_points,0) desc,a.user_id),
  a.user_id,a.display_name,a.avatar_url,a.jlpt_level,a.period_xp,
  coalesce(s.total_xp,0),coalesce((select sum(la.points)::int from public.learning_activity la where la.user_id=a.user_id),0),
  coalesce(s.current_streak,0)
from agg a left join public.user_stats s on s.user_id=a.user_id
order by a.period_points desc,coalesce(s.reward_points,0) desc,a.user_id
limit greatest(1,least(coalesce(p_limit,50),100));
$$;
revoke all on function public.get_competition_leaderboard(text,integer) from public, anon;
grant execute on function public.get_competition_leaderboard(text,integer) to authenticated;
