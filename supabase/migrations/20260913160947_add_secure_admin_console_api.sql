create or replace function public.get_admin_console_data(p_section text default 'users', p_level text default null)
returns jsonb
language plpgsql
security definer
set search_path = 'pg_catalog,public,auth'
as $function$
declare
  v_role text;
  v_result jsonb;
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  select role into v_role from public.profiles where id = auth.uid();
  if coalesce(v_role,'student') not in ('admin','owner') then raise exception 'forbidden'; end if;

  case p_section
    when 'users' then
      select coalesce(jsonb_agg(x order by x.created_at desc), '[]'::jsonb) into v_result
      from (select p.id,p.display_name,p.target_level,p.role,p.plan,p.premium_until,p.country,p.created_at from public.profiles p limit 250) x;
    when 'kanji' then
      select coalesce(jsonb_agg(x order by x.sort_order,x.character), '[]'::jsonb) into v_result
      from (select id,character,level,meaning_id,onyomi,kunyomi,sort_order,is_published from public.kanji where p_level is null or level::text=p_level limit 500) x;
    when 'vocabulary' then
      select coalesce(jsonb_agg(x order by x.sort_order,x.term), '[]'::jsonb) into v_result
      from (select id,term,reading,level,meaning_id,part_of_speech,sort_order,is_published from public.vocabulary where p_level is null or level::text=p_level limit 500) x;
    when 'grammar' then
      select coalesce(jsonb_agg(x order by x.sort_order,x.pattern), '[]'::jsonb) into v_result
      from (select id,pattern,level,meaning_id,structure,sort_order,is_published from public.grammar_points where p_level is null or level::text=p_level limit 500) x;
    when 'reading' then
      select coalesce(jsonb_agg(x order by x.sort_order,x.title), '[]'::jsonb) into v_result
      from (select id,title,level,estimated_minutes,sort_order,is_published from public.reading_passages where p_level is null or level::text=p_level limit 500) x;
    when 'listening' then
      select coalesce(jsonb_agg(x order by x.sort_order,x.title), '[]'::jsonb) into v_result
      from (select id,title,level,duration_seconds,question_type,audio_url,sort_order,is_published from public.listening_items where p_level is null or level::text=p_level limit 500) x;
    when 'questions' then
      select coalesce(jsonb_agg(x order by x.level,x.section,x.mondai_no,x.question_no), '[]'::jsonb) into v_result
      from (select id,level,section,mondai_no,question_no,display_question_no,question_type,prompt_jp,audio_url,image_url from public.jlpt_simulation_questions_public where p_level is null or level::text=p_level limit 500) x;
    else raise exception 'invalid section';
  end case;
  return v_result;
end
$function$;
revoke all on function public.get_admin_console_data(text,text) from public, anon;
grant execute on function public.get_admin_console_data(text,text) to authenticated;

create or replace function public.admin_update_user_access(p_user_id uuid, p_role text default null, p_plan text default null)
returns jsonb
language plpgsql
security definer
set search_path = 'pg_catalog,public,auth'
as $function$
declare v_role text; begin
 if auth.uid() is null then raise exception 'not authenticated'; end if;
 select role into v_role from public.profiles where id=auth.uid();
 if coalesce(v_role,'student') not in ('admin','owner') then raise exception 'forbidden'; end if;
 if p_role is not null and p_role not in ('student','admin','owner') then raise exception 'invalid role'; end if;
 if p_plan is not null and p_plan not in ('free','premium','lifetime') then raise exception 'invalid plan'; end if;
 if p_user_id=auth.uid() and p_role is not null and p_role not in ('admin','owner') then raise exception 'cannot remove own admin access'; end if;
 update public.profiles set role=coalesce(p_role,role), plan=coalesce(p_plan,plan), updated_at=now() where id=p_user_id;
 if not found then raise exception 'user not found'; end if;
 return jsonb_build_object('ok',true);
end $function$;
revoke all on function public.admin_update_user_access(uuid,text,text) from public, anon;
grant execute on function public.admin_update_user_access(uuid,text,text) to authenticated;

create or replace function public.admin_set_content_published(p_kind text,p_id uuid,p_published boolean)
returns jsonb
language plpgsql
security definer
set search_path = 'pg_catalog,public,auth'
as $function$
declare v_role text; begin
 if auth.uid() is null then raise exception 'not authenticated'; end if;
 select role into v_role from public.profiles where id=auth.uid();
 if coalesce(v_role,'student') not in ('admin','owner') then raise exception 'forbidden'; end if;
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
end $function$;
revoke all on function public.admin_set_content_published(text,uuid,boolean) from public, anon;
grant execute on function public.admin_set_content_published(text,uuid,boolean) to authenticated;
