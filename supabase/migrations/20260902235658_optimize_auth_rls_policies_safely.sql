drop policy if exists "users can read own settings" on public.user_settings;
create policy "users can read own settings" on public.user_settings for select to authenticated using ((select auth.uid()) = user_id);

drop policy if exists "users can insert own settings" on public.user_settings;
create policy "users can insert own settings" on public.user_settings for insert to authenticated with check ((select auth.uid()) = user_id);

drop policy if exists "users can update own settings" on public.user_settings;
create policy "users can update own settings" on public.user_settings for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

drop policy if exists "referral_events_select_own" on public.referral_events;
create policy "referral_events_select_own" on public.referral_events for select to authenticated using (((select auth.uid()) = referrer_id) or ((select auth.uid()) = referred_user_id));
