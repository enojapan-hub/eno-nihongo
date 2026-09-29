import type { Exercise, KiokuSession } from "./session-types";
import type { KiokuAspect, KiokuDirection, KiokuItemType, Selection } from "./types";

export const SESSION_SIZE = 20;
export const REPEAT_GAP = 4;

export type Content = {
  id: string;
  type: KiokuItemType;
  level: string;
  surface: string;
  reading: string;
  meaning: string;
};

function fnv(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
const HAN = /\p{Script=Han}/gu;
const norm = (s: string) => s.replace(/\s+/g, "").trim();

/** Look-alike test on Japanese surface/reading only (shared kanji, shared reading prefix >= 2, shared grammar prefix). */
export function isConfusable(a: Content, b: Content): boolean {
  if (a.type !== b.type || a.id === b.id) return false;
  if (a.type === "grammar") {
    const x = norm(a.surface),
      y = norm(b.surface);
    return x.length >= 2 && y.length >= 2 && x.slice(0, 2) === y.slice(0, 2);
  }
  const ha = new Set(a.surface.match(HAN) ?? []);
  if ((b.surface.match(HAN) ?? []).some((c) => ha.has(c))) return true;
  const ra = norm(a.reading),
    rb = norm(b.reading);
  return ra.length >= 2 && rb.length >= 2 && ra.slice(0, 2) === rb.slice(0, 2);
}

/** Text shown for `c` when it is a question (prompt side) or an option/answer for the given aspect+direction. */
export function promptOf(c: Content, aspect: KiokuAspect, direction: KiokuDirection): string {
  return direction === "reverse" ? c.meaning : c.surface;
}
export function answerOf(c: Content, aspect: KiokuAspect, direction: KiokuDirection): string {
  if (direction === "reverse") return c.surface;
  return aspect === "reading" ? c.reading : c.meaning;
}
const usable = (c: Content | undefined, aspect: KiokuAspect, direction: KiokuDirection) =>
  !!c &&
  !!norm(c.surface) &&
  !!norm(promptOf(c, aspect, direction)) &&
  !!norm(answerOf(c, aspect, direction));

/**
 * Builds one exercise from prefetched content. Returns null when content is missing
 * (the caller then moves on to the next ranked candidate). Pure and deterministic.
 */
export function buildExercise(
  sel: Selection,
  content: Map<string, Content>,
  pool: Content[],
  learnedIds: Set<string>,
  sessionId: string,
  index: number,
): Exercise | null {
  const c = content.get(`${sel.itemType}:${sel.itemId}`);
  if (!c || !usable(c, sel.aspect, sel.direction)) return null;
  const answer = answerOf(c, sel.aspect, sel.direction);
  const id = `${sessionId}:${index}`;
  let options: Exercise["options"] = [];
  if (sel.exerciseType === "choice") {
    const seen = new Set([norm(answer)]);
    const cands = pool
      .filter((p) => p.type === c.type && p.id !== c.id && usable(p, sel.aspect, sel.direction))
      .map((p) => ({
        p,
        confusable: isConfusable(c, p),
        learned: learnedIds.has(`${p.type}:${p.id}`),
        h: fnv(`${p.id}|${c.id}`),
      }))
      .sort(
        (a, b) =>
          Number(b.confusable) - Number(a.confusable) ||
          Number(b.learned) - Number(a.learned) ||
          a.h - b.h,
      );
    const picked: Exercise["options"] = [];
    for (const x of cands) {
      const text = answerOf(x.p, sel.aspect, sel.direction);
      if (seen.has(norm(text))) continue;
      seen.add(norm(text));
      picked.push({ id: x.p.id, text, confusable: x.confusable });
      if (picked.length === 3) break;
    }
    if (picked.length < 3) return null; // not enough distractors: fall back to another candidate
    options = [{ id: c.id, text: answer, confusable: false }, ...picked].sort(
      (a, b) => fnv(`${id}|${a.id}`) - fnv(`${id}|${b.id}`),
    );
  }
  return {
    id,
    itemType: sel.itemType,
    itemId: sel.itemId,
    level: sel.level,
    aspect: sel.aspect,
    direction: sel.direction,
    exerciseType: sel.exerciseType,
    stage: sel.stage,
    hintLevel: sel.hintLevel,
    reason: sel.reason,
    prompt: promptOf(c, sel.aspect, sel.direction),
    promptSub:
      sel.direction === "forward" && sel.aspect !== "reading" && c.type !== "kanji"
        ? c.reading
        : "",
    answer,
    options,
    isRepeat: false,
  };
}

/** Walks the ranked list (already capped per item) and keeps the first `size` buildable exercises. No new material is ever added to reach `size`. */
export function buildSession(
  ranked: Selection[],
  content: Map<string, Content>,
  pool: Content[],
  learnedIds: Set<string>,
  sessionId: string,
  now: number,
  size = SESSION_SIZE,
): KiokuSession {
  const exercises: Exercise[] = [];
  for (const sel of ranked) {
    if (exercises.length >= size) break;
    const ex = buildExercise(sel, content, pool, learnedIds, sessionId, exercises.length);
    if (ex) exercises.push(ex);
  }
  return {
    sessionId,
    createdAt: new Date(now).toISOString(),
    exercises,
    index: 0,
    results: {},
    finished: exercises.length === 0,
  };
}

/** Wrong answer => the same exercise comes back once, REPEAT_GAP positions later (or at the end). */
export function queueRepeat(s: KiokuSession, ex: Exercise): KiokuSession {
  if (ex.isRepeat) return s;
  if (s.exercises.some((e) => e.isRepeat && e.id === `${ex.id}~r`)) return s;
  const copy: Exercise = { ...ex, id: `${ex.id}~r`, isRepeat: true, reason: "repeat_after_error" };
  const at = Math.min(s.exercises.length, s.index + 1 + REPEAT_GAP);
  return { ...s, exercises: [...s.exercises.slice(0, at), copy, ...s.exercises.slice(at)] };
}
