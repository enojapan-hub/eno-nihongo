create table if not exists public.reading_curriculum (
  id uuid primary key default gen_random_uuid(),
  lesson_number integer not null,
  level jlpt_level not null,
  title text not null,
  source_book text not null,
  source_page integer,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  unique(source_book,lesson_number,title)
);
create index if not exists reading_curriculum_lesson_idx on public.reading_curriculum(level,source_book,lesson_number,sort_order);
alter table public.reading_curriculum enable row level security;
drop policy if exists "Reading curriculum readable" on public.reading_curriculum;
create policy "Reading curriculum readable" on public.reading_curriculum for select to anon,authenticated using (true);

create table if not exists public.grammar_curriculum (
  id uuid primary key default gen_random_uuid(),
  lesson_number integer not null,
  level jlpt_level not null,
  pattern text not null,
  source_book text not null,
  source_page integer,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  unique(source_book,lesson_number,pattern)
);
create index if not exists grammar_curriculum_lesson_idx on public.grammar_curriculum(level,source_book,lesson_number,sort_order);
alter table public.grammar_curriculum enable row level security;
drop policy if exists "Grammar curriculum readable" on public.grammar_curriculum;
create policy "Grammar curriculum readable" on public.grammar_curriculum for select to anon,authenticated using (true);
