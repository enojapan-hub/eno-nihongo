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
  unique(level, file_name)
);
alter table public.jlpt_simulation_audio_source_map enable row level security;
