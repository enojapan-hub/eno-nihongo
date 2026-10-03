-- Kioku (Context Ladder) membaca kanji_vocabulary_examples langsung dari klien.
-- Tabel ini sudah punya policy baca "Published kanji examples are readable" (hanya baris kanji + kosakata
-- yang published), tetapi hak SELECT tabelnya tidak ada setelah default privileges dicabut
-- (20260911081152), sehingga setiap permintaan klien berakhir 403 "permission denied".
-- Hak diberikan hanya untuk authenticated (aplikasi memakai Kioku setelah login); RLS tetap membatasi
-- baris, dan tidak ada hak tulis yang diberikan.
GRANT SELECT ON TABLE public.kanji_vocabulary_examples TO authenticated;
