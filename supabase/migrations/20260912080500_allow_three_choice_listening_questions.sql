alter table public.jlpt_simulation_questions
  drop constraint if exists jlpt_simulation_questions_choices_check;

alter table public.jlpt_simulation_questions
  add constraint jlpt_simulation_questions_choices_check
  check (
    jsonb_typeof(choices) = 'array'
    and (
      (section = 'listening' and jsonb_array_length(choices) in (3, 4))
      or
      (section <> 'listening' and jsonb_array_length(choices) = 4)
    )
  );
