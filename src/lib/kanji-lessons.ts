/** Pilihan pelajaran khusus untuk kanji terpublikasi yang belum punya nomor pelajaran valid. */
export const EXTRA_LESSON = -1;

type WithLesson = { lesson_number?: number | null };

const validLesson = (n: number | null | undefined): n is number =>
  typeof n === "number" && Number.isInteger(n) && n > 0;

/** Nomor pelajaran valid yang ada, terurut naik. */
export function lessonNumbers(cards: readonly WithLesson[]): number[] {
  return [...new Set(cards.map((c) => c.lesson_number).filter(validLesson))].sort((a, b) => a - b);
}

/** "Kanji Tambahan" hanya perlu bila ada pelajaran bernomor sekaligus kanji tanpa nomor. */
export function hasExtraKanji(cards: readonly WithLesson[]): boolean {
  return lessonNumbers(cards).length > 0 && cards.some((c) => !validLesson(c.lesson_number));
}

/** Urutan input dipertahankan (urutan deterministik dari query: lesson_number lalu sort_order). */
export function filterByLesson<T extends WithLesson>(
  cards: readonly T[],
  lesson: number | null,
): T[] {
  if (lesson === EXTRA_LESSON) return cards.filter((c) => !validLesson(c.lesson_number));
  if (lesson == null) return [...cards];
  return cards.filter((c) => c.lesson_number === lesson);
}

/** Pilihan pelajaran yang aman setelah daftar berubah: pertahankan pilihan valid, jika tidak ke pelajaran pertama. */
export function normalizeLesson(
  current: number | null,
  lessons: readonly number[],
  hasExtra: boolean,
): number | null {
  if (current === EXTRA_LESSON && hasExtra) return EXTRA_LESSON;
  if (current && lessons.includes(current)) return current;
  return lessons[0] ?? null;
}
