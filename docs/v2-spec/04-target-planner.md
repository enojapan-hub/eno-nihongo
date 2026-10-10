# 04 — Target & Adaptive Study Planner
Status: DIIMPLEMENTASIKAN (Target v2), sisa BELUM DIPUTUSKAN.

## TERKUNCI
- Planner dan Target gratis untuk semua pengguna (tanpa gating, tanpa PremiumBadge).
- Target v2 berisi empat accordion: Target Harian (default terbuka), Target Mingguan (+ Ringkasan Mingguan), Jadwal & Evaluasi, Review & Tertunda.
- Target Review membuka Detail Materi (`/kanji|/kotoba|/bunpo?id=`), bukan Flashcard/Kioku. Bila tidak ada materi: empty state "Belum ada materi untuk diulang".
- Alur: Target → Detail Materi → Pelajari → Flashcard → Kioku; pindah tahap hanya lewat tombol setelah penyimpanan berhasil, tanpa redirect otomatis.

## SUDAH DIIMPLEMENTASIKAN
- `target.tsx` memuat keempat accordion di atas; `target-tertunda.tsx` (Belajar Tertunda, RPC `get_target_page_metrics`).
- `src/lib/adaptive-plan.ts`: `fetchAdaptivePlan` (RPC `refresh_adaptive_plan`, fallback `ensure_active_study_plan` dst.), tabel `study_plans`, `daily_study_tasks`; `AdaptiveSuggestion.itemType` untuk review.
- Tombol "Atur target" di `/target` kini mengarah ke `/edit-profil#planner` (diperbaiki; sebelumnya `/pengaturan`).

## BELUM DIPUTUSKAN
- Rumus "Prediksi Penyelesaian" dan aturan status "Sesuai Jadwal".
- Chōkai dalam penguasaan dan tugas harian (UI menandai "Segera hadir — konten audio sedang disiapkan"; enum `listening` sudah ada di `task_type`).

## SIAP DIIMPLEMENTASI
- Tidak ada selain rumus yang menunggu keputusan.
