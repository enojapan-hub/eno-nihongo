create or replace function public.get_jlpt_simulation_attempt_review(p_attempt_id uuid)
returns jsonb language plpgsql security definer set search_path to 'public','pg_temp'
as $function$
declare v_uid uuid:=auth.uid(); v_result jsonb;
begin
 if v_uid is null then raise exception 'authentication required'; end if;
 if not exists(
   select 1 from public.jlpt_simulation_attempts a
   left join public.jlpt_simulation_full_sessions s on s.id=a.full_session_id
   where a.id=p_attempt_id and a.user_id=v_uid and a.completed_at is not null
     and (a.full_session_id is null or (s.user_id=v_uid and s.status='completed'))
 ) then raise exception 'review unavailable until simulation is completed'; end if;
 select coalesce(jsonb_agg(jsonb_build_object('question_id',q.id,'section',a.section,'mondai_no',q.mondai_no,'question_no',q.question_no,'display_question_no',q.display_question_no,'question_type',q.question_type,'instruction_jp',q.instruction_jp,'prompt_jp',q.prompt_jp,'choices',q.choices,'selected_index',ans.selected_index,'correct_index',q.correct_index,'is_correct',coalesce(ans.is_correct,false),'answered',ans.id is not null,'passage_title',q.passage_title,'passage_jp',q.passage_jp,'transcript_jp',q.transcript_jp,'image_url',q.image_url,'explanation_indonesian',q.explanation_indonesian) order by q.mondai_no,q.question_no),'[]'::jsonb) into v_result
 from public.jlpt_simulation_attempts a join public.jlpt_simulation_attempt_questions aq on aq.attempt_id=a.id join public.jlpt_simulation_questions q on q.id=aq.question_id left join public.jlpt_simulation_answers ans on ans.attempt_id=a.id and ans.question_id=q.id where a.id=p_attempt_id and a.user_id=v_uid;
 return v_result;
end $function$;
revoke all on function public.get_jlpt_simulation_attempt_review(uuid) from public;
grant execute on function public.get_jlpt_simulation_attempt_review(uuid) to authenticated;
