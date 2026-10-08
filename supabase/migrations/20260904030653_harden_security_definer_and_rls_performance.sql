-- ENO NIHONGO security hardening
-- 1) Pin SECURITY DEFINER search_path and restrict RPC execution.
-- Keep these functions SECURITY DEFINER because several intentionally write across
-- RLS-protected tables. A pinned path prevents search_path hijacking.

ALTER FUNCTION public.award_referral_signup(text)
  SET search_path = 'pg_catalog, public, auth';
-- Optional legacy RPC: secure it only when present.
DO $$
BEGIN
  IF to_regprocedure('public.get_leaderboard(integer)') IS NOT NULL THEN
    EXECUTE 'ALTER FUNCTION public.get_leaderboard(integer) SET search_path = ''pg_catalog, public, auth''';
    EXECUTE 'REVOKE EXECUTE ON FUNCTION public.get_leaderboard(integer) FROM PUBLIC, anon';
    EXECUTE 'GRANT EXECUTE ON FUNCTION public.get_leaderboard(integer) TO authenticated';
  END IF;
END;
$$;
ALTER FUNCTION public.is_premium(uuid)
  SET search_path = 'pg_catalog, public, auth';
ALTER FUNCTION public.record_learning_activity(text, integer, integer, jsonb)
  SET search_path = 'pg_catalog, public, auth';
ALTER FUNCTION public.redeem_referral_points(integer)
  SET search_path = 'pg_catalog, public, auth';
ALTER FUNCTION public.submit_quiz_attempt(uuid, public.jlpt_level, public.content_skill, jsonb, integer)
  SET search_path = 'pg_catalog, public, auth';

-- Remove implicit PUBLIC/anon execution, then explicitly allow signed-in users.
REVOKE EXECUTE ON FUNCTION public.award_referral_signup(text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_premium(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.record_learning_activity(text, integer, integer, jsonb) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.redeem_referral_points(integer) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.submit_quiz_attempt(uuid, public.jlpt_level, public.content_skill, jsonb, integer) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.award_referral_signup(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_premium(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.record_learning_activity(text, integer, integer, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.redeem_referral_points(integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.submit_quiz_attempt(uuid, public.jlpt_level, public.content_skill, jsonb, integer) TO authenticated;

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
