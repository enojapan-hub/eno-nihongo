create or replace function public.mark_item_mastered(p_item_type text, p_item_id uuid, p_level public.jlpt_level)
returns public.user_item_progress
language plpgsql
security definer
set search_path to 'pg_catalog, public, auth'
as $function$
declare
  v_user_id uuid := auth.uid();
  v_row public.user_item_progress;
  v_already_mastered boolean := false;
  v_valid boolean := false;
begin
  if v_user_id is null then raise exception 'User belum login'; end if;
  if p_item_id is null or p_item_type not in ('kanji','vocabulary','grammar','reading','listening') then raise exception 'invalid_item'; end if;

  case p_item_type
    when 'kanji' then select exists(select 1 from public.kanji where id=p_item_id and level=p_level and is_published=true) into v_valid;
    when 'vocabulary' then select exists(select 1 from public.vocabulary where id=p_item_id and level=p_level and is_published=true) into v_valid;
    when 'grammar' then select exists(select 1 from public.grammar_points where id=p_item_id and level=p_level and is_published=true) into v_valid;
    when 'reading' then select exists(select 1 from public.reading_passages where id=p_item_id and level=p_level and is_published=true) into v_valid;
    when 'listening' then select exists(select 1 from public.listening_items where id=p_item_id and level=p_level and is_published=true) into v_valid;
  end case;
  if not v_valid then raise exception 'item_not_found_or_level_mismatch'; end if;

  select (status='mastered') into v_already_mastered
  from public.user_item_progress
  where user_id=v_user_id and item_type::text=p_item_type and item_id=p_item_id;
  v_already_mastered := coalesce(v_already_mastered,false);

  insert into public.user_item_progress(user_id,item_type,item_id,level,status,repetitions,last_reviewed_at,due_at)
  values(v_user_id,p_item_type::public.item_type,p_item_id,p_level,'mastered',1,now(),now()+interval '7 days')
  on conflict (user_id,item_type,item_id) do update set
    level=excluded.level,status='mastered',repetitions=greatest(public.user_item_progress.repetitions,1),
    last_reviewed_at=now(),due_at=now()+interval '7 days',updated_at=now()
  returning * into v_row;

  if not v_already_mastered then
    perform public.record_learning_activity('lesson_completed',p_item_type,p_item_id,0,5,null,60,jsonb_build_object('level',p_level::text,'status','mastered'));
  end if;
  return v_row;
end;
$function$;

create or replace function public.record_learning_activity(p_activity_type text, p_points integer default 0, p_xp integer default 0, p_metadata jsonb default '{}'::jsonb)
returns public.user_learning_stats
language plpgsql
security definer
set search_path to 'pg_catalog,public,auth'
as $function$
declare v_user_id uuid:=auth.uid(); v_result public.user_learning_stats;
begin
 if v_user_id is null then raise exception 'User belum login'; end if;
 if p_activity_type not in ('lesson_completed','quiz_completed','quiz_answered','daily_target_completed','simulation_section_completed','simulation_full_completed') then raise exception 'invalid_activity_type'; end if;
 -- Legacy client-callable overload must never mint XP/points from caller supplied values.
 perform public.record_learning_activity(p_activity_type,null,null,0,0,null,least(greatest(coalesce((p_metadata->>'duration_seconds')::int,0),0),86400),coalesce(p_metadata,'{}'::jsonb));
 select * into v_result from public.user_learning_stats where user_id=v_user_id;
 return v_result;
end
$function$;
