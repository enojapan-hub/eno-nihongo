type Source = {
  name: string;
  license: string;
  used: string;
  links: ReadonlyArray<readonly [label: string, href: string]>;
};

// Atribusi per jenis data; wording mengikuti ketentuan masing-masing lisensi (lihat docs/kanji-data-sources.md).
// Wajib terlihat di situs (EDRDG Licence §3); dipasang di halaman Tentang, bukan di layar belajar.
const SOURCES: readonly Source[] = [
  {
    name: "KanjiVG © Ulrich Apel",
    license: "CC BY-SA 3.0",
    used: "Struktur komponen, bushu, dan penanda bunyi. ENO NIHONGO meringkas dan menyusunnya ulang (ada perubahan).",
    links: [
      ["KanjiVG", "https://kanjivg.tagaini.net/"],
      ["Lisensi", "https://creativecommons.org/licenses/by-sa/3.0/"],
    ],
  },
  {
    name: "KANJIDIC2 © Electronic Dictionary Research and Development Group (EDRDG)",
    license: "CC BY-SA 4.0",
    used: "Bushu klasik (Kangxi) tiap kanji, untuk validasi silang. Berkas KANJIDIC2 milik EDRDG, dipakai sesuai lisensi Group.",
    links: [
      ["Proyek KANJIDIC", "https://www.edrdg.org/wiki/index.php/KANJIDIC_Project"],
      ["Lisensi EDRDG", "https://www.edrdg.org/edrdg/licence.html"],
    ],
  },
  {
    name: "Kanji alive",
    license: "CC BY 4.0",
    used: "Nama dan arti bushu. Terjemahan Indonesia dibuat oleh ENO NIHONGO.",
    links: [
      ["Kanji alive", "https://kanjialive.com/"],
      ["Lisensi", "https://creativecommons.org/licenses/by/4.0/"],
    ],
  },
];

/** Sumber & lisensi data Kanji (halaman Tentang); tidak ditampilkan di layar belajar. */
export function DataSourcesList() {
  return (
    <ul className="mt-3 space-y-4 text-sm leading-6 text-slate-600">
      {SOURCES.map((s) => (
        <li key={s.name}>
          <p>
            <span className="font-bold text-[#10221a]">{s.name}</span> — {s.license}
          </p>
          <p>{s.used}</p>
          <p>
            {s.links.map(([label, href], i) => (
              <span key={href}>
                {i > 0 && " · "}
                <a
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-semibold text-[#087d48] underline underline-offset-2"
                >
                  {label}
                </a>
              </span>
            ))}
          </p>
        </li>
      ))}
      <li>
        <p>
          <span className="font-bold text-[#10221a]">Catatan pengolahan</span> — data dari sumber di
          atas telah diproses dan disesuaikan oleh ENO NIHONGO untuk kebutuhan aplikasi ini
          (misalnya diringkas, disusun ulang, dan digabungkan). Perubahan tersebut dibuat oleh ENO
          NIHONGO, bukan oleh penyedia data, dan tidak didukung atau disahkan oleh mereka.
        </p>
      </li>
      <li>
        <p>
          <span className="font-bold text-[#10221a]">Cara Mudah Mengingat</span> — dibuat oleh ENO
          NIHONGO dari komponen terverifikasi; bukan asal-usul kanji.
        </p>
      </li>
    </ul>
  );
}
