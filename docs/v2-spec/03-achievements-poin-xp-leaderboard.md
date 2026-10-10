# 03 — ENO Achievements, Badge, Poin, XP & Leaderboard
Status: Poin/XP/Leaderboard DIIMPLEMENTASIKAN; Achievements/Badge Tantangan TIDAK ADA di kode.

## TERKUNCI
- XP = level akun; Poin (`reward_points`) terpisah dari XP ("XP tetap khusus level akun").
- Tidak boleh ada hadiah ganda; hadiah hanya lewat RPC aman yang sudah ada.

## SUDAH DIIMPLEMENTASIKAN
- Level akun: `src/lib/progression.ts` (MAX_ACCOUNT_LEVEL 100, `xpFloorForLevel`); liga Bronze/Silver/Gold/Platinum/Diamond (ambang XP mingguan dan poin di `LEAGUES`).
- `/leaderboard`: tab ranking dan league; periode Mingguan/Bulanan/Sepanjang Masa; filter level; podium, "Posisi kamu"; liga (reset Senin 00:00 JST). RPC `get_leaderboard`, `get_competition_leaderboard`.
- `/tukar-poin`: saldo, poin belajar, katalog satu item "Premium 7 hari" 1.000 poin (RPC `redeem_points_for_premium`), riwayat `point_redemptions`.
- `/progress`: XP/akurasi/quiz/hari aktif, ringkasan Kioku, laporan 7 hari.
- Satu-satunya "badge" = badge identitas sosial (`src/lib/social/social-badges.ts`: Verified, Admin, Sensei, Premium/Diamond, FREE).

## KETIDAKKONSISTENAN
- DIPERBAIKI (belum diuji di browser): kartu "Tukar Poin Premium ... Segera" di `leaderboard.tsx` kini tautan aktif ke `/tukar-poin`.
- `tukar-poin.tsx` memakai client Supabase `@/lib/supabase/client` berbeda dari halaman lain (`@/integrations/supabase/client`).

## BELUM DIPUTUSKAN
- Seluruh Achievements/Badge Tantangan: daftar, kriteria, hadiah, tampilan galeri, data (tabel/RPC baru dan migration).
- Katalog hadiah poin selain Premium 7 hari.
- Bonus streak dan periode leaderboard khusus ENO Rush.

## SIAP DIIMPLEMENTASI
- Tidak ada. Achievements/Badge menunggu spesifikasi.
