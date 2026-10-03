const HAS_JAPANESE = /[぀-ヿ㐀-鿿]/;
// Japanese punctuation that attaches to the text on both sides (no space before or after it).
const GLUE = "、，。．！？…・";
const OPEN_BRACKETS = "（「『【〈《〔［｛";
const CLOSE_BRACKETS = "）」』】〉》〕］｝";
// Standalone particle tokens that form one grammatical unit when authored side by side
// (に+は → には, と+も → とも, から+の → からの). Only tokens that already exist in the source are joined.
const COMPOUND_PARTICLES: Record<string, readonly string[]> = {
  に: ["は", "も"],
  へ: ["は", "も", "の"],
  と: ["は", "も", "の"],
  から: ["は", "も", "の"],
  まで: ["は", "も", "の", "に"],
  より: ["は", "も", "の"],
  か: ["も"],
  ど: ["も"],
};
const TOKEN_END = `(?=[${GLUE}${CLOSE_BRACKETS}]|$)`;

function joinCompoundParticles(text: string): string {
  const tokens = text.split(" ");
  const out: string[] = [];
  for (let i = 0; i < tokens.length; i++) {
    const current = tokens[i] ?? "";
    const next = tokens[i + 1];
    const seconds = COMPOUND_PARTICLES[current];
    if (seconds && next !== undefined) {
      const second = seconds.find((p) => new RegExp(`^${p}${TOKEN_END}`).test(next));
      if (second) {
        out.push(current + next);
        i++;
        continue;
      }
    }
    out.push(current);
  }
  return out.join(" ");
}

/**
 * Normalises the spacing of Japanese text (reading/hiragana or a sentence) for display.
 *
 * It never invents word boundaries. Spaces that exist in the source are kept because they were
 * authored; only whitespace is tidied: runs collapse to one space, nothing leads/trails, Japanese
 * punctuation hugs its neighbours, and standalone particle pairs authored as "に は" read as the single
 * unit "には". Text without spaces stays without spaces: a reading without spaces is better than one
 * with spaces in the wrong place (the previous Intl.Segmenter approach split かかれて into かか れて).
 */
export function normalizeJapaneseSpacing(input: string | null | undefined): string {
  if (!input) return "";
  const collapsed = input.replace(/[\s\u3000]+/g, " ").trim();
  if (!HAS_JAPANESE.test(collapsed)) return collapsed;
  const glued = collapsed
    .replace(new RegExp(`\\s*([${GLUE}])\\s*`, "g"), "$1")
    .replace(new RegExp(`([${OPEN_BRACKETS}])\\s+`, "g"), "$1")
    .replace(new RegExp(`\\s+([${CLOSE_BRACKETS}])`, "g"), "$1");
  return joinCompoundParticles(glued);
}

export function normalizeRomaji(input: string | null | undefined): string {
  return (input ?? "")
    .trim()
    .replace(/\s+/g, " ")
    .replace(/\s+([,.!?;:])/g, "$1");
}
