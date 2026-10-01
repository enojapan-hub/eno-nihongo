-- Map only classifications explicitly supported by uploaded/source PDFs or source file identity.
-- Preserve existing content; add relational labels/provenance only.

-- Explicit word-class mapping from source filenames.
INSERT INTO vocabulary_category_links (vocabulary_id, category_id, source_book, confidence)
SELECT v.id, c.id, v.source_book, 'source_explicit'
FROM vocabulary v JOIN vocabulary_categories c ON c.slug='doushi'
WHERE v.is_published=true AND v.source_book IN ('Kata Kerja Grup 123.pdf','KATA KERJA N3.pdf')
ON CONFLICT DO NOTHING;

INSERT INTO vocabulary_category_links (vocabulary_id, category_id, source_book, confidence)
SELECT v.id, c.id, v.source_book, 'source_explicit'
FROM vocabulary v JOIN vocabulary_categories c ON c.slug='fukushi'
WHERE v.is_published=true AND v.source_book IN ('Kata Keterangan N5.pdf','KATA KETERANGAN N3.pdf')
ON CONFLICT DO NOTHING;

INSERT INTO vocabulary_category_links (vocabulary_id, category_id, source_book, confidence)
SELECT v.id, c.id, v.source_book, 'source_explicit'
FROM vocabulary v JOIN vocabulary_categories c ON c.slug='meishi'
WHERE v.is_published=true AND v.source_book LIKE 'KATA BENDA N3 PART %.pdf'
ON CONFLICT DO NOTHING;

-- Normalize existing explicit POS strings into canonical category links without overwriting POS text.
INSERT INTO vocabulary_category_links (vocabulary_id, category_id, source_book, confidence)
SELECT v.id,c.id,v.source_book,'source_explicit'
FROM vocabulary v JOIN vocabulary_categories c ON c.slug='doushi'
WHERE v.is_published=true AND lower(trim(coalesce(v.part_of_speech,''))) IN ('kata kerja','verb','doushi','動詞')
ON CONFLICT DO NOTHING;

INSERT INTO vocabulary_category_links (vocabulary_id, category_id, source_book, confidence)
SELECT v.id,c.id,v.source_book,'source_explicit'
FROM vocabulary v JOIN vocabulary_categories c ON c.slug='meishi'
WHERE v.is_published=true AND lower(trim(coalesce(v.part_of_speech,''))) IN ('kata benda','kata_benda','noun','meishi','名詞')
ON CONFLICT DO NOTHING;

INSERT INTO vocabulary_category_links (vocabulary_id, category_id, source_book, confidence)
SELECT v.id,c.id,v.source_book,'source_explicit'
FROM vocabulary v JOIN vocabulary_categories c ON c.slug='fukushi'
WHERE v.is_published=true AND lower(trim(coalesce(v.part_of_speech,''))) IN ('kata keterangan','adverb','fukushi','副詞')
ON CONFLICT DO NOTHING;

INSERT INTO vocabulary_category_links (vocabulary_id, category_id, source_book, confidence)
SELECT v.id,c.id,v.source_book,'source_explicit'
FROM vocabulary v JOIN vocabulary_categories c ON c.slug='daimeishi'
WHERE v.is_published=true AND lower(trim(coalesce(v.part_of_speech,''))) IN ('pronoun','kata ganti','daimeishi','代名詞')
ON CONFLICT DO NOTHING;

INSERT INTO vocabulary_category_links (vocabulary_id, category_id, source_book, confidence)
SELECT v.id,c.id,v.source_book,'source_explicit'
FROM vocabulary v JOIN vocabulary_categories c ON c.slug='aisatsu'
WHERE v.is_published=true AND lower(trim(coalesce(v.part_of_speech,''))) IN ('ungkapan','expression','aisatsu','挨拶')
ON CONFLICT DO NOTHING;

-- Add explicit I/Na adjective links only when POS itself distinguishes the class.
INSERT INTO vocabulary_category_links (vocabulary_id, category_id, source_book, confidence)
SELECT v.id,c.id,v.source_book,'source_explicit'
FROM vocabulary v JOIN vocabulary_categories c ON c.slug='i-keiyoushi'
WHERE v.is_published=true AND lower(trim(coalesce(v.part_of_speech,''))) IN ('i-adjective','i-keiyoushi','い形容詞')
ON CONFLICT DO NOTHING;

INSERT INTO vocabulary_category_links (vocabulary_id, category_id, source_book, confidence)
SELECT v.id,c.id,v.source_book,'source_explicit'
FROM vocabulary v JOIN vocabulary_categories c ON c.slug='na-keiyoushi'
WHERE v.is_published=true AND lower(trim(coalesce(v.part_of_speech,''))) IN ('na-adjective','na-keiyoushi','な形容詞')
ON CONFLICT DO NOTHING;

-- Add taxonomy for source-role labels demonstrated by Irodori.
INSERT INTO vocabulary_categories(slug,name_id,parent_slug,sort_order,canonical_slug,taxonomy_kind,is_active,label_ja,label_id)
VALUES
 ('reference-vocabulary','Sankou Goi / Kosakata Referensi',NULL,200,'reference-vocabulary','source_role',true,'参考語彙','Kosakata Referensi'),
 ('repeated-vocabulary','Saishutsu Goi / Kosakata Berulang',NULL,210,'repeated-vocabulary','source_role',true,'再出語彙','Kosakata Berulang'),
 ('expression-sentence','Hyougen / Ungkapan・Ekspresi',NULL,220,'expression-sentence','source_role',true,'表現','Ungkapan / Ekspresi'),
 ('conversation-extra','Kaiwa Tsuika Goi / Kosakata Tambahan Percakapan',NULL,230,'conversation-extra','source_role',true,'会話練習での追加語彙','Kosakata Tambahan Percakapan'),
 ('dokkai-vocabulary','Dokkai Goi / Kosakata Materi Bacaan',NULL,240,'dokkai-vocabulary','source_role',true,'読解素材の中に出てくることば','Kosakata Materi Bacaan'),
 ('polite-service-vocabulary','Teinei Goi / Kosakata Ragam Sopan Layanan',NULL,250,'polite-service-vocabulary','source_role',true,'丁寧なことば','Kosakata Ragam Sopan Layanan'),
 ('proper-noun','Koyuu Meishi / Kata Benda Nama Khusus',NULL,260,'proper-noun','source_role',true,'固有名詞','Kata Benda Nama Khusus')
ON CONFLICT (slug) DO UPDATE SET
 name_id=EXCLUDED.name_id, canonical_slug=EXCLUDED.canonical_slug,
 taxonomy_kind=EXCLUDED.taxonomy_kind,is_active=true,label_ja=EXCLUDED.label_ja,label_id=EXCLUDED.label_id;

-- Canonical labels for verb groups, matching source terminology.
UPDATE vocabulary_categories SET label_ja='1グループ',label_id='Kata Kerja Kelompok 1',name_id='1 Group / Kata Kerja Kelompok 1' WHERE slug='doushi-group-1';
UPDATE vocabulary_categories SET label_ja='2グループ',label_id='Kata Kerja Kelompok 2',name_id='2 Group / Kata Kerja Kelompok 2' WHERE slug='doushi-group-2';
UPDATE vocabulary_categories SET label_ja='3グループ',label_id='Kata Kerja Kelompok 3',name_id='3 Group / Kata Kerja Kelompok 3' WHERE slug='doushi-group-3';
