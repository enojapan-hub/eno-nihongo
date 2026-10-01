create or replace function public.link_unleveled_vocabulary_sources(p_limit integer default 200)
returns jsonb
language plpgsql
security definer
set search_path to 'pg_catalog','public'
as $function$
declare
  r record;
  v_id uuid;
  n_processed integer := 0;
  n_linked integer := 0;
  n_categorized integer := 0;
  n_pending integer := 0;
  candidate_count integer;
begin
  for r in
    select *
    from public.vocabulary_source_items
    where is_verified = true
      and vocabulary_id is null
      and level_hint is null
    order by created_at, source_book, source_order, id
    limit greatest(coalesce(p_limit,200),1)
    for update skip locked
  loop
    n_processed := n_processed + 1;
    v_id := null;

    select count(*) into candidate_count
    from public.vocabulary v
    where lower(btrim(v.term)) = lower(btrim(r.term))
      and (
        nullif(btrim(coalesce(r.reading,'')),'') is null
        or nullif(btrim(coalesce(v.reading,'')),'') is null
        or lower(btrim(v.reading)) = lower(btrim(r.reading))
      );

    if candidate_count = 1 then
      select v.id into v_id
      from public.vocabulary v
      where lower(btrim(v.term)) = lower(btrim(r.term))
        and (
          nullif(btrim(coalesce(r.reading,'')),'') is null
          or nullif(btrim(coalesce(v.reading,'')),'') is null
          or lower(btrim(v.reading)) = lower(btrim(r.reading))
        )
      limit 1;

      update public.vocabulary_source_items
      set vocabulary_id = v_id
      where id = r.id;
      n_linked := n_linked + 1;

      if r.subgroup is not null
         and exists (select 1 from public.vocabulary_categories c where c.slug = r.subgroup) then
        insert into public.vocabulary_category_map(vocabulary_id, category_slug, source_book)
        values (v_id, r.subgroup, r.source_book)
        on conflict do nothing;
        if found then n_categorized := n_categorized + 1; end if;
      end if;
    end if;
  end loop;

  select count(*) into n_pending
  from public.vocabulary_source_items
  where is_verified = true and vocabulary_id is null and level_hint is null;

  return jsonb_build_object(
    'processed',n_processed,
    'linked_existing',n_linked,
    'categorized',n_categorized,
    'pending_after',n_pending
  );
end;
$function$;

revoke execute on function public.link_unleveled_vocabulary_sources(integer) from public, anon;
grant execute on function public.link_unleveled_vocabulary_sources(integer) to authenticated;
