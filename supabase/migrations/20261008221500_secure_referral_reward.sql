-- Referral reward is granted only for a completed lesson through the validated atomic flow.
-- A direct INSERT into learning_activity or a direct RPC call cannot satisfy this guard.
create or replace function public.activate_referral_reward()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, auth
as $$
declare
  v_ref public.referrals%rowtype;
  v_type text := new.metadata->>'content_type';
  v_item uuid;
begin
  if new.activity_type <> 'lesson_completed' then return new; end if;
  if current_setting('eno.validated_material_learning', true) is distinct from new.user_id::text then
    return new;
  end if;
  if v_type not in ('kanji','vocabulary','grammar','reading','listening') then return new; end if;
  if coalesce(new.metadata->>'content_id','') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then return new; end if;
  v_item := (new.metadata->>'content_id')::uuid;
  if not exists (
    select 1 from public.user_item_progress p
    where p.user_id=new.user_id and p.item_type::text=v_type and p.item_id=v_item and p.status='learning'
  ) then return new; end if;

  select * into v_ref from public.referrals
  where referred_user_id=new.user_id and status='pending'
  order by created_at asc limit 1 for update;
  if v_ref.id is null then return new; end if;
  update public.referrals set status='completed' where id=v_ref.id and status='pending';
  if not found then return new; end if;
  update public.profiles
  set plan=case when plan='lifetime' then plan else 'premium' end,
      premium_until=case when plan='lifetime' then premium_until
        else greatest(coalesce(premium_until,now()),now())+interval '30 days' end,
      updated_at=now()
  where id=v_ref.referrer_id;
  insert into public.reward_grants(user_id,reward_kind,premium_days,points_spent,metadata)
  values(v_ref.referrer_id,'referral_premium',30,0,
    jsonb_build_object('referral_id',v_ref.id,'referred_user_id',new.user_id));
  insert into public.referral_events(referrer_id,referred_user_id,referral_code,event_type,points_awarded)
  values(v_ref.referrer_id,new.user_id,v_ref.code,'conversion',0)
  on conflict (referrer_id,referred_user_id,event_type) do nothing;
  return new;
end;
$$;
revoke all on function public.activate_referral_reward() from public,anon,authenticated;

create or replace function public.mark_material_learned_atomic(
  p_item_type public.content_skill, p_item_id uuid, p_level public.jlpt_level
) returns boolean
language plpgsql
security definer
set search_path = pg_catalog, public, auth
as $$
declare
  v_user uuid := auth.uid();
  v_existing public.user_item_progress%rowtype;
begin
  if v_user is null then raise exception 'login_required'; end if;
  if p_item_type is null or p_item_id is null or p_level is null then raise exception 'invalid_content'; end if;
  perform pg_advisory_xact_lock(hashtextextended(v_user::text || ':' || p_item_type::text || ':' || p_item_id::text,0));
  select * into v_existing from public.user_item_progress
  where user_id=v_user and item_type=p_item_type and item_id=p_item_id for update;
  if found and v_existing.status <> 'new' then return false; end if;
  if v_existing.id is not null then
    update public.user_item_progress
    set status='learning',repetitions=1,last_reviewed_at=now(),due_at=now()+interval '1 day'
    where id=v_existing.id;
  else
    insert into public.user_item_progress(user_id,item_type,item_id,level,status,repetitions,last_reviewed_at,due_at)
    values(v_user,p_item_type,p_item_id,p_level,'learning',1,now(),now()+interval '1 day');
  end if;
  -- The transaction-local marker is only set by this validated server function.
  perform set_config('eno.validated_material_learning',v_user::text,true);
  begin
    perform public.record_learning_activity('lesson_completed',p_item_type::text,p_item_id,0,0,null,60,
      jsonb_build_object('level',p_level::text,'repetition',1));
  exception when others then
    perform set_config('eno.validated_material_learning','',true);
    raise;
  end;
  perform set_config('eno.validated_material_learning','',true);
  return true;
end;
$$;
