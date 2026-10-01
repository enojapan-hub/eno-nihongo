create table if not exists public.kanji_curriculum (
  id uuid primary key default gen_random_uuid(),
  kanji_id uuid references public.kanji(id) on delete set null,
  character text not null,
  level jlpt_level not null,
  source_book text not null,
  lesson_number integer not null,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  unique (source_book, lesson_number, character)
);
create index if not exists kanji_curriculum_lesson_idx on public.kanji_curriculum(level,source_book,lesson_number,sort_order);
alter table public.kanji_curriculum enable row level security;
drop policy if exists "Published kanji curriculum readable" on public.kanji_curriculum;
create policy "Published kanji curriculum readable" on public.kanji_curriculum for select to anon, authenticated using (true);
