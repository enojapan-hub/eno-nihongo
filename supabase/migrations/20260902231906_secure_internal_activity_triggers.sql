-- These two SECURITY DEFINER functions are trigger handlers, not client RPCs.
-- Revoke their public API execution while preserving trigger execution.
revoke execute on function public.award_item_activity() from public, anon, authenticated;
revoke execute on function public.award_quiz_activity() from public, anon, authenticated;

-- This function is a trigger handler for content_translations; pin its search_path.
create or replace function public.touch_content_translations_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- This is an Auth trigger handler and must remain privileged, but it is not a client RPC.
revoke execute on function public.ensure_profile_defaults() from public, anon, authenticated;

-- Keep the normal user-facing RPCs restricted to authenticated users.
revoke execute on function public.award_referral_signup(text) from public, anon;
grant execute on function public.award_referral_signup(text) to authenticated;
revoke execute on function public.redeem_referral_points(integer) from public, anon;
grant execute on function public.redeem_referral_points(integer) to authenticated;
revoke execute on function public.submit_quiz_attempt(uuid, jlpt_level, content_skill, jsonb, integer) from public, anon;
grant execute on function public.submit_quiz_attempt(uuid, jlpt_level, content_skill, jsonb, integer) to authenticated;
revoke execute on function public.is_premium(uuid) from public, anon;
grant execute on function public.is_premium(uuid) to authenticated;
