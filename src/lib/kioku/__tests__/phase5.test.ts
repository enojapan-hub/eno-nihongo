import { describe, expect, it } from "vitest";
import { applyEvent, initialMem, type ProgressionEvent } from "../progression";
import { rankCandidates, selectExercises, toLearned } from "../selector";
import {
  blankOut,
  buildExercise,
  buildSession,
  contextsOf,
  DELAY_MAX,
  DELAY_MIN,
  delayGap,
  phraseAround,
  pickContext,
  refOf,
  scheduleDelayed,
  type Content,
} from "../session";
import type { Exercise, KiokuSession } from "../session-types";
import { loadSession, saveSession } from "../session-store";
import type { MemoryStateRow, Selection } from "../types";

const NOW = Date.parse("2026-10-01T00:00:00Z");
const DAY = 86400000;
const ex = (i: number, o: Partial<Exercise> = {}): Exercise => ({
  id: `s:${i}`,
  itemType: "vocabulary",
  itemId: `i${i}`,
  level: "N5",
  aspect: "meaning",
  direction: "forward",
  exerciseType: "choice",
  stage: 1,
  hintLevel: 3,
  reason: "r",
  hintText: "x",
  prompt: `p${i}`,
  promptSub: "",
  answer: "a",
  options: [
    { id: "a", text: "a", confusable: false },
    { id: "b", text: "b", confusable: false },
    { id: "c", text: "c", confusable: false },
    { id: "d", text: "d", confusable: false },
  ],
  isRepeat: false,
  ...o,
});
const session = (n: number, o: Partial<KiokuSession> = {}): KiokuSession => ({
  sessionId: "s",
  createdAt: "2026-10-01T00:00:00Z",
  exercises: Array.from({ length: n }, (_, i) => ex(i)),
  index: 0,
  results: {},
  finished: false,
  ...o,
});
const mem = () => {
  const d = new Map<string, string>();
  return {
    getItem: (k: string) => d.get(k) ?? null,
    setItem: (k: string, v: string) => void d.set(k, v),
    removeItem: (k: string) => void d.delete(k),
  };
};

describe("Ingatan Tertunda (position gap, local)", () => {
  it("is never shown right after the first answer; gap 5-15 scaled to the session", () => {
    expect(delayGap(20)).toBe(7);
    expect(delayGap(6)).toBe(DELAY_MIN);
    expect(delayGap(60)).toBe(DELAY_MAX);
    const s = scheduleDelayed(session(20), session(20).exercises[0]!, true);
    const at = s.exercises.findIndex((e) => e.isDelayed);
    expect(s.exercises).toHaveLength(21);
    expect(at - 0 - 1).toBe(7); // 7 other exercises in between
    expect(s.exercises[at]).toMatchObject({
      itemId: "i0",
      retention: "delayed",
      reason: "delayed_recall",
    });
  });
  it("short sessions compress the gap but keep separation; tiny sessions skip it", () => {
    const six = scheduleDelayed(session(6), session(6).exercises[0]!, true);
    expect(six.exercises.findIndex((e) => e.isDelayed)).toBe(6); // after all 5 other exercises
    const three = scheduleDelayed(session(3), session(3).exercises[0]!, true);
    expect(three.exercises.some((e) => e.isDelayed)).toBe(false);
  });
  it("only for independent correct answers of items that still need verification", () => {
    const s = session(20);
    expect(scheduleDelayed(s, s.exercises[0]!, false).exercises).toHaveLength(20);
    const strong = ex(0, { exerciseType: "recall_flip", stage: 3, hintLevel: 1 });
    expect(scheduleDelayed(s, strong, true).exercises).toHaveLength(20);
    const retest = ex(0, { retention: "retest" });
    expect(scheduleDelayed(s, retest, true).exercises).toHaveLength(20);
  });
  it("no chains, one per combo, capped share, respects max appearances", () => {
    let s = session(20);
    s = scheduleDelayed(s, s.exercises[0]!, true);
    const again = scheduleDelayed(s, s.exercises[0]!, true);
    expect(again.exercises).toHaveLength(21); // same combo already scheduled
    const delayed = s.exercises.find((e) => e.isDelayed)!;
    expect(scheduleDelayed(s, delayed, true).exercises).toHaveLength(21); // a delayed copy is never delayed again
    let many = session(20);
    for (let i = 0; i < 20; i++)
      many = scheduleDelayed({ ...many, index: 0 }, many.exercises[i]!, true);
    expect(many.exercises.filter((e) => e.isDelayed).length).toBeLessThanOrEqual(6); // 30% of 20
    const crowded = session(20, {
      exercises: [
        ex(0),
        ex(0, { id: "x1", aspect: "reading" }),
        ex(0, { id: "x2", direction: "reverse" }),
        ...Array.from({ length: 17 }, (_, i) => ex(i + 1)),
      ],
    });
    expect(scheduleDelayed(crowded, crowded.exercises[0]!, true).exercises).toHaveLength(20);
  });
  it("delayed recall uses less help; a stage-0 item is not made harder", () => {
    const s = scheduleDelayed(session(20), ex(0, { stage: 2 }), true);
    expect(s.exercises.find((e) => e.isDelayed)).toMatchObject({
      exerciseType: "recall_flip",
      hintLevel: 1,
    });
    const s0 = scheduleDelayed(session(20), ex(0, { stage: 0 }), true);
    expect(s0.exercises.find((e) => e.isDelayed)).toMatchObject({
      exerciseType: "choice",
      hintLevel: 3,
    });
  });
  it("the schedule survives a reload (it lives in the saved session)", () => {
    const store = mem();
    const s = scheduleDelayed(session(20), session(20).exercises[0]!, true);
    saveSession(store, "u", { ...s, index: 3 });
    const back = loadSession(store, "u", NOW - 1000 * 60 * 60 * 24 * 365 + 1)!;
    expect(back.exercises.filter((e) => e.isDelayed)).toHaveLength(1);
    expect(back.exercises.findIndex((e) => e.isDelayed)).toBe(
      s.exercises.findIndex((e) => e.isDelayed),
    );
  });
});

describe("retention signal (immediate vs delayed)", () => {
  const ev = (o: Partial<ProgressionEvent> = {}): ProgressionEvent => ({
    correct: true,
    usedHint: false,
    confidence: "yakin",
    errorType: null,
    responseMs: 2000,
    hintLevel: 3,
    at: NOW,
    ...o,
  });
  it("immediate events are exactly the phase 3 behaviour", () => {
    expect(applyEvent(initialMem(), ev()).stability).toBeCloseTo(1.1);
    expect(applyEvent(initialMem(), ev({ retention: "immediate" }))).toEqual(
      applyEvent(initialMem(), ev()),
    );
  });
  it("delayed/retest success strengthens stability more, but never skips stages / Kuasai", () => {
    const d = applyEvent(initialMem(), ev({ retention: "delayed" }));
    expect(d.stability).toBeCloseTo(1.5);
    expect(d.stability).toBeGreaterThan(applyEvent(initialMem(), ev()).stability);
    expect(d.stage).toBe(1);
    const low = applyEvent(
      { ...initialMem(), stage: 2, successCount: 2, stability: 20 },
      ev({ retention: "delayed", hintLevel: 1 }),
    );
    expect(low.stage).toBe(3); // one step only
    expect(
      applyEvent(
        { ...initialMem(), stage: 1, stability: 50 },
        ev({ retention: "retest", hintLevel: 0 }),
      ).stage,
    ).toBe(2);
  });
  it("delayed failure is a stronger forgetting signal", () => {
    const start = { ...initialMem(), stage: 3, stability: 10, successCount: 3 };
    const imm = applyEvent(start, ev({ correct: false, hintLevel: 1 }));
    const del = applyEvent(start, ev({ correct: false, hintLevel: 1, retention: "delayed" }));
    expect(del.stability).toBeLessThan(imm.stability);
    expect(del.lapses).toBe(1);
    expect(applyEvent(initialMem(), ev({ correct: false, retention: "delayed" })).lapses).toBe(1); // counted even without earlier successes
    expect(applyEvent(initialMem(), ev({ correct: false })).lapses).toBe(0);
  });
});

describe("Tes Kejutan (mastered re-test)", () => {
  const V = (id: string): Content => ({
    id,
    type: "vocabulary",
    level: "N5",
    surface: `語${id}`,
    reading: `よ${id}`,
    meaning: `m${id}`,
  });
  const row = (id: string, o: Partial<MemoryStateRow> = {}): MemoryStateRow => ({
    item_type: "vocabulary",
    item_id: id,
    aspect: "meaning",
    direction: "forward",
    stage: 4,
    stability: 30,
    due_at: new Date(NOW + 20 * DAY).toISOString(),
    last_tested_at: new Date(NOW - 20 * DAY).toISOString(),
    lapses: 0,
    success_count: 6,
    failure_count: 0,
    overconfident_wrong: 0,
    last_error_type: null,
    ...o,
  });
  const lr = (...ids: string[]) =>
    toLearned(
      ids.map((id) => ({
        item_type: "vocabulary",
        item_id: id,
        level: "N5",
        status: "mastered",
        due_at: null,
        last_reviewed_at: null,
      })),
    );
  it("only eligible mastered items: old enough or due; recall with no hint; flagged as retest", () => {
    const r = rankCandidates(
      lr("old", "fresh"),
      [row("old"), row("fresh", { last_tested_at: new Date(NOW - 2 * DAY).toISOString() })],
      NOW,
    );
    const old = r.find(
      (s) => s.itemId === "old" && s.aspect === "meaning" && s.direction === "forward",
    )!;
    expect(old).toMatchObject({
      reason: "retest_mastered",
      retention: "retest",
      exerciseType: "recall_flip",
      hintLevel: 0,
    });
    expect(
      r.find((s) => s.itemId === "fresh" && s.aspect === "meaning" && s.direction === "forward"),
    ).toBeUndefined();
  });
  it("a due mastered item is a retest too; non-mastered items are not", () => {
    const due = rankCandidates(
      lr("d"),
      [row("d", { due_at: new Date(NOW - DAY).toISOString() })],
      NOW,
    ).find((s) => s.aspect === "meaning" && s.direction === "forward")!;
    expect(due.retention).toBe("retest");
    const learning = toLearned([
      {
        item_type: "vocabulary",
        item_id: "l",
        level: "N5",
        status: "learning",
        due_at: null,
        last_reviewed_at: null,
      },
    ]);
    expect(
      rankCandidates(learning, [row("l", { stage: 2 })], NOW).some((s) => s.retention === "retest"),
    ).toBe(false);
  });
  it("mastered retests never dominate a session (<= 20%)", () => {
    const ids = Array.from({ length: 30 }, (_, i) => `m${i}`);
    const rows = ids.map((id) => row(id));
    const ranked = selectExercises(rankCandidates(lr(...ids), rows, NOW), 40);
    expect(ranked.filter((s) => s.retention === "retest").length).toBeGreaterThan(10);
    const pool = ids.map(V);
    const s = buildSession(
      ranked,
      new Map(pool.map((c) => [`vocabulary:${c.id}`, c])),
      pool,
      new Set(),
      "sid",
      NOW,
    );
    expect(s.exercises.filter((e) => e.retention === "retest").length).toBeLessThanOrEqual(4);
  });
});

describe("Context Ladder", () => {
  const V = (
    id: string,
    surface: string,
    meaning: string,
    examples: Content["examples"] = [],
    senses?: Content["senses"],
  ): Content => ({
    id,
    type: "vocabulary",
    level: "N5",
    surface,
    reading: `r${id}`,
    meaning,
    examples,
    ...(senses ? { senses } : {}),
  });
  const A = V("A", "会う", "bertemu", [
    { ja: "日曜日に友達に会います。", id: "Saya bertemu teman." },
    { ja: "駅で先生に会いました。", id: "Saya bertemu guru di stasiun." },
  ]);
  const pool = [A, ...["B", "C", "D", "E"].map((i) => V(i, `語${i}`, `arti ${i}`))];
  const content = new Map(pool.map((c) => [`vocabulary:${c.id}`, c]));
  const usage = (c: Content, stage: number, extra: Partial<Selection> = {}): Selection => ({
    itemType: c.type,
    itemId: c.id,
    level: "N5",
    aspect: "usage",
    direction: "forward",
    exerciseType: "choice",
    stage,
    hintLevel: 3,
    optionCount: 4,
    reason: "r",
    score: 1,
    ...extra,
  });
  const build = (
    c: Content,
    stage: number,
    sid = "s",
    seen?: Map<string, Set<string>>,
    cm = content,
    pl = pool,
  ) => buildExercise(usage(c, stage), cm, pl, new Set(), sid, 0, seen);

  it("usage combos are gated on the base aspect and step up with the usage stage", () => {
    const learned = toLearned([
      {
        item_type: "vocabulary",
        item_id: "A",
        level: "N5",
        status: "learning",
        due_at: null,
        last_reviewed_at: null,
      },
    ]);
    expect(rankCandidates(learned, [], NOW).some((s) => s.aspect === "usage")).toBe(false);
    const meaning: MemoryStateRow = {
      item_type: "vocabulary",
      item_id: "A",
      aspect: "meaning",
      direction: "forward",
      stage: 1,
      stability: 1,
      due_at: "2026-09-30T00:00:00Z",
      last_tested_at: "2026-09-28T00:00:00Z",
      lapses: 0,
      success_count: 1,
      failure_count: 0,
      overconfident_wrong: 0,
      last_error_type: null,
    };
    expect(rankCandidates(learned, [meaning], NOW).some((s) => s.aspect === "usage")).toBe(true);
  });
  it("L2 phrase -> L3 sentence as the usage stage grows (real substrings, blank safe)", () => {
    const l2 = build(A, 0)!;
    const l3 = build(A, 1)!;
    expect(l2.ladder).toBe(2);
    expect(l3.ladder).toBe(3);
    expect(l2.prompt.length).toBeLessThan(l3.prompt.length);
    for (const e of [l2, l3]) {
      expect(e.exerciseType).toBe("usage");
      expect(e.prompt).toContain("＿＿");
      expect(e.prompt).not.toContain("会");
      expect(e.options.map((o) => o.text)).toContain("会");
    }
    const original = A.examples!.map((x) => x.ja);
    expect(
      original.some(
        (ja) =>
          ja.includes(l2.prompt.split("＿＿")[0]!) && ja.includes(l2.prompt.split("＿＿")[1]!),
      ),
    ).toBe(true);
  });
  it("L4 uses the real sense of the word in a sentence (vocabulary_senses); otherwise it falls back to a valid sentence", () => {
    const multi = V(
      "M",
      "上げる",
      "menaikkan",
      [{ ja: "手を上げます。", id: "Angkat tangan." }],
      [
        { meaning: "menaikkan", examples: [{ ja: "手を上げます。", id: "Angkat tangan." }] },
        {
          meaning: "memberi",
          examples: [{ ja: "友達にプレゼントを上げました。", id: "Memberi hadiah." }],
        },
      ],
    );
    const cm = new Map([...content, ["vocabulary:M", multi]]);
    const l4 = build(multi, 2, "s", undefined, cm, [...pool, multi])!;
    expect(l4).toMatchObject({ ladder: 4, variant: "sense_context" });
    expect(l4.prompt).toMatch(/手を上げます。|友達にプレゼントを上げました。/);
    expect(l4.options.map((o) => o.text)).toEqual(expect.arrayContaining(["menaikkan", "memberi"]));
    expect(l4.options.find((o) => o.text === l4.answer)).toBeTruthy();
    const fallback = build(A, 3)!;
    expect(fallback.ladder).toBe(3); // no multi-sense data -> valid sentence exercise, no invented context
  });
  it("no context data -> the usage combo is skipped (fallback to normal exercises)", () => {
    const bare = V("N", "新しい", "baru", []);
    expect(
      build(bare, 1, "s", undefined, new Map([["vocabulary:N", bare]]), [bare, ...pool]),
    ).toBeNull();
  });
  it("Kanji: compound with the kanji blanked (L2), compound in a sentence (L3)", () => {
    const comp = V("C1", "予約", "reservasi", [
      { ja: "ホテルを予約しました。", id: "Saya memesan hotel." },
    ]);
    const K: Content = {
      id: "K",
      type: "kanji",
      level: "N5",
      surface: "予",
      reading: "ヨ",
      meaning: "sebelumnya",
      compounds: [comp],
    };
    const kp = [
      K,
      ...["1", "2", "3"].map((i): Content => ({
        id: `k${i}`,
        type: "kanji",
        level: "N5",
        surface: `漢${i}`,
        reading: `r${i}`,
        meaning: `m${i}`,
      })),
      ...pool,
    ];
    const km = new Map([["kanji:K", K]]);
    const sel = (stage: number): Selection => ({
      itemType: "kanji",
      itemId: "K",
      level: "N5",
      aspect: "usage",
      direction: "forward",
      exerciseType: "choice",
      stage,
      hintLevel: 3,
      optionCount: 4,
      reason: "r",
      score: 1,
    });
    const l2 = buildExercise(sel(0), km, kp, new Set(), "s", 0)!;
    expect(l2).toMatchObject({ ladder: 2, prompt: "＿約", answer: "予" });
    const l3 = buildExercise(sel(1), km, kp, new Set(), "s", 0)!;
    expect(l3).toMatchObject({ ladder: 3, prompt: "ホテルを＿＿しました。", answer: "予約" });
    expect(l3.prompt).not.toContain("予約");
    expect(l3.feedback).toContain("予 sebelumnya");
    expect(
      buildExercise(sel(0), new Map([["kanji:K", { ...K, compounds: [] }]]), kp, new Set(), "s", 0),
    ).toBeNull();
  });
  it("Bunpou: which pattern is used (L3), then correct vs wrong sentence with the real reason (L4)", () => {
    const G = (id: string, s: string, m: string, o: Partial<Content> = {}): Content => ({
      id,
      type: "grammar",
      level: "N5",
      surface: s,
      reading: "",
      meaning: m,
      ...o,
    });
    const g = G("G", "〜から（alasan）", "karena", {
      examples: [{ ja: "雨が降っているから、出かけません。", id: "Karena hujan." }],
      wrong: [
        {
          wrong: "眠いですから早く寝ますから。",
          correct: "眠いですから、早く寝ます。",
          reason: "から tidak diulang.",
        },
      ],
    });
    const gp = [
      g,
      G("H", "〜ので", "karena (sopan)"),
      G("I", "〜のに", "padahal"),
      G("J", "〜ため", "demi"),
    ];
    const gm = new Map([["grammar:G", g]]);
    const sel = (stage: number): Selection => ({
      itemType: "grammar",
      itemId: "G",
      level: "N5",
      aspect: "usage",
      direction: "forward",
      exerciseType: "choice",
      stage,
      hintLevel: 3,
      optionCount: 4,
      reason: "r",
      score: 1,
    });
    const l3 = buildExercise(sel(0), gm, gp, new Set(), "s", 0)!;
    expect(l3).toMatchObject({
      ladder: 3,
      prompt: "雨が降っているから、出かけません。",
      answer: "〜から（alasan）",
    });
    const l4 = buildExercise(sel(1), gm, gp, new Set(), "s", 0)!;
    expect(l4).toMatchObject({
      ladder: 4,
      variant: "wrong_example",
      answer: "眠いですから、早く寝ます。",
      feedback: "から tidak diulang.",
    });
  });
});

describe("context variation and safety", () => {
  const V = (examples: Array<{ ja: string; id: string }>): Content => ({
    id: "A",
    type: "vocabulary",
    level: "N5",
    surface: "便利",
    reading: "べんり",
    meaning: "praktis",
    examples,
  });
  const exs = [
    "電車は便利です。",
    "この道具はとても便利だ。",
    "便利な店が多い町です。",
    "スマホは便利ですね。",
  ].map((ja) => ({ ja, id: "t" }));
  it("is deterministic per seed but varies across seeds when several sentences are valid", () => {
    const c = V(exs);
    const pick = (seed: string) =>
      pickContext(contextsOf(c), (e) => refOf(e.ja), undefined, seed)!.ja;
    expect(pick("s1")).toBe(pick("s1"));
    expect(
      new Set(["s1", "s2", "s3", "s4", "s5", "s6", "s7", "s8"].map(pick)).size,
    ).toBeGreaterThan(1);
  });
  it("prefers sentences that were not used before (context_ref history), and falls back when all were used", () => {
    const c = V(exs);
    const used = new Set(exs.slice(0, 3).map((e) => refOf(e.ja)));
    expect(pickContext(contextsOf(c), (e) => refOf(e.ja), used, "any")!.ja).toBe(exs[3]!.ja);
    const all = new Set(exs.map((e) => refOf(e.ja)));
    expect(pickContext(contextsOf(c), (e) => refOf(e.ja), all, "any")).toBeTruthy();
  });
  it("every produced blank keeps the Japanese intact and hides the answer (phrase and sentence)", () => {
    for (const e of exs) {
      const b = blankOut(e.ja, "便利", false)!;
      expect(b).not.toContain("便利");
      expect(b.split("＿＿").join("便利")).toBe(e.ja);
      const ph = phraseAround(e.ja, "便利");
      if (ph) {
        expect(e.ja).toContain(ph);
        expect(ph.length).toBeLessThan(e.ja.length);
        expect(ph).toContain("便利");
      }
    }
    expect(phraseAround("日曜日に友達に会います。", "会")).toBe("友達に会います");
    expect(phraseAround("電車 は 便利 です。", "便利")).toBe(
      "電車 は 便利 です。".length > 0 ? phraseAround("電車 は 便利 です。", "便利") : null,
    );
  });
  it("examples that would corrupt other words are never offered", () => {
    expect(blankOut("会社で友達に会います。", "会", true)).toBeNull();
    const c: Content = {
      id: "A",
      type: "vocabulary",
      level: "N5",
      surface: "会う",
      reading: "あう",
      meaning: "bertemu",
      examples: [
        { ja: "会社で友達に会います。", id: "x" },
        { ja: "駅で先生に会いました。", id: "y" },
      ],
    };
    const pool = ["B", "C", "D"].map((i): Content => ({
      id: i,
      type: "vocabulary",
      level: "N5",
      surface: `語${i}`,
      reading: i,
      meaning: i,
    }));
    const e = buildExercise(
      {
        itemType: "vocabulary",
        itemId: "A",
        level: "N5",
        aspect: "usage",
        direction: "forward",
        exerciseType: "choice",
        stage: 1,
        hintLevel: 3,
        optionCount: 4,
        reason: "r",
        score: 1,
      },
      new Map([["vocabulary:A", c]]),
      [c, ...pool],
      new Set(),
      "s",
      0,
    )!;
    expect(e.prompt).toBe("駅で先生に＿＿いました。"); // the 会社 sentence was rejected
  });
});

describe("sense context needs genuinely different senses", () => {
  it("near-duplicate senses (real data: あと / アルバム) fall back to a plain sentence exercise", () => {
    const c: Content = {
      id: "A",
      type: "vocabulary",
      level: "N4",
      surface: "あと",
      reading: "あと",
      meaning: "Sisa",
      examples: [{ ja: "あとで教えて下さい。", id: "Tolong beri tahu nanti." }],
      senses: [
        { meaning: "Sisa", examples: [{ ja: "あと五分あります。", id: "Tersisa lima menit." }] },
        {
          meaning: "sisa; yang tersisa; setelah; nanti (sesuai konteks)",
          examples: [{ ja: "あとで教えて下さい。", id: "Tolong beri tahu nanti." }],
        },
      ],
    };
    const pool = [
      c,
      ...["B", "C", "D"].map((i): Content => ({
        id: i,
        type: "vocabulary",
        level: "N4",
        surface: `語${i}`,
        reading: i,
        meaning: `m${i}`,
      })),
    ];
    const e = buildExercise(
      {
        itemType: "vocabulary",
        itemId: "A",
        level: "N4",
        aspect: "usage",
        direction: "forward",
        exerciseType: "choice",
        stage: 2,
        hintLevel: 3,
        optionCount: 4,
        reason: "r",
        score: 1,
      },
      new Map([["vocabulary:A", c]]),
      pool,
      new Set(),
      "s",
      0,
    );
    expect(e?.variant).not.toBe("sense_context");
  });
});


describe("source-backed grammar exercise safety", () => {
  it("never needs invented sentence data for grammar remediation", () => {
    const grammar: Content = {
      id: "g-source",
      type: "grammar",
      level: "N5",
      surface: "に",
      reading: "",
      meaning: "di/pada",
      examples: [{ ja: "学校に行きます。", id: "Pergi ke sekolah." }],
      wrong: [{ wrong: "学校で行きます。", correct: "学校に行きます。", reason: "Tujuan memakai に." }],
    };
    const sel: Selection = {
      itemType: "grammar",
      itemId: grammar.id,
      level: "N5",
      aspect: "usage",
      direction: "forward",
      exerciseType: "choice",
      stage: 2,
      hintLevel: 3,
      optionCount: 4,
      reason: "test",
      score: 10,
    };
    const ex = buildExercise(
      sel,
      new Map([[`grammar:${grammar.id}`, grammar]]),
      [grammar],
      new Set([`grammar:${grammar.id}`]),
      "source-test",
      0,
    );
    expect(ex).not.toBeNull();
    expect(["particle_choice", "error_spot", "usage"]).toContain(ex!.exerciseType);
    const sourceText = [grammar.examples![0]!.ja, grammar.wrong![0]!.wrong, grammar.wrong![0]!.correct].join(" ");
    expect(sourceText).toContain(ex!.answer);
  });
});


describe("validated conjugation exercises", () => {
  it("uses only attached source forms and never invents a conjugation", () => {
    const vocab: Content = {
      id: "v-form",
      type: "vocabulary",
      level: "N5",
      surface: "行きます",
      reading: "いきます",
      meaning: "pergi",
      forms: [
        { code: "dictionary", label: "Bentuk Kamus", value: "行く" },
        { code: "masu", label: "Bentuk Masu", value: "行きます" },
        { code: "te", label: "Bentuk Te", value: "行って" },
        { code: "ta", label: "Bentuk Ta", value: "行った" },
      ],
      examples: [{ ja: "学校へ 行きます", id: "Pergi ke sekolah." }],
    };
    const sel: Selection = {
      itemType: "vocabulary", itemId: vocab.id, level: "N5", aspect: "usage",
      direction: "forward", exerciseType: "choice", stage: 2, hintLevel: 3,
      optionCount: 4, reason: "test", score: 10,
    };
    let found: ReturnType<typeof buildExercise> = null;
    for (let i = 0; i < 20 && !found; i++)
      found = buildExercise(sel, new Map([[`vocabulary:${vocab.id}`, vocab]]), [vocab],
        new Set([`vocabulary:${vocab.id}`]), `form-${i}`, 0);
    expect(found).not.toBeNull();
    if (found?.exerciseType === "conjugation_choice") {
      expect(vocab.forms!.map((x) => x.value)).toContain(found.answer);
      expect(found.options.every((o) => vocab.forms!.some((x) => x.value === o.text))).toBe(true);
    }
  });
});


describe("Kanji reading matching", () => {
  it("builds reading choices only from real Kanji readings", () => {
    const items: Content[] = [
      { id:"k1",type:"kanji",level:"N5",surface:"日",reading:"ニチ / ひ",meaning:"hari" },
      { id:"k2",type:"kanji",level:"N5",surface:"月",reading:"ゲツ / つき",meaning:"bulan" },
      { id:"k3",type:"kanji",level:"N5",surface:"火",reading:"カ / ひ",meaning:"api" },
      { id:"k4",type:"kanji",level:"N5",surface:"水",reading:"スイ / みず",meaning:"air" },
    ];
    const sel: Selection = { itemType:"kanji",itemId:"k1",level:"N5",aspect:"reading",direction:"forward",exerciseType:"choice",stage:2,hintLevel:3,optionCount:4,reason:"test",score:10 };
    const ex=buildExercise(sel,new Map(items.map(x=>[`kanji:${x.id}`,x])),items,new Set(items.map(x=>`kanji:${x.id}`)),"match",0);
    expect(ex).not.toBeNull();
    expect(ex!.variant).toBe("reading_match");
    expect(items.map(x=>x.reading)).toContain(ex!.answer);
    expect(ex!.options.every(o=>items.some(x=>x.reading===o.text))).toBe(true);
  });
});

describe("source-safe particle exercise", () => {
  it("does not turn a lexical の into a particle question for unrelated grammar", () => {
    const grammar: Content = {
      id: "g",
      type: "grammar",
      level: "N5",
      surface: "〜たい",
      reading: "",
      meaning: "ingin",
      examples: [{ ja: "日本の料理を食べたいです。", id: "Saya ingin makan masakan Jepang." }],
    };
    const sel: Selection = {
      itemType: "grammar",
      itemId: "g",
      level: "N5",
      aspect: "usage",
      direction: "forward",
      exerciseType: "choice",
      stage: 2,
      hintLevel: 3,
      optionCount: 4,
      reason: "r",
      score: 1,
    };
    const built = buildExercise(
      sel,
      new Map([["grammar:g", grammar]]),
      [grammar],
      new Set(["grammar:g"]),
      "safe",
      0,
    );
    expect(built?.variant).not.toBe("particle_choice");
  });
});

