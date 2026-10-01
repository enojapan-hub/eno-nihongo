-- Map only classifications explicitly encoded by source PDFs/source filenames.
-- No inferred adjective subtype or verb group is assigned here.

-- Canonical POS labels from explicit source collections.
UPDATE vocabulary SET part_of_speech='Doushi / Kata Kerja'
WHERE is_published=true AND source_book IN ('Kata Kerja Grup 123.pdf','KATA KERJA N3.pdf');
UPDATE vocabulary SET part_of_speech='Fukushi / Kata Keterangan'
WHERE is_published=true AND source_book IN ('Kata Keterangan N5.pdf','KATA KETERANGAN N3.pdf');
UPDATE vocabulary SET part_of_speech='Meishi / Kata Benda'
WHERE is_published=true AND source_book IN ('Kata Benda N5.pdf','KATA BENDA N3 PART 1.pdf','KATA BENDA N3 PART 2.pdf','KATA BENDA N3 PART 3.pdf','KATA BENDA N3 PART 4.pdf');

-- Source-explicit category links, idempotent.
INSERT INTO vocabulary_category_links(vocabulary_id,category_id,source_book,confidence)
SELECT v.id,c.id,v.source_book,'source_explicit'
FROM vocabulary v JOIN vocabulary_categories c ON c.slug='doushi'
WHERE v.is_published=true AND v.source_book IN ('Kata Kerja Grup 123.pdf','KATA KERJA N3.pdf')
ON CONFLICT DO NOTHING;
INSERT INTO vocabulary_category_links(vocabulary_id,category_id,source_book,confidence)
SELECT v.id,c.id,v.source_book,'source_explicit'
FROM vocabulary v JOIN vocabulary_categories c ON c.slug='fukushi'
WHERE v.is_published=true AND v.source_book IN ('Kata Keterangan N5.pdf','KATA KETERANGAN N3.pdf')
ON CONFLICT DO NOTHING;
INSERT INTO vocabulary_category_links(vocabulary_id,category_id,source_book,confidence)
SELECT v.id,c.id,v.source_book,'source_explicit'
FROM vocabulary v JOIN vocabulary_categories c ON c.slug='meishi'
WHERE v.is_published=true AND v.source_book IN ('Kata Benda N5.pdf','KATA BENDA N3 PART 1.pdf','KATA BENDA N3 PART 2.pdf','KATA BENDA N3 PART 3.pdf','KATA BENDA N3 PART 4.pdf')
ON CONFLICT DO NOTHING;

-- Record the same canonical mapping in the lightweight category map for compatibility.
INSERT INTO vocabulary_category_map(vocabulary_id,category_slug,source_book)
SELECT v.id,'doushi',v.source_book FROM vocabulary v
WHERE v.is_published=true AND v.source_book IN ('Kata Kerja Grup 123.pdf','KATA KERJA N3.pdf')
ON CONFLICT DO NOTHING;
INSERT INTO vocabulary_category_map(vocabulary_id,category_slug,source_book)
SELECT v.id,'fukushi',v.source_book FROM vocabulary v
WHERE v.is_published=true AND v.source_book IN ('Kata Keterangan N5.pdf','KATA KETERANGAN N3.pdf')
ON CONFLICT DO NOTHING;
INSERT INTO vocabulary_category_map(vocabulary_id,category_slug,source_book)
SELECT v.id,'meishi',v.source_book FROM vocabulary v
WHERE v.is_published=true AND v.source_book IN ('Kata Benda N5.pdf','KATA BENDA N3 PART 1.pdf','KATA BENDA N3 PART 2.pdf','KATA BENDA N3 PART 3.pdf','KATA BENDA N3 PART 4.pdf')
ON CONFLICT DO NOTHING;
