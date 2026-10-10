# 02 — Profil & Pengaturan Pribadi
Status: DIIMPLEMENTASIKAN versi saat ini; desain v2 BELUM DIPUTUSKAN.

## TERKUNCI
- Planner/Target gratis untuk semua akun. Pengaturan target dilakukan di `/edit-profil` (anchor `#planner`).

## SUDAH DIIMPLEMENTASIKAN
- `/profil`: nama, JLPT level·negara, plan, stat Poin/Materi/Streak, kartu Adaptive Study Planner, baris Negara/Bahasa/Target, tombol Ajak Teman dan Tukar Poin.
- `/edit-profil`: foto (upload+crop), Nama (min 2 karakter), Negara, Bio, Bahasa aplikasi (teks "Bahasa Indonesia", tidak dapat diganti), Target JLPT (level, durasi bulan, hari belajar/minggu). Menyimpan lewat RPC `update_study_days_per_week`, `create_or_replace_study_plan`, `generate_weekly_study_plan`, `sync_daily_study_task_progress`.
- `/pengaturan`: Akses Khusus (per role), Belajar & Aplikasi (Target, Pengingat via `get_my_notification_settings`/`set_my_daily_reminder`, Mode Tampilan di localStorage `enonihongo-theme`), Akun, Bantuan (Laporkan Masalah via `submit_user_report`), Tentang.
- `/notifikasi` (`user_notifications`): filter Semua/Belum Dibaca, tandai dibaca, hapus. `/profil-foto` hanya redirect ke `/edit-profil`.

## BELUM DIPUTUSKAN
- Desain Profil v2 (tidak ada desain tertulis yang dapat diakses).
- Apakah bahasa aplikasi (id/en/ja) harus dapat diganti; saat ini UI profil menampilkan en/ja bila ada, tetapi edit tidak mendukung.
- Notifikasi satu kali "Planner kini gratis": definisi "pengguna lama" dan mekanisme penayangan.

## SIAP DIIMPLEMENTASI
- Tidak ada tanpa desain Profil v2.
