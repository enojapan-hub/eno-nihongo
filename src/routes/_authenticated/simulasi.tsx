import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowRight,
  BookOpen,
  CheckCircle2,
  Crown,
  Headphones,
  Languages,
  ListChecks,
  Sparkles,
  Timer,
  Type,
} from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";
import { fetchFullSimulationAccess } from "@/lib/membership";
import { fetchTargetLevel } from "@/lib/target-level";
import { PremiumBadge } from "@/components/membership/PremiumBadge";
import { supabase } from "@/integrations/supabase/client";
import { EXAM_NUMBERS } from "@/lib/jlpt-simulation-config";
async function fetchExamNumbers(level: string): Promise<number[]> {
  const { data, error } = await supabase.rpc("get_simulation_exam_numbers", {
    p_level: level,
  });
  if (error) throw error;
  return (data ?? []).map((x: unknown) =>
    Number(typeof x === "object" && x ? Object.values(x)[0] : x),
  );
}
export const Route = createFileRoute("/_authenticated/simulasi")({ component: SimulationPage });
const sections = [
  {
    key: "vocabulary",
    jp: "文字・語彙",
    label: "Kanji & Kosakata",
    icon: Type,
    tone: "bg-emerald-50 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-300",
  },
  {
    key: "grammar",
    jp: "文法",
    label: "Bunpou",
    icon: Languages,
    tone: "bg-amber-50 text-amber-600 dark:bg-amber-500/15 dark:text-amber-300",
  },
  {
    key: "reading",
    jp: "読解",
    label: "Dokkai",
    icon: BookOpen,
    tone: "bg-sky-50 text-sky-600 dark:bg-sky-500/15 dark:text-sky-300",
  },
  {
    key: "listening",
    jp: "聴解",
    label: "Choukai",
    icon: Headphones,
    tone: "bg-rose-50 text-rose-500 dark:bg-rose-500/15 dark:text-rose-300",
  },
] as const;
function SimulationPage() {
  const target = useQuery({ queryKey: ["target-level"], queryFn: fetchTargetLevel, retry: 1 });
  const level = target.data ?? "N5";
  const access = useQuery({
    queryKey: ["full-simulation-access"],
    queryFn: fetchFullSimulationAccess,
    staleTime: 30000,
  });
  const a = access.data;
  const exams = useQuery({
    queryKey: ["simulation-exam-numbers", level],
    queryFn: () => fetchExamNumbers(level),
    enabled: !target.isLoading,
    staleTime: 5 * 60 * 1000,
  });
  const available = new Set(exams.data ?? [1]);
  return (
    <AppShell title="Simulasi JLPT" compact>
      <div className="mx-auto max-w-2xl pb-8">
        <section className="overflow-hidden rounded-3xl border border-primary/15 bg-gradient-to-br from-primary/15 via-card to-card p-5 shadow-sm sm:p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="mb-2 inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-2.5 py-1 text-[10px] font-bold text-primary">
                <Sparkles className="size-3" />
                PUSAT UJIAN JLPT
              </div>
              <h1 className="text-2xl font-bold tracking-tight">Simulasi JLPT {level}</h1>
              <p className="mt-1 max-w-md text-xs leading-5 text-muted-foreground">
                Latih setiap bagian atau kerjakan simulasi penuh dengan format ujian yang
                terstruktur.
              </p>
            </div>
            <div className="grid size-12 shrink-0 place-items-center rounded-2xl bg-primary text-primary-foreground shadow-sm">
              <span className="text-sm font-black">{level}</span>
            </div>
          </div>
          <div className="mt-4 flex items-center gap-2 text-[10px] text-muted-foreground">
            <CheckCircle2 className="size-3.5 text-primary" />
            <span>Level mengikuti target JLPT di profil Anda</span>
          </div>
        </section>
        {target.isLoading ? (
          <p className="py-8 text-center text-xs text-muted-foreground">Memuat level profil…</p>
        ) : target.isError ? (
          <p className="py-8 text-center text-xs text-destructive">
            Level profil tidak dapat dimuat.
          </p>
        ) : (
          <>
            <div className="mb-2 mt-5 flex items-end justify-between">
              <div>
                <h2 className="text-sm font-bold">Latihan per Bagian</h2>
                <p className="text-[10px] text-muted-foreground">
                  Fokuskan latihan pada kemampuan tertentu.
                </p>
              </div>
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              {sections.map(({ key, jp, label, icon: Icon, tone }) => (
                <Link
                  key={key}
                  to="/simulasi-bagian/$level/$section"
                  params={{ level, section: key }}
                  className="group flex items-center gap-3 rounded-2xl border bg-card px-3.5 py-3.5 transition-colors hover:border-primary/30 hover:bg-primary/[.03]"
                >
                  <span className={`grid size-8 place-items-center rounded-lg ${tone}`}>
                    <Icon className="size-4" />
                  </span>
                  <span className="flex-1">
                    <span className="block font-jp text-[13px] font-bold">{jp}</span>
                    <span className="text-[10px] text-muted-foreground">
                      {label} {level}
                    </span>
                  </span>
                  <ArrowRight className="size-4 text-muted-foreground" />
                </Link>
              ))}
            </div>
            <section className="mt-5 rounded-3xl border bg-card p-5 shadow-sm">
              <div className="flex items-start justify-between">
                <div>
                  <h2 className="text-[15px] font-bold">Simulasi Penuh JLPT {level}</h2>
                  <p className="mt-1 text-[10px] leading-4 text-muted-foreground">
                    Kerjakan seluruh bagian dalam satu alur ujian.
                  </p>
                </div>
                <span className="rounded-full bg-primary/10 px-2 py-1 text-[9px] font-bold text-primary">
                  FREE
                </span>
              </div>
              <div className="mt-3 space-y-2 text-[11px]">
                <div className="flex items-center gap-2">
                  <Timer className="size-3.5 text-primary" />
                  <span>Waktu mengikuti format level {level}</span>
                </div>
                <div className="flex items-center gap-2">
                  <ListChecks className="size-3.5 text-primary" />
                  <span>Free: simulasi penuh tanpa batas selama tahap pengembangan</span>
                </div>
                <div className="flex items-center gap-2">
                  <Crown className="size-3.5 text-primary" />
                  <span>Premium & Lifetime: fitur premium akan terus ditambahkan</span>
                </div>
              </div>
              <div className="mt-4 grid grid-cols-5 gap-2">
                {EXAM_NUMBERS.map((n) =>
                  available.has(n) ? (
                    <Button key={n} asChild className="h-10 rounded-full px-0 text-[11px]">
                      <Link
                        to="/simulasi-penuh/$level"
                        params={{ level }}
                        search={{ exam: n }}
                        aria-label={`Mulai Simulasi ${level} #${String(n).padStart(2, "0")}`}
                      >
                        #{String(n).padStart(2, "0")}
                      </Link>
                    </Button>
                  ) : (
                    <Button
                      key={n}
                      disabled
                      variant="outline"
                      className="h-10 rounded-full px-0 text-[11px]"
                    >
                      #{String(n).padStart(2, "0")}
                    </Button>
                  ),
                )}
              </div>
              <p className="mt-2 text-center text-[9px] text-muted-foreground">
                Pilih nomor ujian untuk memulai simulasi penuh.
              </p>
            </section>
            <section className="mt-4 rounded-3xl border border-primary/20 bg-gradient-to-br from-primary/[.08] to-card p-5">
              <div className="flex items-center gap-2">
                <Crown className="size-4 text-primary" />
                <h2 className="text-[12px] font-bold">ENO Monthly Exam {level}</h2>
                {!a?.monthlyExam && <PremiumBadge />}
              </div>
              <p className="mt-1 text-[10px] leading-4 text-muted-foreground">
                Ujian bulanan mengikuti level profil.
              </p>
              {a?.monthlyExam ? (
                <Button className="mt-3 h-9 w-full rounded-full text-[10px]">
                  Ikuti Monthly Exam
                </Button>
              ) : (
                <Button asChild className="mt-3 h-9 w-full rounded-full text-[10px]">
                  <Link to="/paket">Buka dengan Premium</Link>
                </Button>
              )}
            </section>
          </>
        )}
      </div>
    </AppShell>
  );
}
