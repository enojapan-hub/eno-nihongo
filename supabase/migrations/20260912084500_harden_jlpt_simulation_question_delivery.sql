-- Keep JLPT simulation answer keys server-side.
-- Authenticated clients read questions through jlpt_simulation_questions_public.

create or replace view public.jlpt_simulation_questions_public
with (security_invoker = true)
as
select
  id,
  level,
  section,
  mondai_no,
  question_no,
  question_type,
  instruction_jp,
  prompt_jp,
  choices,
  passage_title,
  passage_jp,
  audio_url,
  transcript_jp
from public.jlpt_simulation_questions
where is_published = true;

revoke all on public.jlpt_simulation_questions from anon, authenticated;
grant select on public.jlpt_simulation_questions_public to authenticated;
revoke all on public.jlpt_simulation_questions_public from anon;
