-- Public view is created by the subsequent visual-assets migration with the final column shape.
revoke all on public.jlpt_simulation_questions from anon, authenticated;
grant select on public.jlpt_simulation_questions_public to authenticated;
revoke all on public.jlpt_simulation_questions_public from anon;

create table if not exists public.jlpt_simulation_answers (
 id uuid primary key default gen_random_uuid(),
 attempt_id uuid not null references public.jlpt_simulation_attempts(id) on delete cascade,
 question_id uuid not null references public.jlpt_simulation_questions(id),
 selected_index smallint not null check(selected_index between 0 and 3),
 is_correct boolean not null,
 created_at timestamptz not null default now(),
 unique(attempt_id,question_id)
);
alter table public.jlpt_simulation_answers enable row level security;
revoke all on public.jlpt_simulation_answers from anon, authenticated;

revoke insert,update,delete on public.jlpt_simulation_attempts from anon, authenticated;
grant select on public.jlpt_simulation_attempts to authenticated;

create or replace function public.submit_jlpt_simulation_section(p_level text,p_section text,p_duration_seconds integer,p_answers jsonb)
returns table(attempt_id uuid,total_questions integer,correct_count integer,score_percent numeric)
language plpgsql
security definer
set search_path=public,pg_temp
as $$
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
 on conflict(attempt_id,question_id) do nothing;
 select count(*),count(*) filter(where is_correct) into v_total,v_correct from public.jlpt_simulation_answers where jlpt_simulation_answers.attempt_id=v_attempt;
 update public.jlpt_simulation_attempts set correct_count=v_correct where id=v_attempt;
 return query select v_attempt,v_expected,v_correct,case when v_expected=0 then 0::numeric else round(v_correct::numeric*100/v_expected,2) end;
end $$;
revoke all on function public.submit_jlpt_simulation_section(text,text,integer,jsonb) from public,anon;
grant execute on function public.submit_jlpt_simulation_section(text,text,integer,jsonb) to authenticated;
