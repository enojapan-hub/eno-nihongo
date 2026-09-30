-- One participant may submit each class quiz only once.
-- The database constraint is the final anti-retake guard; the RPC also returns a clear message.
create unique index if not exists class_quiz_attempts_quiz_user_unique
  on public.class_quiz_attempts (quiz_id, user_id);

create or replace function public.submit_class_quiz(p_quiz_id uuid, p_answers jsonb)
returns table(attempt_id uuid, score numeric, correct_count integer, total_questions integer)
language plpgsql
security definer
set search_path = 'public'
as $function$
declare
  v_class uuid;
  v_due timestamptz;
  v_correct int := 0;
  v_total int := 0;
  v_id uuid;
  v_score numeric := 0;
  v_bad int := 0;
begin
  if auth.uid() is null then raise exception 'Login diperlukan'; end if;
  if jsonb_typeof(p_answers) <> 'object' then raise exception 'Format jawaban tidak valid'; end if;

  perform 1 from public.class_quizzes where id = p_quiz_id for update;

  select class_id, due_at into v_class, v_due
  from public.class_quizzes
  where id = p_quiz_id and is_published;

  if v_class is null or not public.is_class_member(v_class) then
    raise exception 'Akses quiz ditolak';
  end if;
  if v_due is not null and now() > v_due then
    raise exception 'Batas waktu quiz sudah berakhir';
  end if;
  if exists (
    select 1 from public.class_quiz_attempts
    where quiz_id = p_quiz_id and user_id = auth.uid()
  ) then
    raise exception 'Kuis ini sudah pernah dikumpulkan dan tidak dapat dikerjakan ulang';
  end if;

  select count(*) into v_bad
  from jsonb_each_text(p_answers) e
  where e.value !~ '^[0-9]+$';
  if v_bad > 0 then raise exception 'Format jawaban tidak valid'; end if;

  select count(*),
         count(*) filter (
           where case
             when (p_answers ->> id::text) ~ '^[0-9]+$'
             then (p_answers ->> id::text)::int
             else -1
           end = correct_index
         )
    into v_total, v_correct
  from public.class_quiz_questions
  where quiz_id = p_quiz_id;

  if v_total = 0 then raise exception 'Quiz belum memiliki soal'; end if;
  if jsonb_object_length(p_answers) <> v_total then
    raise exception 'Semua soal wajib dijawab';
  end if;

  v_score := round((v_correct::numeric / v_total::numeric) * 100, 2);

  begin
    insert into public.class_quiz_attempts(
      quiz_id, user_id, answers, score, correct_count, total_questions
    )
    values(p_quiz_id, auth.uid(), p_answers, v_score, v_correct, v_total)
    returning id into v_id;
  exception when unique_violation then
    raise exception 'Kuis ini sudah pernah dikumpulkan dan tidak dapat dikerjakan ulang';
  end;

  return query select v_id, v_score, v_correct, v_total;
end
$function$;
