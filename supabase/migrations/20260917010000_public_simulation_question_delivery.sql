-- Deliver only published question fields needed by the browser.
-- Correct answers and editorial fields remain private in the source table.
create or replace function public.get_published_simulation_questions(
  p_level text,
  p_section text
)
returns table (
  id uuid,
  mondai_no integer,
  question_no integer,
  display_question_no integer,
  question_type text,
  instruction_jp text,
  prompt_jp text,
  choices jsonb,
  passage_title text,
  passage_jp text,
  audio_url text,
  image_url text,
  transcript_jp text
)
language sql
security definer
set search_path = pg_catalog, public
stable
as $$
  select q.id, q.mondai_no, q.question_no, q.display_question_no,
    q.question_type, q.instruction_jp, q.prompt_jp, q.choices,
    q.passage_title, q.passage_jp, q.audio_url, q.image_url, q.transcript_jp
  from public.jlpt_simulation_questions q
  where q.is_published = true and q.level = p_level and q.section = p_section
  order by q.mondai_no, q.question_no;
$$;

revoke all on function public.get_published_simulation_questions(text, text) from public;
grant execute on function public.get_published_simulation_questions(text, text) to authenticated;
