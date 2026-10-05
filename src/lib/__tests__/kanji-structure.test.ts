import { readFileSync } from "node:fs";
import { beforeEach, describe, expect, it, vi } from "vitest";

const rpc = vi.fn();
vi.mock("@/integrations/supabase/client", () => ({
  supabase: { rpc: (...a: unknown[]) => rpc(...a) },
}));

import {
  buildShapeExplanation,
  fetchKanjiStructure,
  parseKanjiStructure,
  pickReading,
  radicalBaseNote,
  radicalTitle,
  toHiragana,
} from "../kanji-structure";

const radical = (over: Record<string, unknown> = {}) => ({
  form: "言",
  base: "言",
  is_variant: false,
  position: "へん",
  name_ja: "ごんべん",
  base_name_ja: "ごん",
  meaning_id: "berkata",
  meaning_en: "speech",
  rule: "general",
  ...over,
});
const payload = (over: Record<string, unknown> = {}) => ({
  radical: radical(),
  components: [
    { c: "言", kanji_id: "k-gon" },
    { c: "吾", kanji_id: null },
  ],
  decomposition: [{ c: "吾", p: ["五", "口"] }],
  needs_review: false,
  family: [
    { id: "a", character: "話", meaning_id: "berbicara", kunyomi: "はなす", onyomi: "ワ" },
    { id: "b", character: "読", meaning_id: "membaca", kunyomi: null, onyomi: "ドク" },
  ],
  family_total: 40,
  ...over,
});

describe("bushu mapping", () => {
  it("maps the RPC radical into display fields", () => {
    const s = parseKanjiStructure(payload())!;
    expect(s.radical).toMatchObject({ form: "言", nameJa: "ごんべん", meaningId: "berkata" });
    expect(radicalTitle(s.radical)).toBe("言（ごんべん）");
    expect(radicalBaseNote(s.radical)).toBeNull();
  });

  it("notes the base form when the radical appears as a variant", () => {
    const s = parseKanjiStructure(
      payload({
        radical: radical({ form: "扌", base: "手", is_variant: true, name_ja: "てへん" }),
      }),
    )!;
    expect(radicalTitle(s.radical)).toBe("扌（てへん）");
    expect(radicalBaseNote(s.radical)).toBe("bentuk dasar 手");
  });
});

describe("component / decomposition transform", () => {
  it("keeps order, links only components with a kanji id and drops malformed entries", () => {
    const s = parseKanjiStructure(
      payload({
        components: [{ c: "言", kanji_id: "k" }, { c: "" }, null, { c: "吾", kanji_id: null }],
        decomposition: [{ c: "吾", p: ["五", "口"] }, { c: "x", p: ["y"] }, { p: ["a", "b"] }],
      }),
    )!;
    expect(s.components).toEqual([
      { c: "言", kanjiId: "k" },
      { c: "吾", kanjiId: null },
    ]);
    expect(s.decomposition).toEqual([{ c: "吾", p: ["五", "口"] }]);
  });
});

describe("family mapping", () => {
  it("builds a short hiragana reading and keeps the total", () => {
    const s = parseKanjiStructure(payload())!;
    expect(s.family.map((f) => f.reading)).toEqual(["はなす", "どく"]);
    expect(s.familyTotal).toBe(40);
  });

  it("converts katakana, strips okurigana markers and prefers kunyomi", () => {
    expect(toHiragana("ゴウ")).toBe("ごう");
    expect(pickReading(["かた.る"], ["ゴ"])).toBe("かたる");
    expect(pickReading([], ["ゴ"])).toBe("ご");
    expect(pickReading(null, null)).toBeNull();
  });
});

describe("missing / conflict handling", () => {
  it("returns null for absent or unrecognised data instead of guessing", () => {
    expect(parseKanjiStructure(null)).toBeNull();
    expect(parseKanjiStructure({})).toBeNull();
    expect(parseKanjiStructure(payload({ radical: radical({ meaning_id: null }) }))).toBeNull();
  });

  it("flags review-needed kanji and does not explain unknown components", () => {
    const s = parseKanjiStructure(
      payload({ needs_review: true, components: [], decomposition: [] }),
    )!;
    expect(s.needsReview).toBe(true);
    const text = buildShapeExplanation("原", s).join(" ");
    expect(text).toContain("dalam peninjauan");
    expect(text).not.toContain("tersusun dari");
  });
});

describe("explanation (UI mapping)", () => {
  it("explains 語 from verified parts only", () => {
    const s = parseKanjiStructure(payload())!;
    const lines = buildShapeExplanation("語", s);
    expect(lines[0]).toBe("Kanji 「語」 tersusun dari 「言」 + 「吾」.");
    expect(lines[1]).toContain("「言」（ごんべん）");
    expect(lines[1]).toContain("terletak di sisi kiri");
    expect(lines[2]).toBe("Komponen 「吾」 sendiri tersusun dari 「五」 + 「口」.");
  });

  it("handles repeated and base-form kanji", () => {
    const rep = parseKanjiStructure(
      payload({
        radical: radical({ form: "一", base: "一", position: "かんむり", name_ja: "いち" }),
        components: ["一", "一", "一"].map((c) => ({ c, kanji_id: null })),
        decomposition: [],
      }),
    )!;
    expect(buildShapeExplanation("三", rep)[0]).toContain("「一」 yang diulang 3 kali");
    const base = parseKanjiStructure(payload({ components: [], decomposition: [] }))!;
    expect(buildShapeExplanation("言", base)[0]).toContain("bentuk dasar");
  });
});

describe("family query", () => {
  beforeEach(() => rpc.mockReset());

  it("uses one RPC call with the user level and no per-item requests", async () => {
    rpc.mockResolvedValue({ data: payload(), error: null });
    const s = await fetchKanjiStructure("kid", "N4");
    expect(rpc).toHaveBeenCalledTimes(1);
    expect(rpc).toHaveBeenCalledWith("get_kanji_structure", { p_kanji_id: "kid", p_level: "N4" });
    expect(s?.family).toHaveLength(2);
  });

  it("propagates RPC errors and maps an empty result to null", async () => {
    rpc.mockResolvedValueOnce({ data: null, error: null });
    expect(await fetchKanjiStructure("kid", null)).toBeNull();
    rpc.mockResolvedValueOnce({ data: null, error: new Error("boom") });
    await expect(fetchKanjiStructure("kid", null)).rejects.toThrow("boom");
  });
});

describe("migration contract", () => {
  const sql = readFileSync(
    new URL("../../../supabase/migrations/20261005010000_kanji_structure.sql", import.meta.url),
    "utf8",
  );
  it("caps the family at 12, is select-only for clients and has RLS on every table", () => {
    expect(sql).toMatch(/limit 12/);
    expect(sql).not.toMatch(/grant (insert|update|delete|all)/i);
    expect(sql).toMatch(/grant select on[^;]*to anon, authenticated/);
    expect(sql).toMatch(
      /grant execute on function public\.get_kanji_structure[^;]*to authenticated, service_role/,
    );
    expect((sql.match(/enable row level security/g) ?? []).length).toBe(4);
  });
});
