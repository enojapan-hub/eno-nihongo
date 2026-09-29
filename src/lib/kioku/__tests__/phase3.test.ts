import { describe, expect, it } from "vitest";
import {
  applyEvent,
  initialMem,
  stageCap,
  type MemLite,
  type ProgressionEvent,
} from "../progression";
import { COMBOS, planExercise, rankCandidates, selectExercises, toLearned } from "../selector";
import { buildSession, makeHint, queueRepeat, type Content } from "../session";
import type { MemoryStateRow } from "../types";

const AT = Date.parse("2026-10-01T00:00:00Z");
const ev = (o: Partial<ProgressionEvent> = {}): ProgressionEvent => ({
  correct: true,
  usedHint: false,
  confidence: "yakin",
  errorType: null,
  responseMs: 2000,
  hintLevel: 3,
  at: AT,
  ...o,
});
const run = (events: ProgressionEvent[], from?: MemLite) =>
  events.reduce<MemLite | undefined>((m, e) => applyEvent(m, e), from) as MemLite;
const row = (id: string, o: Partial<MemoryStateRow> = {}): MemoryStateRow => ({
  item_type: "kanji",
  item_id: id,
  aspect: "meaning",
  direction: "forward",
  stage: 0,
  stability: 0.5,
  due_at: "2026-09-30T00:00:00Z",
  last_tested_at: "2026-09-29T00:00:00Z",
  lapses: 0,
  success_count: 0,
  failure_count: 0,
  overconfident_wrong: 0,
  last_error_type: null,
  ...o,
});
const prog = (id: string, t = "kanji") => ({
  item_type: t,
  item_id: id,
  level: "N5",
  status: "learning",
  due_at: null,
  last_reviewed_at: null,
});

describe("Petunjuk Memudar / stage plan", () => {
  it("weak item starts with help, help fades with stage", () => {
    expect(planExercise(undefined)).toMatchObject({
      exerciseType: "choice",
      hintLevel: 3,
      optionCount: 3,
    });
    expect(planExercise(row("a", { stage: 1 }))).toMatchObject({
      exerciseType: "choice",
      hintLevel: 3,
      optionCount: 4,
    });
    expect(planExercise(row("a", { stage: 2 }))).toMatchObject({
      exerciseType: "recall_flip",
      hintLevel: 2,
    });
    expect(planExercise(row("a", { stage: 3 }))).toMatchObject({
      exerciseType: "recall_flip",
      hintLevel: 1,
    });
    expect(planExercise(row("a", { stage: 4 }))).toMatchObject({
      exerciseType: "recall_flip",
      hintLevel: 0,
    });
  });
  it("a guessed weak item is not pushed to recall", () => {
    expect(planExercise(row("a", { stage: 0, last_error_type: "likely_guess" }))).toMatchObject({
      exerciseType: "choice",
      optionCount: 4,
    });
  });
  it("makeHint is deterministic and never reveals more than the first character", () => {
    expect(makeHint("praktis; nyaman")).toBe("p○○○○○○; n○○○○○");
    expect(makeHint("ひま")).toBe("ひ○");
    expect(makeHint("ひま")).toBe(makeHint("ひま"));
  });
});

describe("Ingatan Balik", () => {
  it("reverse is offered only after forward was recognised; reading is never reversed", () => {
    const learned = toLearned([prog("k")]);
    const none = rankCandidates(learned, [], AT);
    expect(none.some((s) => s.direction === "reverse")).toBe(false);
    const withFwd = rankCandidates(learned, [row("k", { stage: 1 })], AT);
    expect(withFwd.some((s) => s.direction === "reverse" && s.aspect === "meaning")).toBe(true);
    expect(
      COMBOS.kanji
        .concat(COMBOS.vocabulary)
        .some((c) => c.aspect === "reading" && c.direction === "reverse"),
    ).toBe(false);
  });
  const c = (id: string, s: string, m: string): Content => ({
    id,
    type: "kanji",
    level: "N5",
    surface: s,
    reading: `よ${id}`,
    meaning: m,
  });
  const pool = [
    c("a", "一", "satu"),
    c("b", "二", "dua"),
    c("d", "三", "tiga"),
    c("e", "四", "empat"),
  ];
  const content = new Map(pool.map((x) => [`kanji:${x.id}`, x]));
  it("JP->ID and ID->JP questions have the right prompt/answer", () => {
    const ranked = rankCandidates(toLearned([prog("a")]), [row("a", { stage: 1 })], AT); // the per-item cap is applied while building
    const s = buildSession(ranked, content, pool, new Set(["kanji:a"]), "sid", AT);
    const f = s.exercises.find((e) => e.direction === "forward" && e.aspect === "meaning")!;
    const r = s.exercises.find((e) => e.direction === "reverse")!;
    expect([f.prompt, f.answer]).toEqual(["一", "satu"]);
    expect([r.prompt, r.answer]).toEqual(["satu", "一"]);
    expect(r.options.map((o) => o.text)).toContain("一");
  });
  it("a missed recall repeats as an easier choice question", () => {
    const ranked = rankCandidates(toLearned([prog("a")]), [row("a", { stage: 3 })], AT); // the per-item cap is applied while building
    let s = buildSession(ranked, content, pool, new Set(["kanji:a"]), "sid", AT);
    const rec = s.exercises[0]!;
    expect(rec.exerciseType).toBe("recall_flip");
    s = queueRepeat(s, rec);
    const rep = s.exercises.find((e) => e.isRepeat)!;
    expect(rep).toMatchObject({ exerciseType: "choice", hintLevel: 3 });
  });
});

describe("adaptive progression", () => {
  it("one correct answer never makes an item Kuasai", () => {
    expect(applyEvent(initialMem(), ev()).stage).toBe(1);
    expect(
      applyEvent({ ...initialMem(), stage: 3, successCount: 1 }, ev({ hintLevel: 1 })).stage,
    ).toBe(3);
  });
  it("choice answers are capped at Gunakan; Kuasai needs unhinted recall, >=4 successes and stability", () => {
    let m = run([ev(), ev(), ev(), ev()]);
    expect(m.stage).toBe(2); // choices stop at stage 2 however many
    expect(stageCap(3)).toBe(2);
    m = applyEvent(m, ev({ hintLevel: 2 }));
    expect(m.stage).toBe(3);
    m = applyEvent(m, ev({ hintLevel: 1 }));
    expect(m.stage).toBe(4);
    const fewer = run([ev(), ev(), ev({ hintLevel: 2 }), ev({ hintLevel: 1 })]);
    expect(fewer.successCount).toBe(4);
    expect(fewer.stage).toBe(4);
    const early = applyEvent(
      { ...initialMem(), stage: 3, successCount: 1, stability: 0.5 },
      ev({ hintLevel: 1 }),
    );
    expect(early.stage).toBe(3);
  });
  it("hint, slow answer and ragu do not advance the stage", () => {
    for (const o of [{ usedHint: true }, { responseMs: 9000 }, { confidence: "ragu" as const }])
      expect(applyEvent(initialMem(), ev(o)).stage).toBe(0);
  });
  it("ragu+correct grows stability less than yakin+correct", () => {
    const y = applyEvent(initialMem(), ev({ confidence: "yakin" })),
      r = applyEvent(initialMem(), ev({ confidence: "ragu" }));
    expect(r.stability).toBeLessThan(y.stability);
    expect(r.stage).toBeLessThan(y.stage);
    expect(r.dueAt).toBeLessThan(y.dueAt);
  });
  it("yakin+wrong is a stronger weakness signal than ragu+wrong", () => {
    const start = { ...initialMem(), stage: 3, stability: 10, successCount: 3 };
    const y = applyEvent(start, ev({ correct: false, confidence: "yakin", hintLevel: 1 }));
    const r = applyEvent(start, ev({ correct: false, confidence: "ragu", hintLevel: 1 }));
    expect(y.overconfidentWrong).toBe(1);
    expect(r.overconfidentWrong).toBe(0);
    expect(y.stage).toBeLessThan(r.stage);
    expect(y.stability).toBeLessThan(r.stability);
  });
  it("overconfident_wrong is prioritised by the selector next time", () => {
    const rows = [
      row("oc", { overconfident_wrong: 1, failure_count: 1, due_at: "2026-10-09T00:00:00Z" }),
      row("gen", { stage: 1, due_at: "2026-10-09T00:00:00Z" }),
    ];
    const top = selectExercises(
      rankCandidates(toLearned([prog("gen"), prog("oc")]), rows, AT),
      5,
    ).filter((s) => s.direction === "forward" && s.aspect === "meaning");
    expect(top[0]).toMatchObject({ itemId: "oc", reason: "overconfident_wrong" });
  });
  it("deterministic", () => {
    const es = [ev(), ev({ correct: false, confidence: "yakin" }), ev({ hintLevel: 2 })];
    expect(JSON.stringify(run(es))).toBe(JSON.stringify(run(es)));
  });
});
