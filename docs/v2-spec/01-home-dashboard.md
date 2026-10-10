# 01 — Home Publik & Dashboard
Status: sebagian DIIMPLEMENTASIKAN; sisanya BELUM DIPUTUSKAN.

## TERKUNCI (keputusan owner)
- Navigasi utama TARGET | MATERI | HOME | SIMULASI | KELAS.
- Dashboard: avatar membuka kartu profil (preview); tampil @username; Planner gratis (tanpa PremiumBadge); level JLPT mengarah ke `/edit-profil#planner`.

## SUDAH DIIMPLEMENTASIKAN (fakta kode)
- Landing `/` (`src/routes/index.tsx`): statis, tanpa query data. Seksi fitur, level N5–N1, akses (Gratis, Premium Bulanan Rp50.000, Tahunan Rp350.000, Lifetime Rp1.500.000), alasan memilih, CTA, footer kontak. Harga hardcode di file (bukan dari DB).
- Dashboard `/dashboard` (`dashboard.tsx`): sapaan + nama + @username + status Premium + edit profil; kartu target hari ini; stat XP/Poin/Hari/Target; Akses Cepat (Materi, Flashcard, Kioku, Simulasi); ringkasan memori; Progress Materi per level; Aktivitas Mingguan; JlptStatusBar; InstallPrompt. Data: `getMyAccount`, `fetchAdaptivePlan`, `fetchMembership`, `fetchLeaderboard`, RPC `get_my_dashboard_metrics`.
- Tanpa gating fitur di dashboard.

## BELUM DIPUTUSKAN
- Desain final Landing v2 (tidak ada desain tertulis yang dapat diakses).
- Apakah harga landing harus dibaca dari satu sumber bersama `src/lib/public-plans.ts` (saat ini ganda: landing hardcode vs public-plans).
- Tata letak final Dashboard v2 di luar item TERKUNCI.

## SIAP DIIMPLEMENTASI
- Tidak ada tanpa spesifikasi layar Landing/Dashboard v2.
