# 05 — Materi: Kanji, Kotoba, Bunpou, Dokkai, Chōkai
Status: DIIMPLEMENTASIKAN sebagian sesuai desain v2 tertulis; Kanji/Kotoba/Chōkai v2 BELUM DIPUTUSKAN.

## TERKUNCI
- Katalog `/belajar` dua kolom (ikon, label, meta, persentase Dipelajari + progress bar). Seksi "Latihan & Ingatan": Flashcard (Gratis), Kioku (Premium). Dokkai/Chōkai di katalog tampil terkunci "Segera hadir".
- Pelajari tersimpan lewat RPC `mark_material_learned_atomic` dan diverifikasi baca ulang; setelah sukses muncul tombol "Lanjut ke Flashcard".
- Bunpou: singkatan rumus dalam `<details>` "Panduan" tersembunyi secara default.
- Dokkai: Mode Belajar/Ujian; timer dari `estimated_minutes`; jawaban dikunci saat waktu habis; penjelasan benar/salah; ulangi soal salah; posisi baca di localStorage; kartu "Lanjutkan membaca".
- Data pembelajaran tidak boleh dikarang; konten hanya `is_published = true`.

## SUDAH DIIMPLEMENTASIKAN (fakta kode)
- Kanji (`kanji.tsx`; `kanji/$id` redirect), Kotoba (`kotoba.tsx`), Bunpou (`bunpo.tsx`, tabel `grammar_points`), Dokkai (`dokkai.tsx`, `dokkai/$id.tsx`; `dokkai-baca/$id` redirect), Chōkai (`choukai.tsx`, tabel `listening_items`, audio diprioritaskan, TTS hanya bila audio kosong; `listening` redirect ke `/choukai`). Tanpa gating Premium.
- Teks fallback "belum tersedia" menandai data kosong; bukan placeholder fitur.

## KETIDAKKONSISTENAN
- DIPERBAIKI: katalog `/belajar` kini menautkan kartu Dokkai (`/dokkai`) dan Choukai (`/choukai`) sesuai ketersediaan aktual (sebelumnya terkunci "Segera hadir"). Keputusan final owner: audio yang hilang bukan blocker; Chōkai tetap menampilkan materi valid yang ada.
- Chōkai: `choukai.tsx` memakai audio bila ada dan TTS hanya bila audio kosong; item tanpa audio dan tanpa transkrip tidak ditampilkan. Penandaan "Segera Hadir" per latihan yang membutuhkan audio valid belum dikerjakan (BELUM TERUJI cakupan datanya; butuh cek data `listening_items` read-only).

## BELUM DIPUTUSKAN
- Desain layar Kanji, Kotoba, Chōkai v2 (tidak ada desain tertulis).
- Highlight kalimat bukti dan audio per paragraf Dokkai (butuh kolom/data dan migration; `reading_passages` belum punya).
- Perbaikan massal data romaji `vocabulary` (butuh izin tulis DB; saat ini ditangani filter di `toPracticeWords`).
- Tombol Review/Pelajari pada kartu Flashcard.

## SIAP DIIMPLEMENTASI
- Tidak ada tanpa desain tertulis per layar. Dokkai/Bunpou/Materi sudah mengikuti spesifikasi yang ada.
