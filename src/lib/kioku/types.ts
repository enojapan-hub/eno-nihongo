export type KiokuItemType = "kanji" | "vocabulary" | "grammar";
export type KiokuAspect = "meaning" | "reading" | "function_context";
export type KiokuDirection = "forward" | "reverse";
export type ExerciseType = "choice" | "recall_flip";
export type Confidence = "yakin" | "ragu";
export type ErrorType =
  | "meaning"
  | "reading"
  | "confusion"
  | "usage_context"
  | "slow_recall"
  | "likely_guess"
  | "general";

/** Row of `user_item_progress` that counts as "already studied". */
export type LearnedItem = {
  itemType: KiokuItemType;
  itemId: string;
  level: string;
  status: string;
  dueAt: string | null;
  lastReviewedAt: string | null;
};

/** Row of `memory_state` (derived cache). */
export type MemoryStateRow = {
  item_type: KiokuItemType;
  item_id: string;
  aspect: string;
  direction: string;
  stage: number;
  stability: number;
  due_at: string;
  last_tested_at: string | null;
  lapses: number;
  success_count: number;
  failure_count: number;
  overconfident_wrong: number;
  last_error_type: string | null;
};

export type Selection = {
  itemType: KiokuItemType;
  itemId: string;
  level: string;
  aspect: KiokuAspect;
  direction: KiokuDirection;
  exerciseType: ExerciseType;
  stage: number;
  hintLevel: number;
  reason: string;
  score: number;
};

/** Payload of one event sent to `kioku_record_events`. */
export type KiokuEvent = {
  client_event_id: string;
  session_id: string;
  item_type: KiokuItemType;
  item_id: string;
  level: string;
  aspect: KiokuAspect;
  direction: KiokuDirection;
  exercise_type: ExerciseType;
  correct: boolean;
  selected_answer: string | null;
  confidence: Confidence | null;
  hint_level: number;
  used_hint: boolean;
  response_ms: number;
  error_type: ErrorType | null;
  occurred_at: string;
};
