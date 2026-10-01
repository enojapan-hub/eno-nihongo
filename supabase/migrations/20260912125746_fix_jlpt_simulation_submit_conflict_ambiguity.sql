create or replace function public.submit_jlpt_simulation_section(p_level text, p_section text, p_duration_seconds integer, p_answers jsonb)
returns table(attempt_id uuid, total_questions integer, correct_count integer, score_percent numeric)
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare v_uid uuid:=auth.uid(); v_attempt uuid; v_total integer; v_correct integer; v_expected integer;
begin
 if v_uid is null then raise exception 'authentication required'; end if;
 if p_level not in ('N5','N4','N3','N2','N1') then raise exception 'invalid level'; end if;
 if p_section not in ('vocabulary','grammar','reading','listening') then raise exception 'invalid section'; end if;
 if p_duration_seconds < 0 or p_duration_seconds > 14400 then raise exception 'invalid duration'; end if;
 if jsonb_typeof(p_answers) <> 'array' then raise exception 'answers must be an array'; end if;
 select count(*) into v_expected from public.jlpt_simulation_questions q where q.level=p_level and q.section=p_section and q.is_published;
 insert into public.jlpt_simulation_attempts(user_id,level,section,total_questions,correct_count,duration_seconds,completed_at) values(v_uid,p_level,p_section,v_expected,0,p_duration_seconds,now()) returning id into v_attempt;
 insert into public.jlpt_simulation_answers(attempt_id,question_id,selected_index,is_correct)
 select v_attempt,q.id,(a->>'selected_index')::smallint,((a->>'selected_index')::smallint=q.correct_index)
 from jsonb_array_elements(p_answers) a join public.jlpt_simulation_questions q on q.id=(a->>'question_id')::uuid
 where q.level=p_level and q.section=p_section and q.is_published and (a->>'selected_index')::integer between 0 and 3
 on conflict on constraint jlpt_simulation_answers_attempt_id_question_id_key do nothing;
 select count(*),count(*) filter(where is_correct) into v_total,v_correct from public.jlpt_simulation_answers where jlpt_simulation_answers.attempt_id=v_attempt;
 update public.jlpt_simulation_attempts set correct_count=v_correct where id=v_attempt;
 return query select v_attempt,v_expected,v_correct,case when v_expected=0 then 0::numeric else round(v_correct::numeric*100/v_expected,2) end;
end $function$;

create or replace function public.submit_jlpt_simulation_full_section(p_full_session_id uuid, p_session_index integer, p_level text, p_section text, p_duration_seconds integer, p_answers jsonb)
returns table(attempt_id uuid, total_questions integer, correct_count integer, score_percent numeric)
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare v_uid uuid:=auth.uid(); v_attempt uuid; v_expected integer; v_correct integer;
begin
 if v_uid is null then raise exception 'authentication required'; end if;
 if p_session_index < 0 then raise exception 'invalid session'; end if;
 if p_level not in ('N5','N4','N3','N2','N1') or p_section not in ('vocabulary','grammar','reading','listening') then raise exception 'invalid input'; end if;
 if p_duration_seconds < 0 or p_duration_seconds > 14400 then raise exception 'invalid duration'; end if;
 if jsonb_typeof(p_answers) <> 'array' then raise exception 'answers must be an array'; end if;
 if not exists(select 1 from public.jlpt_simulation_full_sessions s where s.id=p_full_session_id and s.user_id=v_uid and s.level=p_level and s.status='in_progress') then raise exception 'invalid full session'; end if;
 select count(*) into v_expected from public.jlpt_simulation_questions q where q.level=p_level and q.section=p_section and q.is_published;
 insert into public.jlpt_simulation_attempts(user_id,level,section,total_questions,correct_count,duration_seconds,completed_at,full_session_id,session_index)
 values(v_uid,p_level,p_section,v_expected,0,p_duration_seconds,now(),p_full_session_id,p_session_index) returning id into v_attempt;
 insert into public.jlpt_simulation_answers(attempt_id,question_id,selected_index,is_correct)
 select v_attempt,q.id,(a->>'selected_index')::smallint,((a->>'selected_index')::smallint=q.correct_index)
 from jsonb_array_elements(p_answers) a join public.jlpt_simulation_questions q on q.id=(a->>'question_id')::uuid
 where q.level=p_level and q.section=p_section and q.is_published and (a->>'selected_index')::integer between 0 and 3
 on conflict on constraint jlpt_simulation_answers_attempt_id_question_id_key do nothing;
 select count(*) filter(where a.is_correct) into v_correct from public.jlpt_simulation_answers a where a.attempt_id=v_attempt;
 update public.jlpt_simulation_attempts set correct_count=v_correct where id=v_attempt;
 return query select v_attempt,v_expected,v_correct,case when v_expected=0 then 0::numeric else round(v_correct::numeric*100/v_expected,2) end;
end $function$;

grant execute on function public.submit_jlpt_simulation_section(text,text,integer,jsonb) to authenticated;
grant execute on function public.submit_jlpt_simulation_full_section(uuid,integer,text,text,integer,jsonb) to authenticated;
