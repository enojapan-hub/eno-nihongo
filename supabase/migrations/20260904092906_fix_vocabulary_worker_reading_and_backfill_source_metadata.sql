create or replace function public.process_vocabulary_source_batch(p_limit integer default 100)
returns jsonb
language plpgsql
security definer
set search_path to 'pg_catalog','public'
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

    select count(*) into candidate_count
    from public.vocabulary v
    where v.level = r.level_hint
      and lower(btrim(v.term)) = lower(btrim(r.term));

    if candidate_count = 1 then
      select v.id into v_id
      from public.vocabulary v
      where v.level = r.level_hint
        and lower(btrim(v.term)) = lower(btrim(r.term))
      limit 1;
      update public.vocabulary_source_items set vocabulary_id = v_id where id = r.id;
      update public.vocabulary v
      set reading = coalesce(v.reading, case when coalesce(r.reading,'') ~ '[ぁ-んァ-ン一-龯々]' then nullif(btrim(r.reading),'') end),
          romaji = coalesce(v.romaji, case when coalesce(r.reading,'') <> '' and coalesce(r.reading,'') !~ '[ぁ-んァ-ン一-龯々]' then btrim(r.reading) end),
          meaning_id = case when coalesce(btrim(v.meaning_id),'') = '' then btrim(r.meaning_id) else v.meaning_id end
      where v.id = v_id;
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
        r.lesson_number,
        r.lesson_title
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
  set intransitive_vocabulary_id = (
    select vv.id from public.vocabulary vv
    where lower(btrim(vv.term)) = lower(btrim(vp.intransitive_term)) and vv.is_published = true
    order by case vv.level when 'N5' then 1 when 'N4' then 2 when 'N3' then 3 when 'N2' then 4 else 5 end, vv.created_at limit 1
  )
  where vp.intransitive_vocabulary_id is null
    and exists (select 1 from public.vocabulary vv where lower(btrim(vv.term)) = lower(btrim(vp.intransitive_term)) and vv.is_published = true);
  get diagnostics n_pairs = row_count;

  update public.verb_pairs vp
  set transitive_vocabulary_id = (
    select vv.id from public.vocabulary vv
    where lower(btrim(vv.term)) = lower(btrim(vp.transitive_term)) and vv.is_published = true
    order by case vv.level when 'N5' then 1 when 'N4' then 2 when 'N3' then 3 when 'N2' then 4 else 5 end, vv.created_at limit 1
  )
  where vp.transitive_vocabulary_id is null
    and exists (select 1 from public.vocabulary vv where lower(btrim(vv.term)) = lower(btrim(vp.transitive_term)) and vv.is_published = true);
  get diagnostics candidate_count = row_count;
  n_pairs := n_pairs + candidate_count;

  select count(*) into n_pending from public.vocabulary_source_items where is_verified = true and vocabulary_id is null and level_hint is not null;
  update public.vocabulary_batch_runs
  set finished_at=now(), processed=n_processed, linked_existing=n_linked, inserted_new=n_inserted,
      categorized=n_categorized, verb_pairs_linked=n_pairs, pending_after=n_pending,
      status=case when n_pending=0 then 'complete' else 'partial' end
  where id=run_id;

  return jsonb_build_object('run_id',run_id,'processed',n_processed,'linked_existing',n_linked,'inserted_new',n_inserted,'categorized',n_categorized,'verb_pairs_linked',n_pairs,'pending_after',n_pending);
exception when others then
  update public.vocabulary_batch_runs set finished_at=now(), status='error', error_text=sqlerrm where id=run_id;
  raise;
end;
$$;

update public.vocabulary v
set reading = s.reading
from public.vocabulary_source_items s
where s.vocabulary_id = v.id
  and v.reading is null
  and coalesce(s.reading,'') ~ '[ぁ-んァ-ン一-龯々]';

insert into public.vocabulary_category_map(vocabulary_id, category_slug, source_book)
select distinct s.vocabulary_id, s.subgroup, s.source_book
from public.vocabulary_source_items s
join public.vocabulary_categories c on c.slug=s.subgroup
where s.vocabulary_id is not null and s.subgroup is not null
on conflict do nothing;
