import { readFileSync } from "node:fs";
import { beforeEach, describe, expect, it, vi } from "vitest";

const rpc = vi.fn();
vi.mock("@/integrations/supabase/client", () => ({
  supabase: { rpc: (...a: unknown[]) => rpc(...a) },
}));

import {
  buildShapeExplanation,
  buildTree,
  fetchKanjiStructure,
  hasRadicalConflict,
  nodeKindLabel,
  parseKanjiStructure,
  pickReading,
  radicalBaseNote,
  radicalTitle,
  toHiragana,
} from "../kanji-structure";
import {
  EXTRA_LESSON,
  filterByLesson,
  hasExtraKanji,
  lessonNumbers,
  normalizeLesson,
} from "../kanji-lessons";

const radical = (over: Record<string, unknown> = {}) => ({
  form: "言",
  base: "言",
  is_variant: false,
  position: "へん",
  name_ja: "ごんべん",
  base_name_ja: "ごん",
  meaning_id: "berkata",
  meaning_en: "speech",
  status: "verified",
  kd2: { base: "言", name_ja: "ごん", meaning_id: "berkata" },
  ...over,
});
const node = (id: number, parent: number | null, ord: number, el: string, over = {}) => ({
  id,
  parent,
  ord,
  depth: parent === null ? 1 : 2,
  el,
  role: null,
  type: "kanji",
  kanji_id: `k-${el}`,
  meaning_id: null,
  is_radical: false,
  base: null,
  base_kanji_id: null,
  ...over,
});
// 語: 言 (makna) + 吾 (bunyi) -> 五 + 口; 吾 bukan kanji ENO (graphic), 五/口 kanji.
const goTree = () => [
  node(1, null, 1, "言", { role: "semantic", meaning_id: "kata", is_radical: true }),
  node(2, null, 2, "吾", { role: "phonetic", type: "graphic", kanji_id: null }),
  node(3, 2, 1, "五", { meaning_id: "lima" }),
  node(4, 2, 2, "口", { meaning_id: "mulut" }),
];
const payload = (over: Record<string, unknown> = {}) => ({
  radical: radical(),
  tree: goTree(),
  needs_review: false,
  mnemonic: null,
  phonetic_element: "吾",
  phonetic_family: [
    { id: "p1", character: "悟", meaning_id: "sadar", kunyomi: "さとる", onyomi: "ゴ" },
  ],
  family: [
    { id: "a", character: "話", meaning_id: "berbicara", kunyomi: "はなす", onyomi: "ワ" },
    { id: "b", character: "読", meaning_id: "membaca", kunyomi: null, onyomi: "ドク" },
  ],
  family_total: 64,
  ...over,
});

describe("radical (bushu) mapping", () => {
  it("shows form + hiragana name, and no base note for a base form", () => {
    const s = parseKanjiStructure(payload())!;
    expect(radicalTitle(s.radical)).toBe("言（ごんべん）");
    expect(radicalBaseNote(s.radical)).toBeNull();
    expect(hasRadicalConflict(s.radical)).toBe(false);
  });

  it("notes the base form for a radical variant (氵 ← 水, 亻 ← 人)", () => {
    const s = parseKanjiStructure(
      payload({
        radical: radical({ form: "氵", base: "水", is_variant: true, name_ja: "さんずい" }),
      }),
    )!;
    expect(radicalTitle(s.radical)).toBe("氵（さんずい）");
    expect(radicalBaseNote(s.radical)).toBe("bentuk dasar 水");
  });

  it("keeps both radicals when sources disagree instead of picking one", () => {
    const s = parseKanjiStructure(
      payload({
        radical: radical({
          form: "月",
          base: "月",
          status: "conflict",
          kd2: { base: "肉", name_ja: "にく", meaning_id: "daging" },
        }),
      }),
    )!;
    expect(hasRadicalConflict(s.radical)).toBe(true);
    const text = buildShapeExplanation("肺", s).join(" ");
    expect(text).toContain("Sumber berbeda soal bushu");
    expect(text).toContain("「月」");
    expect(text).toContain("「肉」");
  });
});

describe("nested decomposition + component types", () => {
  it("builds a tree in order, with independent kanji, radical variants and graphical parts", () => {
    const tree = buildTree([
      node(3, 2, 1, "五"),
      node(1, null, 1, "亻", {
        type: "radical",
        kanji_id: null,
        base: "人",
        base_kanji_id: "k-人",
        is_radical: true,
      }),
      node(2, null, 2, "吾", { type: "graphic", kanji_id: null }),
      node(5, null, 3, "CDP-8BC4", { type: "nonunicode", kanji_id: null }),
    ]);
    expect(tree.map((n) => n.element)).toEqual(["亻", "吾", "CDP-8BC4"]);
    expect(tree[1]!.children.map((n) => n.element)).toEqual(["五"]);
    expect(nodeKindLabel(tree[0]!)).toBe("Bentuk bushu dari 人");
    expect(nodeKindLabel(tree[1]!)).toBe("Bagian grafis (bukan kanji mandiri)");
    expect(nodeKindLabel(tree[2]!)).toBe("Bagian grafis tanpa karakter Unicode");
    expect(nodeKindLabel(tree[1]!.children[0]!)).toBe("Kanji");
  });

  it("only links components that are published kanji (graphical parts get no id)", () => {
    const s = parseKanjiStructure(payload())!;
    expect(s.tree[1]!.kanjiId).toBeNull();
    expect(s.tree[1]!.children.map((c) => c.kanjiId)).toEqual(["k-五", "k-口"]);
  });

  it("drops orphan or malformed nodes instead of guessing", () => {
    const tree = buildTree([node(1, null, 1, "言"), node(2, 99, 1, "x"), { id: "z" }, null]);
    expect(tree.map((n) => n.element)).toEqual(["言"]);
  });
});

describe("semantic / phonetic roles", () => {
  it("states roles only when verified, with the Chinese-sound caveat", () => {
    const lines = buildShapeExplanation("語", parseKanjiStructure(payload())!);
    expect(lines[0]).toBe("Kanji 「語」 tersusun dari 「言」 + 「吾」.");
    expect(lines[1]).toContain("「言」（ごんべん）");
    expect(lines[1]).toContain("terletak di sisi kiri");
    const roles = lines.find((l) => l.includes("petunjuk bunyi"))!;
    expect(roles).toContain("「言」");
    expect(roles).toContain("petunjuk kelompok makna");
    expect(roles).toContain("bunyi Tionghoa");
    expect(lines.at(-1)).toBe("Komponen 「吾」 sendiri tersusun dari 「五」 + 「口」.");
  });

  it("falls back to neutral wording when roles are unknown", () => {
    const tree = goTree().map((n) => ({ ...n, role: null }));
    const text = buildShapeExplanation("語", parseKanjiStructure(payload({ tree }))!).join(" ");
    expect(text).not.toContain("petunjuk");
    expect(text).toContain("tersusun dari 「言」 + 「吾」");
  });
});

describe("empty / review / repeated structure", () => {
  it("separates atomic kanji from kanji whose components are under review", () => {
    const atomic = buildShapeExplanation("木", parseKanjiStructure(payload({ tree: [] }))!)[0];
    expect(atomic).toContain("bentuk dasar");
    const review = buildShapeExplanation(
      "午",
      parseKanjiStructure(payload({ tree: [], needs_review: true }))!,
    )[0];
    expect(review).toContain("dalam peninjauan");
    expect(review).not.toContain("tersusun dari");
  });

  it("describes a repeated component and a non-Unicode part", () => {
    const rep = parseKanjiStructure(
      payload({ tree: [1, 2, 3].map((i) => node(i, null, i, "一", { kanji_id: null })) }),
    )!;
    expect(buildShapeExplanation("三", rep)[0]).toContain("「一」 yang diulang 3 kali");
    const cdp = parseKanjiStructure(
      payload({
        tree: [
          node(1, null, 1, "厂"),
          node(2, null, 2, "CDP-8BC4", { type: "nonunicode", kanji_id: null }),
        ],
      }),
    )!;
    expect(buildShapeExplanation("原", cdp)[0]).toBe(
      "Kanji 「原」 tersusun dari 「厂」 + satu bagian grafis.",
    );
  });

  it("returns null for absent or unrecognised data instead of guessing", () => {
    expect(parseKanjiStructure(null)).toBeNull();
    expect(parseKanjiStructure({})).toBeNull();
    expect(parseKanjiStructure(payload({ radical: radical({ meaning_id: null }) }))).toBeNull();
  });
});

describe("mnemonic is separate from facts", () => {
  it("is exposed on its own field and never mixed into the factual explanation", () => {
    const body = "Bayangkan seseorang bersandar pada pohon untuk beristirahat.";
    const s = parseKanjiStructure(payload({ mnemonic: body }))!;
    expect(s.mnemonic).toBe(body);
    expect(buildShapeExplanation("休", s).join(" ")).not.toContain("Bayangkan");
    expect(parseKanjiStructure(payload())!.mnemonic).toBeNull();
  });
});

describe("family (cross-level, no duplicates)", () => {
  it("keeps every published family member regardless of level, with short hiragana readings", () => {
    const s = parseKanjiStructure(payload())!;
    expect(s.family.map((f) => f.id)).toEqual(["a", "b"]);
    expect(s.family.map((f) => f.reading)).toEqual(["はなす", "どく"]);
    expect(s.phoneticFamily[0]).toMatchObject({ character: "悟", reading: "さとる" });
    expect(s.phoneticElement).toBe("吾");
    expect(s.familyTotal).toBe(64);
    expect(new Set(s.family.map((f) => f.id)).size).toBe(s.family.length);
  });

  it("converts katakana, strips okurigana markers and prefers kunyomi", () => {
    expect(toHiragana("ゴウ")).toBe("ごう");
    expect(pickReading(["かた.る"], ["ゴ"])).toBe("かたる");
    expect(pickReading([], ["ゴ"])).toBe("ご");
    expect(pickReading(null, null)).toBeNull();
  });
});

describe("RPC wrapper", () => {
  beforeEach(() => rpc.mockReset());

  it("uses one RPC call with the user level and no per-item requests", async () => {
    rpc.mockResolvedValue({ data: payload(), error: null });
    const s = await fetchKanjiStructure("kid", "N4");
    expect(rpc).toHaveBeenCalledTimes(1);
    expect(rpc).toHaveBeenCalledWith("get_kanji_structure", { p_kanji_id: "kid", p_level: "N4" });
    expect(s?.tree).toHaveLength(2);
  });

  it("propagates RPC errors and maps an empty result to null", async () => {
    rpc.mockResolvedValueOnce({ data: null, error: null });
    expect(await fetchKanjiStructure("kid", null)).toBeNull();
    rpc.mockResolvedValueOnce({ data: null, error: new Error("boom") });
    await expect(fetchKanjiStructure("kid", null)).rejects.toThrow("boom");
  });
});

describe("kanji without lesson_number", () => {
  const cards = [
    { id: "a", lesson_number: 1 },
    { id: "b", lesson_number: null },
    { id: "c" },
    { id: "d", lesson_number: 0 },
    { id: "e", lesson_number: 2 },
  ];

  it("keeps them reachable via 'Kanji Tambahan' once real lessons exist", () => {
    expect(lessonNumbers(cards)).toEqual([1, 2]);
    expect(hasExtraKanji(cards)).toBe(true);
    expect(filterByLesson(cards, EXTRA_LESSON).map((c) => c.id)).toEqual(["b", "c", "d"]);
    expect(filterByLesson(cards, 1).map((c) => c.id)).toEqual(["a"]);
  });

  it("shows everything, in order and without duplicates, when no lesson exists (current data)", () => {
    const none = [{ id: "a" }, { id: "b", lesson_number: null }];
    expect(lessonNumbers(none)).toEqual([]);
    expect(hasExtraKanji(none)).toBe(false);
    expect(filterByLesson(none, null).map((c) => c.id)).toEqual(["a", "b"]);
  });

  it("normalizes a saved selection safely", () => {
    expect(normalizeLesson(EXTRA_LESSON, [1, 2], true)).toBe(EXTRA_LESSON);
    expect(normalizeLesson(EXTRA_LESSON, [1, 2], false)).toBe(1);
    expect(normalizeLesson(9, [1, 2], true)).toBe(1);
    expect(normalizeLesson(2, [1, 2], true)).toBe(2);
  });
});

describe("migration contract", () => {
  const read = (f: string) =>
    readFileSync(new URL(`../../../supabase/migrations/${f}`, import.meta.url), "utf8");
  const v1 = read("20261005010000_kanji_structure.sql");
  const v2 = read("20261006000000_kanji_structure_v2.sql");
  const data = [
    read("20261005020000_kanji_structure_data.sql"),
    read("20261006010000_kanji_structure_v2_data.sql"),
  ];

  it("caps families, is select-only for clients and keeps RLS on every table", () => {
    expect(v1).toMatch(/limit 12/);
    expect(v2).toMatch(/limit 12/);
    expect(v2).toMatch(/limit 8/);
    for (const sql of [v1, v2]) {
      expect(sql).not.toMatch(/grant (insert|update|delete|all)/i);
      expect(sql).toMatch(/grant select on[^;]*to anon, authenticated/);
      expect(sql).toMatch(
        /grant execute on function public\.get_kanji_structure[^;]*to authenticated, service_role/,
      );
    }
    expect((v1.match(/enable row level security/g) ?? []).length).toBe(4);
    expect((v2.match(/enable row level security/g) ?? []).length).toBe(2);
  });

  it("is non-destructive and the seeds are idempotent", () => {
    for (const sql of [v1, v2, ...data]) {
      expect(sql).not.toMatch(
        /\b(drop\s+(table|schema|function|constraint)|truncate|delete\s+from)\b/i,
      );
      expect(sql).not.toMatch(/disable row level security/i);
    }
    for (const sql of data) expect(sql).toMatch(/on conflict/);
  });
});
