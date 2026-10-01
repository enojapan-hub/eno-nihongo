alter table public.jlpt_simulation_audio_source_map
  add column if not exists source_choices jsonb,
  add column if not exists source_correct_index smallint,
  add column if not exists source_key_verified boolean not null default false,
  add column if not exists source_key_reference text,
  add column if not exists is_scored boolean not null default true,
  add column if not exists source_format text;

alter table public.jlpt_simulation_audio_source_map
  drop constraint if exists jlpt_simulation_audio_source_map_source_correct_index_check;
alter table public.jlpt_simulation_audio_source_map
  add constraint jlpt_simulation_audio_source_map_source_correct_index_check
  check (source_correct_index is null or source_correct_index between 0 and 3);

comment on column public.jlpt_simulation_audio_source_map.source_choices is 'Choices printed in the source booklet; null when choices are audio-only or image-based.';
comment on column public.jlpt_simulation_audio_source_map.source_correct_index is 'Zero-based answer key from a verified external/source answer key.';
comment on column public.jlpt_simulation_audio_source_map.source_key_verified is 'True only after the answer key has been cross-checked against a source answer sheet.';
comment on column public.jlpt_simulation_audio_source_map.is_scored is 'False for instruction/example audio that is not a scored exam item.';
