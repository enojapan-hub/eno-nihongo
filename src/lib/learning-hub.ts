import { supabase } from "@/integrations/supabase/client";
import type { Level } from "@/lib/learn-queries";

export type HubKind = "kanji" | "vocabulary" | "grammar";
export type MasteryKind = HubKind | "reading" | "listening";

export const kindLabel: Record<MasteryKind, string> = {
  kanji: "Kanji",
  vocabulary: "Kotoba",
  grammar: "Bunpou",
  reading: "Dokkai",
  listening: "Chōkai",
};

const tables: Record<MasteryKind, { table: string; title: string }> = {
  kanji: { table: "kanji", title: "character" },
  vocabulary: { table: "vocabulary", title: "term" },
  grammar: { table: "grammar_points", title: "pattern" },
  reading: { table: "reading_passages", title: "title" },
  listening: { table: "listening_items", title: "title" },
};

/** Live counters shared by Materi (flashcard card) and Target. */
export type TargetMetrics = {
  streak: number;
  xpToday: number;
  activeSecondsToday: number;
  dueReviewCount: number;
  errorReviewCount: number;
};

export async function fetchTargetMetrics(): Promise<TargetMetrics> {
  const { data, error } = await (supabase as any).rpc("get_target_page_metrics");
  if (error) throw error;
  return {
    streak: Number(data?.streak ?? 0),
    xpToday: Number(data?.xpToday ?? 0),
    activeSecondsToday: Number(data?.activeSecondsToday ?? 0),
    dueReviewCount: Number(data?.dueReviewCount ?? 0),
    errorReviewCount: Number(data?.errorReviewCount ?? 0),
  };
}

async function countPublished(kind: MasteryKind, level: Level) {
  const { count } = await (supabase as any)
    .from(tables[kind].table)
    .select("id", { count: "exact", head: true })
    .eq("level", level)
    .eq("is_published", true);
  return Number(count ?? 0);
}

async function countProgress(userId: string, kind: MasteryKind, level: Level, statuses: string[]) {
  const { count } = await (supabase as any)
    .from("user_item_progress")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("item_type", kind)
    .eq("level", level)
    .in("status", statuses);
  return Number(count ?? 0);
}

export type ContinueItem = {
  kind: HubKind;
  id: string;
  title: string;
  sub: string;
  href: string;
  learned: number;
  total: number;
  percent: number;
  at: string;
};

/** Most recent lesson the user actually completed at the active level (from learning_activity), or null. */
export async function fetchContinueLearning(level: Level): Promise<ContinueItem | null> {
  const { data: auth } = await supabase.auth.getUser();
  const userId = auth.user?.id;
  if (!userId) return null;
  const { data, error } = await (supabase as any)
    .from("learning_activity")
    .select("metadata,created_at")
    .eq("user_id", userId)
    .eq("activity_type", "lesson_completed")
    .order("created_at", { ascending: false })
    .limit(40);
  if (error) throw error;
  const candidates = (
    (data ?? []) as Array<{ metadata: Record<string, unknown> | null; created_at: string }>
  )
    .filter((row) => {
      const m = row.metadata ?? {};
      return (
        (m["content_type"] === "kanji" ||
          m["content_type"] === "vocabulary" ||
          m["content_type"] === "grammar") &&
        m["content_id"] &&
        (!m["level"] || m["level"] === level)
      );
    })
    .slice(0, 8);
  for (const row of candidates) {
    const kind = row.metadata?.["content_type"] as HubKind;
    const id = String(row.metadata?.["content_id"]);
    const { data: item } = await (supabase as any)
      .from(tables[kind].table)
      .select(`id,${tables[kind].title},meaning_id`)
      .eq("id", id)
      .maybeSingle();
    if (!item) continue;
    const [learned, total] = await Promise.all([
      countProgress(userId, kind, level, ["learning", "review", "mastered"]),
      countPublished(kind, level),
    ]);
    return {
      kind,
      id,
      title: String(item[tables[kind].title] ?? kindLabel[kind]),
      sub: String(item.meaning_id ?? ""),
      href: `/study-item?kind=${kind}&id=${encodeURIComponent(id)}`,
      learned,
      total,
      percent: total ? Math.min(100, Math.round((learned / total) * 100)) : 0,
      at: row.created_at,
    };
  }
  return null;
}

export type MasteryRow = { kind: MasteryKind; mastered: number; learned: number; total: number };

/** Real counters only: mastered/learned rows in user_item_progress against published content at the level. */
export async function fetchMastery(level: Level): Promise<MasteryRow[]> {
  const { data: auth } = await supabase.auth.getUser();
  const userId = auth.user?.id;
  if (!userId) return [];
  const kinds: MasteryKind[] = ["vocabulary", "kanji", "grammar", "reading", "listening"];
  return Promise.all(
    kinds.map(async (kind) => {
      const [mastered, learned, total] = await Promise.all([
        countProgress(userId, kind, level, ["mastered"]),
        countProgress(userId, kind, level, ["learning", "review", "mastered"]),
        countPublished(kind, level),
      ]);
      return { kind, mastered, learned, total };
    }),
  );
}

export type SimulationSummary = {
  total: number;
  passed: boolean;
  examNo: number;
  completedAt: string;
};

export async function fetchLatestSimulation(level: Level): Promise<SimulationSummary | null> {
  const { data: auth } = await supabase.auth.getUser();
  const userId = auth.user?.id;
  if (!userId) return null;
  const { data } = await (supabase as any)
    .from("jlpt_simulation_full_sessions")
    .select("total_score,passed,exam_no,completed_at")
    .eq("user_id", userId)
    .eq("level", level)
    .eq("status", "completed")
    .order("completed_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!data || data.total_score == null) return null;
  return {
    total: Number(data.total_score),
    passed: Boolean(data.passed),
    examNo: Number(data.exam_no ?? 1),
    completedAt: String(data.completed_at),
  };
}

export type WeeklyRow = { taskType: string; target: number; done: number };
export type WeekDay = {
  date: string;
  label: string;
  active: boolean;
  isToday: boolean;
  isPast: boolean;
  target: number;
  done: number;
};
export type WeeklyPlan = { rows: WeeklyRow[]; days: WeekDay[]; studyDays: number };

const jstDate = (d: Date) =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);

/** Monday (JST) of the current week as YYYY-MM-DD. */
export function weekStartJst(now = new Date()) {
  const today = jstDate(now);
  const weekday = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Tokyo",
    weekday: "short",
  }).format(now);
  const back = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].indexOf(weekday);
  const noon = new Date(`${today}T12:00:00Z`).getTime();
  return new Date(noon - Math.max(0, back) * 86400000).toISOString().slice(0, 10);
}

/** Weekday offsets (0 = Monday) of the study days; mirrors public.study_active_offsets(). */
export function studyActiveOffsets(days: number) {
  const n = Math.max(1, Math.min(7, Math.round(days) || 7));
  return Array.from(new Set(Array.from({ length: n }, (_, i) => Math.floor((i * 7) / n))));
}

const dayLabels = ["Sen", "Sel", "Rab", "Kam", "Jum", "Sab", "Min"];
export const quotaTaskTypes = ["new_vocabulary", "new_kanji", "new_grammar", "quiz"] as const;

/** This week's real plan: the planner generates a row per quota task for every active study day (Mon..Sun, JST). */
export async function fetchWeeklyPlan(
  planId: string | null | undefined,
  studyDays: number,
): Promise<WeeklyPlan> {
  const start = weekStartJst();
  const today = jstDate(new Date());
  const offsets = studyActiveOffsets(studyDays);
  const days: WeekDay[] = dayLabels.map((label, i) => {
    const date = new Date(new Date(`${start}T12:00:00Z`).getTime() + i * 86400000)
      .toISOString()
      .slice(0, 10);
    return {
      date,
      label,
      active: offsets.includes(i),
      isToday: date === today,
      isPast: date < today,
      target: 0,
      done: 0,
    };
  });
  const empty: WeeklyPlan = { rows: [], days, studyDays: offsets.length };
  const { data: auth } = await supabase.auth.getUser();
  const userId = auth.user?.id;
  if (!userId || !planId) return empty;
  const end = days[6]?.date ?? start;
  const { data, error } = await (supabase as any)
    .from("daily_study_tasks")
    .select("study_date,task_type,target_count,completed_count")
    .eq("user_id", userId)
    .eq("plan_id", planId)
    .gte("study_date", start)
    .lte("study_date", end);
  if (error) throw error;
  const sums = new Map<string, WeeklyRow>();
  for (const r of (data ?? []) as Array<{
    study_date: string;
    task_type: string;
    target_count: number;
    completed_count: number;
  }>) {
    if (!(quotaTaskTypes as readonly string[]).includes(r.task_type)) continue;
    if (!days.find((x) => x.date === r.study_date)?.active) continue; // only the current study days count toward the weekly plan
    const target = Number(r.target_count || 0),
      done = Math.min(Number(r.completed_count || 0), target);
    const row = sums.get(r.task_type) ?? { taskType: r.task_type, target: 0, done: 0 };
    row.target += target;
    row.done += done;
    sums.set(r.task_type, row);
    const day = days.find((x) => x.date === r.study_date);
    if (day) {
      day.target += target;
      day.done += done;
    }
  }
  return { rows: [...sums.values()], days, studyDays: offsets.length };
}
