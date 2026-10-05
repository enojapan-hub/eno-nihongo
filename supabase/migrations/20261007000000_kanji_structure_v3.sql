-- Struktur Kanji v3: keluarga bushu mengembalikan semua anggota (UI menampilkan 6 dulu lalu "Lihat semua"),
-- dan radical_variants (bentuk bushu lain dari bushu kanji ini). Kunci lama dipertahankan; satu RPC per detail.
-- Anggota keluarga ditentukan oleh bushu dasar (kanji_radical_forms -> kanji_radicals), jadi varian seperti 氵/水 sudah satu keluarga.

create or replace function public.get_kanji_structure(p_kanji_id uuid, p_level public.jlpt_level default null)
returns jsonb
language sql
stable
set search_path = ''
as $$
  with s as (
    select ks.*, k.level as k_level
    from public.kanji_structure ks
    join public.kanji k on k.id = ks.kanji_id and k.is_published
    where ks.kanji_id = p_kanji_id
  ),
  rad as (
    select jsonb_build_object(
      'form', s.radical_form,
      'base', s.radical_base,
      'is_variant', f.is_variant,
      'position', s.radical_position,
      'name_ja', coalesce(n.name_ja, r.name_ja),
      'base_name_ja', r.name_ja,
      'meaning_id', r.meaning_id,
      'meaning_en', r.meaning_en,
      'rule', s.radical_rule,
      'status', s.radical_status,
      'kd2', case when kb.base_char is not null then jsonb_build_object(
        'base', kb.base_char, 'name_ja', kb.name_ja, 'meaning_id', kb.meaning_id) end
    ) as j
    from s
    join public.kanji_radicals r on r.base_char = s.radical_base
    join public.kanji_radical_forms f on f.form_char = s.radical_form
    left join public.kanji_radical_names n on n.base_char = s.radical_base and n.position_class = s.radical_position
    left join public.kanji_radicals kb on kb.base_char = s.radical_kd2_base
  ),
  comps as (
    select coalesce(jsonb_agg(jsonb_build_object('c', c.ch, 'kanji_id', kk.id) order by c.ord), '[]'::jsonb) as j
    from s
    cross join lateral unnest(s.components) with ordinality as c(ch, ord)
    left join public.kanji kk on kk."character" = c.ch and kk.is_published
  ),
  nodes as (
    select c.node_id, c.parent_id, c.ord, c.depth, c.element, c.role,
           kk.id as kid, kk.meaning_id as kmean, f.base_char as fbase, r.meaning_id as rmean, bk.id as bkid
    from public.kanji_components c
    left join public.kanji kk on kk."character" = c.element and kk.is_published
    left join public.kanji_radical_forms f on f.form_char = c.element
    left join public.kanji_radicals r on r.base_char = f.base_char
    left join public.kanji bk on bk."character" = f.base_char and bk.is_published
    where c.kanji_id = p_kanji_id and exists (select 1 from s)
  ),
  tree as (
    select coalesce(jsonb_agg(jsonb_build_object(
      'id', node_id, 'parent', parent_id, 'ord', ord, 'depth', depth, 'el', element, 'role', role,
      'type', case when element like 'CDP-%' then 'nonunicode' when kid is not null then 'kanji'
                   when fbase is not null then 'radical' else 'graphic' end,
      'kanji_id', kid,
      'meaning_id', coalesce(kmean, rmean),
      'is_radical', fbase is not null,
      'base', case when fbase is not null and fbase <> element then fbase end,
      'base_kanji_id', case when fbase is not null and fbase <> element then bkid end
    ) order by node_id), '[]'::jsonb) as j
    from nodes
  ),
  fam as (
    select k2.id, k2."character" as ch, k2.meaning_id, k2.level,
           k2.kunyomi[1] as kun, k2.onyomi[1] as on_,
           row_number() over (
             order by (k2.level = coalesce(p_level, s.k_level)) desc,
                      (up.item_id is not null) desc,
                      abs(array_position(array['N5','N4','N3','N2','N1'], k2.level::text)
                          - array_position(array['N5','N4','N3','N2','N1'], coalesce(p_level, s.k_level)::text)),
                      k2.sort_order, k2."character") as rn
    from s
    join public.kanji_structure s2 on s2.radical_base = s.radical_base and s2.kanji_id <> s.kanji_id
    join public.kanji k2 on k2.id = s2.kanji_id and k2.is_published
    left join public.user_item_progress up
      on up.user_id = (select auth.uid()) and up.item_type = 'kanji' and up.item_id = k2.id
         and up.status in ('learning', 'review', 'mastered')
  ),
  pel as (
    select c.element from public.kanji_components c
    where c.kanji_id = p_kanji_id and c.role = 'phonetic' and c.depth = 1 and exists (select 1 from s)
    order by c.node_id limit 1
  ),
  pfam as (
    select k2.id, k2."character" as ch, k2.meaning_id, k2.kunyomi[1] as kun, k2.onyomi[1] as on_,
           row_number() over (
             order by (k2.level = coalesce(p_level, (select k_level from s))) desc,
                      (up.item_id is not null) desc,
                      k2.sort_order, k2."character") as rn
    from pel
    join public.kanji_components o on o.element = pel.element and o.role = 'phonetic' and o.depth = 1
         and o.kanji_id <> p_kanji_id
    join public.kanji k2 on k2.id = o.kanji_id and k2.is_published
    left join public.user_item_progress up
      on up.user_id = (select auth.uid()) and up.item_type = 'kanji' and up.item_id = k2.id
         and up.status in ('learning', 'review', 'mastered')
    order by rn
    limit 8
  )
  select case when exists (select 1 from s) then jsonb_build_object(
    'radical', (select j from rad),
    'components', (select j from comps),
    'decomposition', (select decomposition from s),
    'needs_review', (select needs_review from s),
    'radical_variants', (select coalesce(jsonb_agg(f2.form_char order by f2.form_char), '[]'::jsonb) from s join public.kanji_radical_forms f2 on f2.base_char = s.radical_base and f2.is_variant),
    'tree', (select j from tree),
    'mnemonic', (select m.body from public.kanji_mnemonics m where m.kanji_id = p_kanji_id),
    'phonetic_element', (select element from pel),
    'phonetic_family', (select coalesce(jsonb_agg(jsonb_build_object('id', id, 'character', ch, 'meaning_id', meaning_id, 'kunyomi', kun, 'onyomi', on_) order by rn), '[]'::jsonb) from pfam),
    'family', (select coalesce(jsonb_agg(jsonb_build_object('id', id, 'character', ch, 'meaning_id', meaning_id, 'kunyomi', kun, 'onyomi', on_) order by rn), '[]'::jsonb) from fam),
    'family_total', (select count(*) from s join public.kanji_structure s2 on s2.radical_base = s.radical_base and s2.kanji_id <> s.kanji_id join public.kanji k2 on k2.id = s2.kanji_id and k2.is_published)
  ) end;
$$;

revoke all on function public.get_kanji_structure(uuid, public.jlpt_level) from public, anon;
grant execute on function public.get_kanji_structure(uuid, public.jlpt_level) to authenticated, service_role;
