alter table public.vocabulary_source_items
  add column if not exists lesson_number integer,
  add column if not exists lesson_title text,
  add column if not exists accent text,
  add column if not exists verb_group smallint,
  add column if not exists is_reference boolean not null default false,
  add column if not exists is_expression boolean not null default false,
  add column if not exists source_section text;

alter table public.vocabulary_source_items
  drop constraint if exists vocabulary_source_items_verb_group_check;

alter table public.vocabulary_source_items
  add constraint vocabulary_source_items_verb_group_check
  check (verb_group is null or verb_group in (1,2,3));

create index if not exists idx_vocabulary_source_items_source_lesson
  on public.vocabulary_source_items(source_book, lesson_number, source_order);

create index if not exists idx_vocabulary_source_items_term_reading
  on public.vocabulary_source_items(lower(btrim(term)), lower(btrim(coalesce(reading,''))));
