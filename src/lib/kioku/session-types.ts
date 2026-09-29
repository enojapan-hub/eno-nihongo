import type { ExerciseType, KiokuAspect, KiokuDirection, KiokuItemType } from "./types";

export type Exercise = {
  id: string;
  itemType: KiokuItemType;
  itemId: string;
  level: string;
  aspect: KiokuAspect;
  direction: KiokuDirection;
  exerciseType: ExerciseType;
  stage: number;
  hintLevel: number;
  reason: string;
  hintText: string;
  /** exercise variant for analytics/UI: jebakan | contrast | cloze | wrong_example */
  variant?: string | undefined;
  /** Context Ladder level actually used (2 phrase, 3 sentence, 4 real context); undefined for plain recognition */
  ladder?: number | undefined;
  /** short hash of the example sentence used (context variation across sessions) */
  contextRef?: string | undefined;
  /** delayed = scheduled retention check inside the session, retest = natural re-test of a mastered item */
  retention?: "delayed" | "retest" | undefined;
  isDelayed?: boolean | undefined;
  /** short chip label (Jebakan / Bedakan / Penggunaan) */
  label?: string | undefined;
  /** short, data-backed explanation shown after answering */
  feedback?: string | undefined;
  prompt: string;
  promptSub: string;
  answer: string;
  options: { id: string; text: string; confusable: boolean }[];
  isRepeat: boolean;
};

export type KiokuSession = {
  sessionId: string;
  createdAt: string;
  exercises: Exercise[];
  index: number;
  results: Record<string, boolean>;
  finished: boolean;
};
