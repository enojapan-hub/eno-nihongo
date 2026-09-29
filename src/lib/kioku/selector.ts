import type {
  ExerciseType,
  KiokuAspect,
  KiokuDirection,
  KiokuItemType,
  LearnedItem,
  MemoryStateRow,
  Selection,
} from "./types";

const DAY = 86400000;
const RETEST_MASTERED_MS = 14 * DAY;
const RECENT_MS = 60 * 60 * 1000;
export const MAX_PER_ITEM = 2;

type Combo = { aspect: KiokuAspect; direction: KiokuDirection };
export const COMBOS: Record<KiokuItemType, Combo[]> = {
  kanji: [
    { aspect: "meaning", direction: "forward" },
    { aspect: "reading", direction: "forward" },
  ],
  vocabulary: [
    { aspect: "meaning", direction: "forward" },
    { aspect: "reading", direction: "forward" },
    { aspect: "meaning", direction: "reverse" },
  ],
  grammar: [
    { aspect: "function_context", direction: "forward" },
    { aspect: "function_context", direction: "reverse" },
  ],
};

const KIOKU_TYPES = new Set<string>(["kanji", "vocabulary", "grammar"]);

/** Only items the user already studied: a `user_item_progress` row that is not still `new`. */
export function toLearned(
  rows: Array<{
    item_type: string;
    item_id: string;
    level: string;
    status: string;
    due_at: string | null;
    last_reviewed_at: string | null;
  }>,
): LearnedItem[] {
  return rows
    .filter((r) => KIOKU_TYPES.has(r.item_type) && r.status !== "new")
    .map((r) => ({
      itemType: r.item_type as KiokuItemType,
      itemId: r.item_id,
      level: r.level,
      status: r.status,
      dueAt: r.due_at,
      lastReviewedAt: r.last_reviewed_at,
    }));
}

const ms = (v: string | null | undefined) => (v ? new Date(v).getTime() : NaN);
export const stateKey = (t: string, id: string, aspect: string, dir: string) =>
  `${t}:${id}:${aspect}:${dir}`;

function score(
  item: LearnedItem,
  st: MemoryStateRow | undefined,
  primary: boolean,
  now: number,
): { score: number; reason: string } | null {
  if (st) {
    const due = ms(st.due_at);
    if (due <= now)
      return {
        score: 1000 + Math.min((now - due) / 3600000, 240) * 0.1,
        reason: item.status === "mastered" ? "due_memory_state_mastered" : "due_memory_state",
      };
    const tested = ms(st.last_tested_at);
    if (st.overconfident_wrong > 0)
      return {
        score: 800 + Math.min(st.overconfident_wrong, 5) * 10,
        reason: "overconfident_wrong",
      };
    if (st.failure_count >= 2 && st.failure_count >= st.success_count)
      return { score: 600 + Math.min(st.failure_count, 10) * 5, reason: "repeated_error" };
    if (st.last_error_type === "confusion")
      return { score: 400, reason: "confusion_reinforcement" };
    if (st.stage >= 4 && !(now - tested < RETEST_MASTERED_MS))
      return { score: 300, reason: "retest_mastered" };
    if (Number.isFinite(tested) && now - tested < RECENT_MS) return null; // just tested and not due yet
    const idle = Number.isFinite(tested) ? Math.min((now - tested) / DAY, 30) : 0;
    return { score: (primary ? 100 : 80) + idle * 0.5, reason: "general_reinforcement" };
  }
  const pDue = ms(item.dueAt);
  if (Number.isFinite(pDue) && pDue <= now)
    return {
      score: 900 + Math.min((now - pDue) / 3600000, 240) * 0.1,
      reason: primary ? "progress_due" : "progress_due_secondary",
    };
  if (item.status === "mastered") {
    const last = ms(item.lastReviewedAt);
    if (!Number.isFinite(last) || now - last >= RETEST_MASTERED_MS)
      return { score: 300, reason: "retest_mastered" };
  }
  return { score: primary ? 100 : 80, reason: "general_reinforcement" };
}

/** Choice while the item is young, free recall once stage >= 3; guesses on choice questions force recall. */
export function planExercise(st: MemoryStateRow | undefined): {
  exerciseType: ExerciseType;
  hintLevel: number;
  stage: number;
} {
  const stage = st?.stage ?? 0;
  if (stage >= 3 || st?.last_error_type === "likely_guess")
    return { exerciseType: "recall_flip", hintLevel: 0, stage };
  return { exerciseType: "choice", hintLevel: 3, stage };
}

/** Full deterministic ranking of candidates (highest priority first). */
export function rankCandidates(
  learned: LearnedItem[],
  states: MemoryStateRow[],
  now: number,
): Selection[] {
  const byKey = new Map(
    states.map((s) => [stateKey(s.item_type, s.item_id, s.aspect, s.direction), s]),
  );
  const out: Selection[] = [];
  for (const item of learned) {
    if (!KIOKU_TYPES.has(item.itemType)) continue;
    COMBOS[item.itemType].forEach((c, i) => {
      const st = byKey.get(stateKey(item.itemType, item.itemId, c.aspect, c.direction));
      const s = score(item, st, i === 0, now);
      if (!s) return;
      out.push({
        itemType: item.itemType,
        itemId: item.itemId,
        level: item.level,
        aspect: c.aspect,
        direction: c.direction,
        ...planExercise(st),
        reason: s.reason,
        score: s.score,
      });
    });
  }
  return out.sort(
    (a, b) =>
      b.score - a.score ||
      a.itemId.localeCompare(b.itemId) ||
      a.aspect.localeCompare(b.aspect) ||
      a.direction.localeCompare(b.direction),
  );
}

/** Applies the per-item cap while keeping ranking order. */
export function selectExercises(ranked: Selection[], limit: number): Selection[] {
  const per = new Map<string, number>();
  const out: Selection[] = [];
  for (const s of ranked) {
    const k = `${s.itemType}:${s.itemId}`;
    if ((per.get(k) ?? 0) >= MAX_PER_ITEM) continue;
    per.set(k, (per.get(k) ?? 0) + 1);
    out.push(s);
    if (out.length >= limit) break;
  }
  return out;
}
