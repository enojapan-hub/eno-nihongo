CREATE OR REPLACE FUNCTION public.get_vocabulary_lexical_rows(p_level public.jlpt_level)
RETURNS TABLE(id uuid, term text, reading text, romaji text, meaning_id text, meaning_en text, part_of_speech text, examples jsonb, level public.jlpt_level, sort_order integer, source_book text, lesson_number integer, lesson_title text, usage_note_id text, created_at timestamptz, origin_id uuid, component_order integer)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO ''
AS $fn$
WITH edges AS (
 SELECT r.source_vocabulary_id, r.target_vocabulary_id,
        coalesce(substring(r.source_reference from ':([0-9]{1,2})$'),'0')::integer component_order,
        t.is_published target_published
 FROM public.vocabulary_relations r
 JOIN public.vocabulary t ON t.id=r.target_vocabulary_id
 WHERE r.relation_type='lexical_component'
   AND r.source_reference LIKE 'eno-kotoba-split-v1:%'
   AND r.confidence='verified'
), active AS (
 SELECT e.source_vocabulary_id FROM edges e
 GROUP BY e.source_vocabulary_id
 HAVING count(*)>=2 AND bool_and(e.target_published)
)
SELECT v.id,v.term,v.reading,v.romaji,v.meaning_id,v.meaning_en,v.part_of_speech,v.examples,v.level,v.sort_order,v.source_book,v.lesson_number,v.lesson_title,v.usage_note_id,v.created_at,v.id,0
FROM public.vocabulary v
WHERE v.is_published AND v.level=p_level
 AND NOT EXISTS(SELECT 1 FROM active a WHERE a.source_vocabulary_id=v.id)
UNION ALL
SELECT t.id,t.term,t.reading,t.romaji,t.meaning_id,t.meaning_en,t.part_of_speech,t.examples,t.level,s.sort_order,s.source_book,s.lesson_number,s.lesson_title,t.usage_note_id,s.created_at,s.id,e.component_order
FROM public.vocabulary s
JOIN active a ON a.source_vocabulary_id=s.id
JOIN edges e ON e.source_vocabulary_id=s.id
JOIN public.vocabulary t ON t.id=e.target_vocabulary_id
WHERE s.is_published AND s.level=p_level AND t.is_published
$fn$;
REVOKE ALL ON FUNCTION public.get_vocabulary_lexical_rows(public.jlpt_level) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_vocabulary_lexical_rows(public.jlpt_level) TO anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.get_vocabulary_count_by_level(p_level public.jlpt_level)
RETURNS bigint LANGUAGE sql STABLE SET search_path TO ''
AS $fn$ SELECT count(DISTINCT r.id) FROM public.get_vocabulary_lexical_rows(p_level) r $fn$;

CREATE OR REPLACE FUNCTION public.get_vocabulary_lesson_counts(p_level public.jlpt_level)
RETURNS TABLE(lesson_number integer,lesson_title text,word_count bigint)
LANGUAGE sql STABLE SET search_path TO ''
AS $fn$
SELECT coalesce(r.lesson_number,-1),CASE WHEN r.lesson_number IS NULL THEN 'Materi tambahan' ELSE max(r.lesson_title) END,count(DISTINCT r.id)
FROM public.get_vocabulary_lexical_rows(p_level) r
GROUP BY r.lesson_number ORDER BY r.lesson_number NULLS LAST
$fn$;

CREATE OR REPLACE FUNCTION public.get_vocabulary_page_by_lesson(p_level public.jlpt_level,p_lesson integer,p_offset integer DEFAULT 0,p_limit integer DEFAULT 60)
RETURNS TABLE(id uuid, term text, reading text, romaji text, meaning_id text, meaning_en text, part_of_speech text, examples jsonb, level public.jlpt_level, sort_order integer, source_book text, lesson_number integer, lesson_title text, usage_note_id text) LANGUAGE sql STABLE SET search_path TO ''
AS $fn$
WITH ranked AS (
 SELECT x.*,row_number() OVER(PARTITION BY x.id ORDER BY x.component_order,x.created_at,x.origin_id) pick
 FROM public.get_vocabulary_lexical_rows(p_level) x
 WHERE coalesce(x.lesson_number,-1)=p_lesson
)
SELECT r.id,r.term,r.reading,r.romaji,r.meaning_id,r.meaning_en,r.part_of_speech,r.examples,r.level,r.sort_order,r.source_book,r.lesson_number,r.lesson_title,r.usage_note_id FROM ranked r WHERE r.pick=1
ORDER BY r.sort_order NULLS LAST,r.created_at,r.component_order,r.id
OFFSET greatest(p_offset,0) LIMIT least(greatest(p_limit,1),200)
$fn$;

CREATE OR REPLACE FUNCTION public.get_vocabulary_page_by_level(p_level public.jlpt_level,p_offset integer DEFAULT 0,p_limit integer DEFAULT 60)
RETURNS TABLE(id uuid, term text, reading text, romaji text, meaning_id text, meaning_en text, part_of_speech text, examples jsonb, level public.jlpt_level, sort_order integer, source_book text, lesson_number integer, lesson_title text, usage_note_id text) LANGUAGE sql STABLE SET search_path TO ''
AS $fn$
WITH ranked AS (
 SELECT x.*,row_number() OVER(PARTITION BY x.id ORDER BY x.lesson_number NULLS LAST,x.component_order,x.created_at,x.origin_id) pick
 FROM public.get_vocabulary_lexical_rows(p_level) x
)
SELECT r.id,r.term,r.reading,r.romaji,r.meaning_id,r.meaning_en,r.part_of_speech,r.examples,r.level,r.sort_order,r.source_book,r.lesson_number,r.lesson_title,r.usage_note_id FROM ranked r WHERE r.pick=1
ORDER BY r.lesson_number NULLS LAST,r.sort_order NULLS LAST,r.created_at,r.component_order,r.id
OFFSET greatest(p_offset,0) LIMIT least(greatest(p_limit,1),200)
$fn$;

CREATE OR REPLACE FUNCTION public.get_vocabulary_count_by_category(p_level public.jlpt_level,p_category_slug text)
RETURNS bigint LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO ''
AS $fn$
SELECT count(DISTINCT r.id)
FROM public.get_vocabulary_lexical_rows(p_level) r
JOIN public.vocabulary_category_links l ON l.vocabulary_id=r.origin_id
JOIN public.vocabulary_categories c ON c.id=l.category_id
WHERE c.is_active AND coalesce(c.canonical_slug,c.slug)=p_category_slug
$fn$;

CREATE OR REPLACE FUNCTION public.get_vocabulary_page_by_category(p_level public.jlpt_level,p_category_slug text,p_offset integer DEFAULT 0,p_limit integer DEFAULT 60)
RETURNS TABLE(id uuid, term text, reading text, romaji text, meaning_id text, meaning_en text, part_of_speech text, examples jsonb, level public.jlpt_level, sort_order integer, source_book text, lesson_number integer, lesson_title text, usage_note_id text) LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO ''
AS $fn$
WITH ranked AS (
 SELECT x.*,row_number() OVER(PARTITION BY x.id ORDER BY x.component_order,x.created_at,x.origin_id) pick
 FROM public.get_vocabulary_lexical_rows(p_level) x
 WHERE EXISTS(
 SELECT 1 FROM public.vocabulary_category_links l JOIN public.vocabulary_categories c ON c.id=l.category_id
 WHERE l.vocabulary_id=x.origin_id AND c.is_active AND coalesce(c.canonical_slug,c.slug)=p_category_slug
 )
)
SELECT r.id,r.term,r.reading,r.romaji,r.meaning_id,r.meaning_en,r.part_of_speech,r.examples,r.level,r.sort_order,r.source_book,r.lesson_number,r.lesson_title,r.usage_note_id FROM ranked r WHERE r.pick=1
ORDER BY r.sort_order NULLS LAST,r.created_at,r.component_order,r.id
OFFSET greatest(p_offset,0) LIMIT least(greatest(p_limit,1),200)
$fn$;
