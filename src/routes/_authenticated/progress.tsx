import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { BarChart3, BookOpen, CheckCircle2, Flame, Gauge, Target, Trophy } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";
import { getAuthUser } from "@/lib/auth-user";
import { levelReadiness, memoryReadiness, weeklyLearning } from "@/lib/kioku/insights";

export const Route = createFileRoute("/_authenticated/progress")({
  head: () => ({
    meta: [
      { title: "Progress — enonihongo" },
      { name: "description", content: "Pantau hasil belajar, XP, streak, dan performa JLPT." },
    ],
  }),
  component: ProgressPage,
});

type MemorySummary = {
  strong: number;
  growing: number;
  weak: number;
  due: number;
  readiness: ReturnType<typeof memoryReadiness>;
  weekly: ReturnType<typeof weeklyLearning>;
  levels: ReturnType<typeof levelReadiness>;
};
async function fetchMemorySummary(): Promise<MemorySummary> {
  const { data: userRes } = await getAuthUser();
  if (!userRes.user)
    return {
      strong: 0,
      growing: 0,
      weak: 0,
      due: 0,
      readiness: memoryReadiness([]),
      weekly: weeklyLearning([]),
      levels: levelReadiness([], []),
    };
  const [memory, reviews, progress] = await Promise.all([
    supabase.from("memory_state").select("item_type,item_id,stage,due_at").eq("user_id", userRes.user.id),
    supabase
      .from("flashcard_reviews")
      .select("rating,created_at,meta")
      .eq("user_id", userRes.user.id)
      .order("created_at", { ascending: false })
      .limit(500),
    supabase
      .from("user_item_progress")
      .select("item_type,item_id,level,status")
      .eq("user_id", userRes.user.id),
  ]);
  if (memory.error) throw memory.error;
  if (reviews.error) throw reviews.error;
  if (progress.error) throw progress.error;
  const now = Date.now();
  const rows = memory.data ?? [];
  const weeklyRows = (reviews.data ?? [])
    .filter((x) => {
      const meta = x.meta && typeof x.meta === "object" && !Array.isArray(x.meta) ? x.meta : {};
      return "source" in meta && meta["source"] === "kioku";
    })
    .map((x) => ({
      correct: x.rating >= 2,
      created_at: x.created_at,
    }));
  return {
    strong: rows.filter((x) => x.stage >= 4).length,
    growing: rows.filter((x) => x.stage >= 2 && x.stage < 4).length,
    weak: rows.filter((x) => x.stage < 2).length,
    due: rows.filter((x) => new Date(x.due_at).getTime() <= now).length,
    readiness: memoryReadiness(rows, now),
    weekly: weeklyLearning(weeklyRows, now),
    levels: levelReadiness(progress.data ?? [], rows, now),
  };
}

type Attempt = {
  id: string;
  level: string | null;
  skill: string | null;
  total_questions: number | null;
  correct_count: number | null;
  score: number | null;
  duration_seconds: number | null;
  xp_earned: number | null;
  created_at: string;
};

async function fetchProgress(): Promise<Attempt[]> {
  const { data: userRes, error: userError } = await getAuthUser();
  if (userError || !userRes.user) throw new Error("Sesi masuk tidak ditemukan.");
  const { data, error } = await supabase
    .from("quiz_attempts")
    .select(
      "id, level, skill, total_questions, correct_count, score, duration_seconds, xp_earned, created_at",
    )
    .eq("user_id", userRes.user.id)
    .order("created_at", { ascending: false })
    .limit(100);
  if (error) throw new Error(error.message);
  return (data ?? []) as Attempt[];
}

const skillLabels: Record<string, string> = {
  kanji: "Kanji",
  vocabulary: "Kotoba",
  grammar: "Bunpō",
  reading: "Dokkai",
  listening: "Chōkai",
};

function ProgressPage() {
  const memory = useQuery({ queryKey: ["progress-memory"], queryFn: fetchMemorySummary, staleTime: 30_000 });
  const {
    data: attempts = [],
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery({ queryKey: ["my-progress-attempts"], queryFn: fetchProgress, staleTime: 30_000 });
  if (isLoading)
    return (
      <AppShell title="Progress" description="Ringkasan perjalanan belajar kamu.">
        <div className="space-y-4">
          <Skeleton className="h-32 w-full rounded-3xl" />
          <div className="grid gap-3 sm:grid-cols-3">
            <Skeleton className="h-28 rounded-2xl" />
            <Skeleton className="h-28 rounded-2xl" />
            <Skeleton className="h-28 rounded-2xl" />
          </div>
        </div>
      </AppShell>
    );
  if (isError)
    return (
      <AppShell title="Progress">
        <Card>
          <CardHeader>
            <CardTitle>Progress tidak dapat dimuat</CardTitle>
            <CardDescription>{(error as Error).message}</CardDescription>
          </CardHeader>
          <CardContent>
            <button
              className="rounded-xl border px-4 py-2 text-sm font-semibold"
              onClick={() => void refetch()}
            >
              Coba lagi
            </button>
          </CardContent>
        </Card>
      </AppShell>
    );

  const totalAttempts = attempts.length;
  const totalXp = attempts.reduce((sum, a) => sum + Number(a.xp_earned ?? 0), 0);
  const answered = attempts.reduce((sum, a) => sum + Number(a.total_questions ?? 0), 0);
  const correct = attempts.reduce((sum, a) => sum + Number(a.correct_count ?? 0), 0);
  const average = answered ? Math.round((correct / answered) * 100) : 0;
  const best = attempts.length ? Math.max(...attempts.map((a) => Number(a.score ?? 0))) : 0;
  const activeDays = new Set(
    attempts.map((a) => new Date(a.created_at).toISOString().slice(0, 10)),
  );
  const byLevel = ["N5", "N4", "N3", "N2", "N1"].map((level) => {
    const rows = attempts.filter((a) => a.level === level);
    const total = rows.reduce((s, a) => s + Number(a.total_questions ?? 0), 0);
    const right = rows.reduce((s, a) => s + Number(a.correct_count ?? 0), 0);
    return { level, attempts: rows.length, score: total ? Math.round((right / total) * 100) : 0 };
  });
  const bySkill = Object.entries(skillLabels).map(([key, label]) => {
    const rows = attempts.filter((a) => a.skill === key);
    const total = rows.reduce((s, a) => s + Number(a.total_questions ?? 0), 0);
    const right = rows.reduce((s, a) => s + Number(a.correct_count ?? 0), 0);
    return {
      key,
      label,
      attempts: rows.length,
      score: total ? Math.round((right / total) * 100) : 0,
    };
  });

  return (
    <AppShell
      title="Progress"
      description="Lihat hasil latihan, XP, konsistensi, dan performa tiap level."
    >
      <div className="space-y-5">
        <section className="rounded-[28px] border border-primary/20 bg-gradient-to-br from-primary/15 via-background to-background p-5 shadow-sm sm:p-7">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-primary">
                Perjalanan belajar
              </p>
              <h1 className="mt-1 text-2xl font-bold tracking-tight sm:text-3xl">Progress kamu</h1>
              <p className="mt-2 max-w-xl text-sm leading-6 text-muted-foreground">
                Setiap quiz yang selesai tersimpan di akun dan dihitung ke statistik berikut.
              </p>
            </div>
            <div className="hidden rounded-2xl bg-primary/10 p-3 text-primary sm:block">
              <Gauge className="size-7" />
            </div>
          </div>
          <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Stat
              icon={<Trophy className="size-4" />}
              label="XP"
              value={totalXp.toLocaleString("id-ID")}
            />
            <Stat
              icon={<CheckCircle2 className="size-4" />}
              label="Akurasi"
              value={`${average}%`}
            />
            <Stat icon={<Target className="size-4" />} label="Quiz" value={String(totalAttempts)} />
            <Stat
              icon={<Flame className="size-4" />}
              label="Hari aktif"
              value={String(activeDays.size)}
            />
          </div>
        </section>
        <Card className="rounded-3xl">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Gauge className="size-4 text-primary" /> Kekuatan ingatan
            </CardTitle>
            <CardDescription>Ringkasan Kioku berdasarkan aspek yang benar-benar sudah diuji.</CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <MemoryStat label="Ingat kuat" value={memory.data?.strong ?? 0} />
            <MemoryStat label="Mulai kuat" value={memory.data?.growing ?? 0} />
            <MemoryStat label="Perlu diperkuat" value={memory.data?.weak ?? 0} />
            <MemoryStat label="Jatuh tempo" value={memory.data?.due ?? 0} />
          </CardContent>
        </Card>
        <Card className="rounded-3xl">
          <CardHeader>
            <CardTitle className="text-base">Kesiapan materi per level</CardTitle>
            <CardDescription>
              Hanya menghitung materi yang sudah dipelajari dan pernah diuji Kioku.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-5 gap-2">
            {(memory.data?.levels ?? []).map((row) => (
              <div key={row.level} className="rounded-2xl bg-muted/30 px-2 py-3 text-center">
                <p className="text-[10px] font-bold text-muted-foreground">{row.level}</p>
                <p className="mt-1 text-lg font-black">{row.score}%</p>
                <p className="mt-0.5 truncate text-[8px] text-primary">{row.label}</p>
              </div>
            ))}
          </CardContent>
        </Card>
        <div className="grid gap-4 lg:grid-cols-2">
          <Card className="rounded-3xl">
            <CardHeader>
              <CardTitle className="text-base">Laporan 7 hari</CardTitle>
              <CardDescription>Aktivitas Kioku tujuh hari terakhir.</CardDescription>
            </CardHeader>
            <CardContent className="grid grid-cols-3 gap-2">
              <MemoryStat label="Review" value={memory.data?.weekly.reviews ?? 0} />
              <MemoryStat label="Akurasi" value={memory.data?.weekly.accuracy ?? 0} suffix="%" />
              <MemoryStat label="Hari aktif" value={memory.data?.weekly.activeDays ?? 0} />
            </CardContent>
          </Card>
          <Card className="rounded-3xl">
            <CardHeader>
              <CardTitle className="text-base">Kesiapan materi</CardTitle>
              <CardDescription>
                Berdasarkan aspek yang sudah diuji Kioku. Ini bukan prediksi kelulusan JLPT.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-end justify-between gap-3">
                <div>
                  <p className="text-3xl font-black">{memory.data?.readiness.score ?? 0}%</p>
                  <p className="mt-1 text-xs font-semibold text-primary">
                    {memory.data?.readiness.label ?? "Belum cukup data"}
                  </p>
                </div>
                <p className="text-right text-[10px] leading-relaxed text-muted-foreground">
                  {memory.data?.readiness.strong ?? 0} aspek kuat
                  <br />
                  {memory.data?.readiness.due ?? 0} jatuh tempo
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
        <div className="grid gap-4 lg:grid-cols-2">
          <Card className="rounded-3xl">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <BarChart3 className="size-4 text-primary" />
                Performa JLPT
              </CardTitle>
              <CardDescription>Akumulasi jawaban benar berdasarkan level.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {byLevel.map((row) => (
                <div key={row.level}>
                  <div className="mb-1.5 flex items-center justify-between text-sm">
                    <span className="font-semibold">{row.level}</span>
                    <span className="text-muted-foreground">
                      {row.attempts} quiz · {row.score}%
                    </span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-primary transition-all"
                      style={{ width: `${row.score}%` }}
                    />
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
          <Card className="rounded-3xl">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <BookOpen className="size-4 text-primary" />
                Kemampuan
              </CardTitle>
              <CardDescription>Performa berdasarkan jenis latihan.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3 sm:grid-cols-2">
              {bySkill.map((row) => (
                <div key={row.key} className="rounded-2xl border bg-muted/20 p-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-semibold">{row.label}</span>
                    <span className="text-sm font-bold text-primary">{row.score}%</span>
                  </div>
                  <p className="mt-1 text-[11px] text-muted-foreground">{row.attempts} percobaan</p>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
        <Card className="rounded-3xl">
          <CardHeader>
            <CardTitle className="text-base">Riwayat terbaru</CardTitle>
            <CardDescription>Hasil quiz terakhir yang tersimpan.</CardDescription>
          </CardHeader>
          <CardContent>
            {attempts.length === 0 ? (
              <div className="rounded-2xl border border-dashed p-8 text-center">
                <p className="font-semibold">Belum ada riwayat quiz</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Selesaikan satu latihan dari menu Quiz untuk mulai mengisi progress.
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {attempts.slice(0, 10).map((a) => (
                  <div
                    key={a.id}
                    className="flex items-center justify-between gap-3 rounded-2xl border bg-muted/10 p-3"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold">{a.level ?? "—"}</span>
                        {a.skill && (
                          <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary">
                            {skillLabels[a.skill] ?? a.skill}
                          </span>
                        )}
                      </div>
                      <p className="mt-1 text-[11px] text-muted-foreground">
                        {new Date(a.created_at).toLocaleString("id-ID", {
                          dateStyle: "medium",
                          timeStyle: "short",
                        })}{" "}
                        · {a.correct_count ?? 0}/{a.total_questions ?? 0} benar
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-bold">{Number(a.score ?? 0)}%</p>
                      <p className="text-[10px] text-muted-foreground">
                        +{Number(a.xp_earned ?? 0)} XP
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
        {attempts.length > 0 && (
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-2xl border bg-muted/10 p-4">
              <p className="text-xs text-muted-foreground">Skor terbaik</p>
              <p className="mt-1 text-2xl font-bold">{best}%</p>
            </div>
            <div className="rounded-2xl border bg-muted/10 p-4">
              <p className="text-xs text-muted-foreground">Total soal dijawab</p>
              <p className="mt-1 text-2xl font-bold">{answered.toLocaleString("id-ID")}</p>
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}

function Stat({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-2xl border bg-background/70 p-3">
      <div className="flex items-center gap-1.5 text-muted-foreground">
        {icon}
        <span className="text-[10px] font-semibold uppercase tracking-wide">{label}</span>
      </div>
      <p className="mt-1 text-lg font-bold tracking-tight">{value}</p>
    </div>
  );
}

function MemoryStat({ label, value, suffix = "" }: { label: string; value: number; suffix?: string }) {
  return <div className="rounded-2xl bg-muted/30 p-3 text-center"><p className="text-xl font-black">{value}{suffix}</p><p className="mt-1 text-[10px] text-muted-foreground">{label}</p></div>;
}
