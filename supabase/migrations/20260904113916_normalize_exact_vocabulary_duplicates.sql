create table if not exists public.vocabulary_merge_map (
  duplicate_id uuid primary key references public.vocabulary(id) on delete cascade,
  canonical_id uuid not null references public.vocabulary(id) on delete cascade,
  reason text not null default 'same_level_term_reading',
  created_at timestamptz not null default now(),
  check (duplicate_id <> canonical_id)
);
create index if not exists vocabulary_merge_map_canonical_idx on public.vocabulary_merge_map(canonical_id);

with ranked as (
  select v.id,v.level,v.term,v.reading,v.meaning_id,
         first_value(v.id) over (
           partition by v.level,lower(btrim(v.term)),lower(btrim(coalesce(v.reading,'')))
           order by length(coalesce(v.meaning_id,'')) desc,
                    jsonb_array_length(coalesce(v.examples,'[]'::jsonb)) desc,
                    (v.source_book is not null) desc,
                    v.created_at asc,
                    v.id
         ) canonical_id,
         count(*) over (partition by v.level,lower(btrim(v.term)),lower(btrim(coalesce(v.reading,'')))) n
  from public.vocabulary v where v.is_published
)
insert into public.vocabulary_merge_map(duplicate_id,canonical_id)
select id,canonical_id from ranked where n>1 and id<>canonical_id
on conflict (duplicate_id) do update set canonical_id=excluded.canonical_id;

insert into public.vocabulary_senses(vocabulary_id,meaning_id,part_of_speech,examples,source_book)
select m.canonical_id,v.meaning_id,v.part_of_speech,v.examples,v.source_book
from public.vocabulary_merge_map m join public.vocabulary v on v.id=m.duplicate_id
where btrim(v.meaning_id)<>''
on conflict do nothing;

insert into public.vocabulary_curriculum(vocabulary_id,source_book,lesson_number,lesson_title,source_term,source_reading,source_meaning_id)
select m.canonical_id,v.source_book,v.lesson_number,v.lesson_title,v.term,v.reading,v.meaning_id
from public.vocabulary_merge_map m join public.vocabulary v on v.id=m.duplicate_id
where v.source_book is not null
on conflict do nothing;

insert into public.vocabulary_category_map(vocabulary_id,category_slug,source_book)
select m.canonical_id,c.category_slug,c.source_book
from public.vocabulary_category_map c join public.vocabulary_merge_map m on m.duplicate_id=c.vocabulary_id
on conflict (vocabulary_id,category_slug) do nothing;

delete from public.vocabulary_category_map c
using public.vocabulary_merge_map m
where c.vocabulary_id=m.duplicate_id;

update public.vocabulary_source_items s set vocabulary_id=m.canonical_id
from public.vocabulary_merge_map m where s.vocabulary_id=m.duplicate_id;

update public.questions q set vocabulary_id=m.canonical_id
from public.vocabulary_merge_map m where q.vocabulary_id=m.duplicate_id;

update public.verb_pairs p set intransitive_vocabulary_id=m.canonical_id
from public.vocabulary_merge_map m where p.intransitive_vocabulary_id=m.duplicate_id;
update public.verb_pairs p set transitive_vocabulary_id=m.canonical_id
from public.vocabulary_merge_map m where p.transitive_vocabulary_id=m.duplicate_id;

update public.content_translations t set source_id=m.canonical_id
from public.vocabulary_merge_map m
where t.source_type='vocabulary' and t.source_id=m.duplicate_id
and not exists (
  select 1 from public.content_translations x
  where x.source_type=t.source_type and x.source_id=m.canonical_id and x.source_field=t.source_field and x.language=t.language
);
delete from public.content_translations t
using public.vocabulary_merge_map m
where t.source_type='vocabulary' and t.source_id=m.duplicate_id;

update public.user_item_progress u set item_id=m.canonical_id
from public.vocabulary_merge_map m
where u.item_type::text='vocabulary' and u.item_id=m.duplicate_id
and not exists (
  select 1 from public.user_item_progress x
  where x.user_id=u.user_id and x.item_type=u.item_type and x.item_id=m.canonical_id
);
delete from public.user_item_progress u
using public.vocabulary_merge_map m
where u.item_type::text='vocabulary' and u.item_id=m.duplicate_id;

update public.vocabulary v set is_published=false
from public.vocabulary_merge_map m
where v.id=m.duplicate_id and v.is_published;

alter table public.vocabulary_merge_map enable row level security;
drop policy if exists "vocabulary merge map readable" on public.vocabulary_merge_map;
create policy "vocabulary merge map readable" on public.vocabulary_merge_map for select to authenticated using (true);
