-- Post-deploy switch for N3/N5 source-backed listening banks.
-- Run ONLY after the production /api/jlpt-image endpoint has been verified
-- for the N3/N5 Drive image IDs added by PR #7.
-- This file is intentionally outside supabase/migrations so merging source code
-- does not automatically publish staged questions before runtime verification.

begin;

-- Safety assertions: expected staged source bank sizes and no malformed rows.
do $$
declare
  n3_count integer;
  n5_count integer;
  bad_rows integer;
begin
  select count(*) into n3_count
  from public.jlpt_simulation_questions
  where level='N3' and section='listening' and source_kind='drive_reference';

  select count(*) into n5_count
  from public.jlpt_simulation_questions
  where level='N5' and section='listening' and source_kind='drive_reference';

  select count(*) into bad_rows
  from public.jlpt_simulation_questions
  where level in ('N3','N5')
    and section='listening'
    and source_kind='drive_reference'
    and (
      prompt_jp is null
      or btrim(prompt_jp)=''
      or jsonb_array_length(choices) not in (3,4)
      or correct_index < 0
      or correct_index >= jsonb_array_length(choices)
    );

  if n3_count <> 28 then
    raise exception 'Refusing switch: expected 28 N3 source listening rows, found %', n3_count;
  end if;
  if n5_count <> 24 then
    raise exception 'Refusing switch: expected 24 N5 source listening rows, found %', n5_count;
  end if;
  if bad_rows <> 0 then
    raise exception 'Refusing switch: found % malformed N3/N5 source listening rows', bad_rows;
  end if;
end $$;

-- Remove the old ENO listening bank from the public view without deleting it.
update public.jlpt_simulation_questions
set is_published = false
where level in ('N3','N5')
  and section='listening'
  and source_kind='eno_original';

-- Publish the verified source-backed bank.
update public.jlpt_simulation_questions
set is_published = true
where level in ('N3','N5')
  and section='listening'
  and source_kind='drive_reference';

-- Mark the grouped audio sources ready only after the bank switch.
update public.jlpt_simulation_audio_source_map
set status='ready', verified_at=coalesce(verified_at, now())
where level in ('N3','N5')
  and mapping_scope='session'
  and structure_verified=true
  and status in ('aligned','ready');

commit;

-- Expected published counts after execution:
-- N3 listening = 28 drive_reference, 0 eno_original
-- N5 listening = 24 drive_reference, 0 eno_original
