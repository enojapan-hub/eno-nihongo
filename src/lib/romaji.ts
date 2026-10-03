import { normalizeJapaneseSpacing, normalizeRomaji } from "./japanese-spacing";

/**
 * Shared kana → romaji fallback (modified Hepburn, long vowels written as in the source: ou/oo/uu).
 *
 * Curated romaji from the database is always preferred; this is only used when an example has a
 * reading but no romaji. It returns "" instead of guessing: unknown characters (kanji, latin) and
 * particle は/へ whose role cannot be proven from the reading's own spacing yield no romaji, because
 * a missing romaji is better than a misleading one.
 */

const VOWELS = "aiueo";
const MAX_UNSPACED_RUN = 12;
const BASE: Record<string, string> = {
  あ: "a",
  い: "i",
  う: "u",
  え: "e",
  お: "o",
  か: "ka",
  き: "ki",
  く: "ku",
  け: "ke",
  こ: "ko",
  さ: "sa",
  し: "shi",
  す: "su",
  せ: "se",
  そ: "so",
  た: "ta",
  ち: "chi",
  つ: "tsu",
  て: "te",
  と: "to",
  な: "na",
  に: "ni",
  ぬ: "nu",
  ね: "ne",
  の: "no",
  は: "ha",
  ひ: "hi",
  ふ: "fu",
  へ: "he",
  ほ: "ho",
  ま: "ma",
  み: "mi",
  む: "mu",
  め: "me",
  も: "mo",
  や: "ya",
  ゆ: "yu",
  よ: "yo",
  ら: "ra",
  り: "ri",
  る: "ru",
  れ: "re",
  ろ: "ro",
  わ: "wa",
  ゐ: "i",
  ゑ: "e",
  を: "o",
  が: "ga",
  ぎ: "gi",
  ぐ: "gu",
  げ: "ge",
  ご: "go",
  ざ: "za",
  じ: "ji",
  ず: "zu",
  ぜ: "ze",
  ぞ: "zo",
  だ: "da",
  ぢ: "ji",
  づ: "zu",
  で: "de",
  ど: "do",
  ば: "ba",
  び: "bi",
  ぶ: "bu",
  べ: "be",
  ぼ: "bo",
  ぱ: "pa",
  ぴ: "pi",
  ぷ: "pu",
  ぺ: "pe",
  ぽ: "po",
  ゔ: "vu",
};
const YOUON_PREFIX: Record<string, string> = {
  き: "ky",
  ぎ: "gy",
  し: "sh",
  じ: "j",
  ち: "ch",
  ぢ: "j",
  に: "ny",
  ひ: "hy",
  び: "by",
  ぴ: "py",
  み: "my",
  り: "ry",
};
const YOUON_VOWEL: Record<string, string> = { ゃ: "a", ゅ: "u", ょ: "o" };
// Sounds written with a small vowel/ゅ, mostly in loanwords (ファ, フィ, ティ, ウォ, ...).
const EXTENDED: Record<string, string> = {
  ふぁ: "fa",
  ふぃ: "fi",
  ふぇ: "fe",
  ふぉ: "fo",
  ふゅ: "fyu",
  てぃ: "ti",
  でぃ: "di",
  てゅ: "tyu",
  でゅ: "dyu",
  とぅ: "tu",
  どぅ: "du",
  うぃ: "wi",
  うぇ: "we",
  うぉ: "wo",
  ゔぁ: "va",
  ゔぃ: "vi",
  ゔぇ: "ve",
  ゔぉ: "vo",
  ゔゅ: "vyu",
  しぇ: "she",
  じぇ: "je",
  ちぇ: "che",
  つぁ: "tsa",
  つぃ: "tsi",
  つぇ: "tse",
  つぉ: "tso",
  くぁ: "kwa",
  くぃ: "kwi",
  くぇ: "kwe",
  くぉ: "kwo",
  ぐぁ: "gwa",
  いぇ: "ye",
  すぃ: "si",
  ずぃ: "zi",
};
const CLOSING_PUNCT: Record<string, string> = {
  "、": ",",
  "，": ",",
  "。": ".",
  "．": ".",
  "！": "!",
  "？": "?",
  "…": "...",
  "」": '"',
  "』": '"',
  "）": ")",
};
const OPENING_PUNCT: Record<string, string> = { "「": '"', "『": '"', "（": "(" };
// Particle pairs written as one unit in the reading; romaji keeps them as two words.
const COMPOUND_PARTICLES: Record<string, string> = {
  には: "ni wa",
  にも: "ni mo",
  へは: "e wa",
  へも: "e mo",
  への: "e no",
  とは: "to wa",
  とも: "to mo",
  との: "to no",
  からは: "kara wa",
  からも: "kara mo",
  からの: "kara no",
  までは: "made wa",
  までも: "made mo",
  までの: "made no",
  までに: "made ni",
  よりは: "yori wa",
  よりも: "yori mo",
  よりの: "yori no",
};
// Words in which は is read "wa" although it is not a particle in the modern sense.
const FIXED_WA = new Set(["こんにちは", "こんばんは"]);

const toHiragana = (text: string) =>
  text.replace(/[ァ-ヶ]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0x60));

/** Converts a run of kana (no spaces/punctuation) literally; null if a character is not convertible. */
function convertRun(run: string): string | null {
  let out = "";
  let geminate = false;
  const chars = [...run];
  for (let i = 0; i < chars.length; i++) {
    const c = chars[i] ?? "";
    const d = chars[i + 1];
    if (c === "っ") {
      geminate = true;
      continue;
    }
    if (c === "ー") {
      const last = out[out.length - 1];
      if (!last || !VOWELS.includes(last)) return null;
      out += last;
      continue;
    }
    if (c === "ん") {
      const next = d ? (BASE[d] ?? EXTENDED[d + (chars[i + 2] ?? "")] ?? "") : "";
      out += next && (VOWELS.includes(next[0] ?? "") || next[0] === "y") ? "n'" : "n";
      continue;
    }
    let romaji: string | undefined;
    let consumed = 1;
    const pair = d ? c + d : "";
    if (pair && EXTENDED[pair]) {
      romaji = EXTENDED[pair];
      consumed = 2;
    } else if (d && YOUON_VOWEL[d] && YOUON_PREFIX[c]) {
      romaji = (YOUON_PREFIX[c] ?? "") + (YOUON_VOWEL[d] ?? "");
      consumed = 2;
    } else if (BASE[c]) {
      romaji = BASE[c];
    }
    if (!romaji) return null;
    if (geminate) {
      if (VOWELS.includes(romaji[0] ?? "")) return null;
      romaji = romaji.startsWith("ch") ? `t${romaji}` : `${romaji[0]}${romaji}`;
      geminate = false;
    }
    out += romaji;
    i += consumed - 1;
  }
  return geminate ? null : out;
}

/** Romaji for a single word's reading (a vocabulary term). は/へ are literal inside a word. */
export function wordRomaji(reading: string | null | undefined): string {
  const text = toHiragana(normalizeJapaneseSpacing(reading)).replace(/\s+/g, "");
  if (!text) return "";
  if (FIXED_WA.has(text)) return text === "こんにちは" ? "konnichiwa" : "konbanwa";
  return convertRun(text) ?? "";
}

/**
 * Romaji fallback for an example sentence's reading. Uses the reading's own (authored) spacing to
 * recognise particles: は/へ/を standing alone, or the compounds in COMPOUND_PARTICLES, are
 * particles (wa/e/o). A longer unspaced run containing は/へ after its first character may hide a
 * particle, so the whole result is withheld.
 */
export function sentenceRomaji(reading: string | null | undefined): string {
  // ・ separates loanwords (ファッション・デザイナー); romaji writes them as separate words.
  const text = toHiragana(normalizeJapaneseSpacing(reading)).replace(/・/g, " ");
  if (!text) return "";
  const pieces: Array<{ text: string; kind: "word" | "open" | "close" }> = [];
  for (const token of text.split(" ")) {
    for (const part of token.match(/[^、，。．！？…「」『』（）]+|[、，。．！？…「」『』（）]/g) ??
      []) {
      const closing = CLOSING_PUNCT[part];
      const opening = OPENING_PUNCT[part];
      if (closing || opening) {
        pieces.push({ text: (closing ?? opening) as string, kind: closing ? "close" : "open" });
        continue;
      }
      let romaji: string | null;
      if (part === "は") romaji = "wa";
      else if (part === "へ") romaji = "e";
      else if (part === "を") romaji = "o";
      else if (COMPOUND_PARTICLES[part]) romaji = COMPOUND_PARTICLES[part] ?? null;
      else if (FIXED_WA.has(part)) romaji = part === "こんにちは" ? "konnichiwa" : "konbanwa";
      else if (/.[はへ]/.test(part)) return "";
      // A long unspaced run would produce an unreadable romaji blob; withhold it instead.
      else if (part.length > MAX_UNSPACED_RUN) return "";
      else romaji = convertRun(part);
      if (romaji === null || romaji === "") return "";
      pieces.push({ text: romaji, kind: "word" });
    }
  }
  let out = "";
  let afterOpen = false;
  for (const piece of pieces) {
    if (!out) out = piece.text;
    else if (piece.kind === "close") out += piece.text;
    else if (afterOpen) out += piece.text;
    else out += ` ${piece.text}`;
    afterOpen = piece.kind === "open";
  }
  out = normalizeRomaji(out);
  return /[.!?]$/.test(out) ? out.charAt(0).toUpperCase() + out.slice(1) : out;
}

/**
 * Romaji to display for an example: the curated database romaji when present, otherwise the
 * conservative fallback from the reading ("" when it cannot be produced reliably).
 */
export function exampleRomaji(example: {
  romaji?: string | null | undefined;
  reading?: string | null | undefined;
}): string {
  return normalizeRomaji(example.romaji) || sentenceRomaji(example.reading);
}
