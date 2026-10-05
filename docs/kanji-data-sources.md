# Sumber data Struktur Kanji: lisensi, provenance, pembaruan

Dokumen ini mencatat fakta dari sumber resmi. Bukan nasihat hukum; hal yang ambigu ditandai.

## Lisensi (bukti resmi)

| Sumber                              | Pemilik               | Lisensi                        | Bukti                                                                                                                              |
| ----------------------------------- | --------------------- | ------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------- |
| KanjiVG                             | Ulrich Apel           | CC BY-SA 3.0                   | https://github.com/KanjiVG/kanjivg (README: "copyright Ulrich Apel ... Attribution-Share Alike 3.0"), https://kanjivg.tagaini.net/ |
| KANJIDIC2                           | James Breen dan EDRDG | CC BY-SA 4.0 + ketentuan EDRDG | https://www.edrdg.org/edrdg/licence.html (§3 atribusi, §4 pembaruan, §8 kondisi khusus)                                            |
| Kanji alive (japanese-radicals.csv) | Kanji alive           | CC BY 4.0                      | https://github.com/kanjialive/kanji-data-media (README dan LICENSE.md)                                                             |

Ketentuan EDRDG yang relevan (kutipan ringkas dari §3-§4 halaman lisensi):

- Penggunaan komersial tidak dibatasi; perangkat lunak yang memakai berkas tidak wajib open source.
- Situs web yang memakai data wajib mencantumkan sumber, dengan tautan ke berkas lisensi/dokumentasi EDRDG.
- Bila materi dicampur dengan sumber lain, pengakuan umum atas sumber sudah cukup.
- Share-Alike berlaku bila karya diubah/dikembangkan lalu didistribusikan.
- "There must be a procedure for regular updating of the data from the most recent versions available"; contoh resmi: situs kamus memperbarui "at least once a month". Frekuensi untuk jenis penggunaan lain tidak ditentukan (AMBIGUOUS).

## Atribusi di aplikasi

Atribusi tidak ditampilkan di layar belajar. Letaknya: halaman Tentang (`/tentang#sumber-data`), dengan tautan dari footer beranda dan menu Pengaturan ("Sumber & Lisensi Data"). Isinya dibuat per jenis data (KanjiVG, KANJIDIC2/EDRDG, Kanji alive, mnemonik buatan ENO) dengan tautan lisensi. Daftar sumbernya ada di `src/components/legal/DataSourcesList.tsx`.

## Provenance per field

| Field                                                              | Sumber                                                                       | Disimpan/dihitung | Status                                       |
| ------------------------------------------------------------------ | ---------------------------------------------------------------------------- | ----------------- | -------------------------------------------- |
| `kanji_structure.radical_form`, `radical_position`, `radical_rule` | KanjiVG (atribut radical/position)                                           | disimpan          | atribusi KanjiVG                             |
| `kanji_radical_forms`, `kanji_radicals`, `kanji_radical_names`     | Kanji alive (nama, arti Inggris); terjemahan Indonesia oleh ENO              | disimpan          | atribusi Kanji alive                         |
| `radical_kd2_base`, `radical_status`                               | KANJIDIC2 (bushu klasik) dibandingkan dengan KanjiVG                         | disimpan          | atribusi EDRDG + prosedur pembaruan di bawah |
| `kanji_components` (pohon, kedalaman, urutan)                      | KanjiVG; aturan pemangkasan ENO                                              | disimpan          | atribusi KanjiVG                             |
| tipe node (kanji / bentuk bushu / grafis / non-Unicode)            | dihitung saat baca dari tabel ENO                                            | dihitung          | turunan, tanpa sumber baru                   |
| `role = phonetic`                                                  | penanda `kvg:phon` KanjiVG (812 kanji); `role_source = 'KanjiVG (kvg:phon)'` | disimpan          | atribusi KanjiVG                             |
| `role = semantic`                                                  | KanjiVG tidak punya penanda makna terdokumentasi                             | tidak disimpan    | 0 (dikosongkan migrasi 20261008000000)       |
| `kanji_mnemonics`                                                  | dibuat oleh ENO dari komponen terverifikasi                                  | disimpan          | karya ENO                                    |
| etimologi                                                          | tidak ada                                                                    | tidak disimpan    | 0                                            |

## Peran bunyi/makna dan Make Me a Hanzi

Dokumentasi resmi KanjiVG (https://kanjivg.tagaini.net/svg-format.html, bagian `phon`): "The `phon` attribute should mark the part indicating the pronunciation. The values of this attribute are inconsistent, and the meanings of many of them are completely undocumented." ENO hanya memakai KEBERADAAN atribut pada grup anak langsung, tidak pernah nilainya. Tidak ada atribut makna di dokumentasi KanjiVG.

Perbandingan deterministik atas 1510 baris peran sebelum perubahan (CURRENT_ROLE / SAFE_SOURCE_ROLE / RESULT):

- phonetic 812: setiap baris adalah grup anak langsung yang membawa `kvg:phon` di KanjiVG -> KEEP_SAFE (812). CONFLICT 0, UNKNOWN 0.
- semantic 698: tidak ada penanda makna di KanjiVG (698 berasal dari kesimpulan struktur dua bagian + kamus pembanding) -> REMOVE_UNVERIFIED (698), dikosongkan.

Make Me a Hanzi tidak dipakai lagi oleh data produksi: tidak ada baris yang disimpan dengan sumber itu, kodenya tidak mereferensikannya, dan entri atribusinya dihapus. Ia hanya tersisa sebagai referensi riwayat pengembangan (skrip di luar repo yang pernah menyaring baris). Catatan jujur: 812 kanji itu dulu dipilih dari 1171 yang bertanda KanjiVG dengan penyaring tersebut; tiap baris yang tersimpan tetap dapat dibuktikan dari KanjiVG saja. Kanji bertanda KanjiVG lainnya sengaja tidak ditambahkan (kualitas penanda tidak konsisten).

## Share-Alike (ringkasan audit; bukan nasihat hukum)

EKSPLISIT di teks lisensi resmi:

- KanjiVG, CC BY-SA 3.0 (legalcode): atribusi pencipta/judul/URI dan tautan lisensi bila Distribute/Publicly Perform (4(c)); Adaptation harus memberi label bahwa ada perubahan (3(b)) dan hanya boleh didistribusikan di bawah CC BY-SA yang sama atau lebih baru (4(b)). Kumpulan (Collection) yang memuat Karya tanpa diubah tidak wajib seluruhnya berlisensi sama (4(a)/(b)).
- KANJIDIC2, EDRDG: CC BY-SA 4.0 + ketentuan EDRDG (atribusi; tandai bila diubah; Adapter's License harus CC BY-SA 4.0 atau kompatibel, §3(b); hak basis data sui generis: basis data yang memuat bagian substansial isi adalah Adapted Material, §4(b), isinya sendiri tidak). EDRDG: perangkat lunak tidak wajib open source; pembaruan rutin (contoh "at least once a month").
  INTERPRETASI / AMBIGUOUS, REQUIRES LEGAL DECISION:
- Apakah data turunan ENO (tabel `kanji_structure`, `kanji_components`, hasil RPC `get_kanji_structure` yang dapat dibaca klien) dianggap "Adaptation/Adapted Material" yang didistribusikan, sehingga perlu diberi lisensi CC BY-SA dan tersedia untuk diunduh.
- Apakah akses lewat RPC/PostgREST termasuk "Share/Distribute".
- Apakah lisensi aplikasi secara keseluruhan terpengaruh (teks lisensi menyebut hanya Adaptation, bukan Collection/perangkat lunak; EDRDG menyatakan perangkat lunak tidak wajib open source).
  Keputusan itu belum diambil; tidak ada perubahan lisensi repositori.

## Prosedur pembaruan KANJIDIC2

`scripts/kanjidic2-radical-check.mjs` mengunduh berkas resmi `https://www.edrdg.org/kanjidic/kanjidic2.xml.gz`, membaca bushu klasik, dan membandingkannya dengan `supabase/data/kanjidic2-radicals.json` (hanya kanji ENO). Workflow `.github/workflows/kanjidic2-check.yml` menjalankannya tiap bulan (tanggal 1) tanpa secret; gagal bila ada selisih.

Bila ada selisih:

1. Jalankan `node scripts/kanjidic2-radical-check.mjs --write` untuk memperbarui snapshot (versi, tanggal, sha256).
2. Buat migrasi SQL manual yang hanya memperbarui baris terdampak (`radical_kd2_base`, `radical_status`). Jangan mengubah baris `needs_review` atau menyelesaikan konflik secara otomatis.
3. Buka PR; verifikasi ulang jumlah baris terdampak.

Workflow dapat dipicu manual (`workflow_dispatch`) setelah berada di cabang default; selama belum, ia berjalan pada PR yang mengubah workflow/skrip/snapshot. Skrip hanya mendeteksi selisih (tidak commit, tidak deploy, tanpa secret).

Catatan: snapshot awal diambil dari mirror GitHub (`verified_against_official: false`) karena edrdg.org tidak dapat dijangkau dari lingkungan pengembangan; eksekusi workflow pertama akan membandingkannya dengan berkas resmi.
