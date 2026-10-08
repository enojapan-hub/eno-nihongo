CREATE OR REPLACE FUNCTION public.mark_material_learned_atomic(p_item_type public.content_skill, p_item_id uuid, p_level public.jlpt_level)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, auth
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_existing public.user_item_progress%ROWTYPE;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'login_required'; END IF;
  IF p_item_type IS NULL OR p_item_id IS NULL OR p_level IS NULL THEN RAISE EXCEPTION 'invalid_content'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(v_user::text || ':' || p_item_type::text || ':' || p_item_id::text, 0));
  SELECT * INTO v_existing FROM public.user_item_progress
  WHERE user_id = v_user AND item_type = p_item_type AND item_id = p_item_id FOR UPDATE;
  IF FOUND AND v_existing.status <> 'new' THEN RETURN false; END IF;
  IF v_existing.id IS NOT NULL THEN
    UPDATE public.user_item_progress SET status='learning', repetitions=1, last_reviewed_at=now(), due_at=now()+interval '1 day' WHERE id=v_existing.id;
  ELSE
    INSERT INTO public.user_item_progress(user_id,item_type,item_id,level,status,repetitions,last_reviewed_at,due_at)
    VALUES(v_user,p_item_type,p_item_id,p_level,'learning',1,now(),now()+interval '1 day');
  END IF;
  PERFORM public.record_learning_activity('lesson_completed',p_item_type::text,p_item_id,0,0,NULL,60,jsonb_build_object('level',p_level::text,'repetition',1));
  RETURN true;
END;
$$;
REVOKE ALL ON FUNCTION public.mark_material_learned_atomic(public.content_skill,uuid,public.jlpt_level) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mark_material_learned_atomic(public.content_skill,uuid,public.jlpt_level) TO authenticated;
