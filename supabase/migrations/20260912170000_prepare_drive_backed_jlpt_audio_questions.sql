-- Keep the repository schema aligned with the live JLPT audio mapping work.
-- Drive-backed questions remain unpublished until the audio proxy is deployed.

create table if not exists public.jlpt_simulation_audio_source_map (
  id uuid primary key default gen_random_uuid(),
  level text not null check (level in ('N5','N4','N3','N2','N1')),
  mondai_no smallint,
  question_no smallint,
  file_name text not null,
  drive_file_id text not null,
  drive_url text not null,
  mapping_scope text not null check (mapping_scope in ('question','mondai','session')),
  status text not null default 'inventory' check (status in ('inventory','needs_alignment','aligned','ready')),
  notes text,
  created_at timestamptz not null default now(),
  structure_verified boolean not null default false,
  source_pdf_file_id text,
  verified_at timestamptz,
  source_choices jsonb,
  source_correct_index smallint,
  source_key_verified boolean not null default false,
  source_key_reference text,
  is_scored boolean not null default true,
  source_format text,
  simulation_question_id uuid references public.jlpt_simulation_questions(id) on delete set null,
  delivery_path text,
  unique(level, file_name)
);

alter table public.jlpt_simulation_audio_source_map
  add column if not exists structure_verified boolean not null default false,
  add column if not exists source_pdf_file_id text,
  add column if not exists verified_at timestamptz,
  add column if not exists source_choices jsonb,
  add column if not exists source_correct_index smallint,
  add column if not exists source_key_verified boolean not null default false,
  add column if not exists source_key_reference text,
  add column if not exists is_scored boolean not null default true,
  add column if not exists source_format text,
  add column if not exists simulation_question_id uuid references public.jlpt_simulation_questions(id) on delete set null,
  add column if not exists delivery_path text;

alter table public.jlpt_simulation_questions
  drop constraint if exists jlpt_simulation_questions_source_kind_check;

alter table public.jlpt_simulation_questions
  add constraint jlpt_simulation_questions_source_kind_check
  check (source_kind in ('eno_original', 'drive_reference'));

create unique index if not exists jlpt_audio_source_map_level_file_uidx
  on public.jlpt_simulation_audio_source_map(level, file_name);

create unique index if not exists jlpt_audio_source_map_sim_question_uidx
  on public.jlpt_simulation_audio_source_map(simulation_question_id)
  where simulation_question_id is not null;

alter table public.jlpt_simulation_audio_source_map enable row level security;
