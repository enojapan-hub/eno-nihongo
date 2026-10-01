import { supabase } from "@/integrations/supabase/client";

export type ProgressMetric = { done: number; total: number };
export type WeeklyMetric = { date: string; xp: number; minutes: number; activities: number };
export type ContinueLesson = { type: string; id: string; level: string; at: string; title: string; subtitle: string; to: string } | null;
export type DashboardMetrics = {
  level: string;
  progress: Record<"kanji" | "vocabulary" | "grammar" | "reading" | "listening", ProgressMetric>;
  weekly: WeeklyMetric[];
  last: { type: string; id: string; level: string; at: string } | null;
};

const empty: DashboardMetrics = {
  level: "N5",
  progress: {
    kanji: { done: 0, total: 0 }, vocabulary: { done: 0, total: 0 }, grammar: { done: 0, total: 0 }, reading: { done: 0, total: 0 }, listening: { done: 0, total: 0 },
  },
  weekly: [],
  last: null,
};

function metric(value: unknown): ProgressMetric {
  const row = value && typeof value === "object" ? value as Record<string, unknown> : {};
  return { done: Number(row.done ?? 0) || 0, total: Number(row.total ?? 0) || 0 };
}

function normalizeDashboardMetrics(value: unknown): DashboardMetrics {
  if (!value || typeof value !== "object") return empty;
  const row = value as Record<string, unknown>;
  const p = row.progress && typeof row.progress === "object" ? row.progress as Record<string, unknown> : {};
  const weeklyRaw = Array.isArray(row.weekly) ? row.weekly : [];
  const weekly: WeeklyMetric[] = weeklyRaw
    .filter((item): item is Record<string, unknown> => !!item && typeof item === "object")
    .map((item) => ({
      date: String(item.date ?? ""),
      xp: Number(item.xp ?? 0) || 0,
      minutes: Number(item.minutes ?? 0) || 0,
      activities: Number(item.activities ?? 0) || 0,
    }))
    .filter((item) => item.date.length > 0);

  const lastRaw = row.last && typeof row.last === "object" ? row.last as Record<string, unknown> : null;
  const last = lastRaw && lastRaw.id ? {
    type: String(lastRaw.type ?? ""),
    id: String(lastRaw.id),
    level: String(lastRaw.level ?? row.level ?? "N5"),
    at: String(lastRaw.at ?? ""),
  } : null;

  return {
    level: String(row.level ?? "N5"),
    progress: {
      kanji: metric(p.kanji),
      vocabulary: metric(p.vocabulary),
      grammar: metric(p.grammar),
      reading: metric(p.reading),
      listening: metric(p.listening),
    },
    weekly,
    last,
  };
}

export async function fetchDashboardMetrics(): Promise<DashboardMetrics> {
  try {
    const { data, error } = await (supabase as any).rpc("get_my_dashboard_metrics", {});
    if (error || !data) return empty;
    return normalizeDashboardMetrics(data);
  } catch (error) {
    console.warn("Dashboard metrics fallback activated.", error);
    return empty;
  }
}

export async function resolveContinueLesson(last: DashboardMetrics["last"]): Promise<ContinueLesson> {
  if (!last?.id) return null;
  const map: Record<string, { table: string; select: string; title: string; subtitle: string; route: string }> = {
    kanji: { table: "kanji", select: "character,meaning_id", title: "character", subtitle: "meaning_id", route: "/kanji" },
    vocabulary: { table: "vocabulary", select: "term,meaning_id", title: "term", subtitle: "meaning_id", route: "/kotoba" },
    grammar: { table: "grammar_points", select: "pattern,meaning_id", title: "pattern", subtitle: "meaning_id", route: "/bunpo" },
    reading: { table: "reading_passages", select: "title,lesson_title", title: "title", subtitle: "lesson_title", route: "/dokkai" },
    listening: { table: "listening_items", select: "title,lesson_title", title: "title", subtitle: "lesson_title", route: "/choukai" },
  };
  const cfg = map[last.type];
  if (!cfg) return null;
  try {
    const { data } = await (supabase as any).from(cfg.table).select(cfg.select).eq("id", last.id).maybeSingle();
    return {
      ...last,
      title: String(data?.[cfg.title] ?? `${last.type} ${last.level}`),
      subtitle: String(data?.[cfg.subtitle] ?? `Lanjutkan materi ${last.level}`),
      to: cfg.route,
    };
  } catch (error) {
    console.warn("Continue lesson fallback activated.", error);
    return null;
  }
}
