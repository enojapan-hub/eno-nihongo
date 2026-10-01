create table if not exists public.vocabulary_categories (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name_id text not null,
  parent_slug text,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.vocabulary_category_map (
  vocabulary_id uuid not null references public.vocabulary(id) on delete cascade,
  category_slug text not null references public.vocabulary_categories(slug) on delete cascade,
  source_book text,
  created_at timestamptz not null default now(),
  primary key (vocabulary_id, category_slug)
);

create table if not exists public.verb_pairs (
  id uuid primary key default gen_random_uuid(),
  intransitive_vocabulary_id uuid references public.vocabulary(id) on delete set null,
  transitive_vocabulary_id uuid references public.vocabulary(id) on delete set null,
  intransitive_term text not null,
  intransitive_reading text,
  intransitive_meaning_id text,
  transitive_term text not null,
  transitive_reading text,
  transitive_meaning_id text,
  source_book text not null,
  source_order integer,
  created_at timestamptz not null default now(),
  unique(source_book, source_order)
);

insert into public.vocabulary_categories(slug,name_id,parent_slug,sort_order) values
('kata-benda','Kata Benda',null,10),
('kata-kerja','Kata Kerja',null,20),
('kata-sifat','Kata Sifat',null,30),
('kata-keterangan','Kata Keterangan',null,40),
('angka','Angka & Bilangan',null,50),
('waktu','Waktu & Kalender',null,60),
('warna','Warna',null,70),
('anggota-tubuh','Anggota Tubuh',null,80),
('alat-sekolah','Alat Tulis & Sekolah',null,90),
('alat-dapur','Peralatan Dapur',null,100),
('buah-sayur','Buah & Sayur',null,110),
('makanan-minuman','Makanan & Minuman',null,120),
('hewan','Hewan',null,130),
('keluarga','Keluarga',null,140),
('pekerjaan','Pekerjaan',null,150),
('tempat','Tempat',null,160),
('transportasi','Transportasi',null,170),
('jidoushi','自動詞 / Jidoushi','kata-kerja',210),
('tadoushi','他動詞 / Tadoushi','kata-kerja',220),
('i-keiyoushi','い形容詞', 'kata-sifat',310),
('na-keiyoushi','な形容詞', 'kata-sifat',320),
('ruigo','類語 / Ruigo',null,400)
on conflict (slug) do update set name_id=excluded.name_id,parent_slug=excluded.parent_slug,sort_order=excluded.sort_order;

alter table public.vocabulary_categories enable row level security;
alter table public.vocabulary_category_map enable row level security;
alter table public.verb_pairs enable row level security;

create policy "public read vocabulary categories" on public.vocabulary_categories for select using (true);
create policy "public read vocabulary category map" on public.vocabulary_category_map for select using (true);
create policy "public read verb pairs" on public.verb_pairs for select using (true);
