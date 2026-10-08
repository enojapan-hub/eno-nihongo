export const VOCAB_THEMES = [
  { slug: "warna", labelJa: "色", label: "Warna", hint: "Warna dasar dan warna umum" },
  {
    slug: "bilangan-penghitung",
    labelJa: "数・助数詞",
    label: "Bilangan & Penghitung",
    hint: "Angka · nomor · jumlah · satuan penghitung",
  },
  {
    slug: "alat-tulis",
    labelJa: "文房具",
    label: "Alat Tulis",
    hint: "Perlengkapan menulis, kertas, dan alat kantor dasar",
  },
] as const;

export type VocabThemeSlug = (typeof VOCAB_THEMES)[number]["slug"];

export function vocabularyThemeLabel(slug: VocabThemeSlug) {
  return VOCAB_THEMES.find((theme) => theme.slug === slug)?.label ?? slug;
}
