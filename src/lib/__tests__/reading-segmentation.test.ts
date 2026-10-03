import { describe, expect, it } from "vitest";
import { normalizeJapaneseSpacing } from "../japanese-spacing";
import { validateReadingSpacing } from "../reading-validator";
import fixtures from "./fixtures/reading-segmentation.json";

// Golden cases produced by the offline segmentation tool (scripts/reading-segmentation): the
// unspaced reading, and the segmentation it must end up with. The UI keeps authored spacing, so
// these tests pin down both the data contract (validator) and the display normalizer.
const cases = fixtures as Array<{
  category: string;
  ja: string;
  unspaced: string;
  expected: string;
}>;

describe("reading segmentation contract", () => {
  it("covers every required category", () => {
    const categories = cases.map((c) => c.category).join(" | ");
    for (const needle of [
      "particles",
      "auxiliary",
      "polite past",
      "negative",
      "passive",
      "katakana",
      "small katakana",
      "comma",
      "question",
      "quoted",
      "numbers",
      "fixed expression",
      "compound particle",
      "suru verb",
      "conjugated verb",
      "matrix: Group 1",
      "matrix: Group 2",
      "matrix: Group 3",
      "matrix: te-form",
      "matrix: plain form",
      "matrix: irregular",
      "matrix: compound noun",
      "matrix: punctuation",
      "manual correction",
    ]) {
      expect(categories).toContain(needle);
    }
  });

  for (const c of cases) {
    describe(c.category, () => {
      it("keeps every original character (spacing only)", () => {
        expect(c.expected.replace(/ /g, "")).toBe(c.unspaced);
      });
      it("passes the structural validator", () => {
        expect(validateReadingSpacing(c.expected, { original: c.unspaced })).toEqual([]);
      });
      it("is stable under the display normalizer", () => {
        expect(normalizeJapaneseSpacing(c.expected)).toBe(c.expected);
      });
      it("never leaves a space after 、 or before 。", () => {
        expect(c.expected).not.toMatch(/、 | 。|。 | 、/);
        expect(c.expected).not.toMatch(/ {2}/);
      });
    });
  }

  it("Bunpō regression: かかれて stays whole", () => {
    const bunpo = cases.find((c) => c.category.startsWith("bunpo regression"));
    expect(bunpo?.expected).toBe("この ほん には、くわしい せつめい は かかれて いません。");
    expect(bunpo?.expected).not.toContain("かか れて");
    expect(bunpo?.expected).not.toContain("、 くわしい");
  });

  it("a conjugated verb is never cut: おこなわれます", () => {
    expect(validateReadingSpacing("おこ なわれます。")).toContainEqual({
      code: "known-bad-split",
      detail: "おこ なわれ",
    });
    expect(validateReadingSpacing("おこなわれます。")).toEqual([]);
  });
});

describe("validateReadingSpacing", () => {
  it("flags the damage classes", () => {
    const codes = (r: string, original?: string) =>
      validateReadingSpacing(r, { original }).map((i) => i.code);
    expect(codes("")).toEqual(["empty"]);
    expect(codes(" ほん は")).toContain("edge-whitespace");
    expect(codes("ほん  は")).toContain("double-space");
    expect(codes("らいねん、 かぞく に あう。")).toContain("punctuation-space");
    expect(codes("かぞく に あう 。")).toContain("punctuation-space");
    expect(codes("「 ほん」 は")).toContain("bracket-space");
    expect(codes("ほん は", "ほんを")).toContain("chars-changed");
    expect(codes("この ほん には、くわしい せつめい は かか れて いません。")).toContain(
      "split-conjugation",
    );
  });

  it("flags a long reading that has no segmentation at all", () => {
    expect(
      validateReadingSpacing("このほんにはくわしいせつめいはかかれていません。").map((i) => i.code),
    ).toContain("unsegmented");
    expect(validateReadingSpacing("おこなわれます").map((i) => i.code)).not.toContain(
      "unsegmented",
    );
  });

  it("accepts the authored target", () => {
    expect(
      validateReadingSpacing("この ほん には、くわしい せつめい は かかれて いません。"),
    ).toEqual([]);
  });
});
