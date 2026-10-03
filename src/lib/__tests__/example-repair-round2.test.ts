import { describe, expect, it } from "vitest";
import { normalizeJapaneseSpacing, normalizeRomaji } from "../japanese-spacing";
import { exampleRomaji, sentenceRomaji } from "../romaji";
import { validateReadingSpacing } from "../reading-validator";
import fixtures from "./fixtures/example-repair-round2.json";

// Golden rows taken from the LIVE database after the romaji / missing-reading / arti repair round
// (scripts/reading-segmentation/romaji-round). `before` holds the pre-repair value of every field
// the round touched, so each repair class is pinned: the repaired value must be the one served and
// must differ from the defective one. The remaining categories are unchanged reference rows that
// pin the ENO romaji conventions (particles, long vowels, small っ, katakana, punctuation).
type Row = {
  n: number;
  category: string;
  id: string;
  table: string;
  ja: string;
  reading: string;
  romaji: string;
  arti: string;
  before: Record<string, string | null> | null;
};
const rows = fixtures as Row[];

const letters = (s: string) =>
  s
    .toLowerCase()
    .replace(/n'/g, "n")
    .replace(/[^a-z]/g, "");
const KANJI = /[一-鿿]/;
const KANA_OR_CJK = /[぀-ヿ一-鿿]/;
// Intentional "(が)" style usage annotations that the data keeps on purpose.
const ANNOTATION = /[（(][がにを][)）]/;
// A stand-alone は that is the noun 歯 / 葉 / 派 / 刃 (not the particle) is romanised "ha"; the app's
// fallback converter cannot know that, but the curated database romaji is what is served.
const NOUN_HA = /[歯葉派刃]/;

describe("repair round 2: coverage", () => {
  it("covers every required category", () => {
    const cats = rows.map((r) => r.category).join(" | ");
    for (const needle of [
      "romaji repair: typo",
      "romaji repair: spacing only",
      "missing-reading recovery",
      "reading source repair: stray space",
      "reading source repair: lexical word rejoined",
      "arti repair: template placeholder",
      "arti repair: wrong meaning",
      "arti repair: empty arti filled",
      "particle romanization",
      "long vowel",
      "small tsu",
      "katakana",
      "Group 1/2/3",
      "punctuation",
      "grammar example",
    ]) {
      expect(cats).toContain(needle);
    }
  });
});

describe.each(rows)("$category — $id", (r) => {
  it("serves all four fields", () => {
    expect(r.ja.length).toBeGreaterThan(0);
    expect(r.reading.length).toBeGreaterThan(0);
    expect(r.romaji.length).toBeGreaterThan(0);
    expect(r.arti.length).toBeGreaterThan(0);
  });

  it("reading holds no kanji and passes the structural validator", () => {
    expect(KANJI.test(r.reading)).toBe(false);
    const issues = validateReadingSpacing(r.reading).filter((i) => i.code !== "unsegmented");
    expect(issues).toEqual([]);
    if (!ANNOTATION.test(r.reading)) expect(normalizeJapaneseSpacing(r.reading)).toBe(r.reading);
  });

  it("romaji is pure romaji and never invents or drops digits", () => {
    expect(KANA_OR_CJK.test(r.romaji)).toBe(false);
    expect(/[0-9０-９]/.test(r.romaji)).toBe(/[0-9０-９]/.test(r.reading));
    expect(r.romaji).toBe(normalizeRomaji(r.romaji));
    expect(exampleRomaji({ romaji: r.romaji, reading: r.reading })).toBe(normalizeRomaji(r.romaji));
  });

  it("romaji word boundaries cover the reading boundaries", () => {
    const units = r.reading.split(/\s+/).filter(Boolean).length;
    const words = r.romaji.split(/[\s-]+/).filter(Boolean).length;
    expect(words).toBeGreaterThanOrEqual(units - 1);
  });

  it("agrees with the app's own kana→romaji conversion where it can produce one", () => {
    if (ANNOTATION.test(r.reading) || (NOUN_HA.test(r.ja) && /(^| )は( |$)/.test(r.reading)))
      return;
    const fallback = sentenceRomaji(r.reading);
    if (!fallback) return;
    expect(letters(fallback)).toBe(letters(r.romaji));
  });

  it("arti is Indonesian prose, never a template or placeholder", () => {
    expect(r.arti.startsWith("Contoh penggunaan")).toBe(false);
    expect(
      /\b(the|is|are|was|were|you|did)\b/i.test(r.arti) &&
        !/\b(yang|dan|di|ke|adalah)\b/i.test(r.arti),
    ).toBe(false);
    expect(r.arti).toMatch(/[.!?)”"]$/);
  });
});

describe("repair round 2: repaired fields differ from the defective value", () => {
  const repaired = rows.filter((r) => r.before);
  it("has repaired rows in every repair category", () => {
    expect(repaired.length).toBeGreaterThanOrEqual(130);
  });
  for (const r of repaired) {
    it(`${r.category} — ${r.id}`, () => {
      const served: Record<string, string> = {
        reading: r.reading,
        hiragana: r.reading,
        romaji: r.romaji,
        id: r.arti,
      };
      for (const [field, old] of Object.entries(r.before ?? {})) {
        expect(served[field]).not.toBe(old);
        if (old) {
          // spacing-only repairs keep every character; content repairs are listed separately
          if (/spacing only|lexical word rejoined/.test(r.category))
            expect(served[field]?.replace(/\s+/g, "")).toBe(old.replace(/\s+/g, ""));
        } else {
          expect(old).toBeFalsy(); // recovered / filled: the field was missing before
        }
      }
    });
  }

  it("recovered readings used to be missing", () => {
    for (const r of repaired.filter((x) => x.category.startsWith("missing-reading"))) {
      expect(r.before?.["reading"] ?? r.before?.["hiragana"] ?? null).toBeNull();
    }
  });
  it("placeholder arti no longer carries the template prefix", () => {
    for (const r of repaired.filter((x) => x.category.includes("placeholder"))) {
      expect(r.before?.["id"]).toMatch(/^Contoh penggunaan/);
      expect(r.arti).not.toMatch(/^Contoh penggunaan/);
    }
  });
});
