-- Standardize the user-facing vocabulary taxonomy without overwriting source POS text.
-- Ten primary categories are identical for N5-N1. Multi-function entries may belong to
-- more than one primary category; specialist labels remain available as detail metadata.

create or replace function public.vocabulary_primary_category_slugs(p_part_of_speech text)
returns text[]
language sql
immutable
set search_path = ''
as $$
  with n as (
    select lower(trim(coalesce(p_part_of_speech, ''))) as value
  ), flags as (
    select
      value,
      value like '%kata benda%' or value like '%meishi%' or value like '%nomina%' as noun,
      value like '%kata kerja%' or value like '%doushi%' as verb,
      value like '%kata sifat い%' or value like '%sifat い%' or value like '%i-keiyoushi%' as adj_i,
      value like '%kata sifat な%' or value like '%sifat な%' or value like '%sifat-na%' or value like '%na-keiyoushi%' as adj_na,
      value like '%kata keterangan%' or value like '%fukushi%' as adverb,
      value like '%kata ganti%' or value like '%daimeishi%' or value like '%pronomina%' as pronoun,
      value like '%kata sambung%' or value like '%kata penghubung%' or value like '%konjungsi%' or value like '%setsuzokushi%' as conjunction,
      value like '%kata seru%' or value like '%seruan%' as interjection,
      value like '%ungkapan%' or value like '%frasa%' or value like '%kalimat%' as expression
    from n
  )
  select array_remove(array[
    case when noun then 'kata-benda' end,
    case when verb then 'kata-kerja' end,
    case when adj_i then 'kata-sifat-i' end,
    case when adj_na then 'kata-sifat-na' end,
    case when adverb then 'kata-keterangan' end,
    case when pronoun then 'kata-ganti' end,
    case when conjunction then 'kata-sambung' end,
    case when interjection then 'kata-seru' end,
    case when expression then 'ungkapan' end,
    case when not (noun or verb or adj_i or adj_na or adverb or pronoun or conjunction or interjection or expression)
      then 'lainnya' end
  ], null)
  from flags
$$;

revoke all on function public.vocabulary_primary_category_slugs(text) from public, anon, authenticated;

create or replace function public.get_vocabulary_primary_category_counts(p_level public.jlpt_level)
returns table(category_slug text, item_count bigint)
language sql
stable
security definer
set search_path = ''
as $$
  with classified as (
    select distinct r.id, c.category_slug
    from public.get_vocabulary_lexical_rows(p_level) r
    cross join lateral unnest(public.vocabulary_primary_category_slugs(r.part_of_speech)) c(category_slug)
  )
  select c.category_slug, count(*)::bigint
  from classified c
  group by c.category_slug
$$;

revoke all on function public.get_vocabulary_primary_category_counts(public.jlpt_level)
from public, anon;
grant execute on function public.get_vocabulary_primary_category_counts(public.jlpt_level)
to authenticated, service_role;

create or replace function public.get_vocabulary_count_by_primary_category(
  p_level public.jlpt_level,
  p_category_slug text
)
returns bigint
language sql
stable
security definer
set search_path = ''
as $$
  select count(distinct r.id)
  from public.get_vocabulary_lexical_rows(p_level) r
  where p_category_slug = any(public.vocabulary_primary_category_slugs(r.part_of_speech))
$$;

revoke all on function public.get_vocabulary_count_by_primary_category(public.jlpt_level,text)
from public, anon;
grant execute on function public.get_vocabulary_count_by_primary_category(public.jlpt_level,text)
to authenticated, service_role;

create or replace function public.get_vocabulary_page_by_primary_category(
  p_level public.jlpt_level,
  p_category_slug text,
  p_offset integer default 0,
  p_limit integer default 60
)
returns table(
  id uuid,
  term text,
  reading text,
  romaji text,
  meaning_id text,
  meaning_en text,
  part_of_speech text,
  examples jsonb,
  level public.jlpt_level,
  sort_order integer,
  source_book text,
  lesson_number integer,
  lesson_title text,
  usage_note_id text
)
language sql
stable
security definer
set search_path = ''
as $$
  with ranked as (
    select x.*,
      row_number() over(
        partition by x.id
        order by x.component_order,x.created_at,x.origin_id
      ) as pick
    from public.get_vocabulary_lexical_rows(p_level) x
    where p_category_slug = any(public.vocabulary_primary_category_slugs(x.part_of_speech))
  )
  select
    r.id,r.term,r.reading,r.romaji,r.meaning_id,r.meaning_en,r.part_of_speech,
    r.examples,r.level,r.sort_order,r.source_book,r.lesson_number,r.lesson_title,r.usage_note_id
  from ranked r
  where r.pick=1
  order by r.sort_order nulls last,r.created_at,r.component_order,r.id
  offset greatest(p_offset,0)
  limit least(greatest(p_limit,1),200)
$$;

revoke all on function public.get_vocabulary_page_by_primary_category(public.jlpt_level,text,integer,integer)
from public, anon;
grant execute on function public.get_vocabulary_page_by_primary_category(public.jlpt_level,text,integer,integer)
to authenticated, service_role;
