create or replace function public.teacher_set_content_published(p_kind text,p_id bigint,p_published boolean)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare v_role text;
begin
 if auth.uid() is null then raise exception 'not authenticated'; end if;
 select role into v_role from public.profiles where id=auth.uid();
 if coalesce(v_role,'student') not in ('teacher','admin','owner') then raise exception 'forbidden'; end if;
 case p_kind
  when 'kanji' then update public.kanji set is_published=p_published where id=p_id;
  when 'vocabulary' then update public.vocabulary set is_published=p_published where id=p_id;
  when 'grammar' then update public.grammar_points set is_published=p_published where id=p_id;
  when 'reading' then update public.reading_passages set is_published=p_published where id=p_id;
  when 'listening' then update public.listening_items set is_published=p_published where id=p_id;
  else raise exception 'invalid content kind';
 end case;
 if not found then raise exception 'content not found'; end if;
 return jsonb_build_object('ok',true);
end $$;
revoke all on function public.teacher_set_content_published(text,bigint,boolean) from public,anon;
grant execute on function public.teacher_set_content_published(text,bigint,boolean) to authenticated;

create or replace function public.get_teacher_content(p_kind text,p_level text default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare v_role text; v_result jsonb;
begin
 if auth.uid() is null then raise exception 'not authenticated'; end if;
 select role into v_role from public.profiles where id=auth.uid();
 if coalesce(v_role,'student') not in ('teacher','admin','owner') then raise exception 'forbidden'; end if;
 case p_kind
  when 'kanji' then select coalesce(jsonb_agg(to_jsonb(x)),'[]'::jsonb) into v_result from (select id,character as title,level,is_published,meaning_id as subtitle from public.kanji where p_level is null or level::text=p_level order by sort_order nulls last limit 200) x;
  when 'vocabulary' then select coalesce(jsonb_agg(to_jsonb(x)),'[]'::jsonb) into v_result from (select id,term as title,level,is_published,meaning_id as subtitle from public.vocabulary where p_level is null or level::text=p_level order by sort_order nulls last limit 200) x;
  when 'grammar' then select coalesce(jsonb_agg(to_jsonb(x)),'[]'::jsonb) into v_result from (select id,pattern as title,level,is_published,meaning_id as subtitle from public.grammar_points where p_level is null or level::text=p_level order by sort_order nulls last limit 200) x;
  when 'reading' then select coalesce(jsonb_agg(to_jsonb(x)),'[]'::jsonb) into v_result from (select id,title,level,is_published,translation_id as subtitle from public.reading_passages where p_level is null or level::text=p_level order by sort_order nulls last limit 200) x;
  when 'listening' then select coalesce(jsonb_agg(to_jsonb(x)),'[]'::jsonb) into v_result from (select id,title,level,is_published,translation_id as subtitle from public.listening_items where p_level is null or level::text=p_level order by sort_order nulls last limit 200) x;
  else raise exception 'invalid content kind';
 end case;
 return v_result;
end $$;
revoke all on function public.get_teacher_content(text,text) from public,anon;
grant execute on function public.get_teacher_content(text,text) to authenticated;
