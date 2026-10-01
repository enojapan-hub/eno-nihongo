create table if not exists public.content_sources (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  level public.jlpt_level,
  source_kind text not null default 'reference_pdf',
  curriculum_family text,
  ui_unit_label text not null default 'Pelajaran',
  priority integer not null default 100,
  notes text,
  created_at timestamptz not null default now()
);

create table if not exists public.vocabulary_category_links (
  vocabulary_id uuid not null references public.vocabulary(id) on delete cascade,
  category_id uuid not null references public.vocabulary_categories(id) on delete cascade,
  source_book text,
  confidence text not null default 'source_explicit' check (confidence in ('source_explicit','derived','supplemental')),
  created_at timestamptz not null default now(),
  primary key (vocabulary_id, category_id)
);

create index if not exists vocabulary_category_links_category_idx on public.vocabulary_category_links(category_id);
create index if not exists vocabulary_category_links_vocab_idx on public.vocabulary_category_links(vocabulary_id);
create index if not exists vocabulary_curriculum_lesson_idx on public.vocabulary_curriculum(source_book, lesson_number);
create index if not exists kanji_curriculum_lesson_idx on public.kanji_curriculum(level, source_book, lesson_number, sort_order);
create index if not exists grammar_curriculum_lesson_idx on public.grammar_curriculum(level, source_book, lesson_number, sort_order);

insert into public.content_sources(code,name,level,source_kind,curriculum_family,ui_unit_label,priority,notes)
values
 ('n5_minna_1','Minna no Nihongo I','N5','reference_pdf','minna_no_nihongo','Pelajaran',10,'Referensi kurikulum utama N5; UI tetap menggunakan label Pelajaran.'),
 ('n4_minna_2','Minna no Nihongo II','N4','reference_pdf','minna_no_nihongo','Pelajaran',10,'Referensi kurikulum utama N4; UI tetap menggunakan label Pelajaran.'),
 ('n3_soumatome','Sou Matome N3','N3','reference_pdf','sou_matome','Pelajaran',10,'Referensi kurikulum utama N3; struktur sumber dinormalisasi menjadi Pelajaran di UI.'),
 ('n2_soumatome','Sou Matome N2','N2','reference_pdf','sou_matome','Pelajaran',10,'Referensi kurikulum utama N2; struktur sumber dinormalisasi menjadi Pelajaran di UI.'),
 ('supplemental_vocab','Kosakata Tambahan','N5','supplemental','supplemental','Pelajaran',90,'Materi tambahan/tematik; tidak menggantikan urutan kurikulum utama.')
on conflict (code) do update set name=excluded.name, source_kind=excluded.source_kind, curriculum_family=excluded.curriculum_family, ui_unit_label=excluded.ui_unit_label, priority=excluded.priority, notes=excluded.notes;

insert into public.vocabulary_categories(slug,name_id,parent_slug,sort_order)
values
 ('meishi','Meishi / Kata Benda','kelas-kata',10),
 ('doushi','Doushi / Kata Kerja','kelas-kata',20),
 ('doushi-group-1','Kata Kerja Kelompok 1','doushi',21),
 ('doushi-group-2','Kata Kerja Kelompok 2','doushi',22),
 ('doushi-group-3','Kata Kerja Kelompok 3','doushi',23),
 ('jidoushi','Jidoushi / Kata Kerja Intransitif','doushi',24),
 ('tadoushi','Tadoushi / Kata Kerja Transitif','doushi',25),
 ('i-keiyoushi','I-keiyoushi / Kata Sifat い','kelas-kata',30),
 ('na-keiyoushi','Na-keiyoushi / Kata Sifat な','kelas-kata',31),
 ('fukushi','Fukushi / Kata Keterangan','kelas-kata',40),
 ('setsuzokushi','Setsuzokushi / Kata Sambung','kelas-kata',50),
 ('aisatsu','Kata Sapaan','tematik',100),
 ('daimeishi','Kata Ganti','tematik',110),
 ('hari','Nama Hari','tematik',120),
 ('waktu','Waktu','tematik',130),
 ('bulan','Nama Bulan','tematik',140),
 ('warna','Warna','tematik',150),
 ('angka','Angka','tematik',160),
 ('anggota-tubuh','Anggota Tubuh','tematik',170),
 ('alat-sekolah','Alat Tulis & Peralatan Sekolah','tematik',180),
 ('peralatan-dapur','Peralatan Dapur','tematik',190),
 ('buah-sayur','Buah & Sayur','tematik',200)
on conflict (slug) do update set name_id=excluded.name_id,parent_slug=excluded.parent_slug,sort_order=excluded.sort_order;
