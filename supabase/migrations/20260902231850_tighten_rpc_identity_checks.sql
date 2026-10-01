create or replace function public.is_premium(p_user_id uuid default auth.uid())
returns boolean
language sql
stable security definer
set search_path = public
as $$
  select exists(
    select 1 from public.profiles p
    where p.id = p_user_id
      and (p.plan in ('premium','lifetime') or p.premium_until > now())
      and (p_user_id = (select auth.uid()))
  );
$$;

create or replace function public.award_referral_signup(p_code text)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare v_referrer uuid; v_points integer := 100;
begin
  if (select auth.uid()) is null then raise exception 'not_authenticated'; end if;
  select id into v_referrer from public.profiles
  where upper(referral_code)=upper(trim(p_code)) and id <> (select auth.uid());
  if v_referrer is null then return 0; end if;
  insert into public.referral_events(referrer_id,referred_user_id,referral_code,event_type,points_awarded)
  values(v_referrer,(select auth.uid()),upper(trim(p_code)),'signup',v_points)
  on conflict (referrer_id,referred_user_id,event_type) do nothing;
  if found then
    update public.profiles set referral_points=referral_points+v_points, updated_at=now() where id=v_referrer;
    return v_points;
  end if;
  return 0;
end;
$$;

create or replace function public.redeem_referral_points(p_points integer default 1000)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare v_days integer := 7; v_balance integer;
begin
  if (select auth.uid()) is null then raise exception 'not_authenticated'; end if;
  if p_points <> 1000 then raise exception 'invalid_points'; end if;
  select referral_points into v_balance from public.profiles where id=(select auth.uid()) for update;
  if coalesce(v_balance,0) < p_points then return 0; end if;
  update public.profiles
    set referral_points = referral_points - p_points,
        plan = case when plan='lifetime' then plan else 'premium' end,
        premium_until = case when plan='lifetime' then premium_until else greatest(coalesce(premium_until, now()), now()) + make_interval(days => v_days) end,
        updated_at = now()
    where id=(select auth.uid());
  insert into public.reward_grants(user_id,reward_kind,premium_days,points_spent,metadata)
  values((select auth.uid()),'referral_premium',v_days,p_points,jsonb_build_object('source','referral_points'));
  return v_days;
end;
$$;

create or replace function public.submit_quiz_attempt(p_quiz_id uuid, p_level jlpt_level, p_skill content_skill, p_answers jsonb, p_duration_seconds integer default 0)
returns public.quiz_attempts
language plpgsql
security definer
set search_path = public
as $$
declare v_attempt public.quiz_attempts; v_total integer; v_correct integer; v_xp integer; v_score numeric(5,2);
begin
  if (select auth.uid()) is null then raise exception 'Authentication required'; end if;
  select count(*) into v_total from jsonb_array_elements(coalesce(p_answers,'[]'::jsonb));
  if v_total=0 then raise exception 'No answers submitted'; end if;
  select count(*) into v_correct
  from jsonb_array_elements(coalesce(p_answers,'[]'::jsonb)) a
  join public.questions q on q.id=(a->>'questionId')::uuid
  where q.is_published=true and (a->>'selectedIndex')::integer=q.correct_index;
  v_score:=round((v_correct::numeric/v_total::numeric)*100,2); v_xp:=v_correct*10;
  insert into public.quiz_attempts(user_id,quiz_id,level,skill,total_questions,correct_count,score,xp_earned,duration_seconds)
  values((select auth.uid()),p_quiz_id,p_level,p_skill,v_total,v_correct,v_score,v_xp,greatest(coalesce(p_duration_seconds,0),0)) returning * into v_attempt;
  insert into public.quiz_answers(attempt_id,user_id,question_id,selected_index,is_correct)
  select v_attempt.id,(select auth.uid()),(a->>'questionId')::uuid,(a->>'selectedIndex')::integer,(a->>'selectedIndex')::integer=q.correct_index
  from jsonb_array_elements(coalesce(p_answers,'[]'::jsonb)) a
  join public.questions q on q.id=(a->>'questionId')::uuid and q.is_published=true;
  return v_attempt;
end;
$$;

-- Ensure the user-callable RPCs are not executable by anonymous/public roles.
revoke execute on function public.award_referral_signup(text) from public, anon;
grant execute on function public.award_referral_signup(text) to authenticated;
revoke execute on function public.redeem_referral_points(integer) from public, anon;
grant execute on function public.redeem_referral_points(integer) to authenticated;
revoke execute on function public.submit_quiz_attempt(uuid, jlpt_level, content_skill, jsonb, integer) from public, anon;
grant execute on function public.submit_quiz_attempt(uuid, jlpt_level, content_skill, jsonb, integer) to authenticated;
revoke execute on function public.is_premium(uuid) from public, anon;
grant execute on function public.is_premium(uuid) to authenticated;
