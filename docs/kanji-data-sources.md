# Sumber data Struktur Kanji: lisensi, provenance, pembaruan

Dokumen ini mencatat fakta dari sumber resmi. Bukan nasihat hukum; hal yang ambigu ditandai.

## Lisensi (bukti resmi)

| Sumber | Pemilik | Lisensi | Bukti |
| --- | --- | --- | --- |
| KanjiVG | Ulrich Apel | CC BY-SA 3.0 | https://github.com/KanjiVG/kanjivg (README: "copyright Ulrich Apel ... Attribution-Share Alike 3.0"), https://kanjivg.tagaini.net/ |
| KANJIDIC2 | James Breen dan EDRDG | CC BY-SA 4.0 + ketentuan EDRDG | https://www.edrdg.org/edrdg/licence.html (§3 atribusi, §4 pembaruan, §8 kondisi khusus) |
| Kanji alive (japanese-radicals.csv) | Kanji alive | CC BY 4.0 | https://github.com/kanjialive/kanji-data-media (README dan LICENSE.md) |
| Make Me a Hanzi (dictionary.txt) | Shaunak Kishore | LGPL v3 | https://github.com/skishore/makemeahanzi (berkas COPYING) |

Ketentuan EDRDG yang relevan (kutipan ringkas dari §3-§4 halaman lisensi):
- Penggunaan komersial tidak dibatasi; perangkat lunak yang memakai berkas tidak wajib open source.
- Situs web yang memakai data wajib mencantumkan sumber, dengan tautan ke berkas lisensi/dokumentasi EDRDG.
- Bila materi dicampur dengan sumber lain, pengakuan umum atas sumber sudah cukup.
- Share-Alike berlaku bila karya diubah/dikembangkan lalu didistribusikan.
- "There must be a procedure for regular updating of the data from the most recent versions available"; contoh resmi: situs kamus memperbarui "at least once a month". Frekuensi untuk jenis penggunaan lain tidak ditentukan (AMBIGUOUS).

## Atribusi di aplikasi

Atribusi tidak ditampilkan di layar belajar. Letaknya: halaman Tentang (`/tentang#sumber-data`), dengan tautan dari footer beranda dan menu Pengaturan ("Sumber & Lisensi Data"). Isinya dibuat per jenis data (KanjiVG, KANJIDIC2/EDRDG, Kanji alive, Make Me a Hanzi, mnemonik buatan ENO) dengan tautan lisensi. Daftar sumbernya ada di `src/components/legal/DataSourcesList.tsx`.

## Provenance per field

| Field | Sumber | Disimpan/dihitung | Status |
| --- | --- | --- | --- |
| `kanji_structure.radical_form`, `radical_position`, `radical_rule` | KanjiVG (atribut radical/position) | disimpan | atribusi KanjiVG |
| `kanji_radical_forms`, `kanji_radicals`, `kanji_radical_names` | Kanji alive (nama, arti Inggris); terjemahan Indonesia oleh ENO | disimpan | atribusi Kanji alive |
| `radical_kd2_base`, `radical_status` | KANJIDIC2 (bushu klasik) dibandingkan dengan KanjiVG | disimpan | atribusi EDRDG + prosedur pembaruan di bawah |
| `kanji_components` (pohon, kedalaman, urutan) | KanjiVG; aturan pemangkasan ENO | disimpan | atribusi KanjiVG |
| tipe node (kanji / bentuk bushu / grafis / non-Unicode) | dihitung saat baca dari tabel ENO | dihitung | turunan, tanpa sumber baru |
| `role = phonetic` | penanda `kvg:phon` KanjiVG; hanya disimpan bila kamus pembanding setuju | disimpan | lihat catatan Make Me a Hanzi |
| `role = semantic` | identifikasi komponen makna, hanya bila dua sumber setuju | disimpan | lihat catatan Make Me a Hanzi |
| `kanji_mnemonics` | dibuat oleh ENO dari komponen terverifikasi | disimpan | karya ENO |
| etimologi | tidak ada | tidak disimpan | 0 |

## Make Me a Hanzi: cara pakai dan status

Dipakai hanya sebagai pembanding. Isi (hint, definisi, teks etimologi) tidak disimpan. Namun pemilihan baris yang disimpan bergantung pada kesepakatan dengan data tersebut:
- Peran bunyi: nilai yang disimpan adalah penanda KanjiVG; Make Me a Hanzi hanya menyaring (812 kanji lolos dari 1171 yang bertanda di KanjiVG).
- Peran makna: 695 dari 698 diturunkan dari struktur dua bagian KanjiVG plus penanda bunyi; 3 kanji (嗣 旗 飾) bergantung pada Make Me a Hanzi untuk menunjuk komponen makna.
- README Make Me a Hanzi hanya menyebut Unihan dan CJKlib sebagai sumber `dictionary.txt`; asal kolom `etymology` tidak dijelaskan.
Apakah ini menimbulkan kewajiban turunan LGPL v3 atas data ENO: AMBIGUOUS, perlu keputusan pemilik.

## Prosedur pembaruan KANJIDIC2

`scripts/kanjidic2-radical-check.mjs` mengunduh berkas resmi `https://www.edrdg.org/kanjidic/kanjidic2.xml.gz`, membaca bushu klasik, dan membandingkannya dengan `supabase/data/kanjidic2-radicals.json` (hanya kanji ENO). Workflow `.github/workflows/kanjidic2-check.yml` menjalankannya tiap bulan (tanggal 1) tanpa secret; gagal bila ada selisih.

Bila ada selisih:
1. Jalankan `node scripts/kanjidic2-radical-check.mjs --write` untuk memperbarui snapshot (versi, tanggal, sha256).
2. Buat migrasi SQL manual yang hanya memperbarui baris terdampak (`radical_kd2_base`, `radical_status`). Jangan mengubah baris `needs_review` atau menyelesaikan konflik secara otomatis.
3. Buka PR; verifikasi ulang jumlah baris terdampak.

Catatan: snapshot awal diambil dari mirror GitHub (`verified_against_official: false`) karena edrdg.org tidak dapat dijangkau dari lingkungan pengembangan; eksekusi workflow pertama akan membandingkannya dengan berkas resmi.
