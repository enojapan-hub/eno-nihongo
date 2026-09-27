-- Vocabulary-level usage note ("Penggunaan") as the single source of truth for Kotoba.
-- Additive only: no default, no backfill, vocabulary_senses untouched.
-- The two page RPCs gain one trailing output column (usage_note_id); arguments,
-- filters, ordering, paging limits, volatility, search_path and grants are unchanged.
-- Idempotent so a re-run is harmless.
--
-- Rollback (manual):
--   drop function if exists public.get_vocabulary_page_by_lesson(jlpt_level, integer, integer, integer);
--   drop function if exists public.get_vocabulary_page_by_level(jlpt_level, integer, integer);
--   -- recreate both functions from their previous definitions (same body without usage_note_id)
--   alter table public.vocabulary drop column if exists usage_note_id;

alter table public.vocabulary add column if not exists usage_note_id text;

comment on column public.vocabulary.usage_note_id is
  'Vocabulary-level usage note (Indonesian) shown as "Penggunaan" in Kotoba. Source of truth; vocabulary_senses.usage_note_id is legacy fallback only.';

-- The return type changes, so the functions must be dropped and recreated.
drop function if exists public.get_vocabulary_page_by_lesson(jlpt_level, integer, integer, integer);
create function public.get_vocabulary_page_by_lesson(p_level jlpt_level, p_lesson integer, p_offset integer default 0, p_limit integer default 60)
returns table(id uuid, term text, reading text, romaji text, meaning_id text, meaning_en text, part_of_speech text, examples jsonb, level jlpt_level, sort_order integer, source_book text, lesson_number integer, lesson_title text, usage_note_id text)
language sql
stable
set search_path to 'public'
as $function$
 select v.id,v.term,v.reading,v.romaji,v.meaning_id,v.meaning_en,v.part_of_speech,v.examples,v.level,v.sort_order,v.source_book,v.lesson_number,v.lesson_title,v.usage_note_id
 from public.vocabulary v where v.is_published=true and v.level=p_level and ((p_lesson=-1 and v.lesson_number is null) or v.lesson_number=p_lesson)
 order by v.sort_order nulls last,v.created_at,v.id
 offset greatest(p_offset,0) limit least(greatest(p_limit,1),200)
$function$;

drop function if exists public.get_vocabulary_page_by_level(jlpt_level, integer, integer);
create function public.get_vocabulary_page_by_level(p_level jlpt_level, p_offset integer default 0, p_limit integer default 60)
returns table(id uuid, term text, reading text, romaji text, meaning_id text, meaning_en text, part_of_speech text, examples jsonb, level jlpt_level, sort_order integer, source_book text, lesson_number integer, lesson_title text, usage_note_id text)
language sql
stable
set search_path to 'public'
as $function$
 select v.id,v.term,v.reading,v.romaji,v.meaning_id,v.meaning_en,v.part_of_speech,v.examples,v.level,v.sort_order,v.source_book,v.lesson_number,v.lesson_title,v.usage_note_id
 from public.vocabulary v
 where v.is_published=true and v.level=p_level
 order by v.lesson_number nulls last,v.sort_order nulls last,v.created_at,v.id
 offset greatest(p_offset,0) limit least(greatest(p_limit,1),200)
$function$;

-- Restore the previous ACL exactly: PUBLIC + service_role (anon/authenticated inherit via PUBLIC).
revoke all on function public.get_vocabulary_page_by_lesson(jlpt_level, integer, integer, integer) from public, anon, authenticated, service_role;
revoke all on function public.get_vocabulary_page_by_level(jlpt_level, integer, integer) from public, anon, authenticated, service_role;
grant execute on function public.get_vocabulary_page_by_lesson(jlpt_level, integer, integer, integer) to public, service_role;
grant execute on function public.get_vocabulary_page_by_level(jlpt_level, integer, integer) to public, service_role;
