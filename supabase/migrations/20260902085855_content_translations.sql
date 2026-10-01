create table if not exists public.content_translations (
  id uuid primary key default gen_random_uuid(),
  source_type text not null,
  source_id uuid not null,
  source_field text not null,
  source_text text not null,
  translated_text text,
  language text not null default 'id',
  status text not null default 'pending' check (status in ('pending','processing','completed','failed')),
  attempts integer not null default 0,
  last_error text,
  model text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  translated_at timestamptz,
  unique(source_type, source_id, source_field, language)
);
create index if not exists content_translations_status_idx on public.content_translations(status, updated_at);
create index if not exists content_translations_source_idx on public.content_translations(source_type, source_id);
alter table public.content_translations enable row level security;
create or replace function public.touch_content_translations_updated_at()
returns trigger language plpgsql as $$ begin new.updated_at = now(); return new; end; $$;
drop trigger if exists content_translations_updated_at on public.content_translations;
create trigger content_translations_updated_at before update on public.content_translations for each row execute function public.touch_content_translations_updated_at();
