# Draft — Komisi Guru & Saldo Kelas Berbayar

Status: **DESAIN SAJA — belum diaktifkan, belum ada migration, belum ada UI, belum terhubung payout Duitku.**

## Sumber kebenaran yang sudah ada
- `classes.teacher_id`, `classes.price`, `classes.currency`, `classes.ends_at`, `classes.status`.
- `payment_orders` sudah mendukung `product_type = 'teacher_class'`, `provider = 'duitku'`, `product_id`, `amount_idr`, status pembayaran dan `paid_at`.
- Pembayaran hanya boleh menghasilkan komisi setelah order kelas tervalidasi **paid** oleh callback/provider server-side.

## Aturan bisnis v1
1. Biaya admin ENO NIHONGO: **20%** dari pembayaran kelas yang berhasil.
2. Hak guru: **80%**.
3. Persentase harus disalin/snapshot ke transaksi saat pembayaran berhasil. Perubahan tarif masa depan tidak boleh mengubah transaksi lama.
4. Komisi guru masuk status **pending/tertahan** setelah pembayaran berhasil.
5. Pending baru menjadi **available/tersedia** setelah kelas benar-benar berakhir (`ends_at <= now()`) dan kelas memenuhi status akhir yang disepakati.
6. Guru tidak dapat menarik saldo pending.
7. Refund/cancel harus membalik entitlement secara idempotent. Jika belum cair, kurangi pending/available; jika payout sudah diproses, masuk jalur rekonsiliasi admin — jangan membuat saldo negatif diam-diam.
8. Semua nominal IDR disimpan sebagai integer/bigint; jangan gunakan floating point.
9. Saldo adalah hasil penjumlahan ledger immutable, bukan kolom saldo yang dapat diedit langsung.
10. Semua event pembayaran, release, refund, withdrawal harus memiliki idempotency key/unique reference agar callback berulang tidak menggandakan uang.

### Pembulatan
Untuk pembayaran `gross_amount`:
- `admin_fee = floor(gross_amount * 20 / 100)`
- `teacher_net = gross_amount - admin_fee`
Dengan ini `gross = admin_fee + teacher_net` selalu tepat.

## Tabel yang direncanakan

### teacher_earning_ledger
Satu sumber kebenaran mutasi komisi guru.
- id uuid PK
- teacher_id uuid FK auth.users
- class_id uuid FK classes
- payment_order_id uuid FK payment_orders nullable untuk event non-pembayaran
- entry_type: earning | release | refund_adjustment | withdrawal_hold | withdrawal_paid | withdrawal_reversal
- gross_amount_idr bigint
- admin_fee_idr bigint
- teacher_amount_idr bigint (signed sesuai tipe entry)
- admin_fee_percent numeric — snapshot, default awal 20
- balance_bucket: pending | available | withdrawn
- idempotency_key text UNIQUE
- occurred_at timestamptz
- metadata jsonb terbatas/non-secret

Catatan implementasi: jangan membuat dua sumber saldo. Query/RPC saldo menghitung ledger berdasarkan bucket dan tipe transaksi.

### teacher_payout_accounts
Rekening pencairan milik guru.
- id uuid PK
- teacher_id uuid
- bank_code / bank_name
- account_number (akses dibatasi; tampilkan masked pada UI)
- account_holder_name
- status: pending_verification | verified | rejected
- created_at / updated_at
- satu rekening default aktif untuk v1

Nomor rekening adalah data sensitif: RLS owner/admin, tidak boleh ikut query kelas/peserta, tidak ditulis ke log/audit metadata umum.

### teacher_withdrawals
Permintaan tarik saldo.
- id uuid PK
- teacher_id uuid
- payout_account_id uuid
- amount_idr bigint
- status: requested | processing | paid | failed | rejected
- provider/reference nullable
- requested_at / processed_at
- failure_reason nullable
- idempotency_key UNIQUE

Saldo available harus di-hold secara atomik ketika withdrawal dibuat untuk mencegah double withdrawal/race condition.

## Alur transaksi
`payment_orders(paid, teacher_class)`
→ validasi `product_id = classes.id` dan nominal/order
→ snapshot 20% admin + 80% guru
→ ledger earning ke **pending**
→ kelas berakhir
→ proses release idempotent pending → **available**
→ guru membuat withdrawal
→ available di-hold
→ payout diproses
→ sukses: **withdrawn**
→ gagal: hold dikembalikan ke **available**.

## Menu Guru — Saldo
Tambahkan setelah backend siap:
- Saldo tersedia
- Saldo tertahan
- Total pendapatan
- Biaya admin 20%
- Riwayat pendapatan per kelas
- Rekening pencairan
- Tarik saldo
- Riwayat withdrawal + status

Pada detail pendapatan tampilkan: nama kelas, pendapatan kotor, biaya admin, komisi bersih guru, status tertahan/tersedia, tanggal kelas berakhir.

## Panel Admin
- Tarif platform: awal **20%** (perubahan hanya berlaku transaksi baru).
- Gross revenue kelas.
- Bagian ENO NIHONGO.
- Komisi guru pending/available/withdrawn.
- Daftar withdrawal dan rekonsiliasi.
- Refund/failed payout harus terlihat di audit trail.

## RLS / keamanan
- Guru hanya membaca ledger, rekening dan withdrawal miliknya.
- Guru tidak dapat INSERT/UPDATE ledger langsung.
- Mutasi uang hanya lewat RPC/backend server yang tervalidasi.
- Admin dapat membaca seluruh settlement tetapi perubahan finansial harus melalui fungsi terkontrol dan audit log.
- Callback Duitku harus diverifikasi server-side sebelum mengubah `payment_orders` atau ledger.
- Jangan mempercayai nominal, teacher_id, class_id, status atau fee dari client.

## Kondisi sebelum implementasi
Jangan aktifkan sampai kontrak integrasi Duitku final diketahui:
- callback sukses/gagal/refund dan signature verification,
- apakah payout/disbursement ke rekening guru tersedia melalui produk/provider yang dipakai,
- bank code + validasi rekening,
- fee payout/provider,
- settlement timing,
- refund/chargeback behavior.

Jika Duitku yang disetujui hanya payment gateway dan tidak menyediakan disbursement yang diperlukan, payment collection tetap Duitku tetapi payout guru harus memakai jalur/provider yang memang mendukung pencairan. Jangan menganggap API payout tersedia tanpa verifikasi.

## Acceptance criteria implementasi
- Satu callback paid yang dikirim berulang hanya membuat satu earning.
- Contoh Rp100.000 → admin Rp20.000, guru Rp80.000.
- Sebelum kelas selesai: Rp80.000 pending, available Rp0.
- Setelah release kelas: pending Rp0, available Rp80.000.
- Withdrawal bersamaan tidak dapat melebihi available.
- Refund menghasilkan koreksi yang dapat diaudit.
- Guru A tidak dapat membaca saldo/rekening Guru B.
- Semua nominal pada panel guru = hasil ledger, bukan perhitungan client.
