export type MemoryRow = { stage: number; due_at: string; level?: string | null };
export type WeeklyRow = { correct: boolean; created_at: string };

export function memoryReadiness(rows: MemoryRow[], now = Date.now()) {
  if (!rows.length) return { score: 0, label: "Belum cukup data", strong: 0, due: 0 };
  const strong = rows.filter((x) => x.stage >= 4).length;
  const growing = rows.filter((x) => x.stage >= 2 && x.stage < 4).length;
  const due = rows.filter((x) => new Date(x.due_at).getTime() <= now).length;
  const score = Math.round(((strong + growing * 0.5) / rows.length) * 100);
  return {
    score,
    label: score >= 80 ? "Kuat" : score >= 55 ? "Berkembang" : "Perlu diperkuat",
    strong,
    due,
  };
}

export function weeklyLearning(rows: WeeklyRow[], now = Date.now()) {
  const since = now - 7 * 86_400_000;
  const week = rows.filter((x) => new Date(x.created_at).getTime() >= since);
  const correct = week.filter((x) => x.correct).length;
  const days = new Set(week.map((x) => new Date(x.created_at).toISOString().slice(0, 10))).size;
  return {
    reviews: week.length,
    correct,
    accuracy: week.length ? Math.round((correct / week.length) * 100) : 0,
    activeDays: days,
  };
}

export function fatigueSuggested(answered: number, wrong: number) {
  if (answered < 12) return false;
  return wrong / answered >= 0.5 || answered >= 30;
}
