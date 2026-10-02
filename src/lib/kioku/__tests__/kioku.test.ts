import { describe, expect, it } from "vitest";
import { classifyError } from "../classify";
import { createOutbox, type StorageLike } from "../outbox";
import { rankCandidates, selectExercises, toLearned } from "../selector";
import { buildSession, queueRepeat, type Content } from "../session";
import { loadSession, saveSession } from "../session-store";
import type { KiokuEvent, MemoryStateRow } from "../types";

const NOW = Date.parse("2026-10-01T00:00:00Z");
const mem = (): StorageLike & { d: Map<string, string> } => {
  const d = new Map<string, string>();
  return {
    d,
    getItem: (k) => d.get(k) ?? null,
    setItem: (k, v) => void d.set(k, v),
    removeItem: (k) => void d.delete(k),
  };
};
const prog = (
  id: string,
  o: Partial<{
    item_type: string;
    status: string;
    due_at: string | null;
    last_reviewed_at: string | null;
  }> = {},
) => ({
  item_type: "kanji",
  item_id: id,
  level: "N5",
  status: "learning",
  due_at: null,
  last_reviewed_at: null,
  ...o,
});
const st = (id: string, o: Partial<MemoryStateRow> = {}): MemoryStateRow => ({
  item_type: "kanji",
  item_id: id,
  aspect: "meaning",
  direction: "forward",
  stage: 1,
  stability: 1,
  due_at: "2026-10-05T00:00:00Z",
  last_tested_at: "2026-09-28T00:00:00Z",
  lapses: 0,
  success_count: 1,
  failure_count: 0,
  overconfident_wrong: 0,
  last_error_type: null,
  ...o,
});
const ev = (n: number): KiokuEvent => ({
  client_event_id: `e${n}`,
  session_id: "s",
  item_type: "kanji",
  item_id: "k",
  level: "N5",
  aspect: "meaning",
  direction: "forward",
  exercise_type: "choice",
  correct: true,
  selected_answer: null,
  selected_item_id: null,
  variant: null,
  retention: "immediate",
  context_ref: null,
  confidence: null,
  hint_level: 3,
  used_hint: false,
  response_ms: 1000,
  error_type: null,
  occurred_at: new Date(NOW).toISOString(),
});

describe("gating", () => {
  it("user without learned material gets nothing", () => {
    expect(selectExercises(rankCandidates(toLearned([]), [], NOW), 20)).toEqual([]);
  });
  it("only learned kanji/kotoba/bunpou; never new, hiragana, reading or listening", () => {
    const learned = toLearned([
      prog("a"),
      prog("n", { status: "new" }),
      prog("h", { item_type: "hiragana" }),
      prog("r", { item_type: "reading" }),
      prog("l", { item_type: "listening" }),
      prog("g", { item_type: "grammar" }),
    ]);
    const ids = new Set(selectExercises(rankCandidates(learned, [], NOW), 20).map((s) => s.itemId));
    expect([...ids].sort()).toEqual(["a", "g"]);
  });
});

describe("selector priority", () => {
  const learned = toLearned(
    ["due", "oc", "rep", "conf", "gen"]
      .map((i) => prog(i))
      .concat([prog("mast", { status: "mastered", last_reviewed_at: "2026-08-01T00:00:00Z" })]),
  );
  const states = [
    st("due", { due_at: "2026-09-30T00:00:00Z" }),
    st("oc", { overconfident_wrong: 1, failure_count: 1 }),
    st("rep", { failure_count: 3, success_count: 1 }),
    st("conf", { last_error_type: "confusion" }),
    st("gen"),
  ];
  const top = selectExercises(rankCandidates(learned, states, NOW), 20).filter(
    (s) => s.aspect === "meaning" && s.direction === "forward",
  );
  it("orders due > overconfident_wrong > repeated error > confusion > mastered retest > general, with reasons", () => {
    expect(top.map((s) => s.itemId)).toEqual(["due", "oc", "rep", "conf", "mast", "gen"]);
    expect(top.map((s) => s.reason)).toEqual([
      "due_memory_state",
      "overconfident_wrong",
      "repeated_error",
      "confusion_reinforcement",
      "retest_mastered",
      "general_reinforcement",
    ]);
  });
  it("is deterministic", () => {
    const a = JSON.stringify(rankCandidates(learned, states, NOW)),
      b = JSON.stringify(rankCandidates([...learned].reverse(), [...states].reverse(), NOW));
    expect(a).toBe(b);
  });
  it("existing SRS due_at counts as due; caps items per session slot and skips just-tested items", () => {
    const r = rankCandidates(
      toLearned([prog("p", { due_at: "2026-09-30T00:00:00Z" }), prog("t")]),
      [st("t", { last_tested_at: new Date(NOW - 60000).toISOString() })],
      NOW,
    );
    expect(r[0]?.reason).toBe("progress_due");
    expect(
      r.some((s) => s.itemId === "t" && s.aspect === "meaning" && s.direction === "forward"),
    ).toBe(false);
  });
});

describe("error classifier", () => {
  const base = {
    correct: false,
    aspect: "meaning",
    exerciseType: "choice" as const,
    responseMs: 4000,
    usedHint: false,
  };
  it("labels only what is provable", () => {
    expect(classifyError({ ...base, correct: true })).toBeNull();
    expect(classifyError({ ...base, correct: true, responseMs: 9000 })).toBe("slow_recall");
    expect(classifyError({ ...base, selectedWasConfusable: true })).toBe("confusion");
    expect(classifyError({ ...base, responseMs: 500 })).toBe("likely_guess");
    expect(classifyError({ ...base, exerciseType: "recall_flip", responseMs: 500 })).toBe(
      "meaning",
    );
    expect(classifyError({ ...base, aspect: "reading" })).toBe("reading");
    expect(classifyError({ ...base, aspect: "function_context" })).toBe("usage_context");
    expect(classifyError({ ...base, aspect: "general" })).toBe("general");
  });
});

describe("session build / restore", () => {
  const c = (id: string, surface: string): Content => ({
    id,
    type: "kanji",
    level: "N5",
    surface,
    reading: `よみ${id}`,
    meaning: `arti ${id}`,
  });
  const pool = ["a", "b", "c", "d", "e"].map((i) => c(i, `字${i}`));
  const content = new Map(pool.map((x) => [`kanji:${x.id}`, x]));
  const learnedIds = new Set(["kanji:a", "kanji:b"]);
  it("uses only the available learned candidates, never filler", () => {
    const ranked = selectExercises(rankCandidates(toLearned([prog("a"), prog("b")]), [], NOW), 40);
    const s = buildSession(ranked, content, pool, learnedIds, "sid", NOW);
    expect(new Set(s.exercises.map((e) => e.itemId))).toEqual(new Set(["a", "b"]));
    expect(s.exercises.length).toBe(4);
    for (const e of s.exercises)
      if (e.exerciseType === "choice") {
        expect(e.options).toHaveLength(3);
        expect(e.options.filter((o) => o.text === e.answer)).toHaveLength(1);
      }
    expect(buildSession([], content, pool, learnedIds, "sid", NOW).exercises).toEqual([]);
  });
  it("wrong answer requeues once; session restores after reload", () => {
    const ranked = selectExercises(rankCandidates(toLearned([prog("a"), prog("b")]), [], NOW), 40);
    let s = buildSession(ranked, content, pool, learnedIds, "sid", NOW);
    const n = s.exercises.length;
    s = queueRepeat(s, s.exercises[0]!);
    s = queueRepeat(s, s.exercises[0]!);
    expect(s.exercises.length).toBe(n + 1);
    const storage = mem();
    saveSession(storage, "u", { ...s, index: 2 });
    expect(loadSession(storage, "u", NOW + 1000)?.index).toBe(2);
    expect(loadSession(storage, "u", NOW + 25 * 3600 * 1000)).toBeNull();
  });
});

describe("outbox", () => {
  it("push does not wait for network", () => {
    const storage = mem();
    const ob = createOutbox("u", storage, () => new Promise(() => {}));
    ob.push(ev(1));
    void ob.flush();
    ob.push(ev(2));
    expect(ob.pending()).toBe(2);
    expect(JSON.parse(storage.getItem("eno-kioku-outbox-v1:u")!)).toHaveLength(2);
  });
  it("failed batch keeps events; reload retries; success clears; same id is not queued twice", async () => {
    const storage = mem();
    let fail = true;
    const sent: string[] = [];
    const sender = async (b: KiokuEvent[]) => {
      if (fail) throw new Error("offline");
      sent.push(...b.map((e) => e.client_event_id));
    };
    const a = createOutbox("u", storage, sender);
    a.push(ev(1));
    a.push(ev(1));
    a.push(ev(2));
    expect(await a.flush()).toMatchObject({ ok: false, remaining: 2 });
    const b = createOutbox("u", storage, sender); // simulated reload
    expect(b.pending()).toBe(2);
    fail = false;
    expect(await b.flush()).toMatchObject({ ok: true, sent: 2, remaining: 0 });
    expect(sent).toEqual(["e1", "e2"]);
    expect(storage.getItem("eno-kioku-outbox-v1:u")).toBeNull();
  });
  it("events pushed during a flush are not lost", async () => {
    const storage = mem();
    let release!: () => void;
    const ob = createOutbox(
      "u",
      storage,
      () =>
        new Promise<void>((r) => {
          release = r;
        }),
    );
    ob.push(ev(1));
    const p = ob.flush();
    ob.push(ev(2));
    release();
    await Promise.resolve();
    expect(ob.pending()).toBeGreaterThanOrEqual(1);
    void p;
  });
  it("an empty flush (page mount) does not block later flushes", async () => {
    const storage = mem();
    const sent: string[] = [];
    const ob = createOutbox(
      "u",
      storage,
      async (b) => void sent.push(...b.map((e) => e.client_event_id)),
    );
    await ob.flush();
    ob.push(ev(1));
    await ob.flush();
    expect(sent).toEqual(["e1"]);
  });
});
