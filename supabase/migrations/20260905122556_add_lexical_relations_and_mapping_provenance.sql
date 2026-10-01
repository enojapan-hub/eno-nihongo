-- Relational lexical mapping for source-backed vocabulary enrichment.
CREATE TABLE IF NOT EXISTS vocabulary_relations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_vocabulary_id uuid NOT NULL REFERENCES vocabulary(id) ON DELETE CASCADE,
  target_vocabulary_id uuid NOT NULL REFERENCES vocabulary(id) ON DELETE CASCADE,
  relation_type text NOT NULL,
  source_book text,
  source_reference text,
  confidence text NOT NULL DEFAULT 'source_explicit',
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT vocabulary_relations_not_self CHECK (source_vocabulary_id <> target_vocabulary_id),
  CONSTRAINT vocabulary_relations_unique UNIQUE(source_vocabulary_id,target_vocabulary_id,relation_type,source_book)
);
CREATE INDEX IF NOT EXISTS vocabulary_relations_source_idx ON vocabulary_relations(source_vocabulary_id,relation_type);
CREATE INDEX IF NOT EXISTS vocabulary_relations_target_idx ON vocabulary_relations(target_vocabulary_id,relation_type);

ALTER TABLE vocabulary_curriculum ADD COLUMN IF NOT EXISTS source_unit_type text;
ALTER TABLE vocabulary_curriculum ADD COLUMN IF NOT EXISTS source_unit_number integer;
ALTER TABLE vocabulary_curriculum ADD COLUMN IF NOT EXISTS display_lesson_number integer;
ALTER TABLE vocabulary_curriculum ADD COLUMN IF NOT EXISTS source_reference text;
ALTER TABLE vocabulary_curriculum ADD COLUMN IF NOT EXISTS mapping_confidence text NOT NULL DEFAULT 'legacy';
ALTER TABLE vocabulary_curriculum ADD COLUMN IF NOT EXISTS source_kind text NOT NULL DEFAULT 'reference_pdf';

ALTER TABLE vocabulary_category_links ADD COLUMN IF NOT EXISTS source_reference text;
ALTER TABLE vocabulary_category_links ADD COLUMN IF NOT EXISTS mapping_method text NOT NULL DEFAULT 'source_explicit';

CREATE INDEX IF NOT EXISTS vocabulary_curriculum_source_unit_idx ON vocabulary_curriculum(source_book,source_unit_type,source_unit_number);
CREATE INDEX IF NOT EXISTS vocabulary_curriculum_display_lesson_idx ON vocabulary_curriculum(display_lesson_number);

-- Normalize existing POS strings only where their semantics are unambiguous.
UPDATE vocabulary SET part_of_speech='Meishi / Kata Benda' WHERE lower(btrim(part_of_speech)) IN ('noun','kata benda','kata_benda');
UPDATE vocabulary SET part_of_speech='Doushi / Kata Kerja' WHERE lower(btrim(part_of_speech)) IN ('verb','kata kerja');
UPDATE vocabulary SET part_of_speech='Fukushi / Kata Keterangan' WHERE lower(btrim(part_of_speech)) IN ('kata keterangan','adverb');
UPDATE vocabulary SET part_of_speech='I-keiyoushi / Kata Sifat い' WHERE lower(btrim(part_of_speech))='i-adjective';
UPDATE vocabulary SET part_of_speech='Na-keiyoushi / Kata Sifat な' WHERE lower(btrim(part_of_speech))='na-adjective';
UPDATE vocabulary SET part_of_speech='Daimeishi / Kata Ganti' WHERE lower(btrim(part_of_speech))='pronoun';
UPDATE vocabulary SET part_of_speech='Hyougen / Ungkapan' WHERE lower(btrim(part_of_speech))='ungkapan';
UPDATE vocabulary SET part_of_speech='Furēzu / Frasa' WHERE lower(btrim(part_of_speech))='frasa';
-- Generic adjective remains generic until PDF source resolves i/na class.
UPDATE vocabulary SET part_of_speech='Keiyoushi / Kata Sifat (belum terklasifikasi)' WHERE lower(btrim(part_of_speech)) IN ('adjective','kata sifat');
