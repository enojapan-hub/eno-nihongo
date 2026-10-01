alter table public.jlpt_simulation_questions add column if not exists image_url text;

drop view if exists public.jlpt_simulation_questions_public;
create view public.jlpt_simulation_questions_public as
select id, level, section, mondai_no, question_no, question_type, instruction_jp, prompt_jp, choices, passage_title, passage_jp, audio_url, transcript_jp, image_url
from public.jlpt_simulation_questions
where is_published = true;

grant select on public.jlpt_simulation_questions_public to authenticated;
