-- Peran komponen hanya dari metadata KanjiVG yang terdokumentasi.
-- Peran bunyi (phonetic): penanda kvg:phon pada grup KanjiVG ("The phon attribute should mark the part
-- indicating the pronunciation", https://kanjivg.tagaini.net/svg-format.html) -> dipertahankan.
-- Peran makna (semantic): KanjiVG tidak punya penanda makna; peran ini sebelumnya bergantung pada kamus
-- pembanding pihak ketiga -> dikosongkan (role dan role_source saja; node, bushu, mnemonik tidak disentuh).
-- Idempotent: hanya mengubah baris yang masih bertanda semantic atau bersumber sumber pihak ketiga.
set local lock_timeout = '8s';

update public.kanji_components
   set role = null, role_source = null
 where role = 'semantic';

update public.kanji_components
   set role_source = 'KanjiVG (kvg:phon)'
 where role = 'phonetic'
   and role_source is distinct from 'KanjiVG (kvg:phon)';
