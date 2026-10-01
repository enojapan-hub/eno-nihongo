CREATE OR REPLACE FUNCTION public.get_vocabulary_page_by_level(p_level jlpt_level, p_offset integer DEFAULT 0, p_limit integer DEFAULT 60)
RETURNS TABLE(id uuid, term text, reading text, romaji text, meaning_id text, meaning_en text, part_of_speech text, examples jsonb, level jlpt_level, sort_order integer, source_book text, lesson_number integer, lesson_title text)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT v.id, v.term, v.reading, v.romaji, v.meaning_id, v.meaning_en, v.part_of_speech, v.examples, v.level, v.sort_order, v.source_book, v.lesson_number, v.lesson_title
  FROM public.vocabulary v
  WHERE v.is_published = true
    AND (v.level = p_level OR EXISTS (SELECT 1 FROM public.vocabulary_level_labels l WHERE l.vocabulary_id = v.id AND l.level = p_level))
  ORDER BY v.lesson_number NULLS LAST, v.sort_order NULLS LAST, v.created_at, v.id
  OFFSET GREATEST(p_offset,0)
  LIMIT LEAST(GREATEST(p_limit,1),200)
$$;

CREATE OR REPLACE FUNCTION public.get_vocabulary_count_by_level(p_level jlpt_level)
RETURNS bigint
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT count(DISTINCT v.id)
  FROM public.vocabulary v
  WHERE v.is_published = true
    AND (v.level = p_level OR EXISTS (SELECT 1 FROM public.vocabulary_level_labels l WHERE l.vocabulary_id = v.id AND l.level = p_level))
$$;
