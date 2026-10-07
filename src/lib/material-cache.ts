import type { QueryClient } from "@tanstack/react-query";

export type MaterialCacheKind = "kanji" | "vocabulary" | "grammar" | "reading" | "questions";

/**
 * Segarkan cache pembaca setelah Admin/Editor mengubah konten.
 * Prefix invalidation sengaja dipakai agar semua level/detail yang sedang tersimpan ikut basi.
 */
export function invalidateMaterialCaches(qc: QueryClient, kind: MaterialCacheKind) {
  const keys: Record<MaterialCacheKind, ReadonlyArray<readonly string[]>> = {
    kanji: [["kanji"], ["kanji-one"], ["kanji-study"], ["materi-kanji"], ["hafalan-kanji"]],
    vocabulary: [
      ["vocab-lessons"],
      ["vocab-category-count"],
      ["vocab-count"],
      ["vocab-direct"],
      ["vocab-senses"],
      ["materi-vocab"],
      ["materi-extra-vocab"],
      ["hafalan-vocab"],
    ],
    grammar: [
      ["grammar-list"],
      ["grammar-detail"],
      ["materi-grammar"],
      ["hafalan-grammar"],
    ],
    reading: [["reading"], ["dokkai"]],
    questions: [["simulation"], ["simulasi"], ["quiz"]],
  };
  return Promise.all(keys[kind].map((queryKey) => qc.invalidateQueries({ queryKey })));
}
