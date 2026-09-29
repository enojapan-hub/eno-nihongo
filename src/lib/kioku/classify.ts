import type { ErrorType, ExerciseType, KiokuAspect } from "./types";

export const SLOW_MS = 8000; // same "slow" threshold as planner-mastery
export const GUESS_MS = 1200;

export type ClassifyInput = {
  correct: boolean;
  aspect: KiokuAspect | string;
  exerciseType: ExerciseType;
  responseMs: number;
  usedHint: boolean;
  /** The chosen wrong option was flagged as a look-alike of the answer (shared kanji / reading prefix). */
  selectedWasConfusable?: boolean;
};

/**
 * Deterministic v1 error classifier. Only labels what the recorded data can prove:
 * - correct but slow            -> slow_recall
 * - wrong, chose a look-alike   -> confusion
 * - wrong, instant multiple-choice, no hint -> likely_guess
 * - wrong otherwise             -> by aspect (meaning / reading / usage_context), else general
 * Correct and fast answers have no error type.
 */
export function classifyError(i: ClassifyInput): ErrorType | null {
  if (i.correct) return i.responseMs > SLOW_MS ? "slow_recall" : null;
  if (i.selectedWasConfusable) return "confusion";
  if (i.exerciseType === "choice" && !i.usedHint && i.responseMs > 0 && i.responseMs < GUESS_MS)
    return "likely_guess";
  if (i.aspect === "meaning") return "meaning";
  if (i.aspect === "reading") return "reading";
  if (
    i.aspect === "function_context" ||
    i.aspect === "usage" ||
    i.aspect === "context" ||
    i.aspect === "function"
  )
    return "usage_context";
  return "general";
}
