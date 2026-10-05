-- Struktur Kanji: bushu, komponen, dan keluarga bushu.
-- Sumber data: KanjiVG (Ulrich Apel, CC BY-SA 3.0) untuk bushu/komponen per kanji, dan Kanji alive
-- japanese-radicals.csv (CC BY 4.0) untuk nama/arti bushu. Tabel hanya berisi data terverifikasi dari
-- sumber tersebut; kanji tanpa data sumber dibiarkan tanpa baris (tidak ditebak).

create table if not exists public.kanji_radicals (
  base_char text primary key,
  name_ja text not null,
  meaning_en text not null,
  meaning_id text not null,
  source text not null default 'Kanji alive japanese-radicals (CC BY 4.0); terjemahan Indonesia: ENO NIHONGO'
);

create table if not exists public.kanji_radical_forms (
  form_char text primary key,
  base_char text not null references public.kanji_radicals(base_char),
  is_variant boolean not null
);

create table if not exists public.kanji_radical_names (
  base_char text not null references public.kanji_radicals(base_char),
  position_class text not null check (position_class in ('へん','つくり','かんむり','あし','かまえ','たれ','にょう')),
  name_ja text not null,
  primary key (base_char, position_class)
);

create table if not exists public.kanji_structure (
  kanji_id uuid primary key references public.kanji(id) on delete cascade,
  radical_form text not null references public.kanji_radical_forms(form_char),
  radical_base text not null references public.kanji_radicals(base_char),
  radical_position text check (radical_position in ('へん','つくり','かんむり','あし','かまえ','たれ','にょう')),
  radical_rule text not null check (radical_rule in ('general','tradit')),
  components text[] not null default '{}',
  decomposition jsonb not null default '[]'::jsonb check (jsonb_typeof(decomposition) = 'array'),
  needs_review boolean not null default false,
  source text not null default 'KanjiVG (CC BY-SA 3.0)',
  created_at timestamptz not null default now()
);
create index if not exists kanji_structure_radical_base_idx on public.kanji_structure (radical_base);

alter table public.kanji_radicals enable row level security;
alter table public.kanji_radical_forms enable row level security;
alter table public.kanji_radical_names enable row level security;
alter table public.kanji_structure enable row level security;

drop policy if exists kanji_radicals_read on public.kanji_radicals;
create policy kanji_radicals_read on public.kanji_radicals for select to anon, authenticated using (true);
drop policy if exists kanji_radical_forms_read on public.kanji_radical_forms;
create policy kanji_radical_forms_read on public.kanji_radical_forms for select to anon, authenticated using (true);
drop policy if exists kanji_radical_names_read on public.kanji_radical_names;
create policy kanji_radical_names_read on public.kanji_radical_names for select to anon, authenticated using (true);
drop policy if exists kanji_structure_read on public.kanji_structure;
create policy kanji_structure_read on public.kanji_structure for select to anon, authenticated
  using (exists (select 1 from public.kanji k where k.id = kanji_id and k.is_published));

revoke all on public.kanji_radicals, public.kanji_radical_forms, public.kanji_radical_names, public.kanji_structure from public, anon, authenticated;
grant select on public.kanji_radicals, public.kanji_radical_forms, public.kanji_radical_names, public.kanji_structure to anon, authenticated;

-- Satu RPC untuk detail kanji: bushu, komponen (dengan tautan hanya bila kanji tersedia), uraian, dan keluarga bushu.
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
      'rule', s.radical_rule
    ) as j
    from s
    join public.kanji_radicals r on r.base_char = s.radical_base
    join public.kanji_radical_forms f on f.form_char = s.radical_form
    left join public.kanji_radical_names n on n.base_char = s.radical_base and n.position_class = s.radical_position
  ),
  comps as (
    select coalesce(jsonb_agg(jsonb_build_object('c', c.ch, 'kanji_id', kk.id) order by c.ord), '[]'::jsonb) as j
    from s
    cross join lateral unnest(s.components) with ordinality as c(ch, ord)
    left join public.kanji kk on kk."character" = c.ch and kk.is_published
  ),
  fam as (
    select k2.id, k2."character" as ch, k2.meaning_id, k2.level,
           k2.kunyomi[1] as kun, k2.onyomi[1] as on_
    from s
    join public.kanji_structure s2 on s2.radical_base = s.radical_base and s2.kanji_id <> s.kanji_id
    join public.kanji k2 on k2.id = s2.kanji_id and k2.is_published
    left join public.user_item_progress up
      on up.user_id = (select auth.uid()) and up.item_type = 'kanji' and up.item_id = k2.id
         and up.status in ('learning', 'review', 'mastered')
    order by (k2.level = coalesce(p_level, s.k_level)) desc,
             (up.item_id is not null) desc,
             abs(array_position(array['N5','N4','N3','N2','N1'], k2.level::text)
                 - array_position(array['N5','N4','N3','N2','N1'], coalesce(p_level, s.k_level)::text)),
             k2.sort_order, k2."character"
    limit 12
  )
  select case when exists (select 1 from s) then jsonb_build_object(
    'radical', (select j from rad),
    'components', (select j from comps),
    'decomposition', (select decomposition from s),
    'needs_review', (select needs_review from s),
    'family', (select coalesce(jsonb_agg(jsonb_build_object('id', id, 'character', ch, 'meaning_id', meaning_id, 'kunyomi', kun, 'onyomi', on_)), '[]'::jsonb) from fam),
    'family_total', (select count(*) from s join public.kanji_structure s2 on s2.radical_base = s.radical_base and s2.kanji_id <> s.kanji_id join public.kanji k2 on k2.id = s2.kanji_id and k2.is_published)
  ) end;
$$;

revoke all on function public.get_kanji_structure(uuid, public.jlpt_level) from public, anon;
grant execute on function public.get_kanji_structure(uuid, public.jlpt_level) to authenticated, service_role;
