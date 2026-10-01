alter table public.jlpt_simulation_attempts add column if not exists full_session_id uuid references public.jlpt_simulation_full_sessions(id) on delete cascade;
alter table public.jlpt_simulation_attempts add column if not exists session_index integer check (session_index is null or session_index >= 0);
create index if not exists jlpt_simulation_attempts_full_session_idx on public.jlpt_simulation_attempts(full_session_id,session_index);

drop function if exists public.submit_jlpt_simulation_full_section(uuid,integer,text,text,integer,jsonb);
create function public.submit_jlpt_simulation_full_section(p_full_session_id uuid,p_session_index integer,p_level text,p_section text,p_duration_seconds integer,p_answers jsonb)
returns table(attempt_id uuid,total_questions integer,correct_count integer,score_percent numeric)
language plpgsql security definer set search_path='public','pg_temp' as $$
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
 on conflict(attempt_id,question_id) do nothing;
 select count(*) filter(where a.is_correct) into v_correct from public.jlpt_simulation_answers a where a.attempt_id=v_attempt;
 update public.jlpt_simulation_attempts set correct_count=v_correct where id=v_attempt;
 return query select v_attempt,v_expected,v_correct,case when v_expected=0 then 0::numeric else round(v_correct::numeric*100/v_expected,2) end;
end $$;
revoke all on function public.submit_jlpt_simulation_full_section(uuid,integer,text,text,integer,jsonb) from public,anon;
grant execute on function public.submit_jlpt_simulation_full_section(uuid,integer,text,text,integer,jsonb) to authenticated;

create or replace function public.finalize_jlpt_simulation_full(p_full_session_id uuid)
returns table(session_id uuid,total_score integer,passed boolean,certificate_token uuid,completed_at timestamptz)
language plpgsql security definer set search_path='public','pg_temp' as $$
declare v_uid uuid:=auth.uid(); v_level text; v_language integer; v_reading integer; v_listening integer; v_total integer; v_pass boolean; v_token uuid; v_done timestamptz;
begin
 if v_uid is null then raise exception 'authentication required'; end if;
 select s.level into v_level from public.jlpt_simulation_full_sessions s where s.id=p_full_session_id and s.user_id=v_uid and s.status='in_progress' for update;
 if v_level is null then raise exception 'invalid full session'; end if;
 if not exists(select 1 from public.jlpt_simulation_attempts a where a.full_session_id=p_full_session_id and a.section='listening') then raise exception 'simulation incomplete'; end if;
 if v_level in ('N1','N2','N3') then
   select round(coalesce(sum(correct_count) filter(where section in ('vocabulary','grammar')),0)::numeric*60/nullif(coalesce(sum(total_questions) filter(where section in ('vocabulary','grammar')),0),0)),
          round(coalesce(sum(correct_count) filter(where section='reading'),0)::numeric*60/nullif(coalesce(sum(total_questions) filter(where section='reading'),0),0)),
          round(coalesce(sum(correct_count) filter(where section='listening'),0)::numeric*60/nullif(coalesce(sum(total_questions) filter(where section='listening'),0),0))
   into v_language,v_reading,v_listening from public.jlpt_simulation_attempts where full_session_id=p_full_session_id;
   v_language:=coalesce(v_language,0); v_reading:=coalesce(v_reading,0); v_listening:=coalesce(v_listening,0); v_total:=v_language+v_reading+v_listening;
   v_pass:=v_total >= case v_level when 'N1' then 100 when 'N2' then 90 else 95 end and v_language>=19 and v_reading>=19 and v_listening>=19;
 else
   select round(coalesce(sum(correct_count) filter(where section in ('vocabulary','grammar','reading')),0)::numeric*120/nullif(coalesce(sum(total_questions) filter(where section in ('vocabulary','grammar','reading')),0),0)),
          round(coalesce(sum(correct_count) filter(where section='listening'),0)::numeric*60/nullif(coalesce(sum(total_questions) filter(where section='listening'),0),0))
   into v_language,v_listening from public.jlpt_simulation_attempts where full_session_id=p_full_session_id;
   v_language:=coalesce(v_language,0); v_listening:=coalesce(v_listening,0); v_total:=v_language+v_listening;
   v_pass:=v_total >= case v_level when 'N4' then 90 else 80 end and v_language>=38 and v_listening>=19;
 end if;
 v_done:=now(); v_token:=case when v_pass then gen_random_uuid() else null end;
 update public.jlpt_simulation_full_sessions set status='completed',completed_at=v_done,total_score=v_total,passed=v_pass,certificate_token=v_token where id=p_full_session_id;
 return query select p_full_session_id,v_total,v_pass,v_token,v_done;
end $$;
revoke all on function public.finalize_jlpt_simulation_full(uuid) from public,anon;
grant execute on function public.finalize_jlpt_simulation_full(uuid) to authenticated;
revoke all on function public.complete_jlpt_simulation_full(uuid,integer,boolean) from authenticated;
