# ENO NIHONGO V2 — Spesifikasi

Sumber kebenaran desain v2. Implementasi hanya boleh mengikuti isi dokumen di folder ini.
Bagian yang belum terisi berstatus **MENUNGGU SPESIFIKASI** dan tidak boleh diimplementasikan berdasarkan tebakan.

## Keputusan terkunci (dikonfirmasi owner)
- Navigasi utama: TARGET | MATERI | HOME | SIMULASI | KELAS.
- Alur belajar: Target → Detail Materi → Pelajari → Flashcard → Kioku. Target Review membuka Detail Materi.
- Flashcard: tombol Lupa / Sulit / Ingat / Mudah.
- Adaptive Study Planner dan Target gratis untuk semua akun; Kioku tetap Premium.
- v2 dirilis serentak (satu paket), setelah persetujuan eksplisit owner.

## Format tiap modul (`<modul>.md`)
1. Tujuan dan route
2. Elemen layar (urutan, label teks persis)
3. Data sumber (tabel/RPC yang dipakai; field yang wajib ada)
4. Aturan bisnis (rumus, kriteria, batas, akses Gratis/Premium)
5. State kosong, error, loading
6. Kriteria selesai (dapat diuji)
7. Status: MENUNGGU SPESIFIKASI | SIAP DIIMPLEMENTASI | DIIMPLEMENTASI (commit) | TERVERIFIKASI (CI/tes)

## Indeks modul
| # | Modul | Berkas | Status ringkas |
|---|---|---|---|
| 1 | Home Publik & Dashboard | 01-home-dashboard.md | Sebagian diimplementasikan; desain Landing v2 belum diputuskan |
| 2 | Profil & Pengaturan | 02-profil-pengaturan.md | Versi saat ini ada; desain v2 belum diputuskan |
| 3 | Achievements, Badge, Poin, XP, Leaderboard | 03-achievements-poin-xp-leaderboard.md | Poin/XP/Leaderboard ada; Achievements tidak ada |
| 4 | Target & Adaptive Study Planner | 04-target-planner.md | Diimplementasikan; rumus prediksi belum diputuskan |
| 5 | Materi (Kanji, Kotoba, Bunpou, Dokkai, Chōkai) | 05-materi.md | Sebagian sesuai spesifikasi tertulis |
| 6 | Hiragana & Katakana | 06-hiragana-katakana.md | Diimplementasikan sesuai spesifikasi tertulis |
| 7 | Flashcard & Kioku | 07-flashcard-kioku.md | Flashcard ada; Kioku 3 dari 12 mode aktif |
| 8 | Simulasi JLPT | 08-simulasi-jlpt.md | Versi saat ini ada; desain v2 belum diputuskan |
| 9 | Kelas & Guru | 09-kelas-guru.md | Versi saat ini ada; pembayaran dan saldo guru belum aktif |
| 10 | Royal Arena, Community, Referral & Reward | 10-arena-community-referral-reward.md | Referral/Reward ada; Arena dan Community tidak ada |
| 11 | Premium & Riwayat Pembelian | 11-premium-riwayat-pembelian.md | Premium ada; Riwayat Pembelian tidak ada; Duitku beku |

## Definisi status pengujian
LULUS (dijalankan dan berhasil) | GAGAL | BELUM TERUJI (tidak dijalankan) | SEGERA HADIR (sengaja nonaktif). CI lulus tidak berarti E2E browser lulus. Browser E2E belum pernah dijalankan (Browserbase 401/400, workspace tanpa akses ke situs).

## Catatan sumber
Isi tiap modul disusun dari survei baca-saja terhadap kode (checkpoint `5b92fd0`) dan keputusan owner yang tercatat di sesi. Survei tidak membuka definisi SQL setiap RPC; butir yang belum diverifikasi harus dicek sebelum dijadikan dasar implementasi. Desain visual final tidak tersedia dalam repository dan belum dimasukkan.

## Audit integritas Production (read-only, 2026-10-10)
Dijalankan terhadap database "Eno japan hub" hanya dengan SELECT katalog. Migration `20261020000000_v2_integrity_hardening.sql` disiapkan LOKAL dan BELUM diterapkan.
- `user_item_progress`: trigger `award_item_activity` dan `force_mastered_progress` di Production hanya `return new` / set `updated_at` (isi migration lama berbeda dari database). Menulis progres TIDAK memberi XP/poin. Klien tetap dapat menulis status progres miliknya sendiri (RLS own-row).
- `record_learning_activity`: search_path tersimpan sebagai satu identifier `"pg_catalog,public,auth"` (tidak dapat dieksploitasi, tetapi salah; diperbaiki di migration). Cek duplikasi XP `lesson_completed` mendahului lock baris `user_stats`, sehingga panggilan paralel dapat memberi +5 XP berulang untuk materi yang sama (race; diperbaiki dengan advisory lock).
- `user_item_progress`: `anon` memegang seluruh hak tabel dan `authenticated` memegang TRUNCATE/TRIGGER/REFERENCES (RLS tidak berlaku untuk TRUNCATE). Dicabut di migration.
- `enroll_in_class`: tidak ada di migration; dicatat identik dengan Production. Catatan terbuka: `on conflict ... set status='active'` dapat mengaktifkan kembali baris berstatus non-aktif. Kosakata status belum didefinisikan dan `class_enrollments` kosong, sehingga perilaku tidak diubah.
- Test: typecheck/lint/test/build BELUM TERUJI (registry npm 403). Migration BELUM TERUJI di database terisolasi.
