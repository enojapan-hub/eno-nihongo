# 06 — Hiragana & Katakana
Status: DIIMPLEMENTASIKAN sesuai desain v2 tertulis; sisa BELUM DIPUTUSKAN.

## TERKUNCI
- Layout: tab "Belajar Huruf" / "Latihan Kana"; toggle Hiragana·あ / Katakana·ア; "Romaji aktif"; tab Dasar / Dakuten / Yōon; panel "Huruf terpilih" + Pasangan; "10 soal / sesi"; mode latihan sebagai radio.
- Latihan Baca Kata: hanya kata ≤6 kana dari `vocabulary` terbit; romaji harus cocok dengan `wordRomaji`; arti wajib; homonim digabung; 10 soal 4 pilihan; pengecoh dari bacaan kata nyata lain.

## SUDAH DIIMPLEMENTASIKAN
- `kana.tsx`: tabel kana statis di file (tanpa DB); persistensi hanya localStorage `eno:kana:romaji`. Latihan: Kana→Romaji, Romaji→Kana, Huruf Mirip, Audio→Kana; set Dasar/Dakuten/Yōon/Semua; opsi huruf lemah.
- `components/learn/WordReadingPractice.tsx` + `lib/__tests__/word-reading-practice.test.ts`.

## BELUM DIPUTUSKAN
- Fungsi tombol "Latihan Huruf Ini".
- Apakah progres Kana perlu disimpan di akun (saat ini tidak ada tabel/penyimpanan progres).

## SIAP DIIMPLEMENTASI
- Tidak ada.
