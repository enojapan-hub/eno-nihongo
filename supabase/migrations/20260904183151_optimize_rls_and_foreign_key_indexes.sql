create index if not exists daily_study_tasks_plan_id_idx on public.daily_study_tasks(plan_id);
create index if not exists kanji_curriculum_kanji_id_idx on public.kanji_curriculum(kanji_id);
create index if not exists point_redemptions_user_id_idx on public.point_redemptions(user_id);
create index if not exists verb_pairs_intransitive_vocabulary_id_idx on public.verb_pairs(intransitive_vocabulary_id);
create index if not exists verb_pairs_transitive_vocabulary_id_idx on public.verb_pairs(transitive_vocabulary_id);
create index if not exists vocabulary_category_map_category_slug_idx on public.vocabulary_category_map(category_slug);
create index if not exists vocabulary_source_items_vocabulary_id_idx on public.vocabulary_source_items(vocabulary_id);

alter policy notifications_select_own on public.user_notifications using ((select auth.uid()) = user_id);
alter policy notifications_update_own on public.user_notifications using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
alter policy point_redemptions_select_own on public.point_redemptions using ((select auth.uid()) = user_id);
