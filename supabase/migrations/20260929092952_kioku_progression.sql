drop function if exists public.kioku_apply_event(uuid,public.content_skill,uuid,text,text,boolean,boolean,text,text,timestamptz);

create or replace function public.kioku_apply_event(
  p_user uuid, p_item_type public.content_skill, p_item_id uuid, p_aspect text, p_direction text,
  p_correct boolean, p_used_hint boolean, p_confidence text, p_error_type text, p_at timestamptz,
  p_response_ms integer default 0, p_hint_level integer default 3)
returns void language plpgsql security definer set search_path = pg_catalog, public as $$
declare s public.memory_state; v_stage smallint; v_stab numeric; v_factor numeric; v_cap int; v_hl int := coalesce(p_hint_level,3); v_indep boolean; v_ms int := coalesce(p_response_ms,0);
begin
  select * into s from public.memory_state
   where user_id=p_user and item_type=p_item_type and item_id=p_item_id and aspect=p_aspect and direction=p_direction for update;
  if not found then
    s.stage:=0; s.stability:=0.5; s.lapses:=0; s.success_count:=0; s.failure_count:=0; s.overconfident_wrong:=0; s.last_error_type:=null;
  end if;
  if p_correct then
    v_indep := not coalesce(p_used_hint,false) and v_ms <= 8000 and p_confidence is distinct from 'ragu';
    v_factor := case when coalesce(p_used_hint,false) then 1.2 when p_confidence='ragu' or v_ms>8000 then 1.3 else 2.2 end;
    v_stab := least(365, greatest(s.stability,0.5) * v_factor);
    v_cap := case when v_hl>=3 then 2 when v_hl=2 then 3 else 4 end;
    v_stage := s.stage;
    if v_indep and s.stage < v_cap then v_stage := s.stage+1; end if;
    if v_stage=4 and s.stage<4 and not (s.stage=3 and s.success_count+1>=4 and v_stab>=6) then v_stage:=3; end if;
    s.success_count := s.success_count+1;
    s.due_at := p_at + v_stab * interval '1 day';
  else
    if p_confidence='yakin' then
      v_stage := greatest(0, s.stage-2); v_stab := greatest(0.25, s.stability*0.3); s.overconfident_wrong := s.overconfident_wrong+1;
    else
      v_stage := greatest(0, s.stage-1); v_stab := greatest(0.25, s.stability*0.4);
    end if;
    s.failure_count := s.failure_count+1;
    if s.success_count>0 then s.lapses := s.lapses+1; end if;
    s.due_at := p_at + interval '10 minutes';
  end if;
  insert into public.memory_state(user_id,item_type,item_id,aspect,direction,stage,stability,due_at,last_tested_at,lapses,success_count,failure_count,overconfident_wrong,last_error_type,last_confidence)
  values(p_user,p_item_type,p_item_id,p_aspect,p_direction,v_stage,v_stab,s.due_at,p_at,s.lapses,s.success_count,s.failure_count,s.overconfident_wrong,coalesce(p_error_type,s.last_error_type),p_confidence)
  on conflict (user_id,item_type,item_id,aspect,direction) do update set
    stage=excluded.stage, stability=excluded.stability, due_at=excluded.due_at, last_tested_at=excluded.last_tested_at,
    lapses=excluded.lapses, success_count=excluded.success_count, failure_count=excluded.failure_count,
    overconfident_wrong=excluded.overconfident_wrong, last_error_type=excluded.last_error_type,
    last_confidence=coalesce(excluded.last_confidence, public.memory_state.last_confidence), updated_at=now();
end $$;
revoke all on function public.kioku_apply_event(uuid,public.content_skill,uuid,text,text,boolean,boolean,text,text,timestamptz,integer,integer) from public, anon, authenticated;

create or replace function public.kioku_record_events(p_events jsonb)
returns jsonb language plpgsql security definer set search_path = pg_catalog, public as $$
declare
  v_user uuid := auth.uid(); ev jsonb; v_id uuid; v_type public.content_skill; v_item uuid; v_aspect text; v_dir text;
  v_correct boolean; v_hint boolean; v_conf text; v_err text; v_at timestamptz; v_ms int; v_hl int; v_level public.jlpt_level;
  v_inserted int:=0; v_dupes int:=0; v_skipped int:=0; v_total_ms bigint:=0;
begin
  if v_user is null then raise exception 'User belum login'; end if;
  if jsonb_typeof(p_events) <> 'array' then raise exception 'events_must_be_array'; end if;
  if jsonb_array_length(p_events) > 100 then raise exception 'batch_too_large'; end if;
  for ev in select e from jsonb_array_elements(p_events) e order by (e->>'occurred_at')::timestamptz nulls last loop
    begin
      v_id := (ev->>'client_event_id')::uuid; v_type := (ev->>'item_type')::public.content_skill; v_item := (ev->>'item_id')::uuid;
      v_aspect := ev->>'aspect'; v_dir := coalesce(ev->>'direction','forward'); v_correct := (ev->>'correct')::boolean;
      v_hint := coalesce((ev->>'used_hint')::boolean,false); v_conf := nullif(ev->>'confidence','');
      v_err := nullif(ev->>'error_type',''); v_ms := least(greatest(coalesce((ev->>'response_ms')::int,0),0),600000);
      v_hl := (ev->>'hint_level')::int;
      v_at := least(coalesce((ev->>'occurred_at')::timestamptz, now()), now() + interval '5 minutes');
      if v_id is null or v_item is null or v_correct is null or v_type not in ('kanji','vocabulary','grammar')
         or v_aspect not in ('meaning','reading','usage','function','context','function_context')
         or v_dir not in ('forward','reverse','context') or (v_conf is not null and v_conf not in ('yakin','ragu')) then
        v_skipped := v_skipped+1; continue;
      end if;
      select level into v_level from public.user_item_progress where user_id=v_user and item_type=v_type and item_id=v_item;
      if v_level is null then v_level := nullif(ev->>'level','')::public.jlpt_level; end if;
      if v_level is null then v_skipped := v_skipped+1; continue; end if;
      insert into public.flashcard_reviews(user_id,item_type,item_id,level,rating,direction,aspect,used_hint,response_ms,created_at,client_event_id,session_id,meta)
      values(v_user,v_type,v_item,v_level,case when v_correct then 2 else 0 end,v_dir,v_aspect,v_hint,v_ms,v_at,v_id,nullif(ev->>'session_id','')::uuid,
        jsonb_strip_nulls(jsonb_build_object('source','kioku','exercise_type',ev->>'exercise_type','correct',v_correct,
          'selected_answer',ev->>'selected_answer','confidence',v_conf,'hint_level',v_hl,'error_type',v_err)))
      on conflict (user_id, client_event_id) where client_event_id is not null do nothing;
      if not found then v_dupes := v_dupes+1; continue; end if;
      perform public.kioku_apply_event(v_user,v_type,v_item,v_aspect,v_dir,v_correct,v_hint,v_conf,v_err,v_at,v_ms,v_hl);
      update public.user_item_progress set last_reviewed_at=greatest(coalesce(last_reviewed_at,v_at),v_at), updated_at=now()
       where user_id=v_user and item_type=v_type and item_id=v_item;
      v_inserted := v_inserted+1; v_total_ms := v_total_ms+v_ms;
    exception when others then
      v_skipped := v_skipped+1;
    end;
  end loop;
  if v_inserted > 0 then
    perform public.record_learning_activity('quiz_answered', null::text, null::uuid, 0, 0, null::boolean,
      least((v_total_ms/1000)::int, 3600), jsonb_build_object('mode','kioku','count',v_inserted));
  end if;
  return jsonb_build_object('inserted',v_inserted,'duplicates',v_dupes,'skipped',v_skipped);
end $$;
revoke all on function public.kioku_record_events(jsonb) from public, anon;
grant execute on function public.kioku_record_events(jsonb) to authenticated;

create or replace function public.kioku_rebuild_memory_state()
returns integer language plpgsql security definer set search_path = pg_catalog, public as $$
declare v_user uuid := auth.uid(); r record; n int:=0;
begin
  if v_user is null then raise exception 'User belum login'; end if;
  delete from public.memory_state where user_id=v_user;
  for r in select * from public.flashcard_reviews where user_id=v_user and client_event_id is not null and meta->>'source'='kioku' order by created_at, id loop
    perform public.kioku_apply_event(v_user,r.item_type,r.item_id,r.aspect,r.direction,coalesce((r.meta->>'correct')::boolean,r.rating>=2),
      r.used_hint,r.meta->>'confidence',r.meta->>'error_type',r.created_at,coalesce(r.response_ms,0),(r.meta->>'hint_level')::int);
    n:=n+1;
  end loop;
  return n;
end $$;
revoke all on function public.kioku_rebuild_memory_state() from public, anon;
grant execute on function public.kioku_rebuild_memory_state() to authenticated;