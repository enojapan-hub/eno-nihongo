export type Example = {
  jp?: string | undefined;
  id?: string | undefined;
  reading?: string | undefined;
  /** Curated romaji from the database; consumers show it before falling back to a converter. */
  romaji?: string | undefined;
};
export function asExamples(value: unknown): Example[] {
  if (!value) return [];
  const raw = Array.isArray(value)
    ? value
    : typeof value === "string"
      ? (() => {
          try {
            return JSON.parse(value);
          } catch {
            return [value];
          }
        })()
      : [];
  if (!Array.isArray(raw)) return [];
  return raw
    .map((item) => {
      if (typeof item === "string") return { jp: item };
      if (!item || typeof item !== "object") return {};
      const x = item as Record<string, unknown>;
      const jp = x["jp"] ?? x["japanese"] ?? x["ja"] ?? x["sentence"] ?? x["example"];
      const id = x["id"] ?? x["indonesian"] ?? x["idn"] ?? x["translation_id"];
      const reading = x["reading"] ?? x["hiragana"];
      const romaji = x["romaji"];
      return {
        jp: typeof jp === "string" && jp.trim() ? jp : undefined,
        id: typeof id === "string" && id.trim() ? id : undefined,
        reading: typeof reading === "string" && reading.trim() ? reading : undefined,
        romaji: typeof romaji === "string" && romaji.trim() ? romaji.trim() : undefined,
      };
    })
    .filter((x) => x.jp || x.id);
}
