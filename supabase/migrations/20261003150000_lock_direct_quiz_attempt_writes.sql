-- Close direct client writes to quiz_attempts / quiz_answers.
--
-- The attempts_own_insert / answers_own_insert policies only checked user_id, so a signed-in user
-- could insert a row with any score, xp_earned or attempt_kind. award_quiz_activity and
-- award_simulation_attempt_points then turned those caller-supplied values into XP and reward
-- points shown on the leaderboard. Attempts are now written only by SECURITY DEFINER functions
-- (submit_practice_quiz, submit_quiz_attempt, the class and JLPT simulation RPCs).
--
-- APPLY ONLY AFTER the client that calls submit_practice_quiz is deployed: the previous client
-- inserted into these tables directly and would stop saving quiz results.
--
-- Rollback:
--   grant insert on public.quiz_attempts, public.quiz_answers to authenticated;
--   create policy attempts_own_insert on public.quiz_attempts for insert to authenticated
--     with check ((select auth.uid()) = user_id);
--   create policy answers_own_insert on public.quiz_answers for insert to authenticated
--     with check ((select auth.uid()) = user_id);
--   grant execute on function public.record_quiz_attempt(uuid, public.jlpt_level, public.content_skill, integer, integer, integer) to authenticated;

drop policy if exists attempts_own_insert on public.quiz_attempts;
drop policy if exists answers_own_insert on public.quiz_answers;

revoke insert, update, delete, truncate on public.quiz_attempts from authenticated, anon;
revoke insert, update, delete, truncate on public.quiz_answers from authenticated, anon;

-- SECURITY INVOKER and trusts the caller's score; unused by the app.
revoke all on function public.record_quiz_attempt(uuid, public.jlpt_level, public.content_skill, integer, integer, integer)
  from public, anon, authenticated;
