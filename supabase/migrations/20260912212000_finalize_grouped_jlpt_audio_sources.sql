-- Record verified grouped Choukai delivery sources for levels whose source audio
-- is packaged per mondai (N1) or per listening session (N3/N5).
-- No questions are published by this migration.

update public.jlpt_simulation_audio_source_map
set structure_verified = true,
    status = 'aligned',
    delivery_path = '/api/jlpt-audio?id=' || id::text,
    verified_at = coalesce(verified_at, now())
where level in ('N1', 'N3', 'N5')
  and mapping_scope in ('mondai', 'session');

-- Correct the audited star-position key for the N3 sentence-composition item.
update public.jlpt_simulation_questions
set correct_index = 1
where level = 'N3'
  and section = 'grammar'
  and mondai_no = 2
  and question_no = 4
  and source_kind = 'eno_original';
