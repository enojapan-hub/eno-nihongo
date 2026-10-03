import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { asExamples } from "../examples";
import { normalizeJapaneseSpacing, normalizeRomaji } from "../japanese-spacing";
import { exampleRomaji, sentenceRomaji, wordRomaji } from "../romaji";

// Regression case from the Bunpō screenshot (grammar_points 00264979…, "Kalimat pasif (1)").
const BUNPO = {
  ja: "この本には、くわしい説明は書かれていません。",
  jaSpaced: "この 本 には、くわしい 説明 は 書かれていません。",
  hiragana: "この ほん に は、 くわしい せつめい は かかれて いません。", // as stored in the database
  readingExpected: "この ほん には、くわしい せつめい は かかれて いません。",
  romaji: "Kono hon ni wa, kuwashii setsumei wa kakarete imasen.",
  id: "Di buku ini, penjelasan detailnya tidak tertulis.",
};

describe("normalizeJapaneseSpacing", () => {
  it("Bunpō case: keeps the authored segmentation and never splits かかれて", () => {
    const out = normalizeJapaneseSpacing(BUNPO.hiragana);
    expect(out).toBe(BUNPO.readingExpected);
    expect(out).not.toBe("この ほん には、 くわしい せつめい は かか れて いません。");
    expect(out).not.toContain("かか れて");
    expect(out).not.toContain("、 ");
    expect(out).toContain("かかれて");
  });

  it("does not touch Japanese that is already well spaced and does not invent spaces", () => {
    expect(normalizeJapaneseSpacing(BUNPO.jaSpaced)).toBe(BUNPO.jaSpaced);
    expect(normalizeJapaneseSpacing(BUNPO.ja)).toBe(BUNPO.ja);
  });

  it("leaves unspaced readings unspaced (no guessing) and keeps conjugated forms whole", () => {
    for (const reading of [
      "このほんにはくわしいせつめいはかかれていません",
      "にゅうがくしき",
      "おこなわれます",
      "かかれて",
    ]) {
      expect(normalizeJapaneseSpacing(reading)).toBe(reading);
    }
  });

  it("tidies punctuation: nothing after 、, nothing before 。", () => {
    expect(normalizeJapaneseSpacing("らいねん、 かぞく に あう。")).toBe(
      "らいねん、かぞく に あう。",
    );
    expect(normalizeJapaneseSpacing("かぞく に あう 。")).toBe("かぞく に あう。");
    expect(normalizeJapaneseSpacing("あした 、 くる ！ ほんとう ？")).toBe(
      "あした、くる！ほんとう？",
    );
    expect(normalizeJapaneseSpacing("「 こんにちは 」 と いう")).toBe("「こんにちは」 と いう");
  });

  it("removes double, leading, trailing and full-width whitespace", () => {
    expect(normalizeJapaneseSpacing("  この   ほん　は  ")).toBe("この ほん は");
    expect(normalizeJapaneseSpacing(null)).toBe("");
    expect(normalizeJapaneseSpacing("   ")).toBe("");
  });

  it("joins only authored particle pairs and never a particle with a verb", () => {
    expect(normalizeJapaneseSpacing("ここ に も ある")).toBe("ここ にも ある");
    expect(normalizeJapaneseSpacing("ともだち と は はなさない")).toBe("ともだち とは はなさない");
    expect(normalizeJapaneseSpacing("ほん に あう")).toBe("ほん に あう");
    expect(normalizeJapaneseSpacing("よん で も いい")).toBe("よん で も いい");
  });

  it("is idempotent", () => {
    for (const text of [
      BUNPO.hiragana,
      BUNPO.jaSpaced,
      "らいねん、 かぞく に あう。",
      "「 あ 」 い",
    ]) {
      const once = normalizeJapaneseSpacing(text);
      expect(normalizeJapaneseSpacing(once)).toBe(once);
      expect(once).not.toMatch(/ {2}/);
      expect(once).toBe(once.trim());
    }
  });

  it("leaves non-Japanese text with only whitespace tidied", () => {
    expect(normalizeJapaneseSpacing("  hello   world ")).toBe("hello world");
    expect(normalizeRomaji("  Kono  hon ni wa , kuwashii ")).toBe("Kono hon ni wa, kuwashii");
  });
});

describe("example data keeps Japanese, reading, romaji and meaning", () => {
  it("asExamples forwards romaji, reading and the Indonesian meaning", () => {
    const [example] = asExamples([
      {
        ja: BUNPO.ja,
        hiragana: BUNPO.hiragana,
        romaji: ` ${BUNPO.romaji} `,
        id: BUNPO.id,
        en: "x",
      },
    ]);
    expect(example).toEqual({
      jp: BUNPO.ja,
      reading: BUNPO.hiragana,
      romaji: BUNPO.romaji,
      id: BUNPO.id,
    });
  });

  it("supports the alternative field names and drops empty romaji", () => {
    const [a] = asExamples([{ jp: "あ", reading: "あ", romaji: "  ", translation_id: "a" }]);
    expect(a).toEqual({ jp: "あ", reading: "あ", romaji: undefined, id: "a" });
    expect(asExamples(JSON.stringify([{ ja: "い", id: "i", romaji: "i" }]))[0]?.romaji).toBe("i");
    expect(asExamples(null)).toEqual([]);
  });
});

describe("exampleRomaji (database romaji first, fallback only when empty)", () => {
  it("prefers the curated database romaji over the converter", () => {
    expect(exampleRomaji({ romaji: BUNPO.romaji, reading: BUNPO.hiragana })).toBe(BUNPO.romaji);
    expect(exampleRomaji({ romaji: "curated value", reading: "あ" })).toBe("curated value");
  });

  it("falls back to the converter when romaji is empty and the reading is valid", () => {
    expect(exampleRomaji({ romaji: "", reading: BUNPO.hiragana })).toBe(BUNPO.romaji);
    expect(exampleRomaji({ romaji: null, reading: BUNPO.readingExpected })).toBe(BUNPO.romaji);
  });

  it("returns nothing when both are empty (nothing is invented)", () => {
    expect(exampleRomaji({ romaji: "", reading: "" })).toBe("");
    expect(exampleRomaji({})).toBe("");
  });
});

describe("sentenceRomaji / wordRomaji fallback", () => {
  const cases: Array<[string, string]> = [
    ["ふぁいる", "fairu"],
    ["フィルター", "firutaa"],
    ["メロディー", "merodii"],
    ["フォント", "fonto"],
    ["ホッチキス", "hotchikisu"],
    ["きっぷ", "kippu"],
    ["がっこう", "gakkou"],
    ["しゅっちょう", "shutchou"],
    ["きょう", "kyou"],
    ["ちゃ", "cha"],
    ["じゅうしょ", "juusho"],
    ["おおさか", "oosaka"],
    ["ケーキ", "keeki"],
    ["ほんや", "hon'ya"],
    ["さんねん", "sannen"],
    ["パーティー", "paatii"],
  ];
  it.each(cases)("converts %s → %s", (kana, romaji) => {
    expect(wordRomaji(kana)).toBe(romaji);
  });

  it("writes particle は/へ/を as wa/e/o only when they stand alone", () => {
    expect(sentenceRomaji("わたし は がくせい です")).toBe("watashi wa gakusei desu");
    expect(sentenceRomaji("がっこう へ いきます")).toBe("gakkou e ikimasu");
    expect(sentenceRomaji("ほん を よむ")).toBe("hon o yomu");
    expect(sentenceRomaji("ここ には ほん が ある")).toBe("koko ni wa hon ga aru");
  });

  it("keeps は/へ literal at the start of a word and in fixed greetings", () => {
    expect(sentenceRomaji("はな が さく")).toBe("hana ga saku");
    expect(sentenceRomaji("へや に いる")).toBe("heya ni iru");
    expect(sentenceRomaji("こんにちは")).toBe("konnichiwa");
  });

  it("withholds the romaji when は/へ may hide a particle (no blind conversion)", () => {
    expect(sentenceRomaji("わたしは がくせい です")).toBe("");
    expect(sentenceRomaji("がっこうへ いきます")).toBe("");
  });

  it("handles punctuation and capitalises sentences", () => {
    expect(sentenceRomaji("らいねん、かぞく に あう。")).toBe("Rainen, kazoku ni au.");
    expect(sentenceRomaji("ほんとう です か？")).toBe("Hontou desu ka?");
    expect(sentenceRomaji("「 ありがとう 」 と いう")).toBe('"arigatou" to iu');
    expect(sentenceRomaji("ファッション・デザイナー")).toBe("fasshon dezainaa");
  });

  it("converts the Bunpō reading exactly to the curated romaji", () => {
    expect(sentenceRomaji(BUNPO.hiragana)).toBe(BUNPO.romaji);
    expect(sentenceRomaji(BUNPO.hiragana)).not.toMatch(/ {2}/);
  });

  it("gives nothing for ambiguous or unconvertible input", () => {
    expect(sentenceRomaji("この本には")).toBe("");
    expect(sentenceRomaji("たべます abc")).toBe("");
    expect(sentenceRomaji("このもんだいをかいけつするさくをかんがえる")).toBe("");
    expect(sentenceRomaji("っ")).toBe("");
    expect(sentenceRomaji("")).toBe("");
  });
});

describe("consumers share one implementation", () => {
  const read = (file: string) => readFileSync(join(process.cwd(), "src", file), "utf8");
  const consumers = [
    "routes/_authenticated/kotoba.tsx",
    "routes/_authenticated/kanji.tsx",
    "routes/_authenticated/bunpo.tsx",
  ];

  it("no consumer keeps its own converter or the old Intl.Segmenter spacing", () => {
    for (const file of consumers) {
      const text = read(file);
      expect(text, file).not.toMatch(/function kanaToRomaji/);
      expect(text, file).not.toMatch(/spaceJapanese/);
      expect(text, file).not.toMatch(/Intl\.Segmenter/);
    }
    expect(read("lib/japanese-spacing.ts")).not.toMatch(/Segmenter\s*\(/);
  });

  it("Kotoba and Kanji use the shared fallback; Bunpō uses the shared spacing", () => {
    for (const file of consumers.slice(0, 2)) {
      expect(read(file), file).toMatch(/from "@\/lib\/romaji"/);
      expect(read(file), file).toMatch(/from "@\/lib\/japanese-spacing"/);
    }
    expect(read(consumers[2]!)).toMatch(/normalizeJapaneseSpacing/);
  });

  it("Bunpō reads the *_reading keys used by the wrong-example data", () => {
    const text = read("routes/_authenticated/bunpo.tsx");
    expect(text).toMatch(/x\["wrong_reading"\]/);
    expect(text).toMatch(/x\["correct_reading"\]/);
  });
});
