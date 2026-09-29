import { describe, expect, it } from "vitest";
import { classifyError } from "../classify";
import { rankCandidates, selectExercises, toLearned } from "../selector";
import {
  buildSession,
  buildExercise,
  queueRepeat,
  spaceOut,
  type Content,
  blankOut,
} from "../session";
import {
  buildSignals,
  HOLD_AFTER,
  partnerFor,
  remedyFor,
  toReviewEvents,
  type ReviewEvent,
  MAX_ERROR_AGE_MS,
} from "../signals";
import type { MemoryStateRow, Selection } from "../types";

const NOW = Date.parse("2026-10-01T00:00:00Z");
const st = (
  id: string,
  o: Partial<MemoryStateRow> = {},
  aspect = "meaning",
  dir = "forward",
  type: "kanji" | "vocabulary" | "grammar" = "vocabulary",
): MemoryStateRow => ({
  item_type: type,
  item_id: id,
  aspect,
  direction: dir,
  stage: 1,
  stability: 1,
  due_at: "2026-09-30T00:00:00Z",
  last_tested_at: "2026-09-28T00:00:00Z",
  lapses: 0,
  success_count: 1,
  failure_count: 1,
  overconfident_wrong: 0,
  last_error_type: null,
  ...o,
});
const learned = (...ids: string[]) =>
  toLearned(
    ids.map((id) => ({
      item_type: "vocabulary",
      item_id: id,
      level: "N5",
      status: "learning",
      due_at: null,
      last_reviewed_at: null,
    })),
  );
let t = 0;
const ev = (o: Partial<ReviewEvent> = {}): ReviewEvent => ({
  item_type: "vocabulary",
  item_id: "A",
  aspect: "meaning",
  direction: "forward",
  correct: false,
  error_type: "meaning",
  selected_item_id: null,
  created_at: new Date(NOW - ++t * 1000).toISOString(),
  ...o,
});
const newestFirst = (...e: ReviewEvent[]) => e; // tests list newest first

describe("error -> remediation mapping (deterministic)", () => {
  const partner = {
    id: "B",
    type: "vocabulary" as const,
    source: "error" as const,
    count: 1,
    confirmed: false,
  };
  const map = (
    type: string,
    itemType: "vocabulary" | "grammar" = "vocabulary",
    p: typeof partner | null = null,
  ) =>
    remedyFor({ type: type as never, count: 1 }, { itemType, partner: p, hasWrongExamples: true })
      ?.kind ?? null;
  it("maps each error_type", () => {
    expect(map("meaning")).toBe("meaning");
    expect(map("reading")).toBe("reading");
    expect(map("confusion", "vocabulary", partner)).toBe("jebakan");
    expect(map("usage_context")).toBe("usage");
    expect(map("slow_recall")).toBe("slow");
    expect(map("likely_guess")).toBe("guess");
    expect(map("general")).toBeNull();
  });
  it("selector attaches remedy + explanatory reason; meaning error keeps the meaning combo, reading error the reading combo", () => {
    const sig = buildSignals(
      newestFirst(
        ev({ item_id: "A", aspect: "meaning" }),
        ev({ item_id: "C", aspect: "reading", error_type: "reading" }),
      ),
    );
    const r = rankCandidates(learned("A", "C"), [st("A"), st("C", {}, "reading")], NOW, sig);
    const a = r.find((s) => s.itemId === "A" && s.aspect === "meaning")!;
    const c = r.find((s) => s.itemId === "C" && s.aspect === "reading")!;
    expect(a.remedy?.kind).toBe("meaning");
    expect(a.reason).toMatch(/remediate_meaning/);
    expect(c.remedy?.kind).toBe("reading");
    expect(c.reason).toMatch(/remediate_reading/);
  });
  it("slow_recall -> recall with minimal help by stage; weak stage stays easy", () => {
    const sig = buildSignals(newestFirst(ev({ error_type: "slow_recall", correct: true })));
    const hi = rankCandidates(learned("A"), [st("A", { stage: 2 })], NOW, sig).find(
      (s) => s.aspect === "meaning" && s.direction === "forward",
    )!;
    expect(hi).toMatchObject({ exerciseType: "recall_flip", hintLevel: 1 });
    const lo = rankCandidates(learned("A"), [st("A", { stage: 0 })], NOW, sig).find(
      (s) => s.aspect === "meaning" && s.direction === "forward",
    )!;
    expect(lo.exerciseType).toBe("choice");
  });
  it("likely_guess -> recall with less help once stage>=1, otherwise 4 choices (not harder)", () => {
    const sig = buildSignals(newestFirst(ev({ error_type: "likely_guess" })));
    const s1 = rankCandidates(learned("A"), [st("A", { stage: 1 })], NOW, sig).find(
      (s) => s.aspect === "meaning" && s.direction === "forward",
    )!;
    expect(s1).toMatchObject({ exerciseType: "recall_flip", hintLevel: 1 });
    const s0 = rankCandidates(learned("A"), [st("A", { stage: 0 })], NOW, sig).find(
      (s) => s.aspect === "meaning" && s.direction === "forward",
    )!;
    expect(s0).toMatchObject({ exerciseType: "choice", optionCount: 4 });
  });
});

describe("selected answer -> A<->B pair", () => {
  it("reads selected_item_id back from persisted meta and records the pair", () => {
    const rows = [
      {
        item_type: "vocabulary",
        item_id: "A",
        aspect: "meaning",
        direction: "forward",
        rating: 0,
        created_at: "2026-09-30T00:00:00Z",
        meta: { source: "kioku", correct: false, error_type: "confusion", selected_item_id: "B" },
      },
      {
        item_type: "vocabulary",
        item_id: "X",
        aspect: "meaning",
        direction: "forward",
        rating: 2,
        created_at: "2026-09-30T00:00:00Z",
        meta: null,
      },
    ];
    const sig = buildSignals(toReviewEvents(rows));
    expect([...sig.pairs.values()]).toHaveLength(1);
    expect(partnerFor("vocabulary", "A", sig)).toMatchObject({ id: "B", source: "error" });
    expect(partnerFor("vocabulary", "B", sig)).toMatchObject({ id: "A" }); // symmetric
  });
  it("a single unlabelled wrong pick is NOT treated as confusion; repeating it is", () => {
    const one = buildSignals(newestFirst(ev({ selected_item_id: "B", error_type: "meaning" })));
    expect(partnerFor("vocabulary", "A", one)).toBeNull();
    const two = buildSignals(
      newestFirst(
        ev({ selected_item_id: "B", error_type: "meaning" }),
        ev({ selected_item_id: "B", error_type: "meaning" }),
      ),
    );
    expect(partnerFor("vocabulary", "A", two)).toMatchObject({ id: "B", confirmed: true });
  });
  it("classifier: only a look-alike pick is confusion", () => {
    const base = {
      correct: false,
      aspect: "meaning",
      exerciseType: "choice" as const,
      responseMs: 4000,
      usedHint: false,
    };
    expect(classifyError({ ...base, selectedWasConfusable: true })).toBe("confusion");
    expect(classifyError({ ...base })).toBe("meaning");
  });
  it("source priority: real error pair > relation table", () => {
    const rel = [{ type: "vocabulary" as const, a: "A", b: "R" }];
    expect(partnerFor("vocabulary", "A", buildSignals([], rel))).toMatchObject({
      id: "R",
      source: "relation",
    });
    const both = buildSignals(
      newestFirst(ev({ selected_item_id: "B", error_type: "confusion" })),
      rel,
    );
    expect(partnerFor("vocabulary", "A", both)).toMatchObject({ id: "B", source: "error" });
  });
});

describe("repeated error / contrast / anti-loop", () => {
  const confusion = (n: number) =>
    buildSignals(
      Array.from({ length: n }, () => ev({ selected_item_id: "B", error_type: "confusion" })),
    );
  it("repeated A<->B upgrades jebakan to contrast and raises priority", () => {
    const one = rankCandidates(
      learned("A"),
      [st("A", { due_at: "2026-10-09T00:00:00Z" })],
      NOW,
      confusion(1),
    ).find((s) => s.aspect === "meaning" && s.direction === "forward")!;
    const two = rankCandidates(
      learned("A"),
      [st("A", { due_at: "2026-10-09T00:00:00Z" })],
      NOW,
      confusion(2),
    ).find((s) => s.aspect === "meaning" && s.direction === "forward")!;
    expect(one.remedy?.kind).toBe("jebakan");
    expect(two.remedy?.kind).toBe("contrast");
    expect(two.score).toBeGreaterThan(one.score);
  });
  it("one clean correct answer resolves the error (no endless remediation)", () => {
    const sig = buildSignals(
      newestFirst(
        ev({ correct: true, error_type: null }),
        ev({ selected_item_id: "B", error_type: "confusion" }),
      ),
    );
    expect(sig.unresolved.size).toBe(0);
    const r = rankCandidates(
      learned("A"),
      [st("A", { due_at: "2026-10-09T00:00:00Z", last_error_type: "confusion" })],
      NOW,
      sig,
    );
    expect(r.every((s) => !s.remedy)).toBe(true);
  });
  it("holds escalation after repeated failures", () => {
    const sig = buildSignals(Array.from({ length: HOLD_AFTER }, () => ev()));
    expect(rankCandidates(learned("A"), [st("A")], NOW, sig).every((s) => !s.remedy)).toBe(true);
  });
  it("session bounds remediation share, one per pair, and spaces the same item apart", () => {
    const c = (id: string): Content => ({
      id,
      type: "vocabulary",
      level: "N5",
      surface: `語${id}`,
      reading: `よ${id}`,
      meaning: `arti ${id}`,
    });
    const ids = Array.from({ length: 12 }, (_, i) => `i${i}`);
    const pool = [...ids, "p1", "p2", "p3", "p4"].map(c);
    const content = new Map(pool.map((x) => [`vocabulary:${x.id}`, x]));
    const remedy = (i: number): Selection => ({
      itemType: "vocabulary",
      itemId: ids[i]!,
      level: "N5",
      aspect: "meaning",
      direction: "forward",
      exerciseType: "choice",
      stage: 1,
      hintLevel: 3,
      optionCount: 4,
      reason: "x",
      score: 900 - i,
      remedy: { kind: "jebakan", partnerId: "p1", source: "error", count: 2 },
    });
    const s = buildSession(
      ids.map((_, i) => remedy(i)),
      content,
      pool,
      new Set(),
      "sid",
      NOW,
      10,
    );
    expect(s.exercises.filter((e) => e.variant === "jebakan").length).toBe(4); // capped at 40% of the session (10 -> 4)
    // the same A<->B pair is only used once per session (from either side)
    const mutual: Selection[] = [
      {
        ...remedy(0),
        itemId: "i0",
        remedy: { kind: "jebakan", partnerId: "i1", source: "error", count: 2 },
      },
      {
        ...remedy(1),
        itemId: "i1",
        remedy: { kind: "jebakan", partnerId: "i0", source: "error", count: 2 },
      },
    ];
    expect(
      buildSession(mutual, content, pool, new Set(), "sid", NOW, 10).exercises.filter(
        (e) => e.variant === "jebakan",
      ),
    ).toHaveLength(1);
    const many = ids.map((_, i) => ({
      ...remedy(i),
      remedy: { kind: "meaning" as const, count: 1 },
    }));
    const s2 = buildSession(many, content, pool, new Set(), "sid", NOW, 10);
    expect(s2.exercises).toHaveLength(10);
    const sp = spaceOut([
      { itemType: "k", itemId: "a" },
      { itemType: "k", itemId: "a" },
      { itemType: "k", itemId: "b" },
      { itemType: "k", itemId: "c" },
    ]);
    expect(sp.map((x) => x.itemId)).toEqual(["a", "b", "c", "a"]);
  });
  it("an item comes back at most MAX_APPEARANCES times", () => {
    const c: Content = {
      id: "A",
      type: "vocabulary",
      level: "N5",
      surface: "語",
      reading: "よ",
      meaning: "x",
    };
    const pool = ["A", "B", "C", "D"].map((id) => ({
      ...c,
      id,
      surface: `語${id}`,
      meaning: `m${id}`,
    }));
    const content = new Map(pool.map((x) => [`vocabulary:${x.id}`, x]));
    const sel = (aspect: "meaning" | "reading", dir: "forward" | "reverse"): Selection => ({
      itemType: "vocabulary",
      itemId: "A",
      level: "N5",
      aspect,
      direction: dir,
      exerciseType: "choice",
      stage: 1,
      hintLevel: 3,
      optionCount: 4,
      reason: "x",
      score: 1,
    });
    let s = buildSession(
      [sel("meaning", "forward"), sel("meaning", "reverse")],
      content,
      pool,
      new Set(),
      "sid",
      NOW,
      10,
    );
    expect(s.exercises.length).toBe(2);
    s = queueRepeat(s, s.exercises[0]!);
    expect(s.exercises.length).toBe(3);
    s = queueRepeat(s, s.exercises[1]!);
    expect(s.exercises.length).toBe(3); // cap reached
  });
});

describe("Jebakan / Contrast / Usage exercises", () => {
  const V = (
    id: string,
    surface: string,
    meaning: string,
    extra: Partial<Content> = {},
  ): Content => ({
    id,
    type: "vocabulary",
    level: "N5",
    surface,
    reading: `r${id}`,
    meaning,
    ...extra,
  });
  const A = V("A", "会う", "bertemu", { examples: [{ ja: "友達に会う。", id: "Bertemu teman." }] });
  const B = V("B", "合う", "cocok");
  const others = ["C", "D", "E"].map((i) => V(i, `語${i}`, `arti ${i}`));
  const content = new Map([A, B].map((x) => [`vocabulary:${x.id}`, x]));
  const pool = [A, B, ...others];
  const sel = (remedy: Selection["remedy"]): Selection => ({
    itemType: "vocabulary",
    itemId: "A",
    level: "N5",
    aspect: "meaning",
    direction: "forward",
    exerciseType: "choice",
    stage: 1,
    hintLevel: 3,
    optionCount: 4,
    reason: "r",
    score: 1,
    ...(remedy ? { remedy } : {}),
  });
  it("jebakan uses the real partner as option; unlearned partner is only a distractor", () => {
    const ex = buildExercise(
      sel({ kind: "jebakan", partnerId: "B", source: "error", count: 1 }),
      content,
      pool,
      new Set(["vocabulary:A"]),
      "s",
      0,
    )!;
    expect(ex.variant).toBe("jebakan");
    expect(ex.itemId).toBe("A");
    expect(ex.options.map((o) => o.text)).toEqual(expect.arrayContaining(["bertemu", "cocok"]));
    expect(ex.options.find((o) => o.id === "B")?.confusable).toBe(true);
    expect(ex.feedback).toBe("会う bertemu · 合う cocok");
    // B never becomes a primary exercise
    const s = buildSession(
      [sel({ kind: "jebakan", partnerId: "B", source: "error", count: 1 })],
      content,
      pool,
      new Set(["vocabulary:A"]),
      "s",
      NOW,
    );
    expect(s.exercises.every((e) => e.itemId === "A")).toBe(true);
  });
  it("contrast: two options, sentence context blanked, feedback explains the difference from data", () => {
    const ex = buildExercise(
      sel({ kind: "contrast", partnerId: "B", source: "error", count: 2 }),
      content,
      pool,
      new Set(),
      "s",
      0,
    )!;
    expect(ex).toMatchObject({
      exerciseType: "contrast",
      variant: "contrast",
      prompt: "友達に＿＿。",
      answer: "会う",
      promptSub: "Bertemu teman.",
    });
    expect(ex.options.map((o) => o.text).sort()).toEqual(["会う", "合う"].sort());
    expect(ex.feedback).toBe("会う bertemu · 合う cocok");
  });
  it("contrast without an example falls back to jebakan (no invented context)", () => {
    const noEx = new Map([
      [`vocabulary:A`, V("A", "会う", "bertemu")],
      [`vocabulary:B`, B],
    ]);
    const ex = buildExercise(
      sel({ kind: "contrast", partnerId: "B", source: "error", count: 2 }),
      noEx,
      pool,
      new Set(),
      "s",
      0,
    )!;
    expect(ex.variant).toBe("jebakan");
  });
  it("heuristic partner is the last resort when no error/relation partner exists", () => {
    const H = V("H", "会議", "rapat");
    const ex = buildExercise(
      sel({ kind: "jebakan", count: 1 }),
      content,
      [A, B, H, ...others],
      new Set(),
      "s",
      0,
    )!;
    expect(ex.variant).toBe("jebakan");
    expect(ex.options.some((o) => o.id === "H" && o.confusable)).toBe(true); // shares the kanji 会
    const none = buildExercise(
      sel({ kind: "jebakan", count: 1 }),
      content,
      [A, ...others],
      new Set(),
      "s",
      0,
    )!;
    expect(none.variant).toBeUndefined(); // no relevant pair -> plain exercise, no fake Jebakan
  });
  it("vocab usage cloze (options are terms; feedback = term + meaning)", () => {
    const ex = buildExercise(
      { ...sel({ kind: "usage", count: 1 }), aspect: "meaning" },
      content,
      pool,
      new Set(),
      "s",
      0,
    )!;
    expect(ex).toMatchObject({
      exerciseType: "usage",
      variant: "cloze",
      aspect: "usage",
      answer: "会う",
    });
    expect(ex.options).toHaveLength(4);
  });
  it("grammar usage: correct vs wrong sentence with the real reason", () => {
    const G: Content = {
      id: "G",
      type: "grammar",
      level: "N5",
      surface: "〜に",
      reading: "",
      meaning: "tujuan/waktu",
      wrong: [{ wrong: "学校で行く", correct: "学校に行く", reason: "に menunjukkan tujuan." }],
    };
    const gs: Selection = {
      itemType: "grammar",
      itemId: "G",
      level: "N5",
      aspect: "function_context",
      direction: "forward",
      exerciseType: "choice",
      stage: 1,
      hintLevel: 3,
      optionCount: 4,
      reason: "r",
      score: 1,
      remedy: { kind: "usage", count: 1 },
    };
    const ex = buildExercise(gs, new Map([["grammar:G", G]]), [G], new Set(), "s", 0)!;
    expect(ex).toMatchObject({
      exerciseType: "usage",
      variant: "wrong_example",
      answer: "学校に行く",
      feedback: "に menunjukkan tujuan.",
    });
    expect(ex.options.map((o) => o.text).sort()).toEqual(["学校に行く", "学校で行く"].sort());
  });
  it("grammar contrast between two patterns uses the target example as context", () => {
    const G1: Content = {
      id: "G1",
      type: "grammar",
      level: "N5",
      surface: "は",
      reading: "",
      meaning: "topik",
      examples: [{ ja: "私は学生です。", id: "Saya pelajar." }],
    };
    const G2: Content = {
      id: "G2",
      type: "grammar",
      level: "N5",
      surface: "が",
      reading: "",
      meaning: "subjek",
    };
    const gs: Selection = {
      itemType: "grammar",
      itemId: "G1",
      level: "N5",
      aspect: "function_context",
      direction: "forward",
      exerciseType: "choice",
      stage: 1,
      hintLevel: 3,
      optionCount: 4,
      reason: "r",
      score: 1,
      remedy: { kind: "contrast", partnerId: "G2", source: "error", count: 2 },
    };
    const ex = buildExercise(
      gs,
      new Map([
        ["grammar:G1", G1],
        ["grammar:G2", G2],
      ]),
      [G1, G2],
      new Set(),
      "s",
      0,
    )!;
    expect(ex).toMatchObject({
      exerciseType: "contrast",
      prompt: "私＿＿学生です。",
      answer: "は",
      feedback: "は: topik · が: subjek",
    });
  });
});

describe("cloze on inflected forms", () => {
  it("blanks the kanji stem and offers stems (no invented sentence)", () => {
    const A: Content = {
      id: "A",
      type: "vocabulary",
      level: "N5",
      surface: "会う",
      reading: "あう",
      meaning: "bertemu",
      examples: [{ ja: "日曜日に友達に会います。", id: "Saya bertemu teman pada hari Minggu." }],
    };
    const B: Content = {
      id: "B",
      type: "vocabulary",
      level: "N3",
      surface: "合う",
      reading: "あう",
      meaning: "cocok",
    };
    const s: Selection = {
      itemType: "vocabulary",
      itemId: "A",
      level: "N5",
      aspect: "meaning",
      direction: "forward",
      exerciseType: "choice",
      stage: 1,
      hintLevel: 3,
      optionCount: 4,
      reason: "r",
      score: 1,
      remedy: { kind: "contrast", partnerId: "B", source: "error", count: 2 },
    };
    const ex = buildExercise(
      s,
      new Map([
        ["vocabulary:A", A],
        ["vocabulary:B", B],
      ]),
      [A, B],
      new Set(),
      "s",
      0,
    )!;
    expect(ex).toMatchObject({
      exerciseType: "contrast",
      prompt: "日曜日に友達に＿＿います。",
      answer: "会",
    });
    expect(ex.options.map((o) => o.text).sort()).toEqual(["会", "合"].sort());
    expect(ex.feedback).toBe("会う bertemu · 合う cocok");
  });
});

describe("repeat after error does not resolve the error", () => {
  it("a correct immediate repeat keeps the combo unresolved; a later clean answer resolves", () => {
    const repeatOk = ev({ correct: true, error_type: null, variant: "repeat" });
    const wrong = ev({ selected_item_id: "B", error_type: "confusion" });
    expect(buildSignals(newestFirst(repeatOk, wrong)).unresolved.size).toBe(1);
    const later = ev({ correct: true, error_type: null, variant: null });
    expect(buildSignals(newestFirst(later, repeatOk, wrong)).unresolved.size).toBe(0);
  });
});

describe("confusion persistence (symmetry, replay, age)", () => {
  it("A->B and B->A are one pair and add up", () => {
    const sig = buildSignals(
      newestFirst(
        ev({ item_id: "A", selected_item_id: "B", error_type: "confusion" }),
        ev({ item_id: "B", selected_item_id: "A", error_type: "confusion" }),
      ),
    );
    expect(sig.pairs.size).toBe(1);
    expect([...sig.pairs.values()][0]).toMatchObject({ count: 2, confused: 2 });
    expect(partnerFor("vocabulary", "A", sig)).toMatchObject({ id: "B", confirmed: true });
    expect(partnerFor("vocabulary", "B", sig)).toMatchObject({ id: "A", confirmed: true });
  });
  it("signals are derived from persisted rows only, so a replayed (deduplicated) event adds nothing", () => {
    const rows = [
      {
        item_type: "vocabulary",
        item_id: "A",
        aspect: "meaning",
        direction: "forward",
        rating: 0,
        created_at: "2026-09-30T00:00:00Z",
        meta: { source: "kioku", correct: false, error_type: "confusion", selected_item_id: "B" },
      },
    ];
    expect([...buildSignals(toReviewEvents(rows)).pairs.values()][0]!.count).toBe(1);
  });
  it("an old error stops steering remediation", () => {
    const old = ev({
      selected_item_id: "B",
      error_type: "confusion",
      created_at: new Date(NOW - MAX_ERROR_AGE_MS - 86400000).toISOString(),
    });
    expect(buildSignals(newestFirst(old), [], NOW).unresolved.size).toBe(0);
    expect(buildSignals(newestFirst(old)).unresolved.size).toBe(1); // without a clock the age rule is off
  });
});

describe("remediation lifecycle (always-wrong learner cannot be trapped)", () => {
  it("escalation stops after HOLD_AFTER consecutive errors and never exceeds session caps", () => {
    let events: ReviewEvent[] = [];
    let last = -1;
    for (let round = 1; round <= 8; round++) {
      events = [ev({ selected_item_id: "B", error_type: "confusion" }), ...events]; // newest first
      const sig = buildSignals(events);
      const r = rankCandidates(
        learned("A"),
        [st("A", { due_at: "2026-10-09T00:00:00Z" })],
        NOW,
        sig,
      ).find((s) => s.aspect === "meaning" && s.direction === "forward")!;
      if (round < HOLD_AFTER) expect(r.remedy).toBeTruthy();
      else expect(r.remedy).toBeUndefined();
      last = r.score;
    }
    expect(last).toBeLessThan(700); // back to ordinary priority
  });
  it("after the hold a clean correct answer resolves everything", () => {
    const events = [
      ev({ correct: true, error_type: null, variant: null }),
      ...Array.from({ length: 6 }, () => ev({ selected_item_id: "B", error_type: "confusion" })),
    ];
    expect(buildSignals(events).unresolved.size).toBe(0);
  });
});

describe("relation fallback order: real confusion -> relation -> heuristic", () => {
  const V = (id: string, surface: string, reading: string, meaning: string): Content => ({
    id,
    type: "vocabulary",
    level: "N5",
    surface,
    reading,
    meaning,
  });
  const A = V("A", "会う", "あう", "bertemu");
  const REAL = V("REAL", "遭う", "ろう", "mengalami");
  const REL = V("REL", "合う", "ごう", "cocok");
  const HEUR = V("HEUR", "会議", "かいぎ", "rapat"); // shares 会 with A
  const content = new Map([A, REAL, REL].map((x) => [`vocabulary:${x.id}`, x]));
  const sel = (partnerId?: string, source?: "error" | "relation"): Selection => ({
    itemType: "vocabulary",
    itemId: "A",
    level: "N5",
    aspect: "meaning",
    direction: "forward",
    exerciseType: "choice",
    stage: 1,
    hintLevel: 3,
    optionCount: 4,
    reason: "r",
    score: 1,
    remedy: { kind: "jebakan", count: 1, ...(partnerId ? { partnerId, source } : {}) },
  });
  it("partnerFor prefers the real error pair over the relation table", () => {
    const rel = [{ type: "vocabulary" as const, a: "A", b: "REL" }];
    expect(
      partnerFor(
        "vocabulary",
        "A",
        buildSignals(newestFirst(ev({ selected_item_id: "REAL", error_type: "confusion" })), rel),
      ),
    ).toMatchObject({ id: "REAL", source: "error" });
    expect(partnerFor("vocabulary", "A", buildSignals([], rel))).toMatchObject({
      id: "REL",
      source: "relation",
    });
    expect(partnerFor("vocabulary", "A", buildSignals([], []))).toBeNull(); // empty production tables are safe
  });
  it("builder: given partner wins; heuristic only when no partner exists", () => {
    const pool = [A, REAL, REL, HEUR];
    expect(
      buildExercise(sel("REAL", "error"), content, pool, new Set(), "s", 0)!.options.some(
        (o) => o.id === "REAL" && o.confusable,
      ),
    ).toBe(true);
    expect(
      buildExercise(sel("REL", "relation"), content, pool, new Set(), "s", 0)!.options.some(
        (o) => o.id === "REL" && o.confusable,
      ),
    ).toBe(true);
    const h = buildExercise(sel(), content, pool, new Set(), "s", 0)!;
    expect(h.variant).toBe("jebakan");
    expect(h.options.some((o) => o.id === "HEUR" && o.confusable)).toBe(true);
    const none = buildExercise(sel(), content, [A], new Set(), "s", 0);
    expect(none === null || none.variant === undefined).toBe(true); // nothing relevant -> no fake Jebakan
  });
});

describe("contrast correctness (Japanese kept intact, answer not leaked)", () => {
  it("blankOut restores the original sentence and never leaves the target", () => {
    for (const [ja, needle, stem] of [
      ["電車 は 便利 です。", "便利", false],
      ["便利な駅で便利です。", "便利", false],
      ["日曜日に友達に会います。", "会", true],
      ["これ 以外 に 方法 は ありません。", "以外", false],
    ] as const) {
      const out = blankOut(ja, needle, stem)!;
      expect(out).toBeTruthy();
      expect(out).not.toContain(needle);
      expect(out.split("＿＿").join(needle)).toBe(ja);
    }
  });
  it("does not corrupt other words: 会 inside 会社 is rejected, multiple stem hits are rejected", () => {
    expect(blankOut("会社で友達に会います。", "会", true)).toBeNull();
    expect(blankOut("友達に会って、また会います。", "会", true)).toBeNull();
    expect(blankOut("不便利な町", "便利", false)).toBeNull(); // glued to another kanji
  });
  const V = (
    id: string,
    surface: string,
    meaning: string,
    ex: Content["examples"] = [],
  ): Content => ({
    id,
    type: "vocabulary",
    level: "N5",
    surface,
    reading: `r${id}`,
    meaning,
    examples: ex,
  });
  it("Kotoba: prompt has no answer form, feedback = both meanings from data", () => {
    const A = V("A", "意外", "tak terduga", [
      { ja: "これは意外に安かった。", id: "Ini ternyata lebih murah." },
    ]);
    const B = V("B", "以外", "selain");
    const s: Selection = {
      itemType: "vocabulary",
      itemId: "A",
      level: "N5",
      aspect: "meaning",
      direction: "forward",
      exerciseType: "choice",
      stage: 1,
      hintLevel: 3,
      optionCount: 4,
      reason: "r",
      score: 1,
      remedy: { kind: "contrast", partnerId: "B", source: "error", count: 2 },
    };
    const ex = buildExercise(
      s,
      new Map([
        ["vocabulary:A", A],
        ["vocabulary:B", B],
      ]),
      [A, B],
      new Set(),
      "s",
      0,
    )!;
    expect(ex).toMatchObject({
      exerciseType: "contrast",
      prompt: "これは＿＿に安かった。",
      answer: "意外",
      feedback: "意外 tak terduga · 以外 selain",
    });
    expect(ex.prompt).not.toContain("意外");
    expect(ex.options.map((o) => o.text).sort()).toEqual(["意外", "以外"].sort());
  });
  it("Kanji: contrast falls back to Jebakan with data feedback (no invented sentences)", () => {
    const K = (id: string, ch: string, m: string): Content => ({
      id,
      type: "kanji",
      level: "N5",
      surface: ch,
      reading: `r${id}`,
      meaning: m,
    });
    const A = K("A", "未", "belum"),
      B = K("B", "末", "akhir");
    const s: Selection = {
      itemType: "kanji",
      itemId: "A",
      level: "N5",
      aspect: "meaning",
      direction: "forward",
      exerciseType: "choice",
      stage: 1,
      hintLevel: 3,
      optionCount: 4,
      reason: "r",
      score: 1,
      remedy: { kind: "contrast", partnerId: "B", source: "error", count: 2 },
    };
    const ex = buildExercise(
      s,
      new Map([
        ["kanji:A", A],
        ["kanji:B", B],
      ]),
      [A, B, K("C", "本", "buku"), K("D", "木", "pohon")],
      new Set(),
      "s",
      0,
    )!;
    expect(ex.variant).toBe("jebakan");
    expect(ex.feedback).toBe("未 belum · 末 akhir");
  });
  it("Bunpou: particle contrast blanks the particle; long patterns are identified in the sentence (not blanked)", () => {
    const G = (
      id: string,
      pattern: string,
      meaning: string,
      ex: Content["examples"] = [],
    ): Content => ({
      id,
      type: "grammar",
      level: "N5",
      surface: pattern,
      reading: "",
      meaning,
      examples: ex,
    });
    const ni = G("N", "〜に", "tujuan/waktu", [
      { ja: "学校に行きます。", id: "Pergi ke sekolah." },
    ]);
    const de = G("D", "〜で", "tempat kegiatan");
    const s = (id: string, partner: string): Selection => ({
      itemType: "grammar",
      itemId: id,
      level: "N5",
      aspect: "function_context",
      direction: "forward",
      exerciseType: "choice",
      stage: 1,
      hintLevel: 3,
      optionCount: 4,
      reason: "r",
      score: 1,
      remedy: { kind: "contrast", partnerId: partner, source: "error", count: 2 },
    });
    const ex = buildExercise(
      s("N", "D"),
      new Map([
        ["grammar:N", ni],
        ["grammar:D", de],
      ]),
      [ni, de],
      new Set(),
      "s",
      0,
    )!;
    expect(ex).toMatchObject({
      prompt: "学校＿＿行きます。",
      answer: "に",
      feedback: "〜に: tujuan/waktu · 〜で: tempat kegiatan",
    });
    expect(ex.options.map((o) => o.text).sort()).toEqual(["で", "に"].sort());
    const long = G("L", "KB + が + 好きです", "menyukai", [
      { ja: "私は猫が好きです。", id: "Saya suka kucing." },
    ]);
    const other = G("O", "KB + を + 食べます", "memakan");
    const ex2 = buildExercise(
      s("L", "O"),
      new Map([
        ["grammar:L", long],
        ["grammar:O", other],
      ]),
      [long, other],
      new Set(),
      "s",
      0,
    )!;
    expect(ex2.prompt).toBe("私は猫が好きです。"); // sentence intact, pattern is identified
    expect(ex2.answer).toBe("KB + が + 好きです");
  });
});

describe("distractor isolation in a built session", () => {
  it("partner/distractors are options only: never primary, never learned", () => {
    const V = (id: string, s: string, m: string): Content => ({
      id,
      type: "vocabulary",
      level: "N5",
      surface: s,
      reading: `r${id}`,
      meaning: m,
      examples: [],
    });
    const A = V("A", "会う", "bertemu"),
      B = V("B", "合う", "cocok"),
      C = V("C", "語C", "c"),
      D = V("D", "語D", "d");
    const learnedSet = new Set(["vocabulary:A"]);
    const ranked = selectExercises(
      rankCandidates(
        learned("A"),
        [st("A")],
        NOW,
        buildSignals(newestFirst(ev({ selected_item_id: "B", error_type: "confusion" }))),
      ),
      10,
    );
    const s = buildSession(
      ranked,
      new Map([A, B].map((x) => [`vocabulary:${x.id}`, x])),
      [A, B, C, D],
      learnedSet,
      "sid",
      NOW,
    );
    expect(s.exercises.every((e) => e.itemId === "A")).toBe(true);
    expect(s.exercises.some((e) => e.options.some((o) => o.id === "B"))).toBe(true);
    expect(learnedSet.has("vocabulary:B")).toBe(false);
  });
});
