# 07 — Flashcard & Kioku (12 mode, ENO Rush, Memory DNA)
Status: Flashcard DIIMPLEMENTASIKAN; Kioku 3 dari 12 mode aktif.

## TERKUNCI
- Flashcard gratis; penilaian Lupa / Sulit / Ingat / Mudah. Tombol "Lanjut ke Kioku" muncul hanya bila semua penilaian tersimpan. Kartu: "Tampilkan Jawaban"; pertanyaan "Seberapa baik kamu mengingat kata ini?"; stamp INGAT.
- Kioku Premium. Tab Beranda / Latihan / Analisis; kartu "Kesiapan Ingatan"; "Mulai Latihan Hari Ini".
- Katalog 12 mode (`KIOKU_MODE_GROUPS`): Belajar Cerdas (Latihan Harian, Latihan Adaptif, Memory Rescue, Memory Missions); Uji Kemampuan (Uji Ingatan Kuat, Recall Challenge, Susun Kalimat, Contrast Challenge); Tantangan & Kompetisi (ENO Rush, Memory Battle, Memory Transfer, Memory Laboratory). Mode tanpa spesifikasi disabled "Segera hadir".

## SUDAH DIIMPLEMENTASIKAN
- Aktif: Latihan Harian (`daily`), Latihan Adaptif (`normal`), Uji Ingatan Kuat (`boss`). Mesin sesi + outbox (`kioku_record_events`), tabel `memory_state` (migration `20260929085029_kioku_foundation.sql`), `flashcard_reviews`.
- `hafalan.tsx` (Flashcard; mode Normal/Kartu Lemah/5 Menit/Ujian), `hafalan-riwayat.tsx` (Analisis Ingatan, Premium), `peta-kelemahan.tsx` (soft gate), `jebakan-ingatan.tsx`, `rantai-ingatan.tsx`.
- "Memory DNA" tidak ada di kode/dokumen; "ENO Rush" hanya entri katalog disabled.

## KETIDAKKONSISTENAN
- `jebakan-ingatan`, `rantai-ingatan`, `peta-kelemahan` tidak ditautkan dari mana pun (route yatim); dua yang pertama tanpa gating Premium. SENGAJA TIDAK DITAUTKAN: menautkannya akan membuka fitur tanpa spesifikasi dan melewati gating Premium Kioku. Menunggu keputusan (masuk ke Analisis/Kioku Premium atau tetap tersembunyi).
- Flashcard menulis `user_item_progress` dan `flashcard_reviews` dari client.

## BELUM DIPUTUSKAN
- Spesifikasi 9 mode yang disabled, termasuk ENO Rush (bonus streak, periode leaderboard, migration).
- Analitik Memory DNA / Forecast / Evolution / Interference / Confusion Map; apakah Confusion Map = Jebakan Ingatan.
- Posisi dan gating route yatim di atas.
- Tombol Review/Pelajari di kartu Flashcard.

## SIAP DIIMPLEMENTASI
- Tidak ada tanpa spesifikasi mode.
