/** Ukuran font Daftar Kosakata (Kanji / Hiragana / Arti) dalam px, satu tangga untuk ketiganya. */
export const LIST_FONT_SIZES = [
  { kanji: 12, kana: 10, meaning: 10 },
  { kanji: 13, kana: 11, meaning: 11 },
  { kanji: 14, kana: 12, meaning: 12 },
  { kanji: 16, kana: 14, meaning: 14 },
  { kanji: 18, kana: 16, meaning: 16 },
  { kanji: 20, kana: 18, meaning: 18 },
  { kanji: 22, kana: 20, meaning: 20 },
] as const;
export const LIST_FONT_DEFAULT = 2;
export const LIST_FONT_MIN = 0;
export const LIST_FONT_MAX = LIST_FONT_SIZES.length - 1;
export const LIST_FONT_KEY = "eno:kotoba:font-step";

export const clampFontStep = (step: number) =>
  Number.isInteger(step)
    ? Math.min(LIST_FONT_MAX, Math.max(LIST_FONT_MIN, step))
    : LIST_FONT_DEFAULT;

export function readFontStep(storage: Pick<Storage, "getItem"> | null | undefined): number {
  try {
    const raw = storage?.getItem(LIST_FONT_KEY);
    return raw == null ? LIST_FONT_DEFAULT : clampFontStep(Number(raw));
  } catch {
    return LIST_FONT_DEFAULT;
  }
}
