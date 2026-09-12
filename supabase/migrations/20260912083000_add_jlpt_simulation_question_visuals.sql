alter table public.jlpt_simulation_questions
  add column if not exists image_url text;

alter table public.jlpt_simulation_questions
  add column if not exists display_question_no smallint;

drop view if exists public.jlpt_simulation_questions_public;
create view public.jlpt_simulation_questions_public as
select
  id,
  level,
  section,
  mondai_no,
  question_no,
  display_question_no,
  question_type,
  instruction_jp,
  prompt_jp,
  choices,
  passage_title,
  passage_jp,
  audio_url,
  image_url,
  transcript_jp
from public.jlpt_simulation_questions
where is_published = true;

grant select on public.jlpt_simulation_questions_public to authenticated;
