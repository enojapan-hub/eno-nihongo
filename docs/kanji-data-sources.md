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

## Share-Alike: penilaian akhir untuk database/RPC (bukan nasihat hukum)

EXPLICIT LICENSE TEXT

- CC BY-SA 4.0 (legalcode): `Share` mencakup "make material available to the public including in ways that members of the public may access the material from a place and at a time individually chosen by them" (§1k), jadi penyajian online termasuk Share. ShareAlike berlaku bila "You Share Adapted Material You produce" (§3b); `Adapted Material` = materi yang diturunkan dari Licensed Material dan "translated, altered, arranged, transformed, or otherwise modified in a manner requiring permission under the Copyright and Similar Rights" (§1a). Adapter's License harus CC BY-SA 4.0+ atau kompatibel (§3b1). Basis data: bila bagian substansial isi dimasukkan ke database yang memiliki hak sui generis milik pengguna, "the database ... (but not its individual contents) is Adapted Material" (§4b). Memberi tanda perubahan wajib (§3a1B).
- CC BY-SA 3.0 (KanjiVG, legalcode): `Adaptation` dikecualikan bila berupa `Collection` yang memuat Karya utuh tanpa diubah (§1a-b); Adaptation hanya boleh di-Distribute atau Publicly Perform di bawah CC BY-SA yang sama atau lebih baru (§4b) dan wajib diberi label perubahan (§3b); §4b berlaku bagi Adaptation, dan tidak mewajibkan Collection di luar Adaptation itu berlisensi sama. `Publicly Perform` mencakup membuat tersedia bagi publik sehingga dapat diakses dari tempat dan waktu pilihan sendiri (§1i).
- EDRDG (licence.html): perangkat lunak yang memakai berkas tidak wajib open source; Share-Alike bila diubah/dikembangkan lalu didistribusikan; atribusi di situs; pembaruan rutin (contoh situs kamus: sebulan sekali).

OFFICIAL GUIDANCE (Creative Commons FAQ dan wiki ShareAlike interpretation / Data)

- "The ShareAlike condition applies only for works considered adaptations under copyright law, not simply in collections with other works."
- "The ShareAlike condition only applies when a work is publicly shared"; adaptasi yang tidak dipublikasikan tidak wajib dilisensikan ulang.
- Untuk database: SA mewajibkan lisensi sama atau kompatibel pada database yang dibagikan publik dan memuat bagian substansial isi, "Note that this does not require you to ShareAlike any copyright or other rights you have in the individual contents of the database."
- CC tidak merekomendasikan lisensinya untuk perangkat lunak; operasi SA bergantung pada apa yang dianggap adaptasi menurut hukum hak cipta yurisdiksi tertentu.
- Tidak ada panduan resmi CC, EDRDG, atau KanjiVG yang menyebut "RPC", "API", atau "penyimpanan server".

ENGINEERING INTERPRETATION (bukan fakta hukum)

- KanjiVG: A. Struktur komponen ENO (pohon, bushu, penanda bunyi) diturunkan dari pengelompokan KanjiVG; apakah itu "diubah dengan cara yang memerlukan izin hak cipta" bergantung pada orisinalitas pengelompokan KanjiVG dan transformasi ENO. B. Penyimpanan hanya di server tanpa akses publik: tidak ada Share (panduan CC). C. Respons RPC yang dibaca browser pengguna: kemungkinan besar termasuk "Share"/"Publicly Perform" menurut definisi online di atas, sehingga bila hasilnya Adaptation, SA berlaku. D. JSON hasil query: SA melekat pada materi turunan yang dikirim, bukan pada format pengiriman. E. Yang terkena hanya materi turunan KanjiVG (tabel struktur/komponen dan keluarannya), bukan seluruh database ENO (akun, progres, SRS, dll.). F. Source code aplikasi: tidak ada dasar eksplisit; SA mengikat Adaptation, dan pada 4.0 yang dilisensikan ulang hanya kontribusi pada Adapted Material.
- KANJIDIC2: A. Nomor bushu klasik dan status per kanji adalah fakta/klasifikasi yang diolah; bila ada hak (hak cipta atau sui generis) atas pemilihan/penyusunannya, hasil olahan ENO bisa menjadi Adapted Material. B. Hanya tabel yang memuat bagian substansial isi KANJIDIC2 yang menjadi Adapted Material (§4b), bukan data lain. ENO hanya memakai 1 nilai per kanji (bushu klasik) untuk 2220 kanji, jauh dari "bagian substansial" isi KANJIDIC2, tetapi ambang substansial adalah penilaian hukum. C. Klausul database hanya berlaku bila hak sui generis berlaku pada penggunaan itu. D. Seperti KanjiVG. E. Bagian yang memuat materi turunan KANJIDIC2. F. Tidak (EDRDG: perangkat lunak tidak wajib open source). G. Tidak ada kewajiban eksplisit menyediakan unduhan; yang wajib adalah lisensi sama dan pemberitahuan lisensi saat Share. H. Pembaruan berkala: dicontohkan sebulan sekali untuk situs kamus; berlaku nyata hanya sejauh ENO menyajikan data KANJIDIC2 sebagai kamus (ENO menyajikan satu nilai bushu klasik dan memeriksa tiap bulan lewat workflow).

UNCERTAINTY (satu pertanyaan hukum tersisa)

- Apakah tabel struktur/komponen/bushu turunan ENO adalah "Adapted Material" (modifikasi yang memerlukan izin hak cipta atau melibatkan bagian substansial database sui generis) yang kemudian dibagikan lewat respons RPC. Jawaban resmi tidak tersedia; hasilnya menentukan perlunya lisensi CC BY-SA pada materi turunan itu.

Yang sudah dipenuhi tanpa menunggu keputusan: atribusi, tautan lisensi, dan catatan pengolahan di `/tentang#sumber-data`. Tidak dilakukan (tidak dibutuhkan oleh teks eksplisit): perubahan lisensi repo, unduhan dataset, atau perubahan RLS.

## Prosedur pembaruan KANJIDIC2

`scripts/kanjidic2-radical-check.mjs` mengunduh berkas resmi `https://www.edrdg.org/kanjidic/kanjidic2.xml.gz`, membaca bushu klasik, dan membandingkannya dengan `supabase/data/kanjidic2-radicals.json` (hanya kanji ENO). Workflow `.github/workflows/kanjidic2-check.yml` menjalankannya tiap bulan (tanggal 1) tanpa secret; gagal bila ada selisih.

Bila ada selisih:

1. Jalankan `node scripts/kanjidic2-radical-check.mjs --write` untuk memperbarui snapshot (versi, tanggal, sha256).
2. Buat migrasi SQL manual yang hanya memperbarui baris terdampak (`radical_kd2_base`, `radical_status`). Jangan mengubah baris `needs_review` atau menyelesaikan konflik secara otomatis.
3. Buka PR; verifikasi ulang jumlah baris terdampak.

Workflow dapat dipicu manual (`workflow_dispatch`) setelah berada di cabang default; selama belum, ia berjalan pada PR yang mengubah workflow/skrip/snapshot. Skrip hanya mendeteksi selisih (tidak commit, tidak deploy, tanpa secret).

Metadata manifest membedakan dua fakta: `snapshot` (asal data: mirror GitHub, versi 2026-96, `obtained_from_official: false`) dan `verification` (verifikasi terakhir terhadap berkas resmi). Verifikasi pertama: versi resmi 2026-278 (2026-10-05), sha256 `d9184343a8ce9e999ce9d22d45ca7201f906f80064073fb210faff436e7fa7e4`, hasil MATCH, selisih bushu 0, hilang 0 ([run](https://github.com/enojapan-hub/eno-nihongo/actions/runs/37270943611)). Karena MATCH, data bushu tidak ditulis ulang. Workflow berikutnya mencetak versi resmi, sha256, dan "Hasil: MATCH/DIFFERENT" (gagal unduh = exit 2); metadata `verification` hanya diperbarui lewat commit manual (`--write`), tidak otomatis.
