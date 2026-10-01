create table if not exists public.vocabulary_source_items (
  id uuid primary key default gen_random_uuid(),
  vocabulary_id uuid references public.vocabulary(id) on delete set null,
  term text not null,
  reading text,
  meaning_id text not null,
  lexical_class text,
  subgroup text,
  source_book text not null,
  source_order integer,
  level_hint public.jlpt_level,
  is_verified boolean not null default false,
  created_at timestamptz not null default now(),
  unique (source_book, source_order, term)
);
create index if not exists vocabulary_source_items_term_idx on public.vocabulary_source_items(term);
create index if not exists vocabulary_source_items_source_idx on public.vocabulary_source_items(source_book, source_order);
