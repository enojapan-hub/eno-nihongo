export type MaterialProgressStatus = "new" | "learning" | "review" | "mastered";

export function isMaterialLearned(status: string | null | undefined) {
  return status === "learning" || status === "review" || status === "mastered";
}

export function learnedActionLabel(learned: boolean) {
  return learned ? "Sudah Dipelajari" : "Belum Dipelajari";
}
