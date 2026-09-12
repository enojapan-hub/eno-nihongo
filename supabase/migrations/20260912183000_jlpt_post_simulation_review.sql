alter table public.jlpt_simulation_questions add column if not exists explanation_indonesian text;

create table if not exists public.jlpt_simulation_attempt_questions (
  attempt_id uuid not null references public.jlpt_simulation_attempts(id) on delete cascade,
  question_id uuid not null references public.jlpt_simulation_questions(id) on delete restrict,
  created_at timestamptz not null default now(),
  primary key (attempt_id, question_id)
);
alter table public.jlpt_simulation_attempt_questions enable row level security;
revoke all on public.jlpt_simulation_attempt_questions from anon, authenticated;

insert into public.jlpt_simulation_attempt_questions(attempt_id,question_id)
select distinct a.attempt_id,a.question_id from public.jlpt_simulation_answers a on conflict do nothing;

create or replace function public.submit_jlpt_simulation_section(p_level text,p_section text,p_duration_seconds integer,p_answers jsonb)
returns table(attempt_id uuid,total_questions integer,correct_count integer,score_percent numeric)
language plpgsql security definer set search_path to 'public','pg_temp'
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
 insert into public.jlpt_simulation_attempt_questions(attempt_id,question_id) select v_attempt,q.id from public.jlpt_simulation_questions q where q.level=p_level and q.section=p_section and q.is_published on conflict do nothing;
 insert into public.jlpt_simulation_answers(attempt_id,question_id,selected_index,is_correct)
 select v_attempt,q.id,(a->>'selected_index')::smallint,((a->>'selected_index')::smallint=q.correct_index)
 from jsonb_array_elements(p_answers) a join public.jlpt_simulation_questions q on q.id=(a->>'question_id')::uuid
 where q.level=p_level and q.section=p_section and q.is_published and (a->>'selected_index')::integer between 0 and 3
 on conflict on constraint jlpt_simulation_answers_attempt_id_question_id_key do nothing;
 select count(*),count(*) filter(where is_correct) into v_total,v_correct from public.jlpt_simulation_answers where jlpt_simulation_answers.attempt_id=v_attempt;
 update public.jlpt_simulation_attempts set correct_count=v_correct where id=v_attempt;
 return query select v_attempt,v_expected,v_correct,case when v_expected=0 then 0::numeric else round(v_correct::numeric*100/v_expected,2) end;
end $function$;

create or replace function public.submit_jlpt_simulation_full_section(p_full_session_id uuid,p_session_index integer,p_level text,p_section text,p_duration_seconds integer,p_answers jsonb)
returns table(attempt_id uuid,total_questions integer,correct_count integer,score_percent numeric)
language plpgsql security definer set search_path to 'public','pg_temp'
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
 insert into public.jlpt_simulation_attempts(user_id,level,section,total_questions,correct_count,duration_seconds,completed_at,full_session_id,session_index) values(v_uid,p_level,p_section,v_expected,0,p_duration_seconds,now(),p_full_session_id,p_session_index) returning id into v_attempt;
 insert into public.jlpt_simulation_attempt_questions(attempt_id,question_id) select v_attempt,q.id from public.jlpt_simulation_questions q where q.level=p_level and q.section=p_section and q.is_published on conflict do nothing;
 insert into public.jlpt_simulation_answers(attempt_id,question_id,selected_index,is_correct)
 select v_attempt,q.id,(a->>'selected_index')::smallint,((a->>'selected_index')::smallint=q.correct_index)
 from jsonb_array_elements(p_answers) a join public.jlpt_simulation_questions q on q.id=(a->>'question_id')::uuid
 where q.level=p_level and q.section=p_section and q.is_published and (a->>'selected_index')::integer between 0 and 3
 on conflict on constraint jlpt_simulation_answers_attempt_id_question_id_key do nothing;
 select count(*) filter(where a.is_correct) into v_correct from public.jlpt_simulation_answers a where a.attempt_id=v_attempt;
 update public.jlpt_simulation_attempts set correct_count=v_correct where id=v_attempt;
 return query select v_attempt,v_expected,v_correct,case when v_expected=0 then 0::numeric else round(v_correct::numeric*100/v_expected,2) end;
end $function$;

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

create or replace function public.get_jlpt_simulation_full_review(p_full_session_id uuid)
returns jsonb language plpgsql security definer set search_path to 'public','pg_temp'
as $function$
declare v_uid uuid:=auth.uid(); v_result jsonb;
begin
 if v_uid is null then raise exception 'authentication required'; end if;
 if not exists(select 1 from public.jlpt_simulation_full_sessions s where s.id=p_full_session_id and s.user_id=v_uid and s.status='completed') then raise exception 'review unavailable until simulation is completed'; end if;
 select coalesce(jsonb_agg(jsonb_build_object('attempt_id',a.id,'session_index',a.session_index,'question_id',q.id,'section',a.section,'mondai_no',q.mondai_no,'question_no',q.question_no,'display_question_no',q.display_question_no,'question_type',q.question_type,'instruction_jp',q.instruction_jp,'prompt_jp',q.prompt_jp,'choices',q.choices,'selected_index',ans.selected_index,'correct_index',q.correct_index,'is_correct',coalesce(ans.is_correct,false),'answered',ans.id is not null,'passage_title',q.passage_title,'passage_jp',q.passage_jp,'transcript_jp',q.transcript_jp,'image_url',q.image_url,'explanation_indonesian',q.explanation_indonesian) order by a.session_index,case a.section when 'vocabulary' then 1 when 'grammar' then 2 when 'reading' then 3 else 4 end,q.mondai_no,q.question_no),'[]'::jsonb) into v_result
 from public.jlpt_simulation_attempts a join public.jlpt_simulation_attempt_questions aq on aq.attempt_id=a.id join public.jlpt_simulation_questions q on q.id=aq.question_id left join public.jlpt_simulation_answers ans on ans.attempt_id=a.id and ans.question_id=q.id where a.full_session_id=p_full_session_id and a.user_id=v_uid;
 return v_result;
end $function$;

revoke all on function public.get_jlpt_simulation_attempt_review(uuid) from public;
revoke all on function public.get_jlpt_simulation_full_review(uuid) from public;
grant execute on function public.get_jlpt_simulation_attempt_review(uuid) to authenticated;
grant execute on function public.get_jlpt_simulation_full_review(uuid) to authenticated;
