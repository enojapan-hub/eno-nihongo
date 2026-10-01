create table if not exists public.vocabulary_senses (
  id uuid primary key default gen_random_uuid(),
  vocabulary_id uuid not null references public.vocabulary(id) on delete cascade,
  meaning_id text not null,
  part_of_speech text,
  usage_note_id text,
  examples jsonb not null default '[]'::jsonb,
  source_book text,
  created_at timestamptz not null default now()
);
create unique index if not exists vocabulary_senses_identity_idx on public.vocabulary_senses(vocabulary_id, lower(btrim(meaning_id)), coalesce(lower(btrim(part_of_speech)),''), coalesce(lower(btrim(source_book)),''));

create table if not exists public.vocabulary_curriculum (
  id uuid primary key default gen_random_uuid(),
  vocabulary_id uuid not null references public.vocabulary(id) on delete cascade,
  source_book text not null,
  lesson_number integer,
  lesson_title text,
  source_term text,
  source_reading text,
  source_meaning_id text,
  created_at timestamptz not null default now()
);
create unique index if not exists vocabulary_curriculum_identity_idx on public.vocabulary_curriculum(vocabulary_id, source_book, coalesce(lesson_number,-1), coalesce(source_term,''), coalesce(source_reading,''));
create index if not exists vocabulary_curriculum_lesson_idx on public.vocabulary_curriculum(source_book, lesson_number);

alter table public.vocabulary_senses enable row level security;
alter table public.vocabulary_curriculum enable row level security;

drop policy if exists "published vocabulary senses readable" on public.vocabulary_senses;
create policy "published vocabulary senses readable" on public.vocabulary_senses for select to authenticated using (exists(select 1 from public.vocabulary v where v.id=vocabulary_id and v.is_published));
drop policy if exists "published vocabulary curriculum readable" on public.vocabulary_curriculum;
create policy "published vocabulary curriculum readable" on public.vocabulary_curriculum for select to authenticated using (exists(select 1 from public.vocabulary v where v.id=vocabulary_id and v.is_published));
