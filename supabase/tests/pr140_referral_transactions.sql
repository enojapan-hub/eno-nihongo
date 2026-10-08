BEGIN;
DO $$
DECLARE
  a uuid := '11111111-1111-4111-8111-111111111111';
  b uuid := '22222222-2222-4222-8222-222222222222';
  item uuid := '33333333-3333-4333-8333-333333333333';
  v_before timestamptz;
  v_after timestamptz;
  v_count integer;
BEGIN
  insert into public.profiles(id,referral_code) values (a,'ENO-REFERRER'),(b,'ENO-NEWUSER');
  insert into public.user_stats(user_id,reward_points) values(a,1500),(b,0);
  perform set_config('request.jwt.claim.sub',b::text,true);
  if public.award_referral_signup('ENO-NEWUSER') <> 0 then raise exception 'self referral accepted'; end if;
  if public.award_referral_signup('ENO-REFERRER') <> 1 then raise exception 'valid referral rejected'; end if;
  if public.award_referral_signup('ENO-REFERRER') <> 0 then raise exception 'duplicate referral accepted'; end if;
  insert into public.learning_activity(user_id,activity_type,metadata)
    values(b,'lesson_completed',jsonb_build_object('content_type','kanji','content_id',item));
  select count(*) into v_count from public.reward_grants where user_id=a;
  if v_count <> 0 then raise exception 'unvalidated activity granted reward'; end if;
  if public.mark_material_learned_atomic('kanji',item,'N5') is distinct from true then
    raise exception 'valid learning rejected';
  end if;
  select premium_until into v_after from public.profiles where id=a;
  if v_after not between now()+interval '29 days' and now()+interval '31 days' then
    raise exception 'referral premium not 30 days';
  end if;
  select count(*) into v_count from public.reward_grants where user_id=a and reward_kind='referral_premium';
  if v_count <> 1 then raise exception 'referral grant count incorrect: %',v_count; end if;
  if public.mark_material_learned_atomic('kanji',item,'N5') is distinct from false then
    raise exception 'duplicate learning accepted';
  end if;
  select count(*) into v_count from public.reward_grants where user_id=a and reward_kind='referral_premium';
  if v_count <> 1 then raise exception 'referral grant duplicated'; end if;
  perform set_config('request.jwt.claim.sub',a::text,true);
  if public.redeem_points_for_premium(1000) <> 7 then raise exception 'redemption failed'; end if;
  select premium_until into v_before from public.profiles where id=a;
  if v_before < v_after+interval '6 days' then raise exception 'premium extension failed'; end if;
  if (select reward_points from public.user_stats where user_id=a) <> 500 then
    raise exception 'points balance incorrect';
  end if;
  if public.redeem_points_for_premium(1000) <> 0 then
    raise exception 'insufficient points accepted';
  end if;
END $$;
ROLLBACK;
