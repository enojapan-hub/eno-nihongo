-- Keep the repository schema aligned with the live JLPT audio mapping work.
-- Drive-backed questions remain unpublished until the audio proxy is deployed.

alter table public.jlpt_simulation_questions
  drop constraint if exists jlpt_simulation_questions_source_kind_check;

alter table public.jlpt_simulation_questions
  add constraint jlpt_simulation_questions_source_kind_check
  check (source_kind in ('eno_original', 'drive_reference'));

alter table public.jlpt_simulation_audio_source_map
  add column if not exists simulation_question_id uuid
    references public.jlpt_simulation_questions(id) on delete set null,
  add column if not exists delivery_path text;

create unique index if not exists jlpt_audio_source_map_sim_question_uidx
  on public.jlpt_simulation_audio_source_map(simulation_question_id)
  where simulation_question_id is not null;
