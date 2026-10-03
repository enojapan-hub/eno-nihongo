-- Chōkai simulasi dengan satu audio penuh: peta audio per ujian + timeline soal.
-- Aditif dan backward-compatible: baris lama otomatis exam_no = 1 dan timeline NULL
-- (tetap memakai pemutar lama). Tidak mengubah RLS: tabel hanya dibaca server (service role).
alter table public.jlpt_simulation_audio_source_map
  add column if not exists exam_no integer not null default 1,
  add column if not exists question_timeline jsonb;

alter table public.jlpt_simulation_audio_source_map
  drop constraint if exists jlpt_audio_source_map_timeline_is_array;
alter table public.jlpt_simulation_audio_source_map
  add constraint jlpt_audio_source_map_timeline_is_array
  check (question_timeline is null or jsonb_typeof(question_timeline) = 'array');

comment on column public.jlpt_simulation_audio_source_map.exam_no is
  'Nomor paket simulasi (jlpt_simulation_questions.exam_no) yang memakai audio ini.';
comment on column public.jlpt_simulation_audio_source_map.question_timeline is
  'Hanya untuk mapping_scope=session: [{"q":1,"start":12.4,"end":58.0},...]; q = urutan soal listening (1-based), detik dari awal audio. Isi hanya dari analisis audio yang sudah diverifikasi.';
