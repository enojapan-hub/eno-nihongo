create table if not exists public.verb_forms (
  id uuid primary key default gen_random_uuid(),
  vocabulary_id uuid not null references public.vocabulary(id) on delete cascade,
  form_code text not null,
  form_ja text,
  form_id text,
  value text not null,
  reading text,
  politeness text,
  polarity text,
  tense text,
  voice text,
  source_book text,
  source_reference text,
  provenance text not null default 'source_explicit',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(vocabulary_id, form_code, value)
);

create index if not exists verb_forms_vocabulary_idx on public.verb_forms(vocabulary_id);
create index if not exists verb_forms_code_idx on public.verb_forms(form_code);

create table if not exists public.grammar_form_requirements (
  id uuid primary key default gen_random_uuid(),
  grammar_id uuid not null references public.grammar_points(id) on delete cascade,
  slot_order integer not null default 1,
  word_class text,
  required_form_code text,
  connector text,
  raw_formula text,
  notes_id text,
  source_book text,
  source_reference text,
  provenance text not null default 'source_explicit',
  created_at timestamptz not null default now(),
  unique(grammar_id, slot_order, required_form_code, connector)
);

create index if not exists grammar_form_requirements_grammar_idx on public.grammar_form_requirements(grammar_id);
create index if not exists grammar_form_requirements_form_idx on public.grammar_form_requirements(required_form_code);

create table if not exists public.verb_form_types (
  form_code text primary key,
  label_ja text not null,
  label_id text not null,
  category text not null default 'conjugation',
  sort_order integer not null,
  is_active boolean not null default true
);

insert into public.verb_form_types(form_code,label_ja,label_id,category,sort_order) values
('dictionary','辞書形','Bentuk Kamus','conjugation',10),
('masu','ます形','Bentuk Masu','conjugation',20),
('te','て形','Bentuk Te','conjugation',30),
('ta','た形','Bentuk Ta','conjugation',40),
('nai','ない形','Bentuk Nai / Negatif Biasa','conjugation',50),
('plain_past_negative','なかった形','Bentuk Negatif Lampau Biasa','conjugation',60),
('masu_negative','ません形','Bentuk Negatif Sopan','conjugation',70),
('masu_past','ました形','Bentuk Lampau Sopan','conjugation',80),
('masu_past_negative','ませんでした形','Bentuk Negatif Lampau Sopan','conjugation',90),
('potential','可能形','Bentuk Potensial / Kebisaan','conjugation',100)
on conflict(form_code) do update set label_ja=excluded.label_ja,label_id=excluded.label_id,category=excluded.category,sort_order=excluded.sort_order,is_active=true;
