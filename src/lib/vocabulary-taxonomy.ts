export const VOCAB_PRIMARY_CATEGORIES = [
  { slug: "kata-benda", labelJa: "名詞", label: "Kata Benda", hint: "Waktu · Penghitung · Nama diri" },
  {
    slug: "kata-kerja",
    labelJa: "動詞",
    label: "Kata Kerja",
    hint: "Kel. 1 · Kel. 2 · Kel. 3 · Transitif · Intransitif · する",
  },
  { slug: "kata-sifat-i", labelJa: "い形容詞", label: "Kata Sifat い", hint: "i-keiyoushi" },
  { slug: "kata-sifat-na", labelJa: "な形容詞", label: "Kata Sifat な", hint: "na-keiyoushi" },
  { slug: "kata-keterangan", labelJa: "副詞", label: "Kata Keterangan", hint: "Waktu · Jumlah" },
  { slug: "kata-ganti", labelJa: "代名詞", label: "Kata Ganti", hint: "Orang · Penunjuk" },
  { slug: "kata-sambung", labelJa: "接続詞", label: "Kata Sambung", hint: "Penghubung · Konjungsi" },
  { slug: "kata-seru", labelJa: "感動詞", label: "Kata Seru", hint: "Seruan · Respons" },
  { slug: "ungkapan", labelJa: "表現", label: "Ungkapan", hint: "Frasa · Salam · Permintaan" },
  { slug: "lainnya", labelJa: "その他", label: "Lainnya", hint: "Partikel · Awalan · Akhiran · Penentu · Onomatope" },
] as const;

export type VocabPrimaryCategorySlug = (typeof VOCAB_PRIMARY_CATEGORIES)[number]["slug"];

const unique = <T>(values: T[]) => [...new Set(values)];

export function classifyVocabularyPartOfSpeech(value: string | null | undefined) {
  const raw = String(value ?? "").trim();
  const n = raw.toLocaleLowerCase("id-ID");
  const categories: VocabPrimaryCategorySlug[] = [];

  const add = (slug: VocabPrimaryCategorySlug, match: boolean) => {
    if (match) categories.push(slug);
  };

  add("kata-benda", /kata benda|(?:^|[^a-z])meishi(?:$|[^a-z])|nomina/.test(n));
  add("kata-kerja", /kata kerja|doushi/.test(n));
  add("kata-sifat-i", /kata sifat い|sifat い|i-keiyoushi/.test(n));
  add("kata-sifat-na", /kata sifat な|sifat な|sifat-na|na-keiyoushi/.test(n));
  add("kata-keterangan", /kata keterangan|fukushi/.test(n));
  add("kata-ganti", /kata ganti|daimeishi|pronomina/.test(n));
  add("kata-sambung", /kata sambung|kata penghubung|konjungsi|setsuzokushi/.test(n));
  add("kata-seru", /kata seru|seruan/.test(n));
  add("ungkapan", /ungkapan|frasa|kalimat/.test(n));

  if (!categories.length) categories.push("lainnya");

  const recognized = [
    /kata benda|(?:^|[^a-z])meishi(?:$|[^a-z])|nomina/gi,
    /kata kerja|doushi/gi,
    /kata sifat い|sifat い|i-keiyoushi/gi,
    /kata sifat な|sifat な|sifat-na|na-keiyoushi/gi,
    /kata keterangan|fukushi/gi,
    /kata ganti|daimeishi|pronomina/gi,
    /kata sambung|kata penghubung|konjungsi|setsuzokushi/gi,
    /kata seru|seruan/gi,
    /ungkapan|frasa|kalimat/gi,
  ];
  let remainder = raw;
  for (const pattern of recognized) remainder = remainder.replace(pattern, "");
  const details = unique(
    remainder
      .split(/\s*(?:\/|;|·)\s*/)
      .map((x) => x.replace(/^[-–—\s]+|[-–—\s]+$/g, "").trim())
      .filter(Boolean),
  );

  return { categories: unique(categories), details };
}

export function vocabularyCategoryLabel(slug: VocabPrimaryCategorySlug) {
  return VOCAB_PRIMARY_CATEGORIES.find((x) => x.slug === slug)?.label ?? "Lainnya";
}

export function formatVocabularyClass(value: string | null | undefined) {
  const parsed = classifyVocabularyPartOfSpeech(value);
  return {
    labels: parsed.categories.map(vocabularyCategoryLabel),
    details: parsed.details,
  };
}
