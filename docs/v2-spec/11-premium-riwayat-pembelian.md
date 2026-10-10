# 11 — Premium & Riwayat Pembelian
Status: Premium DIIMPLEMENTASIKAN; Riwayat Pembelian TIDAK ADA; Duitku dibekukan.

## TERKUNCI
- Kioku dan Analisis Ingatan Premium; Planner dan Target gratis.
- Dilarang mengaktifkan pembayaran Duitku tanpa persetujuan owner; tidak ada pembayaran nyata dalam pengujian.

## SUDAH DIIMPLEMENTASIKAN
- Paket (`src/lib/public-plans.ts`): Premium Bulanan Rp50.000/30 hari, Tahunan Rp350.000/365 hari, Lifetime Rp1.500.000. `/paket` (publik), `checkout.tsx`, `api/duitku/create-invoice.ts`, webhook `pembayaran/duitku/callback.ts` (verifikasi signature, RPC `finalize_duitku_payment`), halaman kembali `pembayaran/duitku/selesai.tsx` (teks statis "Pembayaran sedang dikonfirmasi", tidak membaca status order).
- Akses: `src/lib/membership.ts` (`get_my_membership`; role owner/admin/editor/teacher dianggap berhak). Migration: trial Premium 14 hari untuk pengguna baru, auto-expire, aktivasi manual admin (`admin-langganan.tsx`).
- Tabel `payment_orders` hanya dirujuk oleh create-invoice dan callback.

## BELUM DIPUTUSKAN
- Riwayat Pembelian: UI baca-saja `/riwayat-pembelian` DIIMPLEMENTASI (BELUM TERUJI di build/browser): pesanan dari `payment_orders` dan hadiah dari `reward_grants`, hanya baris milik sendiri. RLS baca-sendiri `payment_orders_select_own` sudah ada di Production (tanpa migration). Masih diputuskan owner: penanganan order pending (batal/ulang) dan desain final.
- Halaman kembali Duitku: apakah membaca status order.
- Kapan dan bagaimana Duitku diaktifkan (kode tampak lengkap; pembekuan adalah keputusan owner, bukan penanda di kode).
- Penyatuan sumber harga landing dan `public-plans.ts`.

## SIAP DIIMPLEMENTASI
- Tidak ada tanpa desain Riwayat Pembelian dan persetujuan RLS/migration.
