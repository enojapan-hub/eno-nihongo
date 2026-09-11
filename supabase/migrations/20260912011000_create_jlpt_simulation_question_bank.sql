create table if not exists public.jlpt_simulation_questions (
 id uuid primary key default gen_random_uuid(),
 level text not null check (level in ('N5','N4','N3','N2','N1')),
 section text not null check (section in ('vocabulary','grammar','reading','listening')),
 mondai_no smallint not null check (mondai_no > 0),
 question_no smallint not null check (question_no > 0),
 question_type text not null,
 instruction_jp text not null,
 prompt_jp text not null,
 choices jsonb not null check (jsonb_typeof(choices)='array' and jsonb_array_length(choices)=4),
 correct_index smallint not null check (correct_index between 0 and 3),
 passage_title text,
 passage_jp text,
 audio_url text,
 transcript_jp text,
 source_kind text not null default 'eno_original' check (source_kind='eno_original'),
 is_published boolean not null default false,
 created_at timestamptz not null default now(),
 unique(level,section,mondai_no,question_no)
);
alter table public.jlpt_simulation_questions enable row level security;
drop policy if exists "published simulation questions readable" on public.jlpt_simulation_questions;
create policy "published simulation questions readable" on public.jlpt_simulation_questions for select to authenticated using (is_published=true);
revoke insert, update, delete on public.jlpt_simulation_questions from anon, authenticated;
grant select on public.jlpt_simulation_questions to authenticated;
create index if not exists jlpt_simulation_questions_lookup_idx on public.jlpt_simulation_questions(level,section,mondai_no,question_no) where is_published=true;