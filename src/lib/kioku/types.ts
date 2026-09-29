export type KiokuItemType = "kanji" | "vocabulary" | "grammar";
export type KiokuAspect = "meaning" | "reading" | "usage" | "function_context";
export type KiokuDirection = "forward" | "reverse";
export type ExerciseType = "choice" | "recall_flip" | "contrast" | "usage";
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

export type RemedyKind =
  "meaning" | "reading" | "jebakan" | "contrast" | "usage" | "slow" | "guess";
export type PairSource = "error" | "relation" | "wrong_example" | "heuristic";
export type Remedy = {
  kind: RemedyKind;
  partnerId?: string | undefined;
  source?: PairSource | undefined;
  /** consecutive unresolved errors on this combo */
  count: number;
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
  optionCount: number;
  reason: string;
  score: number;
  remedy?: Remedy;
  /** mastered item that is due for a natural re-test */
  retention?: "retest" | undefined;
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
  /** item id of the chosen option when it is a real item (null for sentence options) */
  selected_item_id: string | null;
  variant: string | null;
  /** immediate (normal) | delayed (verified after a gap in the session) | retest (mastered item re-tested) */
  retention: "immediate" | "delayed" | "retest";
  /** short hash of the example sentence used, so the next session can vary the context */
  context_ref: string | null;
  confidence: Confidence | null;
  hint_level: number;
  used_hint: boolean;
  response_ms: number;
  error_type: ErrorType | null;
  occurred_at: string;
};
