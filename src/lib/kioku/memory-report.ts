import { supabase } from "@/integrations/supabase/client";
import { getAuthUser } from "@/lib/auth-user";
import { memoryReadiness } from "@/lib/kioku/insights";
import type { ErrorType } from "@/lib/kioku/types";

export type MemoryReportRow = {
  stage: number;
  due_at: string;
  overconfident_wrong: number;
  last_error_type: string | null;
};

/** Shared by Kioku Beranda and Analisis Ingatan (same query key, same shape). */
export const MEMORY_REPORT_KEY = ["kioku-memory-report"] as const;

export async function fetchMemoryReport(): Promise<MemoryReportRow[]> {
  const { data: userData } = await getAuthUser();
  if (!userData.user) return [];
  const { data, error } = await supabase
    .from("memory_state")
    .select("stage,due_at,overconfident_wrong,last_error_type")
    .eq("user_id", userData.user.id);
  if (error) throw error;
  return (data ?? []) as MemoryReportRow[];
}

const RECOMMENDATION: Record<ErrorType, string> = {
  meaning: "Perkuat ingatan arti",
  reading: "Perkuat ingatan bacaan",
  confusion: "Bedakan materi yang mirip",
  usage_context: "Perkuat pemahaman konteks",
  slow_recall: "Percepat daya ingat",
  likely_guess: "Kurangi jawaban menebak",
  general: "Ulangi materi yang masih lemah",
};

/**
 * Kioku Beranda summary. Every number is derived from the learner's own memory_state rows
 * with the same rules Analisis Ingatan already uses; nothing is estimated or invented.
 */
export function kiokuHomeSummary(rows: MemoryReportRow[], now = Date.now()) {
  const readiness = memoryReadiness(rows, now);
  const weakRows = rows.filter((r) => r.stage < 2);
  const counts = new Map<ErrorType, number>();
  for (const r of rows) {
    const t = r.last_error_type as ErrorType | null;
    if (!t || !(t in RECOMMENDATION)) continue;
    if (r.stage >= 4 && new Date(r.due_at).getTime() > now) continue;
    counts.set(t, (counts.get(t) ?? 0) + 1);
  }
  const top = [...counts.entries()].sort((a, b) => b[1] - a[1])[0];
  return {
    hasData: rows.length > 0,
    readinessScore: readiness.score,
    readinessLabel: readiness.label,
    needReview: readiness.due,
    needRecovery: weakRows.length,
    strong: readiness.strong,
    recommendation: top
      ? { title: RECOMMENDATION[top[0]], detail: "Berdasarkan pola kesalahan pada latihan sebelumnya." }
      : readiness.due > 0
        ? { title: "Ulangi materi jatuh tempo", detail: "Beberapa materi sudah waktunya diuji kembali." }
        : null,
  };
}
