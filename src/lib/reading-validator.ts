import { normalizeJapaneseSpacing } from "./japanese-spacing";

export type ReadingIssueCode =
  | "empty"
  | "edge-whitespace"
  | "double-space"
  | "punctuation-space"
  | "bracket-space"
  | "chars-changed"
  | "split-conjugation"
  | "known-bad-split"
  | "not-normalized"
  | "unsegmented";

export interface ReadingIssue {
  code: ReadingIssueCode;
  detail?: string;
}

// Punctuation that must touch the text on both sides (same set as normalizeJapaneseSpacing).
const GLUE = "、，。．！？…・";
// Fragments that only exist when a conjugated form or an auxiliary chain was cut inside a word
// (かかれて → かか れて). They are never valid stand-alone tokens in a segmented reading.
const CONJUGATION_FRAGMENTS = new Set([
  "れて",
  "れた",
  "られて",
  "られた",
  "ませんでした",
  "ましょう",
  "たり",
  "だり",
]);
// Regression fragments reported against earlier segmentations.
const KNOWN_BAD_SPLITS = ["かか れて", "おこ なわれ"];
// A reading this long without a single space was not segmented at all.
const UNSEGMENTED_MIN_LENGTH = 12;

const strip = (text: string) => text.replace(/[\s\u3000]+/g, "");

/**
 * Structural validator for a (segmented) hiragana reading. It cannot prove that a segmentation is
 * linguistically right, but it detects every class of damage the segmentation work must never
 * leave behind: stray whitespace, spacing around punctuation, changed characters, cut conjugations.
 */
export function validateReadingSpacing(
  reading: string | null | undefined,
  options: { original?: string | null | undefined } = {},
): ReadingIssue[] {
  const text = reading ?? "";
  if (!text.trim()) return [{ code: "empty" }];
  const issues: ReadingIssue[] = [];
  if (text !== text.trim()) issues.push({ code: "edge-whitespace" });
  if (/ {2,}|[\u3000\t\r\n]/.test(text)) issues.push({ code: "double-space" });
  if (new RegExp(`[${GLUE}] | [${GLUE}]`).test(text)) issues.push({ code: "punctuation-space" });
  if (/[（「『] | [）」』]/.test(text)) issues.push({ code: "bracket-space" });
  if (options.original != null && strip(options.original) !== strip(text)) {
    issues.push({ code: "chars-changed" });
  }
  for (const token of text.split(/[ 、，。．！？…]+/)) {
    if (CONJUGATION_FRAGMENTS.has(token)) issues.push({ code: "split-conjugation", detail: token });
  }
  for (const bad of KNOWN_BAD_SPLITS) {
    if (text.includes(bad)) issues.push({ code: "known-bad-split", detail: bad });
  }
  if (normalizeJapaneseSpacing(text) !== text) issues.push({ code: "not-normalized" });
  if (!/ /.test(text) && strip(text).length >= UNSEGMENTED_MIN_LENGTH) {
    issues.push({ code: "unsegmented" });
  }
  return issues;
}
