# 10 — Royal Arena, Community, Referral & Reward
Status: Referral & Reward DIIMPLEMENTASIKAN; Royal Arena dan Community TIDAK ADA sebagai halaman.

## TERKUNCI
- Hadiah referral: Premium 30 hari untuk pengundang setelah teman melakukan pembelajaran yang memenuhi syarat.

## SUDAH DIIMPLEMENTASIKAN
- `/referral` ("Ajak Teman"): kode, tautan `/auth?ref=CODE`, input "Kode referral teman" (RPC `award_referral_signup`). Backend: `activate_referral_reward` (+30 hari), `reward_grants`, `referral_events` (migration `20261008221500_secure_referral_reward.sql` dan terkait). Tidak ada daftar riwayat referral di UI.
- Lapisan sosial sebagai komponen, bukan halaman: `src/components/social/*` (ChatDock, GlobalChatPanel, DmPanel, FriendsPanel, SocialProfileCard, UsernameGate), `src/lib/social/*`. Titik pemasangan ChatDock belum ditelusuri.
- Royal Arena: tidak ada route atau kode.

## BELUM DIPUTUSKAN
- Royal Arena: konsep, aturan, hadiah, data.
- Community: apakah halaman sendiri atau memakai komponen sosial yang ada; moderasi.
- Desain final riwayat referral. Versi fungsional baca-saja DIIMPLEMENTASI di `/referral` (BELUM TERUJI di build/browser): baris `referrals` milik sendiri, tanpa nilai hadiah atau aturan baru.

## SIAP DIIMPLEMENTASI
- Tidak ada.
