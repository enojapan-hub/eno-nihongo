-- The Duitku callback is verified in the server route before this function is
-- called. This function keeps the order update and plan activation atomic.
create or replace function public.finalize_duitku_payment(
  p_merchant_order_id text,
  p_provider_reference text,
  p_payment_method text,
  p_event_key text,
  p_payload jsonb
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order public.payment_orders%rowtype;
  v_current_plan text;
  v_current_expiry timestamptz;
  v_next_plan text;
  v_next_expiry timestamptz;
begin
  select * into v_order
  from public.payment_orders
  where merchant_order_id = p_merchant_order_id
  for update;

  if not found then
    raise exception 'Payment order not found';
  end if;

  insert into public.payment_webhook_events (
    provider, event_key, merchant_order_id, status, payload
  ) values (
    'duitku', p_event_key, p_merchant_order_id, 'received', p_payload
  ) on conflict (provider, event_key) do nothing;

  if v_order.status = 'paid' then
    return 'already_paid';
  end if;

  if v_order.plan not in ('premium_monthly', 'premium_yearly', 'lifetime') then
    raise exception 'Invalid paid plan';
  end if;

  select plan, premium_until into v_current_plan, v_current_expiry
  from public.profiles
  where id = v_order.user_id
  for update;

  if not found then
    raise exception 'Profile not found';
  end if;

  if v_order.plan = 'lifetime' or v_current_plan = 'lifetime' then
    v_next_plan := 'lifetime';
    v_next_expiry := null;
  else
    v_next_plan := 'premium';
    v_next_expiry := greatest(coalesce(v_current_expiry, now()), now())
      + make_interval(days => v_order.duration_days);
  end if;

  update public.profiles
  set plan = v_next_plan,
      premium_until = v_next_expiry,
      updated_at = now()
  where id = v_order.user_id;

  update public.payment_orders
  set status = 'paid',
      provider_reference = p_provider_reference,
      paid_at = now(),
      updated_at = now()
  where id = v_order.id;

  update public.payment_webhook_events
  set status = 'processed', processed_at = now()
  where provider = 'duitku' and event_key = p_event_key;

  return 'paid';
end;
$$;

revoke all on function public.finalize_duitku_payment(text, text, text, text, jsonb) from public, anon, authenticated;
grant execute on function public.finalize_duitku_payment(text, text, text, text, jsonb) to service_role;
