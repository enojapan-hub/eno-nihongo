# 08 — Simulasi JLPT
Status: DIIMPLEMENTASIKAN versi saat ini; desain v2 BELUM DIPUTUSKAN.

## TERKUNCI
- Level mengikuti target JLPT profil. Navigasi utama memuat SIMULASI.

## SUDAH DIIMPLEMENTASIKAN
- Hub `/simulasi`: Latihan per Bagian (Kanji & Kosakata, Bunpou, Dokkai, Choukai), Simulasi Penuh (badge FREE; teks "tanpa batas selama tahap pengembangan"), ENO Monthly Exam (Premium).
- Simulasi penuh (`simulasi-penuh.$level.tsx` / `.$session.tsx`), hasil, review ("Pembahasan"), sertifikat; waktu sesi di `src/lib/jlpt-simulation-config.ts` (N5/N4/N3 = 3 sesi; N2/N1 = 2). RPC antara lain `start_jlpt_simulation_full`, `submit_jlpt_simulation_section`, `get_published_simulation_questions`, `can_start_full_simulation`.
- ENO Exam (`eno-exam*.tsx`): Premium, 1 percobaan.

## KETIDAKKONSISTENAN
- DIPERBAIKI: tombol "Ikuti Monthly Exam" di `simulasi.tsx` kini tautan ke `/eno-exam`.
- Salinan "tanpa batas" vs RPC yang mengembalikan `monthlyLimit/usedThisMonth`: penegakan batas belum diverifikasi.

## BELUM DIPUTUSKAN
- Desain Simulasi v2 (tidak ada desain tertulis).
- Kebijakan batas simulasi penuh Free vs Premium setelah tahap pengembangan.

## SIAP DIIMPLEMENTASI
- Tidak ada. Target minimal 5 simulasi penuh per level N5–N1 belum diverifikasi terhadap data aktual (BELUM TERUJI).
