create or replace function public.admin_get_content_item(p_kind text, p_id uuid)
returns jsonb language plpgsql security definer set search_path='pg_catalog,public,auth' as $$
declare v_role text; v_result jsonb;
begin
 if auth.uid() is null then raise exception 'not authenticated'; end if;
 select role into v_role from public.profiles where id=auth.uid();
 if coalesce(v_role,'student') not in ('admin','owner') then raise exception 'forbidden'; end if;
 case p_kind
  when 'kanji' then select to_jsonb(t) into v_result from public.kanji t where id=p_id;
  when 'vocabulary' then select to_jsonb(t) into v_result from public.vocabulary t where id=p_id;
  when 'grammar' then select to_jsonb(t) into v_result from public.grammar_points t where id=p_id;
  when 'reading' then select to_jsonb(t) into v_result from public.reading_passages t where id=p_id;
  when 'listening' then select to_jsonb(t) into v_result from public.listening_items t where id=p_id;
  else raise exception 'invalid content kind';
 end case;
 if v_result is null then raise exception 'content not found'; end if;
 return v_result;
end $$;

create or replace function public.admin_save_content_item(p_kind text, p_id uuid, p_data jsonb)
returns uuid language plpgsql security definer set search_path='pg_catalog,public,auth' as $$
declare v_role text; v_id uuid := coalesce(p_id, gen_random_uuid());
begin
 if auth.uid() is null then raise exception 'not authenticated'; end if;
 select role into v_role from public.profiles where id=auth.uid();
 if coalesce(v_role,'student') not in ('admin','owner') then raise exception 'forbidden'; end if;
 if coalesce(p_data->>'level','') not in ('N5','N4','N3','N2','N1') then raise exception 'invalid level'; end if;
 case p_kind
 when 'kanji' then
  if nullif(trim(p_data->>'character'),'') is null or nullif(trim(p_data->>'meaning_id'),'') is null then raise exception 'character and meaning_id required'; end if;
  insert into public.kanji(id,character,level,onyomi,kunyomi,meaning_id,meaning_en,stroke_count,sort_order,is_published,source_book,lesson_number,lesson_title)
  values(v_id,p_data->>'character',(p_data->>'level')::public.jlpt_level,coalesce(array(select jsonb_array_elements_text(coalesce(p_data->'onyomi','[]'::jsonb))),array[]::text[]),coalesce(array(select jsonb_array_elements_text(coalesce(p_data->'kunyomi','[]'::jsonb))),array[]::text[]),p_data->>'meaning_id',nullif(p_data->>'meaning_en',''),nullif(p_data->>'stroke_count','')::int,coalesce(nullif(p_data->>'sort_order','')::int,0),coalesce((p_data->>'is_published')::boolean,false),nullif(p_data->>'source_book',''),nullif(p_data->>'lesson_number','')::int,nullif(p_data->>'lesson_title',''))
  on conflict(id) do update set character=excluded.character,level=excluded.level,onyomi=excluded.onyomi,kunyomi=excluded.kunyomi,meaning_id=excluded.meaning_id,meaning_en=excluded.meaning_en,stroke_count=excluded.stroke_count,sort_order=excluded.sort_order,is_published=excluded.is_published,source_book=excluded.source_book,lesson_number=excluded.lesson_number,lesson_title=excluded.lesson_title;
 when 'vocabulary' then
  if nullif(trim(p_data->>'term'),'') is null or nullif(trim(p_data->>'meaning_id'),'') is null then raise exception 'term and meaning_id required'; end if;
  insert into public.vocabulary(id,term,reading,romaji,meaning_id,meaning_en,part_of_speech,examples,level,sort_order,is_published,source_book,lesson_number,lesson_title)
  values(v_id,p_data->>'term',nullif(p_data->>'reading',''),nullif(p_data->>'romaji',''),p_data->>'meaning_id',nullif(p_data->>'meaning_en',''),nullif(p_data->>'part_of_speech',''),coalesce(p_data->'examples','[]'::jsonb),(p_data->>'level')::public.jlpt_level,coalesce(nullif(p_data->>'sort_order','')::int,0),coalesce((p_data->>'is_published')::boolean,false),nullif(p_data->>'source_book',''),nullif(p_data->>'lesson_number','')::int,nullif(p_data->>'lesson_title',''))
  on conflict(id) do update set term=excluded.term,reading=excluded.reading,romaji=excluded.romaji,meaning_id=excluded.meaning_id,meaning_en=excluded.meaning_en,part_of_speech=excluded.part_of_speech,examples=excluded.examples,level=excluded.level,sort_order=excluded.sort_order,is_published=excluded.is_published,source_book=excluded.source_book,lesson_number=excluded.lesson_number,lesson_title=excluded.lesson_title;
 when 'grammar' then
  if nullif(trim(p_data->>'pattern'),'') is null or nullif(trim(p_data->>'meaning_id'),'') is null then raise exception 'pattern and meaning_id required'; end if;
  insert into public.grammar_points(id,pattern,meaning_id,meaning_en,structure,explanation_id,explanation_en,examples,level,sort_order,is_published,source_book,lesson_number,lesson_title,reading_hiragana,romaji,usage_id,wrong_examples,notes_id)
  values(v_id,p_data->>'pattern',p_data->>'meaning_id',nullif(p_data->>'meaning_en',''),nullif(p_data->>'structure',''),nullif(p_data->>'explanation_id',''),nullif(p_data->>'explanation_en',''),coalesce(p_data->'examples','[]'::jsonb),(p_data->>'level')::public.jlpt_level,coalesce(nullif(p_data->>'sort_order','')::int,0),coalesce((p_data->>'is_published')::boolean,false),nullif(p_data->>'source_book',''),nullif(p_data->>'lesson_number','')::int,nullif(p_data->>'lesson_title',''),nullif(p_data->>'reading_hiragana',''),nullif(p_data->>'romaji',''),nullif(p_data->>'usage_id',''),coalesce(p_data->'wrong_examples','[]'::jsonb),nullif(p_data->>'notes_id',''))
  on conflict(id) do update set pattern=excluded.pattern,meaning_id=excluded.meaning_id,meaning_en=excluded.meaning_en,structure=excluded.structure,explanation_id=excluded.explanation_id,explanation_en=excluded.explanation_en,examples=excluded.examples,level=excluded.level,sort_order=excluded.sort_order,is_published=excluded.is_published,source_book=excluded.source_book,lesson_number=excluded.lesson_number,lesson_title=excluded.lesson_title,reading_hiragana=excluded.reading_hiragana,romaji=excluded.romaji,usage_id=excluded.usage_id,wrong_examples=excluded.wrong_examples,notes_id=excluded.notes_id;
 when 'reading' then
  if nullif(trim(p_data->>'title'),'') is null or nullif(trim(p_data->>'body_jp'),'') is null then raise exception 'title and body_jp required'; end if;
  insert into public.reading_passages(id,title,level,body_jp,translation_id,translation_en,estimated_minutes,sort_order,is_published,body_furigana,source_book,lesson_number,lesson_title)
  values(v_id,p_data->>'title',(p_data->>'level')::public.jlpt_level,p_data->>'body_jp',nullif(p_data->>'translation_id',''),nullif(p_data->>'translation_en',''),nullif(p_data->>'estimated_minutes','')::int,coalesce(nullif(p_data->>'sort_order','')::int,0),coalesce((p_data->>'is_published')::boolean,false),nullif(p_data->>'body_furigana',''),nullif(p_data->>'source_book',''),nullif(p_data->>'lesson_number','')::int,nullif(p_data->>'lesson_title',''))
  on conflict(id) do update set title=excluded.title,level=excluded.level,body_jp=excluded.body_jp,translation_id=excluded.translation_id,translation_en=excluded.translation_en,estimated_minutes=excluded.estimated_minutes,sort_order=excluded.sort_order,is_published=excluded.is_published,body_furigana=excluded.body_furigana,source_book=excluded.source_book,lesson_number=excluded.lesson_number,lesson_title=excluded.lesson_title;
 when 'listening' then
  if nullif(trim(p_data->>'title'),'') is null then raise exception 'title required'; end if;
  insert into public.listening_items(id,title,level,audio_url,transcript_jp,translation_id,duration_seconds,sort_order,is_published,question_type,audio_license,audio_attribution,source,transcript_en,source_book,lesson_number,lesson_title)
  values(v_id,p_data->>'title',(p_data->>'level')::public.jlpt_level,nullif(p_data->>'audio_url',''),nullif(p_data->>'transcript_jp',''),nullif(p_data->>'translation_id',''),nullif(p_data->>'duration_seconds','')::int,coalesce(nullif(p_data->>'sort_order','')::int,0),coalesce((p_data->>'is_published')::boolean,false),nullif(p_data->>'question_type',''),nullif(p_data->>'audio_license',''),nullif(p_data->>'audio_attribution',''),nullif(p_data->>'source',''),nullif(p_data->>'transcript_en',''),nullif(p_data->>'source_book',''),nullif(p_data->>'lesson_number','')::int,nullif(p_data->>'lesson_title',''))
  on conflict(id) do update set title=excluded.title,level=excluded.level,audio_url=excluded.audio_url,transcript_jp=excluded.transcript_jp,translation_id=excluded.translation_id,duration_seconds=excluded.duration_seconds,sort_order=excluded.sort_order,is_published=excluded.is_published,question_type=excluded.question_type,audio_license=excluded.audio_license,audio_attribution=excluded.audio_attribution,source=excluded.source,transcript_en=excluded.transcript_en,source_book=excluded.source_book,lesson_number=excluded.lesson_number,lesson_title=excluded.lesson_title;
 else raise exception 'invalid content kind'; end case;
 return v_id;
end $$;

create or replace function public.admin_delete_content_item(p_kind text,p_id uuid)
returns void language plpgsql security definer set search_path='pg_catalog,public,auth' as $$
declare v_role text;
begin
 if auth.uid() is null then raise exception 'not authenticated'; end if;
 select role into v_role from public.profiles where id=auth.uid();
 if coalesce(v_role,'student') not in ('admin','owner') then raise exception 'forbidden'; end if;
 case p_kind
 when 'kanji' then delete from public.kanji where id=p_id;
 when 'vocabulary' then delete from public.vocabulary where id=p_id;
 when 'grammar' then delete from public.grammar_points where id=p_id;
 when 'reading' then delete from public.reading_passages where id=p_id;
 when 'listening' then delete from public.listening_items where id=p_id;
 else raise exception 'invalid content kind'; end case;
end $$;
revoke all on function public.admin_get_content_item(text,uuid) from public,anon;
revoke all on function public.admin_save_content_item(text,uuid,jsonb) from public,anon;
revoke all on function public.admin_delete_content_item(text,uuid) from public,anon;
grant execute on function public.admin_get_content_item(text,uuid) to authenticated;
grant execute on function public.admin_save_content_item(text,uuid,jsonb) to authenticated;
grant execute on function public.admin_delete_content_item(text,uuid) to authenticated;
