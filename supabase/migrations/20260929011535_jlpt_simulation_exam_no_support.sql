-- exam_no support for JLPT full simulations (exam 1..5 per level), target highlight
-- fields and an image prompt for generated listening pictures.
alter table public.jlpt_simulation_questions
  add column if not exists target_text text,
  add column if not exists target_occurrence smallint,
  add column if not exists image_prompt text;

alter table public.jlpt_simulation_full_sessions
  add column if not exists exam_no smallint not null default 1;
alter table public.jlpt_simulation_full_sessions
  drop constraint if exists jlpt_simulation_full_sessions_exam_no_check;
alter table public.jlpt_simulation_full_sessions
  add constraint jlpt_simulation_full_sessions_exam_no_check check (exam_no between 1 and 5);

create index if not exists jlpt_simulation_questions_level_exam_section_idx
  on public.jlpt_simulation_questions (level, exam_no, section) where is_published;

drop function if exists public.get_published_simulation_questions(text, text);
create function public.get_published_simulation_questions(p_level text, p_section text, p_exam_no integer default 1)
 returns table(id uuid, mondai_no integer, question_no integer, display_question_no integer, question_type text, instruction_jp text, prompt_jp text, choices jsonb, passage_title text, passage_jp text, audio_url text, image_url text, transcript_jp text, target_text text, target_occurrence integer)
 language sql stable security definer
 set search_path to 'pg_catalog', 'public'
as $function$
  select q.id, q.mondai_no, q.question_no, q.display_question_no,
    q.question_type, q.instruction_jp, q.prompt_jp, q.choices,
    q.passage_title, q.passage_jp, q.audio_url, q.image_url, q.transcript_jp,
    q.target_text, q.target_occurrence
  from public.jlpt_simulation_questions q
  where q.is_published = true and q.level = p_level and q.section = p_section
    and q.exam_no = coalesce(p_exam_no, 1)
  order by q.mondai_no, q.question_no;
$function$;

create or replace function public.get_simulation_exam_numbers(p_level text)
 returns setof integer
 language sql stable security definer
 set search_path to 'pg_catalog', 'public'
as $function$
  select distinct q.exam_no::integer from public.jlpt_simulation_questions q
  where q.is_published and q.level = p_level and q.exam_no between 1 and 5
  order by 1;
$function$;

drop function if exists public.start_jlpt_simulation_full(text);
create function public.start_jlpt_simulation_full(p_level text, p_exam_no integer default 1)
 returns uuid
 language plpgsql security definer
 set search_path to 'public'
as $function$
declare v_id uuid; v_exam integer := coalesce(p_exam_no, 1);
begin
  if auth.uid() is null then raise exception 'authentication required'; end if;
  if p_level not in ('N5','N4','N3','N2','N1') then raise exception 'invalid level'; end if;
  if v_exam not between 1 and 5 then raise exception 'invalid exam'; end if;
  if not exists (select 1 from public.jlpt_simulation_questions q where q.level=p_level and q.exam_no=v_exam and q.is_published) then
    raise exception 'exam not available';
  end if;
  insert into public.jlpt_simulation_full_sessions(user_id,level,exam_no) values(auth.uid(),p_level,v_exam) returning id into v_id;
  return v_id;
end;$function$;

create or replace function public.submit_jlpt_simulation_full_section(p_full_session_id uuid, p_session_index integer, p_level text, p_section text, p_duration_seconds integer, p_answers jsonb)
 returns table(attempt_id uuid, total_questions integer, correct_count integer, score_percent numeric)
 language plpgsql security definer
 set search_path to 'public', 'pg_temp'
as $function$
declare v_uid uuid:=auth.uid(); v_attempt uuid; v_expected integer; v_correct integer; v_exam smallint;
begin
 if v_uid is null then raise exception 'authentication required'; end if;
 if p_session_index < 0 then raise exception 'invalid session'; end if;
 if p_level not in ('N5','N4','N3','N2','N1') or p_section not in ('vocabulary','grammar','reading','listening') then raise exception 'invalid input'; end if;
 if p_duration_seconds < 0 or p_duration_seconds > 14400 then raise exception 'invalid duration'; end if;
 if jsonb_typeof(p_answers) <> 'array' then raise exception 'answers must be an array'; end if;
 select s.exam_no into v_exam from public.jlpt_simulation_full_sessions s where s.id=p_full_session_id and s.user_id=v_uid and s.level=p_level and s.status='in_progress';
 if v_exam is null then raise exception 'invalid full session'; end if;
 select count(*) into v_expected from public.jlpt_simulation_questions q where q.level=p_level and q.section=p_section and q.exam_no=v_exam and q.is_published;
 insert into public.jlpt_simulation_attempts(user_id,level,section,total_questions,correct_count,duration_seconds,completed_at,full_session_id,session_index)
 values(v_uid,p_level,p_section,v_expected,0,p_duration_seconds,now(),p_full_session_id,p_session_index) returning id into v_attempt;
 insert into public.jlpt_simulation_attempt_questions(attempt_id,question_id)
 select v_attempt,q.id from public.jlpt_simulation_questions q where q.level=p_level and q.section=p_section and q.exam_no=v_exam and q.is_published on conflict do nothing;
 insert into public.jlpt_simulation_answers(attempt_id,question_id,selected_index,is_correct)
 select v_attempt,q.id,(a->>'selected_index')::smallint,((a->>'selected_index')::smallint=q.correct_index)
 from jsonb_array_elements(p_answers) a join public.jlpt_simulation_questions q on q.id=(a->>'question_id')::uuid
 where q.level=p_level and q.section=p_section and q.exam_no=v_exam and q.is_published and (a->>'selected_index')::integer between 0 and 3
 on conflict on constraint jlpt_simulation_answers_attempt_id_question_id_key do nothing;
 select count(*) filter(where a.is_correct) into v_correct from public.jlpt_simulation_answers a where a.attempt_id=v_attempt;
 update public.jlpt_simulation_attempts set correct_count=v_correct where id=v_attempt;
 return query select v_attempt,v_expected,v_correct,case when v_expected=0 then 0::numeric else round(v_correct::numeric*100/v_expected,2) end;
end $function$;

-- Section practice (simulasi-bagian) stays on exam 1.
create or replace function public.submit_jlpt_simulation_section(p_level text, p_section text, p_duration_seconds integer, p_answers jsonb)
 returns table(attempt_id uuid, total_questions integer, correct_count integer, score_percent numeric)
 language plpgsql security definer
 set search_path to 'public', 'pg_temp'
as $function$
declare v_uid uuid:=auth.uid(); v_attempt uuid; v_total integer; v_correct integer; v_expected integer;
begin
 if v_uid is null then raise exception 'authentication required'; end if;
 if p_level not in ('N5','N4','N3','N2','N1') then raise exception 'invalid level'; end if;
 if p_section not in ('vocabulary','grammar','reading','listening') then raise exception 'invalid section'; end if;
 if p_duration_seconds < 0 or p_duration_seconds > 14400 then raise exception 'invalid duration'; end if;
 if jsonb_typeof(p_answers) <> 'array' then raise exception 'answers must be an array'; end if;
 select count(*) into v_expected from public.jlpt_simulation_questions q where q.level=p_level and q.section=p_section and q.exam_no=1 and q.is_published;
 insert into public.jlpt_simulation_attempts(user_id,level,section,total_questions,correct_count,duration_seconds,completed_at) values(v_uid,p_level,p_section,v_expected,0,p_duration_seconds,now()) returning id into v_attempt;
 insert into public.jlpt_simulation_attempt_questions(attempt_id,question_id)
 select v_attempt,q.id from public.jlpt_simulation_questions q where q.level=p_level and q.section=p_section and q.exam_no=1 and q.is_published on conflict do nothing;
 insert into public.jlpt_simulation_answers(attempt_id,question_id,selected_index,is_correct)
 select v_attempt,q.id,(a->>'selected_index')::smallint,((a->>'selected_index')::smallint=q.correct_index)
 from jsonb_array_elements(p_answers) a join public.jlpt_simulation_questions q on q.id=(a->>'question_id')::uuid
 where q.level=p_level and q.section=p_section and q.exam_no=1 and q.is_published and (a->>'selected_index')::integer between 0 and 3
 on conflict on constraint jlpt_simulation_answers_attempt_id_question_id_key do nothing;
 select count(*),count(*) filter(where is_correct) into v_total,v_correct from public.jlpt_simulation_answers where jlpt_simulation_answers.attempt_id=v_attempt;
 update public.jlpt_simulation_attempts set correct_count=v_correct where id=v_attempt;
 return query select v_attempt,v_expected,v_correct,case when v_expected=0 then 0::numeric else round(v_correct::numeric*100/v_expected,2) end;
end $function$;

-- finalize: also return exam_no so result/certificate know level + exam.
drop function if exists public.finalize_jlpt_simulation_full(uuid);
create function public.finalize_jlpt_simulation_full(p_full_session_id uuid)
 returns table(session_id uuid, total_score integer, passed boolean, certificate_token uuid, completed_at timestamp with time zone, exam_no integer, level text)
 language plpgsql security definer
 set search_path to 'public', 'pg_temp'
as $function$
declare v_uid uuid:=auth.uid(); v_level text; v_exam integer; v_language integer; v_reading integer; v_listening integer; v_total integer; v_pass boolean; v_token uuid; v_done timestamptz;
begin
 if v_uid is null then raise exception 'authentication required'; end if;
 select s.level, s.exam_no into v_level, v_exam from public.jlpt_simulation_full_sessions s where s.id=p_full_session_id and s.user_id=v_uid and s.status='in_progress' for update;
 if v_level is null then raise exception 'invalid full session'; end if;
 if not exists(select 1 from public.jlpt_simulation_attempts a where a.full_session_id=p_full_session_id and a.section='listening') then raise exception 'simulation incomplete'; end if;
 if v_level in ('N1','N2','N3') then
   select round(coalesce(sum(a.correct_count) filter(where a.section in ('vocabulary','grammar')),0)::numeric*60/nullif(coalesce(sum(a.total_questions) filter(where a.section in ('vocabulary','grammar')),0),0)),
          round(coalesce(sum(a.correct_count) filter(where a.section='reading'),0)::numeric*60/nullif(coalesce(sum(a.total_questions) filter(where a.section='reading'),0),0)),
          round(coalesce(sum(a.correct_count) filter(where a.section='listening'),0)::numeric*60/nullif(coalesce(sum(a.total_questions) filter(where a.section='listening'),0),0))
   into v_language,v_reading,v_listening from public.jlpt_simulation_attempts a where a.full_session_id=p_full_session_id;
   v_language:=coalesce(v_language,0); v_reading:=coalesce(v_reading,0); v_listening:=coalesce(v_listening,0); v_total:=v_language+v_reading+v_listening;
   v_pass:=v_total >= case v_level when 'N1' then 100 when 'N2' then 90 else 95 end and v_language>=19 and v_reading>=19 and v_listening>=19;
 else
   select round(coalesce(sum(a.correct_count) filter(where a.section in ('vocabulary','grammar','reading')),0)::numeric*120/nullif(coalesce(sum(a.total_questions) filter(where a.section in ('vocabulary','grammar','reading')),0),0)),
          round(coalesce(sum(a.correct_count) filter(where a.section='listening'),0)::numeric*60/nullif(coalesce(sum(a.total_questions) filter(where a.section='listening'),0),0))
   into v_language,v_listening from public.jlpt_simulation_attempts a where a.full_session_id=p_full_session_id;
   v_language:=coalesce(v_language,0); v_listening:=coalesce(v_listening,0); v_total:=v_language+v_listening;
   v_pass:=v_total >= case v_level when 'N4' then 90 else 80 end and v_language>=38 and v_listening>=19;
 end if;
 v_done:=now(); v_token:=case when v_pass then gen_random_uuid() else null end;
 update public.jlpt_simulation_full_sessions s set status='completed',completed_at=v_done,total_score=v_total,passed=v_pass,certificate_token=v_token where s.id=p_full_session_id;
 return query select p_full_session_id,v_total,v_pass,v_token,v_done,v_exam,v_level;
end $function$;

revoke all on function public.get_published_simulation_questions(text, text, integer) from public, anon;
revoke all on function public.get_simulation_exam_numbers(text) from public, anon;
revoke all on function public.start_jlpt_simulation_full(text, integer) from public, anon;
revoke all on function public.finalize_jlpt_simulation_full(uuid) from public, anon;
grant execute on function public.get_published_simulation_questions(text, text, integer) to authenticated, service_role;
grant execute on function public.get_simulation_exam_numbers(text) to authenticated, service_role;
grant execute on function public.start_jlpt_simulation_full(text, integer) to authenticated, service_role;
grant execute on function public.finalize_jlpt_simulation_full(uuid) to authenticated, service_role;
