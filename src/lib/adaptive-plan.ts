import { supabase } from "@/integrations/supabase/client";
import { getAuthUser } from "@/lib/auth-user";
import type { Level } from "@/lib/learn-queries";
import {
  analyzePlannerWeakness,
  reviewMatchesWeakness,
  type PlannerReview,
} from "@/lib/planner-mastery";

export type AdaptiveTaskType =
  "new_kanji" | "new_vocabulary" | "new_grammar" | "review" | "quiz" | "reading" | "listening";
export type AdaptiveSuggestion = {
  id: string;
  label: string;
  subtitle?: string | null;
  /** Set for review suggestions so Target can open the matching material detail. */
  itemType?: "kanji" | "vocabulary" | "grammar";
};
export type AdaptiveTask = {
  id: string;
  task_type: AdaptiveTaskType;
  target_count: number;
  completed_count: number;
  priority: number;
  reason: string | null;
  metadata: Record<string, unknown> | null;
  suggestions?: AdaptiveSuggestion[];
};
export type AdaptivePlan = {
  active: boolean;
  planId?: string | null;
  studyDaysPerWeek?: number | null;
  startDate?: string | null;
  targetLevel: string | null;
  targetDate: string | null;
  daysLeft: number | null;
  tasks: AdaptiveTask[];
  target: number;
  completed: number;
};
const emptyPlan: AdaptivePlan = {
  active: false,
  targetLevel: null,
  targetDate: null,
  daysLeft: null,
  tasks: [],
  target: 0,
  completed: 0,
};
type ProgressRow = {
  item_type: string;
  item_id: string;
  status: string;
  due_at: string | null;
  ease_factor?: number | null;
};
type ReviewRow = PlannerReview & { meta?: Record<string, unknown> | null };
type KiokuStateRow = {
  item_type: string;
  item_id: string;
  stage: number;
  stability: number;
  due_at: string | null;
  lapses: number;
  failure_count: number;
  overconfident_wrong: number;
  last_error_type: string | null;
};
const aspectLabel: Record<string, string> = {
  meaning: "Arti",
  reading: "Bacaan",
  usage: "Penggunaan",
  function: "Fungsi",
  context: "Konteks",
  confusion: "Membedakan materi mirip",
  meaning_reading: "Arti & Bacaan",
  meaning_usage: "Arti & Penggunaan",
  function_context: "Fungsi & Konteks",
};
const materialLabel: Record<string, string> = {
  kanji: "Kanji",
  vocabulary: "Kotoba",
  grammar: "Bunpou",
};

async function itemSuggestion(
  client: typeof supabase,
  r: { item_type: string; item_id: string },
  weak = false,
  weakLabel?: string,
): Promise<AdaptiveSuggestion | null> {
  const prefix = weak ? `Prioritas ${weakLabel || "kelemahan"}` : "Review";
  if (r.item_type === "kanji") {
    const { data } = await client
      .from("kanji")
      .select("character,meaning_id")
      .eq("id", r.item_id)
      .maybeSingle();
    return data
      ? {
          id: r.item_id,
          itemType: "kanji",
          label: String(data.character ?? "Kanji"),
          subtitle: `${prefix} · ${data.meaning_id ?? "Kanji"}`,
        }
      : null;
  }
  if (r.item_type === "vocabulary") {
    const { data } = await client
      .from("vocabulary")
      .select("term,meaning_id")
      .eq("id", r.item_id)
      .maybeSingle();
    return data
      ? {
          id: r.item_id,
          itemType: "vocabulary",
          label: String(data.term ?? "Kosakata"),
          subtitle: `${prefix} · ${data.meaning_id ?? "Kosakata"}`,
        }
      : null;
  }
  if (r.item_type === "grammar") {
    const { data } = await client
      .from("grammar_points")
      .select("pattern,meaning_id")
      .eq("id", r.item_id)
      .maybeSingle();
    return data
      ? {
          id: r.item_id,
          itemType: "grammar",
          label: String(data.pattern ?? "Bunpou"),
          subtitle: `${prefix} · ${data.meaning_id ?? "Bunpou"}`,
        }
      : null;
  }
  return null;
}

async function enrichTasksWithSuggestions(
  userId: string,
  level: Level,
  tasks: AdaptiveTask[],
): Promise<AdaptiveTask[]> {
  const client = supabase;
  const [{ data: progress }, { data: reviewData }, { data: kiokuState }] = await Promise.all([
    client
      .from("user_item_progress")
      .select("item_type,item_id,status,due_at,ease_factor")
      .eq("user_id", userId)
      .eq("level", level),
    client
      .from("flashcard_reviews")
      .select("item_type,item_id,rating,used_hint,response_ms,direction,aspect,created_at,meta")
      .eq("user_id", userId)
      .eq("level", level)
      .order("created_at", { ascending: false })
      .limit(500),
    client
      .from("memory_state")
      .select(
        "item_type,item_id,stage,stability,due_at,lapses,failure_count,overconfident_wrong,last_error_type",
      )
      .eq("user_id", userId),
  ]);
  const rows = (progress ?? []) as ProgressRow[],
    reviews = (reviewData ?? []) as ReviewRow[],
    memory = (kiokuState ?? []) as KiokuStateRow[],
    w = analyzePlannerWeakness(reviews),
    weakest = w.weakest;
  const levelIds = new Set(rows.map((r) => `${r.item_type}:${r.item_id}`));
  const kiokuRows = memory.filter((r) => levelIds.has(`${r.item_type}:${r.item_id}`));
  const kiokuEventCount = reviews.filter((r) => r.meta?.["source"] === "kioku").length;
  const weakLabel = weakest
    ? `${materialLabel[weakest.itemType] || weakest.itemType} · ${aspectLabel[weakest.aspect] || weakest.aspect}`
    : null;
  const nowIso = new Date().toISOString();
  const mastered = (type: string) =>
    new Set(
      rows.filter((r) => r.item_type === type && r.status === "mastered").map((r) => r.item_id),
    );
  const known = (type: string) =>
    new Set(rows.filter((r) => r.item_type === type).map((r) => r.item_id));
  const aspectItems = new Map<string, number>();
  for (const r of reviews) {
    if (!reviewMatchesWeakness(r, weakest)) continue;
    const k = `${r.item_type}:${r.item_id}`,
      penalty =
        (r.rating < 2 ? 0.65 : 0) +
        (r.used_hint ? 0.2 : 0) +
        (Number(r.response_ms ?? 0) > 8000 ? 0.15 : 0);
    aspectItems.set(k, (aspectItems.get(k) ?? 0) + penalty);
  }
  return Promise.all(
    tasks.map(async (task) => {
      const wanted = Math.max(1, Math.min(12, Number(task.target_count || 1)));
      try {
        if (task.task_type === "review") {
          const due = rows
            .filter((r) => r.due_at && r.due_at <= nowIso)
            .map((r) => ({
              ...r,
              score:
                3 +
                (w.item.get(`${r.item_type}:${r.item_id}`) ?? 0) +
                (aspectItems.get(`${r.item_type}:${r.item_id}`) ?? 0),
              source: "hafalan" as const,
            }));
          const weakNotDue = rows
            .filter((r) => !(r.due_at && r.due_at <= nowIso))
            .map((r) => ({
              ...r,
              score:
                (w.item.get(`${r.item_type}:${r.item_id}`) ?? 0) +
                (aspectItems.get(`${r.item_type}:${r.item_id}`) ?? 0),
              source: "hafalan" as const,
            }))
            .filter((r) => r.score >= 0.28);
          const kioku = kiokuRows
            .map((r) => ({
              ...r,
              status: "learning",
              score:
                (r.due_at && r.due_at <= nowIso ? 4 : 0) +
                Math.min(2, r.failure_count * 0.35 + r.lapses * 0.5 + r.overconfident_wrong * 0.7) +
                (r.stage < 3 ? 0.25 : 0),
              source: "kioku" as const,
            }))
            .filter((r) => r.score >= 0.5);
          const merged = [...due, ...weakNotDue, ...kioku].sort((a, b) => b.score - a.score);
          const seen = new Set<string>();
          const queue = merged
            .filter((r) => {
              const k = `${r.item_type}:${r.item_id}`;
              if (seen.has(k)) return false;
              seen.add(k);
              return true;
            })
            .slice(0, wanted);
          const kiokuRecommended = queue.some((r) => r.source === "kioku");
          const suggestions = (
            await Promise.all(
              queue.map((r) => itemSuggestion(client, r, r.score < 3, weakLabel ?? undefined)),
            )
          ).filter(Boolean) as AdaptiveSuggestion[];
          return {
            ...task,
            priority: queue.length ? 120 : task.priority,
            target_count: Math.max(task.target_count, Math.min(12, queue.length)),
            reason: queue.length
              ? kiokuRecommended
                ? `ENO Kioku memprioritaskan retensi jatuh tempo dan pola lupa, lalu kelemahan ${weakLabel ?? "recall"}.`
                : `Review jatuh tempo diprioritaskan, lalu kelemahan ${weakLabel ?? "recall"}, sebelum materi baru.`
              : task.reason,
            suggestions,
            metadata: {
              ...(task.metadata ?? {}),
              smartReview: true,
              kiokuRecommended,
              kiokuSignalCount: kioku.length,
              kiokuEventCount,
              weakCount: weakNotDue.length,
              dueCount: due.length,
              weakestItemType: weakest?.itemType ?? null,
              weakestAspect: weakest?.aspect ?? null,
              weakestAspectLabel: weakLabel,
              weakestAspectScore: weakest ? Math.round(weakest.weaknessScore * 100) : null,
            },
          };
        }
        const weaknessScore = weakest?.weaknessScore ?? 0,
          newPenalty = weakest && weaknessScore >= 0.35 ? 25 : 0;
        const adjusted = {
          ...task,
          priority: Math.max(1, task.priority - newPenalty),
          metadata: {
            ...(task.metadata ?? {}),
            weaknessGuard: newPenalty > 0,
            weakestItemType: weakest?.itemType ?? null,
            weakestAspect: weakest?.aspect ?? null,
          },
        };
        if (task.task_type === "new_kanji") {
          const skip = known("kanji");
          const { data } = await client
            .from("kanji")
            .select("id,character,meaning_id")
            .eq("level", level)
            .eq("is_published", true)
            .order("sort_order", { ascending: true })
            .limit(wanted * 4);
          return {
            ...adjusted,
            suggestions: (data ?? [])
              .filter((x) => !skip.has(String(x.id)))
              .slice(0, wanted)
              .map((x) => ({
                id: String(x.id),
                label: String(x.character ?? "Kanji"),
                subtitle: x.meaning_id ? String(x.meaning_id) : null,
              })),
          };
        }
        if (task.task_type === "new_vocabulary") {
          const skip = known("vocabulary");
          const { data } = await client
            .from("vocabulary")
            .select("id,term,reading,meaning_id")
            .eq("level", level)
            .eq("is_published", true)
            .order("sort_order", { ascending: true })
            .limit(wanted * 4);
          return {
            ...adjusted,
            suggestions: (data ?? [])
              .filter((x) => !skip.has(String(x.id)))
              .slice(0, wanted)
              .map((x) => ({
                id: String(x.id),
                label: String(x.term ?? "Kosakata"),
                subtitle: [x.reading, x.meaning_id].filter(Boolean).map(String).join(" · "),
              })),
          };
        }
        if (task.task_type === "new_grammar") {
          const skip = known("grammar");
          const { data } = await client
            .from("grammar_points")
            .select("id,pattern,meaning_id")
            .eq("level", level)
            .eq("is_published", true)
            .order("sort_order", { ascending: true })
            .limit(wanted * 4);
          return {
            ...adjusted,
            suggestions: (data ?? [])
              .filter((x) => !skip.has(String(x.id)))
              .slice(0, wanted)
              .map((x) => ({
                id: String(x.id),
                label: String(x.pattern ?? "Bunpou"),
                subtitle: x.meaning_id ? String(x.meaning_id) : null,
              })),
          };
        }
        if (task.task_type === "reading") {
          const skip = mastered("reading");
          const { data } = await client
            .from("reading_passages")
            .select("id,title")
            .eq("level", level)
            .eq("is_published", true)
            .order("sort_order", { ascending: true })
            .limit(wanted * 3);
          return {
            ...adjusted,
            suggestions: (data ?? [])
              .filter((x) => !skip.has(String(x.id)))
              .slice(0, wanted)
              .map((x) => ({ id: String(x.id), label: String(x.title ?? "Dokkai") })),
          };
        }
        if (task.task_type === "listening") {
          const skip = mastered("listening");
          const { data } = await client
            .from("listening_items")
            .select("id,title,duration_seconds")
            .eq("level", level)
            .eq("is_published", true)
            .order("sort_order", { ascending: true })
            .limit(wanted * 3);
          return {
            ...adjusted,
            suggestions: (data ?? [])
              .filter((x) => !skip.has(String(x.id)))
              .slice(0, wanted)
              .map((x) => ({
                id: String(x.id),
                label: String(x.title ?? "Choukai"),
                subtitle: x.duration_seconds
                  ? `${Math.ceil(Number(x.duration_seconds) / 60)} menit`
                  : null,
              })),
          };
        }
        return adjusted;
      } catch {
        return task;
      }
    }),
  );
}

export async function fetchAdaptivePlan(): Promise<AdaptivePlan> {
  const { data: auth, error: authError } = await getAuthUser();
  if (authError || !auth.user) return emptyPlan;
  const client = supabase;
  const today = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
  // Satu RPC menjalankan ensure -> generate -> sync berurutan di server (round-trip 3 -> 1).
  // Bila RPC gabungan belum tersedia / gagal, jalankan ketiga langkah seperti semula.
  const refreshed = await client.rpc("refresh_adaptive_plan" as never, { p_date: today } as never);
  if (refreshed.error) {
    await client.rpc("ensure_active_study_plan");
    await client.rpc("generate_weekly_study_plan", { p_date: today });
    await client.rpc("sync_daily_study_task_progress", { p_study_date: today });
  }
  const [{ data: plans }, { data: tasks }] = await Promise.all([
    client
      .from("study_plans")
      .select("id,target_level,target_date,status,start_date,study_days_per_week")
      .eq("user_id", auth.user.id)
      .eq("status", "active")
      .order("created_at", { ascending: false })
      .limit(1),
    client
      .from("daily_study_tasks")
      .select("id,plan_id,task_type,target_count,completed_count,priority,reason,metadata")
      .eq("user_id", auth.user.id)
      .eq("study_date", today)
      .order("priority", { ascending: false }),
  ]);
  const plan = plans?.[0];
  if (!plan) return emptyPlan;
  const taskRows = [
    ...(await enrichTasksWithSuggestions(
      auth.user.id,
      plan.target_level ?? "N5",
      (tasks ?? []).filter((task) => task.plan_id === plan.id) as unknown as AdaptiveTask[],
    )),
  ].sort((a, b) => b.priority - a.priority);
  const target = taskRows.reduce((s, t) => s + Number(t.target_count || 0), 0),
    completed = taskRows.reduce(
      (s, t) => s + Math.min(Number(t.completed_count || 0), Number(t.target_count || 0)),
      0,
    ),
    targetMs = new Date(`${plan.target_date}T00:00:00+09:00`).getTime(),
    todayMs = new Date(`${today}T00:00:00+09:00`).getTime(),
    daysLeft = Math.max(0, Math.ceil((targetMs - todayMs) / 86400000));
  return {
    active: true,
    planId: String(plan.id),
    studyDaysPerWeek: Number(plan.study_days_per_week ?? 7),
    startDate: plan.start_date ?? null,
    targetLevel: plan.target_level ?? null,
    targetDate: plan.target_date ?? null,
    daysLeft,
    tasks: taskRows,
    target,
    completed,
  };
}

export const adaptiveTaskLabels: Record<AdaptiveTaskType, string> = {
  new_kanji: "Kanji baru",
  new_vocabulary: "Kotoba baru",
  new_grammar: "Bunpō baru",
  review: "Review",
  quiz: "Kuis",
  reading: "Dokkai",
  listening: "Listening",
};
