revoke execute on function public.ensure_active_study_plan() from anon;
revoke execute on function public.get_my_dashboard_metrics() from anon;
revoke execute on function public.get_competition_leaderboard(text,integer) from anon;
revoke execute on function public.award_simulation_attempt_points() from anon, authenticated;
revoke execute on function public.award_daily_target_points() from anon, authenticated;
revoke execute on function public.record_learning_activity(text,text,uuid,integer,integer,boolean,integer,jsonb) from anon;
revoke execute on function public.mark_item_mastered(text,uuid,public.jlpt_level) from anon;
revoke execute on function public.sync_google_profile_metadata() from anon;
