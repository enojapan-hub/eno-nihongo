create table if not exists public.vocabulary_batch_runs (
  id uuid primary key default gen_random_uuid(),
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  processed integer not null default 0,
  linked_existing integer not null default 0,
  inserted_new integer not null default 0,
  categorized integer not null default 0,
  verb_pairs_linked integer not null default 0,
  pending_after integer,
  status text not null default 'running',
  error_text text
);

alter table public.vocabulary_batch_runs enable row level security;

create or replace function public.process_vocabulary_source_batch(p_limit integer default 100)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  r record;
  v_id uuid;
  run_id uuid;
  n_processed integer := 0;
  n_linked integer := 0;
  n_inserted integer := 0;
  n_categorized integer := 0;
  n_pairs integer := 0;
  n_pending integer := 0;
  candidate_count integer;
  normalized_category text;
begin
  insert into public.vocabulary_batch_runs default values returning id into run_id;

  for r in
    select *
    from public.vocabulary_source_items
    where is_verified = true
      and vocabulary_id is null
      and level_hint is not null
    order by created_at, source_book, source_order, id
    limit greatest(coalesce(p_limit,100),1)
    for update skip locked
  loop
    n_processed := n_processed + 1;
    v_id := null;

    select count(*), min(v.id)
      into candidate_count, v_id
    from public.vocabulary v
    where v.level = r.level_hint
      and lower(btrim(v.term)) = lower(btrim(r.term));

    if candidate_count = 1 and v_id is not null then
      update public.vocabulary_source_items set vocabulary_id = v_id where id = r.id;
      n_linked := n_linked + 1;
    else
      v_id := gen_random_uuid();
      insert into public.vocabulary (
        id, term, reading, romaji, meaning_id, meaning_en, part_of_speech,
        examples, level, sort_order, is_published, source_book, lesson_number, lesson_title
      ) values (
        v_id,
        btrim(r.term),
        case when coalesce(r.reading,'') ~ '[ぁ-んァ-ン一-龯々]' then nullif(btrim(r.reading),'') else null end,
        case when coalesce(r.reading,'') <> '' and coalesce(r.reading,'') !~ '[ぁ-んァ-ン一-龯々]' then btrim(r.reading) else null end,
        btrim(r.meaning_id),
        null,
        nullif(btrim(r.lexical_class),''),
        '[]'::jsonb,
        r.level_hint,
        coalesce(r.source_order,0),
        true,
        r.source_book,
        null,
        null
      );
      update public.vocabulary_source_items set vocabulary_id = v_id where id = r.id;
      n_inserted := n_inserted + 1;
    end if;

    normalized_category := case
      when r.subgroup in ('kata_benda','kata_kerja','kata_sifat','kata_keterangan','angka','waktu','warna','anggota_tubuh','alat_sekolah','alat_dapur','buah_sayur','nama_hari','nama_bulan','jidoushi','tadoushi','i_keiyoushi','na_keiyoushi','ruigo') then r.subgroup
      when r.lexical_class = 'kata_benda' then 'kata_benda'
      when r.lexical_class = 'kata_kerja' then 'kata_kerja'
      when r.lexical_class = 'kata_sifat' then 'kata_sifat'
      when r.lexical_class = 'kata_keterangan' then 'kata_keterangan'
      else null
    end;

    if normalized_category is not null and exists (select 1 from public.vocabulary_categories c where c.slug = normalized_category) then
      insert into public.vocabulary_category_map(vocabulary_id, category_slug, source_book)
      values (v_id, normalized_category, r.source_book)
      on conflict do nothing;
      if found then n_categorized := n_categorized + 1; end if;
    end if;
  end loop;

  update public.verb_pairs vp
  set intransitive_vocabulary_id = v.id
  from lateral (
    select vv.id
    from public.vocabulary vv
    where lower(btrim(vv.term)) = lower(btrim(vp.intransitive_term))
      and vv.is_published = true
    order by case vv.level when 'N5' then 1 when 'N4' then 2 when 'N3' then 3 when 'N2' then 4 else 5 end, vv.created_at
    limit 1
  ) v
  where vp.intransitive_vocabulary_id is null;
  get diagnostics n_pairs = row_count;

  update public.verb_pairs vp
  set transitive_vocabulary_id = v.id
  from lateral (
    select vv.id
    from public.vocabulary vv
    where lower(btrim(vv.term)) = lower(btrim(vp.transitive_term))
      and vv.is_published = true
    order by case vv.level when 'N5' then 1 when 'N4' then 2 when 'N3' then 3 when 'N2' then 4 else 5 end, vv.created_at
    limit 1
  ) v
  where vp.transitive_vocabulary_id is null;
  get diagnostics candidate_count = row_count;
  n_pairs := n_pairs + candidate_count;

  select count(*) into n_pending
  from public.vocabulary_source_items
  where is_verified = true and vocabulary_id is null and level_hint is not null;

  update public.vocabulary_batch_runs
  set finished_at = now(), processed = n_processed, linked_existing = n_linked,
      inserted_new = n_inserted, categorized = n_categorized,
      verb_pairs_linked = n_pairs, pending_after = n_pending,
      status = case when n_pending = 0 then 'complete' else 'partial' end
  where id = run_id;

  return jsonb_build_object(
    'run_id', run_id,
    'processed', n_processed,
    'linked_existing', n_linked,
    'inserted_new', n_inserted,
    'categorized', n_categorized,
    'verb_pairs_linked', n_pairs,
    'pending_after', n_pending
  );
exception when others then
  update public.vocabulary_batch_runs
  set finished_at = now(), status='error', error_text=sqlerrm
  where id = run_id;
  raise;
end;
$$;

revoke all on function public.process_vocabulary_source_batch(integer) from public, anon, authenticated;
grant execute on function public.process_vocabulary_source_batch(integer) to postgres, service_role;

-- pg_cron is optional on isolated local test databases.
DO $$
DECLARE
  v_jobid bigint;
BEGIN
  IF to_regclass('cron.job') IS NULL
     OR to_regprocedure('cron.schedule(text,text,text)') IS NULL
     OR to_regprocedure('cron.unschedule(bigint)') IS NULL THEN
    RETURN;
  END IF;
  FOR v_jobid IN
    SELECT jobid FROM cron.job WHERE jobname = 'eno_vocabulary_source_worker'
  LOOP
    PERFORM cron.unschedule(v_jobid);
  END LOOP;
  PERFORM cron.schedule(
    'eno_vocabulary_source_worker',
    '*/5 * * * *',
    'select public.process_vocabulary_source_batch(100);'
  );
END;
$$;
