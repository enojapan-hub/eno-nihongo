drop index if exists public.vocabulary_level_term_unique_idx;
create unique index vocabulary_curriculum_term_unique_idx
on public.vocabulary (level, source_book, lesson_number, lower(btrim(term)));
