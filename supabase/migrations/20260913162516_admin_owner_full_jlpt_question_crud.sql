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
  when 'questions' then select to_jsonb(t) into v_result from public.jlpt_simulation_questions t where id=p_id;
  else raise exception 'invalid content kind';
 end case;
 if v_result is null then raise exception 'content not found'; end if;
 return v_result;
end $$;

create or replace function public.admin_save_question_item(p_id uuid, p_data jsonb)
returns uuid language plpgsql security definer set search_path='pg_catalog,public,auth' as $$
declare v_role text; v_id uuid:=coalesce(p_id,gen_random_uuid()); v_choices jsonb; v_correct int;
begin
 if auth.uid() is null then raise exception 'not authenticated'; end if;
 select role into v_role from public.profiles where id=auth.uid();
 if coalesce(v_role,'student') not in ('admin','owner') then raise exception 'forbidden'; end if;
 if coalesce(p_data->>'level','') not in ('N5','N4','N3','N2','N1') then raise exception 'invalid level'; end if;
 if nullif(trim(p_data->>'section'),'') is null or nullif(trim(p_data->>'question_type'),'') is null then raise exception 'section and question_type required'; end if;
 if nullif(trim(p_data->>'instruction_jp'),'') is null or nullif(trim(p_data->>'prompt_jp'),'') is null then raise exception 'instruction and prompt required'; end if;
 v_choices:=coalesce(p_data->'choices','[]'::jsonb); if jsonb_typeof(v_choices)<>'array' or jsonb_array_length(v_choices)<2 then raise exception 'at least two choices required'; end if;
 v_correct:=coalesce(nullif(p_data->>'correct_index','')::int,-1); if v_correct<0 or v_correct>=jsonb_array_length(v_choices) then raise exception 'invalid correct_index'; end if;
 insert into public.jlpt_simulation_questions(id,level,section,mondai_no,question_no,display_question_no,question_type,instruction_jp,prompt_jp,choices,correct_index,passage_title,passage_jp,audio_url,image_url,transcript_jp,source_kind,is_published,explanation_indonesian)
 values(v_id,p_data->>'level',p_data->>'section',coalesce(nullif(p_data->>'mondai_no','')::smallint,1),coalesce(nullif(p_data->>'question_no','')::smallint,1),nullif(p_data->>'display_question_no','')::smallint,p_data->>'question_type',p_data->>'instruction_jp',p_data->>'prompt_jp',v_choices,v_correct::smallint,nullif(p_data->>'passage_title',''),nullif(p_data->>'passage_jp',''),nullif(p_data->>'audio_url',''),nullif(p_data->>'image_url',''),nullif(p_data->>'transcript_jp',''),coalesce(nullif(p_data->>'source_kind',''),'eno_original'),coalesce((p_data->>'is_published')::boolean,false),nullif(p_data->>'explanation_indonesian',''))
 on conflict(id) do update set level=excluded.level,section=excluded.section,mondai_no=excluded.mondai_no,question_no=excluded.question_no,display_question_no=excluded.display_question_no,question_type=excluded.question_type,instruction_jp=excluded.instruction_jp,prompt_jp=excluded.prompt_jp,choices=excluded.choices,correct_index=excluded.correct_index,passage_title=excluded.passage_title,passage_jp=excluded.passage_jp,audio_url=excluded.audio_url,image_url=excluded.image_url,transcript_jp=excluded.transcript_jp,source_kind=excluded.source_kind,is_published=excluded.is_published,explanation_indonesian=excluded.explanation_indonesian;
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
 when 'questions' then delete from public.jlpt_simulation_questions where id=p_id;
 else raise exception 'invalid content kind'; end case;
end $$;

revoke all on function public.admin_get_content_item(text,uuid) from public,anon;
revoke all on function public.admin_save_question_item(uuid,jsonb) from public,anon;
revoke all on function public.admin_delete_content_item(text,uuid) from public,anon;
grant execute on function public.admin_get_content_item(text,uuid) to authenticated;
grant execute on function public.admin_save_question_item(uuid,jsonb) to authenticated;
grant execute on function public.admin_delete_content_item(text,uuid) to authenticated;
