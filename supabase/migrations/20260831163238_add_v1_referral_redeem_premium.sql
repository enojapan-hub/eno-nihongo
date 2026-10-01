create or replace function public.redeem_referral_points(p_points integer default 1000)
returns integer language plpgsql security definer set search_path = public as $$
declare v_days integer := 7; v_balance integer;
begin
  if auth.uid() is null then raise exception 'not_authenticated'; end if;
  if p_points <> 1000 then raise exception 'invalid_points'; end if;
  select referral_points into v_balance from public.profiles where id=auth.uid() for update;
  if coalesce(v_balance,0) < p_points then return 0; end if;
  update public.profiles
    set referral_points = referral_points - p_points,
        plan = case when plan='lifetime' then plan else 'premium' end,
        premium_until = case when plan='lifetime' then premium_until else greatest(coalesce(premium_until, now()), now()) + make_interval(days => v_days) end,
        updated_at = now()
    where id=auth.uid();
  insert into public.reward_grants(user_id,reward_kind,premium_days,points_spent,metadata)
  values(auth.uid(),'referral_premium',v_days,p_points,jsonb_build_object('source','referral_points'));
  return v_days;
end; $$;
revoke all on function public.redeem_referral_points(integer) from public;
grant execute on function public.redeem_referral_points(integer) to authenticated;
