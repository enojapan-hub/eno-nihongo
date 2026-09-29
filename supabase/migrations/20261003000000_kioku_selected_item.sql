-- ENO Kioku phase 4: keep which item the user picked (selected_item_id) and the exercise variant in the event meta.
-- Function-only change (additive meta keys); tables untouched.
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
          'selected_answer',ev->>'selected_answer','selected_item_id',nullif(ev->>'selected_item_id',''),'variant',nullif(ev->>'variant',''),'confidence',v_conf,'hint_level',v_hl,'error_type',v_err)))
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
