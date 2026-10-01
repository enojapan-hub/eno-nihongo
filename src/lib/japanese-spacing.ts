const HAS_JAPANESE = /[\u3040-\u30ff\u3400-\u9fff]/;
const PUNCTUATION = /^[、。！？!?…・）」』】〉》〕］｝,.!?;:]+$/;
const OPEN_PUNCTUATION = /^[（「『【〈《〔［｛]+$/;

/**
 * Adds learner-friendly spacing to Japanese text at display time.
 * Source/database text is never changed.
 *
 * Uses the browser's locale-aware Japanese word boundaries instead of
 * inserting spaces around kana with regex, which can corrupt real words.
 */
export function spaceJapanese(input: string | null | undefined): string {
  if (!input) return "";
  const text = input.trim();
  if (!HAS_JAPANESE.test(text)) return text.replace(/\s+/g, " ");
  if (typeof Intl === "undefined" || !("Segmenter" in Intl)) return text;

  const Segmenter = (Intl as typeof Intl & {
    Segmenter: new (locale: string, options: { granularity: "word" }) => {
      segment(value: string): Iterable<{ segment: string; isWordLike?: boolean }>;
    };
  }).Segmenter;
  const segmenter = new Segmenter("ja-JP", { granularity: "word" });
  const parts = Array.from(segmenter.segment(text))
    .map(({ segment }) => segment.trim())
    .filter(Boolean);

  let output = "";
  for (const part of parts) {
    if (!output) {
      output = part;
      continue;
    }
    if (PUNCTUATION.test(part)) {
      output += part;
      continue;
    }
    if (OPEN_PUNCTUATION.test(part) || OPEN_PUNCTUATION.test(output.slice(-1))) {
      output += part;
      continue;
    }
    output += ` ${part}`;
  }
  return output.replace(/\s+([、。！？!?…・）」』】〉》〕］｝,.!?;:])/g, "$1");
}

export function normalizeRomaji(input: string | null | undefined): string {
  return (input ?? "").trim().replace(/\s+/g, " ").replace(/\s+([,.!?;:])/g, "$1");
}
