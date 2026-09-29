import { comboKey, partnerFor, remedyFor, type Signals } from "./signals";
import type {
  ExerciseType,
  KiokuAspect,
  KiokuDirection,
  KiokuItemType,
  LearnedItem,
  MemoryStateRow,
  Remedy,
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
    { aspect: "meaning", direction: "reverse" },
    { aspect: "usage", direction: "forward" },
  ],
  vocabulary: [
    { aspect: "meaning", direction: "forward" },
    { aspect: "reading", direction: "forward" },
    { aspect: "meaning", direction: "reverse" },
    { aspect: "usage", direction: "forward" },
  ],
  grammar: [
    { aspect: "function_context", direction: "forward" },
    { aspect: "function_context", direction: "reverse" },
    { aspect: "usage", direction: "forward" },
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
  context = false,
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
    // Tes Kejutan: a mastered item that is neither due nor old enough is left alone (never used as filler).
    if (st.stage >= 4) return null;
    if (Number.isFinite(tested) && now - tested < RECENT_MS) return null; // just tested and not due yet
    const idle = Number.isFinite(tested) ? Math.min((now - tested) / DAY, 30) : 0;
    return {
      score: (primary ? 100 : context ? 90 : 80) + idle * 0.5,
      reason: context ? "context_ladder" : "general_reinforcement",
    };
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
    return null; // mastered and recently reviewed: not a candidate
  }
  return context
    ? { score: 90, reason: "context_ladder" }
    : { score: primary ? 100 : 80, reason: "general_reinforcement" };
}

/**
 * Fading help by stage (Petunjuk Memudar). Weak items always start with the most help:
 *   0 Kenali   : 3 choices                       (hint_level 3)
 *   1 Ingat    : 4 choices                       (hint_level 3)
 *   2 Gunakan  : blind recall, hint shown upfront (hint_level 2)
 *   3 Produksi : blind recall, hint on request    (hint_level 1)
 *   4 Kuasai   : blind recall, no hint            (hint_level 0)
 */
export function planExercise(
  st: MemoryStateRow | undefined,
  remedy?: Remedy,
  retest = false,
): {
  exerciseType: ExerciseType;
  hintLevel: number;
  stage: number;
  optionCount: number;
} {
  const stage = st?.stage ?? 0;
  // Natural re-test of a mastered item: recall with the least help (hint on request when there is no Kioku history yet).
  if (retest)
    return { exerciseType: "recall_flip", hintLevel: stage >= 4 ? 0 : 1, stage, optionCount: 0 };
  // Remediation of slow recall / guessing: less help, but never a hard question for a weak item.
  if (remedy?.kind === "slow" && stage >= 2)
    return { exerciseType: "recall_flip", hintLevel: 1, stage, optionCount: 0 };
  if (remedy?.kind === "guess" && stage >= 1)
    return { exerciseType: "recall_flip", hintLevel: stage >= 4 ? 0 : 1, stage, optionCount: 0 };
  if (stage >= 4) return { exerciseType: "recall_flip", hintLevel: 0, stage, optionCount: 0 };
  if (stage === 3) return { exerciseType: "recall_flip", hintLevel: 1, stage, optionCount: 0 };
  if (stage === 2) return { exerciseType: "recall_flip", hintLevel: 2, stage, optionCount: 0 };
  return {
    exerciseType: "choice",
    hintLevel: 3,
    stage,
    optionCount:
      stage === 0 && st?.last_error_type !== "likely_guess" && remedy?.kind !== "guess" ? 3 : 4,
  };
}

/** Full deterministic ranking of candidates (highest priority first). */
export function rankCandidates(
  learned: LearnedItem[],
  states: MemoryStateRow[],
  now: number,
  signals?: Signals,
): Selection[] {
  const byKey = new Map(
    states.map((s) => [stateKey(s.item_type, s.item_id, s.aspect, s.direction), s]),
  );
  const out: Selection[] = [];
  for (const item of learned) {
    if (!KIOKU_TYPES.has(item.itemType)) continue;
    COMBOS[item.itemType].forEach((c, i) => {
      const st = byKey.get(stateKey(item.itemType, item.itemId, c.aspect, c.direction));
      // Ingatan Balik (ID -> JP) only after the forward direction has been recognised at least once.
      if (c.direction === "reverse" && !st) {
        const fwd = byKey.get(stateKey(item.itemType, item.itemId, c.aspect, "forward"));
        if (!fwd || fwd.stage < 1) return;
      }
      // Usage (cloze) only after the meaning was recognised at least once.
      if (c.aspect === "usage" && !st) {
        const base = item.itemType === "grammar" ? "function_context" : "meaning";
        const m = byKey.get(stateKey(item.itemType, item.itemId, base, "forward"));
        if (!m || m.stage < 1) return;
      }
      let s = score(item, st, i === 0, now, c.aspect === "usage");
      if (!s) return;
      // Error Engine: deterministic remediation from the latest unresolved error of this exact combo.
      const err = signals?.unresolved.get(
        comboKey(item.itemType, item.itemId, c.aspect, c.direction),
      );
      const partner = signals ? partnerFor(item.itemType, item.itemId, signals) : null;
      const remedy = remedyFor(err, { itemType: item.itemType, partner, hasWrongExamples: true });
      if (remedy) {
        const tier =
          700 + Math.min(remedy.count, 3) * 20 + (partner && partner.count >= 2 ? 40 : 0);
        const tag = `remediate_${remedy.kind}${remedy.source ? `:${remedy.source}` : ""}`;
        s =
          tier > s.score
            ? { score: tier, reason: tag }
            : { score: s.score, reason: `${s.reason}+${tag}` };
      }
      // Tes Kejutan: only mastered items that are due / retest-eligible (never random mastered items).
      const retest =
        (s.reason.startsWith("retest_mastered") ||
          s.reason.startsWith("due_memory_state_mastered")) &&
        ((st?.stage ?? 0) >= 4 || (!st && item.status === "mastered")) &&
        c.aspect !== "usage";
      out.push({
        itemType: item.itemType,
        itemId: item.itemId,
        level: item.level,
        aspect: c.aspect,
        direction: c.direction,
        ...planExercise(st, remedy ?? undefined, retest),
        ...(retest ? { retention: "retest" as const } : {}),
        reason: s.reason,
        score: s.score,
        ...(remedy ? { remedy } : {}),
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
