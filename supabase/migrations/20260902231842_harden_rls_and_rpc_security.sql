-- Publicly readable translations only when completed; writes remain server-side.
create policy "content_translations_public_read_completed"
on public.content_translations
for select
to anon, authenticated
using (status = 'completed');

-- RPC security: these functions are intended to be called by signed-in users, not anonymously.
revoke execute on function public.award_referral_signup(text) from public, anon;
grant execute on function public.award_referral_signup(text) to authenticated;

revoke execute on function public.redeem_referral_points(integer) from public, anon;
grant execute on function public.redeem_referral_points(integer) to authenticated;

revoke execute on function public.submit_quiz_attempt(uuid, jlpt_level, content_skill, jsonb, integer) from public, anon;
grant execute on function public.submit_quiz_attempt(uuid, jlpt_level, content_skill, jsonb, integer) to authenticated;

revoke execute on function public.is_premium(uuid) from public, anon;
grant execute on function public.is_premium(uuid) to authenticated;

revoke execute on function public.award_item_activity() from public, anon;
grant execute on function public.award_item_activity() to authenticated;

revoke execute on function public.award_quiz_activity() from public, anon;
grant execute on function public.award_quiz_activity() to authenticated;

-- Replace deprecated auth.role() checks with published-content policies.
drop policy if exists grammar_public_read on public.grammar_points;
create policy grammar_public_read on public.grammar_points for select to anon, authenticated using (is_published);

drop policy if exists kanji_public_read on public.kanji;
create policy kanji_public_read on public.kanji for select to anon, authenticated using (is_published);

drop policy if exists listening_public_read on public.listening_items;
create policy listening_public_read on public.listening_items for select to anon, authenticated using (is_published);

drop policy if exists questions_public_read on public.questions;
create policy questions_public_read on public.questions for select to anon, authenticated using (is_published);

drop policy if exists quizzes_public_read on public.quizzes;
create policy quizzes_public_read on public.quizzes for select to anon, authenticated using (is_published);

drop policy if exists reading_public_read on public.reading_passages;
create policy reading_public_read on public.reading_passages for select to anon, authenticated using (is_published);

drop policy if exists vocabulary_public_read on public.vocabulary;
create policy vocabulary_public_read on public.vocabulary for select to anon, authenticated using (is_published);

-- Improve RLS policy evaluation by evaluating auth.uid() once per statement.
drop policy if exists profiles_select_own on public.profiles;
create policy profiles_select_own on public.profiles for select to authenticated using ((select auth.uid()) = id);
drop policy if exists profiles_update_own on public.profiles;
create policy profiles_update_own on public.profiles for update to authenticated using ((select auth.uid()) = id) with check ((select auth.uid()) = id);

drop policy if exists answers_own_insert on public.quiz_answers;
create policy answers_own_insert on public.quiz_answers for insert to authenticated with check ((select auth.uid()) = user_id);
drop policy if exists answers_own_select on public.quiz_answers;
create policy answers_own_select on public.quiz_answers for select to authenticated using ((select auth.uid()) = user_id);

drop policy if exists attempts_own_insert on public.quiz_attempts;
create policy attempts_own_insert on public.quiz_attempts for insert to authenticated with check ((select auth.uid()) = user_id);
drop policy if exists attempts_own_select on public.quiz_attempts;
create policy attempts_own_select on public.quiz_attempts for select to authenticated using ((select auth.uid()) = user_id);

drop policy if exists referrals_own_select on public.referrals;
create policy referrals_own_select on public.referrals for select to authenticated using ((select auth.uid()) = referrer_id or (select auth.uid()) = referred_user_id);

drop policy if exists reward_grants_own_select on public.reward_grants;
create policy reward_grants_own_select on public.reward_grants for select to authenticated using ((select auth.uid()) = user_id);

drop policy if exists progress_own_all on public.user_item_progress;
create policy progress_own_all on public.user_item_progress for all to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

drop policy if exists stats_select_own on public.user_stats;
create policy stats_select_own on public.user_stats for select to authenticated using ((select auth.uid()) = user_id);
