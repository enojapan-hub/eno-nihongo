create or replace function public.get_material_sync_status(p_level text default null)
returns jsonb
language sql
stable
security invoker
set search_path = public
as $$
with levels as (
  select unnest(array['N5','N4','N3','N2','N1']) as level
), filtered as (
  select level from levels where p_level is null or level=p_level
)
select jsonb_agg(jsonb_build_object(
 'level', f.level,
 'kanji', (select jsonb_build_object('total',count(*),'missing_meaning',count(*) filter(where coalesce(btrim(meaning_id),'')=''),'missing_readings',count(*) filter(where coalesce(array_length(onyomi,1),0)=0 and coalesce(array_length(kunyomi,1),0)=0)) from kanji k where k.is_published and k.level::text=f.level),
 'vocabulary', (select jsonb_build_object('total',count(*),'missing_meaning',count(*) filter(where coalesce(btrim(meaning_id),'')=''),'missing_reading',count(*) filter(where coalesce(btrim(reading),'')=''),'missing_pos',count(*) filter(where coalesce(btrim(part_of_speech),'')='')) from vocabulary v where v.is_published and v.level::text=f.level),
 'grammar', (select jsonb_build_object('total',count(*),'missing_meaning',count(*) filter(where coalesce(btrim(meaning_id),'')=''),'missing_function',count(*) filter(where coalesce(btrim(explanation_id),'')=''),'missing_structure',count(*) filter(where coalesce(btrim(structure),'')=''),'missing_usage',count(*) filter(where coalesce(btrim(usage_id),'')=''),'missing_reading',count(*) filter(where coalesce(btrim(reading_hiragana),'')=''),'missing_romaji',count(*) filter(where coalesce(btrim(romaji),'')='')) from grammar_points g where g.is_published and g.level::text=f.level),
 'reading', (select jsonb_build_object('total',count(*),'missing_body',count(*) filter(where coalesce(btrim(body_jp),'')=''),'missing_translation',count(*) filter(where coalesce(btrim(translation_id),'')=''),'missing_furigana',count(*) filter(where coalesce(btrim(body_furigana),'')='')) from reading_passages r where r.is_published and r.level::text=f.level),
 'listening', (select jsonb_build_object('total',count(*),'with_audio',count(*) filter(where coalesce(btrim(audio_url),'')<>''),'with_transcript',count(*) filter(where coalesce(btrim(transcript_jp),'')<>''),'with_translation',count(*) filter(where coalesce(btrim(translation_id),'')<>'')) from listening_items li where li.is_published and li.level::text=f.level),
 'questions', (select jsonb_build_object('total',count(*),'reading',count(*) filter(where passage_id is not null),'listening',count(*) filter(where listening_id is not null)) from questions q where q.is_published and q.level::text=f.level)
)) from filtered f;
$$;
grant execute on function public.get_material_sync_status(text) to authenticated;
