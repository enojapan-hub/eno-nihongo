-- ENO NIHONGO security hardening
-- 1) Secure available RPCs without assuming optional legacy functions exist.
DO $$
DECLARE
  v_signature text;
BEGIN
  FOREACH v_signature IN ARRAY ARRAY[
    'public.award_referral_signup(text)',
    'public.get_leaderboard(integer)',
    'public.is_premium(uuid)',
    'public.record_learning_activity(text, integer, integer, jsonb)',
    'public.redeem_referral_points(integer)',
    'public.submit_quiz_attempt(uuid, public.jlpt_level, public.content_skill, jsonb, integer)'
  ]
  LOOP
    IF to_regprocedure(v_signature) IS NOT NULL THEN
      EXECUTE format('ALTER FUNCTION %s SET search_path = %L', v_signature, 'pg_catalog, public, auth');
      EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC, anon', v_signature);
      EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated', v_signature);
    END IF;
  END LOOP;
END;
$$;

-- 2) Cache auth.uid() once per statement in RLS policies.
DROP POLICY IF EXISTS "Users can insert own learning activity" ON public.learning_activity;
CREATE POLICY "Users can insert own learning activity"
  ON public.learning_activity
  AS PERMISSIVE
  FOR INSERT
  TO authenticated
  WITH CHECK ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can read own learning activity" ON public.learning_activity;
CREATE POLICY "Users can read own learning activity"
  ON public.learning_activity
  AS PERMISSIVE
  FOR SELECT
  TO authenticated
  USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can read own learning stats" ON public.user_learning_stats;
CREATE POLICY "Users can read own learning stats"
  ON public.user_learning_stats
  AS PERMISSIVE
  FOR SELECT
  TO authenticated
  USING ((select auth.uid()) = user_id);

-- 3) Keep future public functions opt-in rather than implicitly executable.
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  REVOKE EXECUTE ON FUNCTIONS FROM anon, authenticated;
