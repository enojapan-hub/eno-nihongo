-- Explicitly deny anonymous/PUBLIC execution for every remaining client-facing privileged RPC.
revoke execute on function public.award_referral_signup(text) from public, anon;
revoke execute on function public.can_start_full_simulation() from public, anon;
revoke execute on function public.get_my_dashboard_metrics() from public, anon;
revoke execute on function public.mark_item_mastered(text,uuid,public.jlpt_level) from public, anon;
revoke execute on function public.record_learning_activity(text,text,uuid,integer,integer,boolean,integer,jsonb) from public, anon;
revoke execute on function public.record_learning_activity(text,integer,integer,jsonb) from public, anon;
revoke execute on function public.redeem_referral_points(integer) from public, anon;
revoke execute on function public.submit_quiz_attempt(uuid,public.jlpt_level,public.content_skill,jsonb,integer) from public, anon;

-- Keep only the role actually required by the web app.
grant execute on function public.award_referral_signup(text) to authenticated;
grant execute on function public.can_start_full_simulation() to authenticated;
grant execute on function public.get_my_dashboard_metrics() to authenticated;
grant execute on function public.mark_item_mastered(text,uuid,public.jlpt_level) to authenticated;
grant execute on function public.record_learning_activity(text,text,uuid,integer,integer,boolean,integer,jsonb) to authenticated;
grant execute on function public.record_learning_activity(text,integer,integer,jsonb) to authenticated;
grant execute on function public.redeem_referral_points(integer) to authenticated;
grant execute on function public.submit_quiz_attempt(uuid,public.jlpt_level,public.content_skill,jsonb,integer) to authenticated;

comment on function public.award_referral_signup(text) is 'Authenticated RPC. SECURITY DEFINER intentional: referral award writes another user referral balance; auth.uid and unique referral event protect caller scope.';
comment on function public.can_start_full_simulation() is 'Authenticated RPC. SECURITY DEFINER intentional: reads only auth.uid membership and own attempt usage.';
comment on function public.get_my_dashboard_metrics() is 'Authenticated RPC. SECURITY DEFINER intentional: dashboard is scoped exclusively to auth.uid.';
comment on function public.mark_item_mastered(text,uuid,public.jlpt_level) is 'Authenticated RPC. SECURITY DEFINER intentional: validates published content and writes only auth.uid progress.';
comment on function public.record_learning_activity(text,text,uuid,integer,integer,boolean,integer,jsonb) is 'Authenticated RPC. SECURITY DEFINER intentional. Client supplied XP/points are ignored; only verified lesson content can mint fixed XP.';
comment on function public.record_learning_activity(text,integer,integer,jsonb) is 'Legacy authenticated RPC. SECURITY DEFINER intentional. Caller supplied XP/points are ignored.';
comment on function public.redeem_referral_points(integer) is 'Authenticated RPC. SECURITY DEFINER intentional: fixed 1000-point redemption, row locked and scoped to auth.uid.';
comment on function public.submit_quiz_attempt(uuid,public.jlpt_level,public.content_skill,jsonb,integer) is 'Authenticated RPC. SECURITY DEFINER intentional: quiz membership, publication, level and skill are server-validated; writes only auth.uid attempt.';
