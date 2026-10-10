# 09 — Kelas & Guru
Status: DIIMPLEMENTASIKAN versi saat ini; desain v2 dan pembayaran BELUM DIPUTUSKAN.

## TERKUNCI
- Pembayaran Duitku dibekukan: kelas berbayar tidak boleh bisa didaftar sebelum owner mengaktifkannya.

## SUDAH DIIMPLEMENTASIKAN
- Siswa: `kelas.tsx` (katalog + Produk Digital), `kelas.$classId.tsx` (detail/daftar), `kelas-saya.tsx`, workspace (Beranda, Materi, Tugas & Kuis, Jadwal, Pengumuman, Nilai), tugas dan kuis.
- Guru: `guru.tsx`, `guru-kelas-baru.tsx`, kelola kelas (Ringkasan/Peserta/Pengaturan, Konten, Nilai & Koreksi). Admin: `admin-kelas.tsx`.
- Kelas gratis dapat didaftar langsung (RPC `enroll_in_class`). Wrapper di `src/lib/classroom.ts`.
- Saldo Guru: "Segera tersedia", nilai hardcode Rp0 (pembagian 80/20 tertulis di UI), tarik saldo nonaktif.

## AUDIT PENDAFTARAN KELAS BERBAYAR (baca-saja, terverifikasi)
- RPC `public.enroll_in_class` (SECURITY DEFINER, `search_path=public`) di database menolak kelas berbayar di server: `if coalesce(v_price,0)>0 then raise exception 'Pendaftaran kelas berbayar belum tersedia'`. Juga mewajibkan login, status `published`, dan kapasitas.
- Catatan drift: fungsi ini tidak ada di `supabase/migrations` lokal (hanya di `types.ts` dan database). Perlu migration pencatatan, menunggu izin.
- DIPERBAIKI di UI: tombol bawah `kelas.$classId.tsx` untuk kelas berbayar kini nonaktif ("Pendaftaran belum dibuka"). Ini hanya kejujuran UI; penegakan tetap di server.

## BELUM DIPUTUSKAN
- Desain Kelas v2 (tidak ada desain tertulis).
- Aturan saldo/pencairan Guru dan pembagian hasil.
- Status Produk Digital (apakah pembelian terhubung ke `payment_orders`).

## SIAP DIIMPLEMENTASI
- Tidak ada selain migration pencatatan `enroll_in_class` (menunggu izin).
