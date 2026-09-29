import type { ReactNode } from "react";

/**
 * Japanese text is rendered exactly as authored.
 *
 * This component used to rewrite text nodes with `Intl.Segmenter("ja")` and insert a space between every
 * "word-like" segment. The ICU segmenter is morphological, not bunsetsu-based, so it split words such as
 * 閉|ま|って or 日本|語, and word boundaries between hiragana runs (ことが あります, かもしれません) cannot be
 * derived reliably from raw text. Guessing wrongly corrupts the content, so no spaces are created or removed:
 * whitespace that exists in the source (e.g. the hand-spaced N5/N4 content) is preserved as is.
 */
export function JapaneseSpacing({ children }: { children: ReactNode }) {
  return <div>{children}</div>;
}
