alter table public.jlpt_simulation_audio_source_map
  add column if not exists structure_verified boolean not null default false,
  add column if not exists source_pdf_file_id text,
  add column if not exists verified_at timestamptz;

comment on column public.jlpt_simulation_audio_source_map.structure_verified is 'True when filename/folder structure has been verified against the source JLPT material organization; does not mean semantic audio/question alignment is complete.';
