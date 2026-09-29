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
