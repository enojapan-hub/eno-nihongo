# Design QA — katalog kursus

## Referensi

- Sebelum klik: `/workspace/scratch/392c45579f2f/upload/IMG_0431.png`
- Sesudah klik: `/workspace/scratch/392c45579f2f/upload/IMG_0432.png`

## Hasil

- Daftar kursus: kartu horizontal dengan thumbnail, level, jumlah peserta, harga IDR, dan tautan Detail.
- Detail kursus: banner penuh, judul/level, jumlah peserta, harga IDR, fitur pembelajaran, serta CTA Daftar yang tetap terlihat di bawah.
- Uji viewport mobile 390 × 844 melalui Playwright: tiga kartu ter-render, klik kartu menuju detail, `scrollWidth === innerWidth`, dan tidak ada `pageerror`.
- Screenshot uji: `/tmp/course-list.png` dan `/tmp/course-detail.png`.

## Catatan

Validasi visual lokal selesai. Browser cloud untuk pemeriksaan tambahan tidak tersedia pada sesi ini karena batas penggunaan otomatis, sehingga pemeriksaan ini menggunakan fixture data dan browser lokal.

## Final result

passed (local browser QA)
