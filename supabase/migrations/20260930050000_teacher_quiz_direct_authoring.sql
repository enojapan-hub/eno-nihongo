-- Create a quiz and its first multiple-choice question atomically.
-- This keeps the teacher flow on one screen and avoids orphan quiz drafts if question creation fails.
create or replace function public.teacher_create_quiz_with_first_question(
  p_class_id uuid,
  p_title text,
  p_description text,
  p_due_at timestamptz,
  p_duration_minutes integer,
  p_question text,
  p_choices jsonb,
  p_correct_index integer,
  p_explanation text,
  p_category text,
  p_topic text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  qid uuid;
begin
  if auth.uid() is null or not public.can_manage_class(p_class_id) then
    raise exception 'Akses guru diperlukan';
  end if;
  if nullif(btrim(p_title), '') is null then
    raise exception 'Judul kuis wajib diisi';
  end if;
  if p_duration_minutes is not null and (p_duration_minutes < 1 or p_duration_minutes > 480) then
    raise exception 'Durasi kuis harus 1–480 menit';
  end if;
  if nullif(btrim(p_question), '') is null then
    raise exception 'Pertanyaan pertama wajib diisi';
  end if;
  if jsonb_typeof(p_choices) <> 'array'
     or jsonb_array_length(p_choices) < 2
     or exists (
       select 1 from jsonb_array_elements_text(p_choices) choice
       where nullif(btrim(choice), '') is null
     )
     or p_correct_index < 0
     or p_correct_index >= jsonb_array_length(p_choices) then
    raise exception 'Isi semua pilihan dan tandai satu jawaban benar';
  end if;

  insert into public.class_quizzes(class_id,title,description,due_at,duration_minutes,is_published)
  values(p_class_id,btrim(p_title),p_description,p_due_at,p_duration_minutes,false)
  returning id into qid;

  insert into public.class_quiz_questions(
    quiz_id,question,choices,correct_index,explanation,category,topic,sort_order
  )
  values(
    qid,btrim(p_question),p_choices,p_correct_index,nullif(btrim(p_explanation),''),
    coalesce(nullif(btrim(p_category),''),'Umum'),nullif(btrim(p_topic),''),0
  );

  return qid;
end
$$;

revoke all on function public.teacher_create_quiz_with_first_question(uuid,text,text,timestamptz,integer,text,jsonb,integer,text,text,text) from public, anon;
grant execute on function public.teacher_create_quiz_with_first_question(uuid,text,text,timestamptz,integer,text,jsonb,integer,text,text,text) to authenticated;
