create index if not exists quiz_error_reviews_question_id_idx on public.quiz_error_reviews(question_id);
create index if not exists reading_vocabulary_annotations_vocabulary_id_idx on public.reading_vocabulary_annotations(vocabulary_id);

alter policy "Users manage own quiz error reviews" on public.quiz_error_reviews
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

alter policy "Users manage own study sessions" on public.study_sessions
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
