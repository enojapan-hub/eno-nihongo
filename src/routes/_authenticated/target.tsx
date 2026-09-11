import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { BookOpenCheck, Brain, CheckCircle2, Clock3, Flame, Languages, ListChecks, RefreshCcw, Sparkles, Target, Type, Zap } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { Card, CardContent } from "@/components/ui/card";
import { adaptiveTaskLabels, fetchAdaptivePlan, type AdaptiveTaskType } from "@/lib/adaptive-plan";
import { supabase } from "@/integrations/supabase/client";

type TaskRoute = "/kanji" | "/kotoba" | "/bunpo" | "/belajar" | "/quiz" | "/dokkai" | "/listening";
const taskLinks: Partial<Record<AdaptiveTaskType, TaskRoute>> = { new_kanji: "/kanji", new_vocabulary: "/kotoba", new_grammar: "/bunpo", review: "/belajar", quiz: "/quiz", reading: "/dokkai", listening: "/listening" };
type Metrics = { streak: number; xpToday: number; activeSecondsToday: number; dueReviewCount: number; errorReviewCount: number };
type MetricsPayload = Partial<Record<keyof Metrics, unknown>>;
type MetricsRpcClient = { rpc(name: "get_target_page_metrics"): Promise<{ data: MetricsPayload | null; error: unknown }> };

export const Route = createFileRoute("/_authenticated/target")({ head: () => ({ meta: [{ title: "Target — ENO NIHONGO" }] }), component: TargetPage });

async function fetchMetrics(): Promise<Metrics> {
  const { data, error } = await (supabase as unknown as MetricsRpcClient).rpc("get_target_page_metrics");
  if (error) throw error;
  return {
    streak: Number(data?.streak ?? 0),
    xpToday: Number(data?.xpToday ?? 0),
    activeSecondsToday: Number(data?.activeSecondsToday ?? 0),
    dueReviewCount: Number(data?.dueReviewCount ?? 0),
    errorReviewCount: Number(data?.errorReviewCount ?? 0),
  };
}
function timeLabel(seconds: number) { const m = Math.floor(seconds / 60); if (m < 60) return `${m}m`; return `${Math.floor(m / 60)}j ${m % 60}m`; }

function TargetPage() {
  const adaptive = useQuery({ queryKey: ["adaptive-plan"], queryFn: fetchAdaptivePlan, staleTime: 30_000, refetchInterval: 30_000 });
  const metrics = useQuery({ queryKey: ["target-live-metrics"], queryFn: fetchMetrics, staleTime: 15_000, refetchInterval: 30_000 });
  const completed = adaptive.data?.completed ?? 0, target = adaptive.data?.target ?? 0, percent = target ? Math.min(100, (completed / target) * 100) : 0, allDone = target > 0 && completed >= target;
  const level = adaptive.data?.targetLevel ?? "N5"; const slugLevel = level.toLowerCase();
  const quizzes = [
    { label: "Quiz Kanji", icon: Type, slug: `latihan-${slugLevel}-kanji` },
    { label: "Quiz Kosakata", icon: Languages, slug: `latihan-${slugLevel}-vocabulary` },
    { label: "Quiz Bunpou", icon: BookOpenCheck, slug: `latihan-${slugLevel}-grammar` },
    { label: "Mixed Quiz", icon: ListChecks, slug: `latihan-${slugLevel}` },
  ];
  const tasks = adaptive.data?.tasks ?? [];
  const missionRows = [
    { label: "Belajar 30 menit", done: Math.min(30, Math.floor((metrics.data?.activeSecondsToday ?? 0) / 60)), target: 30 },
    { label: "Selesaikan target Kanji", done: tasks.find(t => t.task_type === "new_kanji")?.completed_count ?? 0, target: tasks.find(t => t.task_type === "new_kanji")?.target_count ?? 0 },
    { label: "Pelajari target Kosakata", done: tasks.find(t => t.task_type === "new_vocabulary")?.completed_count ?? 0, target: tasks.find(t => t.task_type === "new_vocabulary")?.target_count ?? 0 },
    { label: "Selesaikan semua target", done: completed, target },
  ];
  return <AppShell compact title="Target"><div className="mx-auto max-w-3xl space-y-4 eno-rise">
    <section><div className="mb-3 flex items-start justify-between gap-3"><div><p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-primary">Adaptive Study Planner</p><h1 className="mt-1 text-[20px] font-bold tracking-tight">Target hari ini</h1><p className="mt-1 text-[11px] text-muted-foreground">Rencana otomatis berdasarkan progres, review, dan target JLPT.</p>{adaptive.data?.active && <p className="mt-1 text-[10px] font-medium text-primary">{level} · {adaptive.data.daysLeft ?? 0} hari menuju target</p>}</div><span className={allDone ? "grid size-10 shrink-0 place-items-center rounded-2xl bg-primary text-primary-foreground eno-bounce" : "grid size-10 shrink-0 place-items-center rounded-2xl bg-primary/10 text-primary eno-pulse-soft"}><Target className="size-5" /></span></div>
      <Card className={allDone ? "rounded-2xl border-primary/35 shadow-sm eno-pop" : "rounded-2xl border-border/70 shadow-sm eno-rise"}><CardContent className="p-4"><div className="grid grid-cols-4 gap-2 text-center">
        <div className="rounded-xl bg-muted/45 p-2"><Flame className="mx-auto size-4 text-orange-500 eno-pulse-soft" /><p className="mt-1 text-[12px] font-bold">{metrics.data?.streak ?? 0}</p><p className="text-[9px] text-muted-foreground">Streak</p></div>
        <div className="rounded-xl bg-muted/45 p-2"><Zap className="mx-auto size-4 text-amber-500" /><p className="mt-1 text-[12px] font-bold">{metrics.data?.xpToday ?? 0}</p><p className="text-[9px] text-muted-foreground">XP hari ini</p></div>
        <div className="rounded-xl bg-muted/45 p-2"><Clock3 className="mx-auto size-4 text-sky-500" /><p className="mt-1 text-[12px] font-bold">{timeLabel(metrics.data?.activeSecondsToday ?? 0)}</p><p className="text-[9px] text-muted-foreground">Waktu</p></div>
        <div className={allDone ? "rounded-xl bg-primary p-2 text-primary-foreground eno-bounce" : "rounded-xl bg-primary/10 p-2"}><CheckCircle2 className={allDone ? "mx-auto size-4 eno-pop" : "mx-auto size-4 text-primary"} /><p className="mt-1 text-[12px] font-bold">{Math.round(percent)}%</p><p className={allDone ? "text-[9px] text-primary-foreground/80" : "text-[9px] text-muted-foreground"}>Selesai</p></div>
      </div><div className="mt-3 h-2 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-primary eno-progress" style={{ width: `${percent}%` }} /></div><p className={allDone ? "mt-2 text-[10px] font-semibold text-primary eno-pop" : "mt-2 text-[10px] text-muted-foreground"}>{target ? (allDone ? "Target hari ini selesai! 🎉" : `${completed} dari ${target} aktivitas selesai`) : "Planner sedang menyiapkan targetmu."}</p></CardContent></Card>
    </section>
    <section><div className="mb-2 flex items-center justify-between px-1"><h2 className="text-[13px] font-semibold">Rencana Belajar Hari Ini</h2><Sparkles className="size-4 text-primary eno-pulse-soft" /></div><div className="space-y-2">{tasks.length ? tasks.map(task => { const done = Math.min(task.completed_count, task.target_count), p = task.target_count ? Math.min(100, done / task.target_count * 100) : 0, isDone = task.target_count > 0 && done >= task.target_count, to: TaskRoute = taskLinks[task.task_type] ?? "/belajar"; return <Link key={task.id} to={to} className={isDone ? "block rounded-2xl border border-primary/25 bg-primary/[.035] p-3 transition hover:border-primary/35 eno-pop" : "block rounded-2xl border bg-card p-3 transition hover:border-primary/35 eno-rise"}><div className="flex items-center gap-3"><span className={isDone ? "grid size-8 shrink-0 place-items-center rounded-xl bg-primary text-primary-foreground" : "grid size-8 shrink-0 place-items-center rounded-xl bg-muted text-muted-foreground"}><CheckCircle2 className="size-4" /></span><div className="min-w-0 flex-1"><div className="flex items-center justify-between gap-2"><p className="truncate text-[12px] font-semibold">{adaptiveTaskLabels[task.task_type]}</p><span className="text-[10px] font-bold">{done}/{task.target_count}</span></div><div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-primary eno-progress" style={{ width: `${p}%` }} /></div><p className="mt-1 text-[9px] text-muted-foreground">{isDone ? "Selesai ✓" : task.reason || "Sesuai target belajar hari ini"}</p></div></div></Link>; }) : <Card className="rounded-2xl"><CardContent className="p-4 text-[11px] text-muted-foreground">Planner sedang menyiapkan rencana berdasarkan level dan targetmu.</CardContent></Card>}</div></section>
    <section><h2 className="mb-2 px-1 text-[13px] font-semibold">Quick Quiz</h2><div className="grid grid-cols-2 gap-2 sm:grid-cols-3">{quizzes.map(({ label, icon: Icon, slug }) => <Link key={label} to="/quiz/$slug" params={{ slug }} className="rounded-2xl border bg-card p-3 transition hover:border-primary/35 eno-rise"><Icon className="size-4 text-primary" /><p className="mt-2 text-[11px] font-semibold">{label}</p></Link>)}<Link to="/quiz" className="rounded-2xl border bg-card p-3 transition hover:border-primary/35 eno-rise"><RefreshCcw className="size-4 text-primary" /><p className="mt-2 text-[11px] font-semibold">Review Kesalahan{metrics.data?.errorReviewCount ? ` (${metrics.data.errorReviewCount})` : ""}</p></Link></div></section>
    <Card className="rounded-2xl border-primary/20 bg-primary/[0.04] eno-rise"><CardContent className="flex items-center gap-3 p-4"><span className="grid size-10 place-items-center rounded-2xl bg-primary/10 text-primary eno-pulse-soft"><Brain className="size-5" /></span><div className="min-w-0 flex-1"><p className="text-[12px] font-semibold">Spaced Repetition</p><p className="mt-0.5 text-[10px] text-muted-foreground">{metrics.data?.dueReviewCount ? `${metrics.data.dueReviewCount} materi sudah jatuh tempo untuk diulas.` : "Tidak ada materi yang jatuh tempo saat ini."}</p></div><Link to="/belajar" className="shrink-0 rounded-xl bg-primary px-3 py-2 text-[10px] font-semibold text-primary-foreground">{metrics.data?.dueReviewCount ? `Review ${metrics.data.dueReviewCount}` : "Review"}</Link></CardContent></Card>
    <section><h2 className="mb-2 px-1 text-[13px] font-semibold">Misi Harian</h2><Card className="rounded-2xl eno-rise"><CardContent className="divide-y p-1">{missionRows.map(m => { const done = m.target > 0 && m.done >= m.target; return <div key={m.label} className="flex items-center gap-3 px-3 py-2.5"><span className={done ? "grid size-7 place-items-center rounded-lg bg-primary text-primary-foreground" : "grid size-7 place-items-center rounded-lg bg-muted"}><CheckCircle2 className="size-3.5" /></span><p className="min-w-0 flex-1 text-[11px] font-medium">{m.label}</p><p className="text-[10px] font-bold text-primary">{m.target ? `${Math.min(m.done, m.target)}/${m.target}` : "—"}</p></div>; })}</CardContent></Card></section>
  </div></AppShell>;
}
