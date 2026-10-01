import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  ArrowRight,
  BookOpen,
  Brain,
  CalendarDays,
  CheckCircle2,
  Clock3,
  Crown,
  Flame,
  Headphones,
  Languages,
  Layers3,
  Pencil,
  Sparkles,
  Target,
  Trophy,
  Type,
  Zap,
} from "lucide-react";
import { getMyAccount } from "@/lib/profile.functions";
import { fetchAdaptivePlan } from "@/lib/adaptive-plan";
import { fetchLeaderboard } from "@/lib/leaderboard";
import { fetchDashboardMetrics, resolveContinueLesson } from "@/lib/dashboard-live";
import { getAccountLevel } from "@/lib/progression";
import { AppShell } from "@/components/layout/AppShell";
import { JlptStatusBar } from "@/components/layout/JlptStatusBar";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { LEVELS, type Level } from "@/lib/learn-queries";
import { fetchMembership } from "@/lib/membership";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { PremiumBadge } from "@/components/membership/PremiumBadge";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({ meta: [{ title: "Home — ENO NIHONGO" }] }),
  component: DashboardPage,
});

const materialMeta = [
  { key: "kanji", label: "Kanji", icon: Type },
  { key: "vocabulary", label: "Kosakata", icon: Languages },
  { key: "grammar", label: "Bunpou", icon: BookOpen },
  { key: "reading", label: "Dokkai", icon: CheckCircle2 },
  { key: "listening", label: "Choukai", icon: Headphones },
] as const;

function DashboardPage() {
  const [showPlannerUpgrade, setShowPlannerUpgrade] = useState(false);
  const fetchAccount = useServerFn(getMyAccount);
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["my-account"],
    queryFn: () => fetchAccount(),
  });
  const rawLevel = data?.profile?.target_level;
  const level: Level = LEVELS.includes(rawLevel as Level) ? (rawLevel as Level) : "N5";
  const adaptive = useQuery({
    queryKey: ["adaptive-plan"],
    queryFn: fetchAdaptivePlan,
    enabled: !isLoading && !isError,
    staleTime: 20_000,
  });
  const membership = useQuery({
    queryKey: ["membership"],
    queryFn: fetchMembership,
    enabled: !isLoading && !isError,
    staleTime: 30_000,
  });
  const leaderboard = useQuery({
    queryKey: ["leaderboard", 100],
    queryFn: () => fetchLeaderboard(100),
    enabled: !isLoading && !isError,
    staleTime: 30_000,
  });
  const metrics = useQuery({
    queryKey: ["dashboard-live", level],
    queryFn: fetchDashboardMetrics,
    enabled: !isLoading && !isError,
    staleTime: 20_000,
  });
  const continueLesson = useQuery({
    queryKey: ["continue-lesson", metrics.data?.last?.id],
    queryFn: () => resolveContinueLesson(metrics.data?.last ?? null),
    enabled: !!metrics.data?.last?.id,
    staleTime: 30_000,
  });
  const profile = data?.profile;
  const me = leaderboard.data?.find((u) => u.userId === profile?.id);
  const name = profile?.display_name?.trim() || "Pembelajar";
  const privilegedRole = ["owner", "admin", "editor", "teacher"].includes(profile?.role ?? "");
  const plannerLocked = !privilegedRole && membership.data?.plan === "free";
  const completed = adaptive.data?.completed ?? 0;
  const target = adaptive.data?.target ?? 0;
  const percent = target ? Math.min(100, (completed / target) * 100) : 0;
  const targetDone = target > 0 && completed >= target;
  const accountLevel = getAccountLevel(me?.xp ?? 0);
  const weekly = metrics.data?.weekly ?? [];
  const maxMinutes = Math.max(1, ...weekly.map((d) => d.minutes));
  const weeklyMinutes = weekly.reduce((s, d) => s + d.minutes, 0);
  const weeklyXp = weekly.reduce((s, d) => s + d.xp, 0);
  if (isLoading)
    return (
      <AppShell compact title="Home">
        <div className="space-y-3">
          <Skeleton className="h-32 w-full rounded-2xl" />
          <Skeleton className="h-24 w-full rounded-2xl" />
          <Skeleton className="h-40 w-full rounded-2xl" />
        </div>
      </AppShell>
    );
  if (isError)
    return (
      <AppShell compact title="Home">
        <Card>
          <CardContent className="p-5 text-sm">
            Data belum bisa dimuat.{" "}
            <button className="font-semibold text-primary" onClick={() => refetch()}>
              Coba lagi
            </button>
          </CardContent>
        </Card>
      </AppShell>
    );
  const hour = new Date().getHours();
  const greeting =
    hour < 11
      ? "Selamat pagi"
      : hour < 15
        ? "Selamat siang"
        : hour < 19
          ? "Selamat sore"
          : "Selamat malam";
  const todayLabel = new Intl.DateTimeFormat("id-ID", {
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(new Date());
  const quickActions = [
    { label: "Kioku", to: "/kioku", icon: Brain },
    { label: "Flashcard", to: "/flashcard", icon: Layers3 },
    { label: "Quiz", to: "/quiz", icon: CheckCircle2 },
    { label: "Simulasi", to: "/simulasi", icon: Trophy },
  ] as const;
  return (
    <AppShell compact title="Home">
      <div className="mx-auto max-w-3xl space-y-5 pb-6">
        <section className="flex items-center justify-between gap-3">
          <div className="min-w-0 flex items-center gap-3">
            <div className="relative shrink-0">
              {profile?.avatar_url ? (
                <img
                  src={profile.avatar_url}
                  alt={name}
                  className="size-12 rounded-2xl border object-cover"
                />
              ) : (
                <div className="grid size-12 place-items-center rounded-2xl bg-primary/10 text-base font-bold text-primary">
                  {name.slice(0, 1).toUpperCase()}
                </div>
              )}
            </div>
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground">{greeting},</p>
              <h1 className="truncate text-xl font-bold tracking-tight">{name}</h1>
              <p className="mt-0.5 text-[11px] capitalize text-muted-foreground">{todayLabel}</p>
            </div>
          </div>
          <Link
            to="/profil"
            className="grid size-10 shrink-0 place-items-center rounded-xl border bg-card text-muted-foreground transition-colors hover:border-primary/30 hover:text-primary"
            aria-label="Edit profil"
          >
            <Pencil className="size-4" />
          </Link>
        </section>

        <Card
          className={`overflow-hidden rounded-3xl border-primary/20 bg-gradient-to-br from-primary/[.10] via-card to-card shadow-sm ${plannerLocked ? "cursor-pointer" : ""}`}
          onClick={plannerLocked ? () => setShowPlannerUpgrade(true) : undefined}
          onKeyDown={
            plannerLocked
              ? (event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    setShowPlannerUpgrade(true);
                  }
                }
              : undefined
          }
          role={plannerLocked ? "button" : undefined}
          tabIndex={plannerLocked ? 0 : undefined}
        >
          <CardContent className="p-5 sm:p-6">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-bold uppercase tracking-wide text-primary">
                    Belajar Hari Ini
                  </span>
                  {plannerLocked && <PremiumBadge />}
                </div>
                <h2 className="mt-1.5 text-lg font-bold leading-snug">
                  {targetDone
                    ? "Target hari ini selesai"
                    : continueLesson.data?.title || "Mulai target belajar hari ini"}
                </h2>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">
                  {plannerLocked
                    ? "Buka Adaptive Study Planner dengan Premium."
                    : targetDone
                      ? "Bagus. Lanjutkan dengan review atau latihan tambahan."
                      : "Rencana belajar disesuaikan dengan progres dan target JLPT Anda."}
                </p>
              </div>
              <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-primary text-primary-foreground">
                {plannerLocked ? <Crown className="size-5" /> : <Target className="size-5" />}
              </span>
            </div>
            {!plannerLocked && (
              <>
                <div className="mt-4 h-2 overflow-hidden rounded-full bg-primary/10">
                  <div
                    className="h-full rounded-full bg-primary"
                    style={{ width: `${percent}%` }}
                  />
                </div>
                <div className="mt-2 flex items-center justify-between text-[10px] text-muted-foreground">
                  <span>{Math.round(percent)}% target selesai</span>
                  <span>
                    {completed}/{target || 0}
                  </span>
                </div>
                <Button asChild className="mt-4 h-10 w-full rounded-xl">
                  <Link to={(continueLesson.data?.to || "/target") as "/target"}>
                    {targetDone ? "Lihat Target Belajar" : "Lanjutkan Belajar"}
                    <ArrowRight className="ml-1.5 size-4" />
                  </Link>
                </Button>
              </>
            )}
          </CardContent>
        </Card>

        <section className="grid grid-cols-4 divide-x rounded-2xl border bg-card py-3">
          <CompactStat icon={Zap} value={(me?.xp ?? 0).toLocaleString("id-ID")} label="XP" />
          <CompactStat
            icon={Sparkles}
            value={(me?.points ?? 0).toLocaleString("id-ID")}
            label="Poin"
          />
          <CompactStat icon={Flame} value={String(me?.streak ?? 0)} label="Hari" />
          <CompactStat icon={Target} value={level} label="Target" />
        </section>
        <div className="px-1">
          <div className="flex items-center justify-between text-[10px]">
            <span className="font-semibold">Level akun {accountLevel.level}</span>
            <span className="text-muted-foreground">
              {accountLevel.xpToNext > 0
                ? `${accountLevel.xpToNext.toLocaleString("id-ID")} XP lagi`
                : "Level maksimum"}
            </span>
          </div>
          <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-primary"
              style={{ width: `${accountLevel.progress}%` }}
            />
          </div>
        </div>

        <section>
          <h2 className="mb-2 px-1 text-sm font-bold">Akses Cepat</h2>
          <div className="grid grid-cols-4 gap-2">
            {quickActions.map(({ label, to, icon: Icon }) => (
              <Link
                key={label}
                to={to}
                className="flex min-w-0 flex-col items-center gap-2 rounded-2xl border bg-card px-2 py-3 text-center transition-colors hover:border-primary/30 hover:bg-primary/[.03]"
              >
                <span className="grid size-9 place-items-center rounded-xl bg-primary/10 text-primary">
                  <Icon className="size-4" />
                </span>
                <span className="text-[11px] font-semibold">{label}</span>
              </Link>
            ))}
          </div>
        </section>

        <section>
          <div className="mb-2 flex items-center justify-between px-1">
            <div>
              <h2 className="text-sm font-bold">Progress Materi {level}</h2>
              <p className="text-[10px] text-muted-foreground">
                Perkembangan materi target JLPT Anda
              </p>
            </div>
            <Link to="/progress" className="text-[11px] font-semibold text-primary">
              Detail
            </Link>
          </div>
          <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 sm:grid sm:grid-cols-5 sm:overflow-visible">
            {materialMeta.map(({ key, label, icon: Icon }) => {
              const m = metrics.data?.progress?.[key] ?? { done: 0, total: 0 };
              const value = m.total ? Math.round((m.done / m.total) * 100) : 0;
              return (
                <div
                  key={key}
                  className="w-[112px] shrink-0 rounded-2xl border bg-card p-3 sm:w-auto"
                >
                  <div className="flex items-center justify-between">
                    <span className="grid size-8 place-items-center rounded-xl bg-primary/10 text-primary">
                      <Icon className="size-4" />
                    </span>
                    <span className="text-[10px] font-bold text-primary">
                      {m.total ? `${value}%` : "—"}
                    </span>
                  </div>
                  <p className="mt-2 text-xs font-semibold">{label}</p>
                  <p className="mt-0.5 text-[10px] text-muted-foreground">
                    {m.total ? `${m.done} / ${m.total} selesai` : "Belum tersedia"}
                  </p>
                  <div className="mt-2 h-1 overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-primary"
                      style={{ width: `${value}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        <Card className="rounded-3xl shadow-none">
          <CardContent className="p-4 sm:p-5">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-sm font-bold">Aktivitas Mingguan</h2>
                <p className="mt-0.5 text-[10px] text-muted-foreground">
                  {weeklyMinutes} menit · {weeklyXp.toLocaleString("id-ID")} XP minggu ini
                </p>
              </div>
              <Clock3 className="size-4 text-primary" />
            </div>
            {weekly.length ? (
              <div className="mt-4 grid h-[88px] grid-cols-7 gap-2">
                {weekly.map((day) => {
                  const date = new Date(`${day.date}T00:00:00+09:00`);
                  const label = new Intl.DateTimeFormat("id-ID", {
                    weekday: "short",
                    timeZone: "Asia/Tokyo",
                  })
                    .format(date)
                    .replace(".", "");
                  const barPx =
                    day.minutes > 0 ? Math.max(10, Math.round((day.minutes / maxMinutes) * 58)) : 3;
                  const isToday =
                    day.date ===
                    new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Tokyo" }).format(new Date());
                  return (
                    <div key={day.date} className="flex min-w-0 flex-col items-center">
                      <div
                        className="flex h-[62px] w-full max-w-7 items-end justify-center rounded-md bg-primary/[0.06]"
                        title={`${day.minutes} menit · ${day.xp} XP`}
                      >
                        <div
                          className="w-full rounded-t-md bg-primary/75"
                          style={{
                            height: `${barPx}px`,
                            minHeight: day.minutes > 0 ? "10px" : "3px",
                          }}
                        />
                      </div>
                      <span
                        className={`mt-1.5 text-[9px] ${isToday ? "font-bold text-primary" : "text-muted-foreground"}`}
                      >
                        {isToday ? "Hari ini" : label}
                      </span>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="mt-4 rounded-2xl bg-muted/40 p-4 text-center text-xs text-muted-foreground">
                Mulai belajar untuk melihat aktivitas mingguan Anda.
              </div>
            )}
          </CardContent>
        </Card>

        <section>
          <div className="mb-2 flex items-center gap-2 px-1">
            <CalendarDays className="size-4 text-primary" />
            <div>
              <h2 className="text-sm font-bold">JLPT</h2>
              <p className="text-[10px] text-muted-foreground">Jadwal dan hitung mundur ujian</p>
            </div>
          </div>
          <JlptStatusBar />
        </section>
        <Dialog open={showPlannerUpgrade} onOpenChange={setShowPlannerUpgrade}>
          <DialogContent className="w-[calc(100%-2rem)] max-w-sm rounded-3xl p-5">
            <DialogHeader className="text-left">
              <span className="grid size-11 place-items-center rounded-2xl bg-primary text-primary-foreground">
                <Crown className="size-5" />
              </span>
              <DialogTitle className="pt-2 text-lg font-black">
                Adaptive Planner adalah fitur Premium
              </DialogTitle>
              <DialogDescription className="text-xs leading-5">
                Premium menyusun target harian sesuai level, waktu belajar, dan progresmu—supaya
                kamu tahu apa yang perlu dipelajari berikutnya.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter className="gap-2 sm:flex-col sm:space-x-0">
              <Button asChild className="w-full rounded-xl">
                <Link to="/paket">Lihat Paket Premium</Link>
              </Button>
              <Button
                type="button"
                variant="outline"
                className="w-full rounded-xl"
                onClick={() => setShowPlannerUpgrade(false)}
              >
                Nanti saja
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </AppShell>
  );
}
function CompactStat({
  icon: Icon,
  value,
  label,
}: {
  icon: typeof Zap;
  value: string;
  label: string;
}) {
  return (
    <div className="min-w-0 px-1 text-center">
      <Icon className="mx-auto size-3.5 text-primary" />
      <p className="mt-1.5 truncate text-xs font-bold">{value}</p>
      <p className="mt-0.5 text-[9px] text-muted-foreground">{label}</p>
    </div>
  );
}
