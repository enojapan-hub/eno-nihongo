-- Normalize category taxonomy to canonical Japanese + Indonesian labels.
-- No vocabulary content or UI is changed.

UPDATE vocabulary_categories SET name_id = 'Meishi / Kata Benda' WHERE slug = 'meishi';
UPDATE vocabulary_categories SET name_id = 'Doushi / Kata Kerja' WHERE slug = 'doushi';
UPDATE vocabulary_categories SET name_id = 'Doushi Kelompok 1 / Kata Kerja Kelompok 1' WHERE slug = 'doushi-group-1';
UPDATE vocabulary_categories SET name_id = 'Doushi Kelompok 2 / Kata Kerja Kelompok 2' WHERE slug = 'doushi-group-2';
UPDATE vocabulary_categories SET name_id = 'Doushi Kelompok 3 / Kata Kerja Kelompok 3' WHERE slug = 'doushi-group-3';
UPDATE vocabulary_categories SET name_id = 'Jidoushi / Kata Kerja Intransitif' WHERE slug = 'jidoushi';
UPDATE vocabulary_categories SET name_id = 'Tadoushi / Kata Kerja Transitif' WHERE slug = 'tadoushi';
UPDATE vocabulary_categories SET name_id = 'I-keiyoushi / Kata Sifat い' WHERE slug = 'i-keiyoushi';
UPDATE vocabulary_categories SET name_id = 'Na-keiyoushi / Kata Sifat な' WHERE slug = 'na-keiyoushi';
UPDATE vocabulary_categories SET name_id = 'Fukushi / Kata Keterangan' WHERE slug = 'fukushi';
UPDATE vocabulary_categories SET name_id = 'Setsuzokushi / Kata Sambung' WHERE slug = 'setsuzokushi';
UPDATE vocabulary_categories SET name_id = 'Aisatsu / Kata Sapaan' WHERE slug = 'aisatsu';
UPDATE vocabulary_categories SET name_id = 'Daimeishi / Kata Ganti' WHERE slug = 'daimeishi';
UPDATE vocabulary_categories SET name_id = 'Ruigo / Sinonim' WHERE slug = 'ruigo';

-- Mark duplicate legacy slugs as aliases rather than deleting them. This preserves compatibility.
ALTER TABLE vocabulary_categories ADD COLUMN IF NOT EXISTS canonical_slug text;
ALTER TABLE vocabulary_categories ADD COLUMN IF NOT EXISTS taxonomy_kind text NOT NULL DEFAULT 'semantic';
ALTER TABLE vocabulary_categories ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true;
ALTER TABLE vocabulary_categories ADD COLUMN IF NOT EXISTS label_ja text;
ALTER TABLE vocabulary_categories ADD COLUMN IF NOT EXISTS label_id text;

UPDATE vocabulary_categories SET canonical_slug = slug WHERE canonical_slug IS NULL;

UPDATE vocabulary_categories SET canonical_slug='meishi', is_active=false WHERE slug='kata-benda';
UPDATE vocabulary_categories SET canonical_slug='doushi', is_active=false WHERE slug='kata-kerja';
UPDATE vocabulary_categories SET canonical_slug='i-keiyoushi', is_active=false WHERE slug='kata-sifat';
UPDATE vocabulary_categories SET canonical_slug='fukushi', is_active=false WHERE slug='kata-keterangan';
UPDATE vocabulary_categories SET canonical_slug='aisatsu', is_active=false WHERE slug='sapaan';
UPDATE vocabulary_categories SET canonical_slug='daimeishi', is_active=false WHERE slug='kata_ganti';
UPDATE vocabulary_categories SET canonical_slug='hari', is_active=false WHERE slug='nama_hari';
UPDATE vocabulary_categories SET canonical_slug='bulan', is_active=false WHERE slug='nama_bulan';
UPDATE vocabulary_categories SET canonical_slug='alat-sekolah', is_active=false WHERE slug='alat_sekolah';
UPDATE vocabulary_categories SET canonical_slug='peralatan-dapur', is_active=false WHERE slug IN ('alat_dapur','alat-dapur');
UPDATE vocabulary_categories SET canonical_slug='buah-sayur', is_active=false WHERE slug='buah_sayur';
UPDATE vocabulary_categories SET canonical_slug='anggota-tubuh', is_active=false WHERE slug='anggota_tubuh';

UPDATE vocabulary_categories SET taxonomy_kind='word_class' WHERE slug IN ('meishi','doushi','i-keiyoushi','na-keiyoushi','fukushi','setsuzokushi','daimeishi');
UPDATE vocabulary_categories SET taxonomy_kind='verb_group' WHERE slug IN ('doushi-group-1','doushi-group-2','doushi-group-3');
UPDATE vocabulary_categories SET taxonomy_kind='transitivity' WHERE slug IN ('jidoushi','tadoushi');
UPDATE vocabulary_categories SET taxonomy_kind='lexical_relation' WHERE slug='ruigo';
UPDATE vocabulary_categories SET taxonomy_kind='expression' WHERE slug IN ('aisatsu','ekspresi');
UPDATE vocabulary_categories SET taxonomy_kind='theme' WHERE slug IN ('hari','waktu','bulan','cuaca_musim','alat-sekolah','peralatan-dapur','buah-sayur','anggota-tubuh','makanan-minuman','hewan','keluarga','pekerjaan','warna','angka','tempat','transportasi');

UPDATE vocabulary_categories SET label_ja='名詞', label_id='Kata Benda' WHERE slug='meishi';
UPDATE vocabulary_categories SET label_ja='動詞', label_id='Kata Kerja' WHERE slug='doushi';
UPDATE vocabulary_categories SET label_ja='自動詞', label_id='Kata Kerja Intransitif' WHERE slug='jidoushi';
UPDATE vocabulary_categories SET label_ja='他動詞', label_id='Kata Kerja Transitif' WHERE slug='tadoushi';
UPDATE vocabulary_categories SET label_ja='い形容詞', label_id='Kata Sifat い' WHERE slug='i-keiyoushi';
UPDATE vocabulary_categories SET label_ja='な形容詞', label_id='Kata Sifat な' WHERE slug='na-keiyoushi';
UPDATE vocabulary_categories SET label_ja='副詞', label_id='Kata Keterangan' WHERE slug='fukushi';
UPDATE vocabulary_categories SET label_ja='接続詞', label_id='Kata Sambung' WHERE slug='setsuzokushi';
UPDATE vocabulary_categories SET label_ja='代名詞', label_id='Kata Ganti' WHERE slug='daimeishi';
UPDATE vocabulary_categories SET label_ja='挨拶', label_id='Kata Sapaan' WHERE slug='aisatsu';
UPDATE vocabulary_categories SET label_ja='類語', label_id='Sinonim' WHERE slug='ruigo';

CREATE INDEX IF NOT EXISTS vocabulary_categories_canonical_slug_idx ON vocabulary_categories(canonical_slug);
CREATE INDEX IF NOT EXISTS vocabulary_categories_kind_active_idx ON vocabulary_categories(taxonomy_kind,is_active);
