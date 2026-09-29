import { SLOW_MS } from "./classify";
import type { Confidence } from "./types";

/**
 * TypeScript mirror of `kioku_apply_event` (SQL is the source of truth for memory_state; this copy keeps
 * the rules deterministic, documented and unit-testable). Stages: 0 Kenali, 1 Ingat, 2 Gunakan, 3 Produksi, 4 Kuasai.
 */
export type MemLite = {
  stage: number;
  stability: number;
  successCount: number;
  failureCount: number;
  lapses: number;
  overconfidentWrong: number;
  lastErrorType: string | null;
  dueAt: number;
};
export type ProgressionEvent = {
  correct: boolean;
  usedHint: boolean;
  confidence: Confidence | null;
  errorType: string | null;
  responseMs: number;
  hintLevel: number | null;
  at: number;
};
export const STAGE_NAMES = ["Kenali", "Ingat", "Gunakan", "Produksi", "Kuasai"] as const;
const DAY = 86400000;
export const initialMem = (): MemLite => ({
  stage: 0,
  stability: 0.5,
  successCount: 0,
  failureCount: 0,
  lapses: 0,
  overconfidentWrong: 0,
  lastErrorType: null,
  dueAt: 0,
});

/** Highest stage a correct answer can reach given the help that was on screen. */
export function stageCap(hintLevel: number | null): number {
  const hl = hintLevel ?? 3;
  return hl >= 3 ? 2 : hl === 2 ? 3 : 4;
}

export function applyEvent(prev: MemLite | undefined, ev: ProgressionEvent): MemLite {
  const s = prev ?? initialMem();
  const next: MemLite = { ...s, lastErrorType: ev.errorType ?? s.lastErrorType };
  if (ev.correct) {
    const independent = !ev.usedHint && ev.responseMs <= SLOW_MS && ev.confidence !== "ragu";
    const factor = ev.usedHint
      ? 1.2
      : ev.confidence === "ragu" || ev.responseMs > SLOW_MS
        ? 1.3
        : 2.2;
    next.stability = Math.min(365, Math.max(s.stability, 0.5) * factor);
    let stage = s.stage;
    if (independent && s.stage < stageCap(ev.hintLevel)) stage = s.stage + 1;
    if (
      stage === 4 &&
      s.stage < 4 &&
      !(s.stage === 3 && s.successCount + 1 >= 4 && next.stability >= 6)
    )
      stage = 3;
    next.stage = stage;
    next.successCount = s.successCount + 1;
    next.dueAt = ev.at + next.stability * DAY;
  } else {
    if (ev.confidence === "yakin") {
      next.stage = Math.max(0, s.stage - 2);
      next.stability = Math.max(0.25, s.stability * 0.3);
      next.overconfidentWrong = s.overconfidentWrong + 1;
    } else {
      next.stage = Math.max(0, s.stage - 1);
      next.stability = Math.max(0.25, s.stability * 0.4);
    }
    next.failureCount = s.failureCount + 1;
    if (s.successCount > 0) next.lapses = s.lapses + 1;
    next.dueAt = ev.at + 10 * 60000;
  }
  return next;
}
