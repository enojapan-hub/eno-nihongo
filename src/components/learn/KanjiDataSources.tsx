type Source = {
  name: string;
  license: string;
  used: string;
  links: ReadonlyArray<readonly [label: string, href: string]>;
};

// Atribusi per jenis data; wording mengikuti ketentuan masing-masing lisensi (lihat docs/kanji-data-sources.md).
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
  {
    name: "Make Me a Hanzi",
    license: "LGPL v3",
    used: "Hanya pembanding untuk memverifikasi peran bunyi/makna; datanya tidak disalin.",
    links: [
      ["Make Me a Hanzi", "https://github.com/skishore/makemeahanzi"],
      ["Lisensi", "https://www.gnu.org/licenses/lgpl-3.0.html"],
    ],
  },
];

/** Atribusi ringkas yang bisa dibuka; tidak memenuhi layar belajar. */
export function KanjiDataSources() {
  return (
    <details className="mt-3 rounded-lg border bg-card text-[11px] leading-4 text-muted-foreground">
      <summary className="flex min-h-11 cursor-pointer list-none items-center px-2.5 font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary [&::-webkit-details-marker]:hidden">
        Sumber data dan lisensi
      </summary>
      <ul className="space-y-2 border-t px-2.5 py-2">
        {SOURCES.map((s) => (
          <li key={s.name}>
            <p>
              <span className="font-semibold text-foreground">{s.name}</span> — {s.license}
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
                    className="underline underline-offset-2"
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
            <span className="font-semibold text-foreground">Cara Mudah Mengingat</span> — dibuat
            oleh ENO NIHONGO dari komponen terverifikasi; bukan asal-usul kanji.
          </p>
        </li>
      </ul>
    </details>
  );
}
