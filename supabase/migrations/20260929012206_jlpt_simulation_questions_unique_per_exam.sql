-- Question numbering is unique per exam, not per level.
alter table public.jlpt_simulation_questions
  drop constraint if exists jlpt_simulation_questions_level_section_mondai_no_question__key;
alter table public.jlpt_simulation_questions
  add constraint jlpt_simulation_questions_level_exam_section_mondai_question_key
  unique (level, exam_no, section, mondai_no, question_no);
alter table public.jlpt_simulation_questions
  drop constraint if exists jlpt_simulation_questions_exam_no_check;
alter table public.jlpt_simulation_questions
  add constraint jlpt_simulation_questions_exam_no_check check (exam_no between 1 and 5);
