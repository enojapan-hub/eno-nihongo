create table if not exists public.reading_vocabulary_annotations (
  id uuid primary key default gen_random_uuid(),
  passage_id uuid not null references public.reading_passages(id) on delete cascade,
  vocabulary_id uuid references public.vocabulary(id) on delete set null,
  surface text not null,
  reading text,
  romaji text,
  meaning_id text,
  position_order integer not null default 0,
  source_type text not null default 'database',
  created_at timestamptz not null default now(),
  unique (passage_id, surface, position_order)
);
alter table public.reading_vocabulary_annotations enable row level security;
drop policy if exists "published reading annotations are readable" on public.reading_vocabulary_annotations;
create policy "published reading annotations are readable" on public.reading_vocabulary_annotations for select using (exists (select 1 from public.reading_passages rp where rp.id=passage_id and rp.is_published=true));
create index if not exists reading_vocab_annotations_passage_idx on public.reading_vocabulary_annotations(passage_id, position_order);

insert into public.reading_vocabulary_annotations (passage_id,vocabulary_id,surface,reading,romaji,meaning_id,position_order,source_type)
select rp.id, v.id, v.term, v.reading, v.romaji, v.meaning_id,
       row_number() over(partition by rp.id order by length(v.term) desc, v.sort_order nulls last)::int,
       'same_level_database'
from public.reading_passages rp
join public.vocabulary v on v.level=rp.level and v.is_published=true and length(v.term)>=2 and position(v.term in rp.body_jp)>0
where rp.is_published=true
on conflict (passage_id,surface,position_order) do nothing;
