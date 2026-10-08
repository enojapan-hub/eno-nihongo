import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, BarChart3, BrainCircuit, Crown, RotateCcw, TriangleAlert } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { PremiumUpgradeDialog } from "@/components/membership/PremiumUpgradeDialog";
import { fetchGrammarList, fetchKanjiList, type Level } from "@/lib/learn-queries";
import { fetchTargetLevel } from "@/lib/target-level";
import { fetchVocabListResilient } from "@/lib/vocab-resilient";
import { masteryLabel } from "@/lib/mastery-analysis";
import { supabase } from "@/integrations/supabase/client";
import { getAuthUser } from "@/lib/auth-user";
import { fetchMembershipAccess } from "@/lib/membership";
import { useState } from "react";

export const Route = createFileRoute("/_authenticated/hafalan-riwayat")({
  head: () => ({ meta: [{ title: "Analisis Ingatan — ENO NIHONGO" }] }),
  component: HafalanHistoryPage,
});

type Review = {
  item_type: string;
  item_id: string;
  rating: number;
  aspect: string | null;
  used_hint: boolean | null;
  response_ms: number | null;
  created_at: string;
  meta: Record<string, unknown> | null;
};

async function fetchReviews(level: Level) {
  const { data: userData } = await getAuthUser();
  if (!userData.user) return [] as Review[];
  const { data, error } = await supabase
    .from("flashcard_reviews")
    .select("item_type,item_id,rating,aspect,used_hint,response_ms,created_at,meta")
    .eq("user_id", userData.user.id)
    .eq("level", level)
    .order("created_at", { ascending: false })
    .limit(500);
  if (error) throw error;
  return (data ?? []) as Review[];
}

type MemoryRow = {
  stage: number;
  due_at: string;
  overconfident_wrong: number;
  last_error_type: string | null;
};

async function fetchMemory() {
  const { data: userData } = await getAuthUser();
  if (!userData.user) return [] as MemoryRow[];
  const { data, error } = await supabase
    .from("memory_state")
    .select("stage,due_at,overconfident_wrong,last_error_type")
    .eq("user_id", userData.user.id);
  if (error) throw error;
  return (data ?? []) as MemoryRow[];
}

function dayKey(value: string) {
  return new Date(value).toLocaleDateString("id-ID", { weekday: "short", day: "numeric" });
}

function trainingAspect(aspect: string | null) {
  if (aspect === "meaning_reading") return "meaning";
  if (aspect === "meaning_usage") return "usage";
  if (aspect === "function_context") return "context";
  return aspect || "meaning";
}

function HafalanHistoryPage() {
  const [upgradeOpen, setUpgradeOpen] = useState(false);
  const membership = useQuery({ queryKey: ["membership-access"], queryFn: fetchMembershipAccess, staleTime: 60_000 });
  const hasPremiumAccess = membership.data?.hasPremiumAccess === true;
  const target = useQuery({ queryKey: ["target-level"], queryFn: fetchTargetLevel });
  const level = target.data as Level | undefined;
  const ready = !!level && hasPremiumAccess;
  const reviews = useQuery({
    queryKey: ["hafalan-history", level],
    queryFn: () => fetchReviews(level!),
    enabled: ready,
  });
  const memory = useQuery({
    queryKey: ["kioku-memory-report"],
    queryFn: fetchMemory,
    enabled: ready,
  });
  const kanji = useQuery({
    queryKey: ["history-kanji", level],
    queryFn: () => fetchKanjiList(level!),
    enabled: ready,
  });
  const vocab = useQuery({
    queryKey: ["history-vocab", level],
    queryFn: () => fetchVocabListResilient(level!),
    enabled: ready,
  });
  const grammar = useQuery({
    queryKey: ["history-grammar", level],
    queryFn: () => fetchGrammarList(level!),
    enabled: ready,
  });

  if (!membership.isLoading && !hasPremiumAccess)
    return (
      <AppShell compact title="Analisis Ingatan">
        <div className="mx-auto w-full max-w-md p-4">
          <section className="rounded-3xl border border-primary/20 bg-card p-6 text-center">
            <span className="mx-auto grid size-11 place-items-center rounded-2xl bg-primary/10 text-primary"><Crown className="size-5" /></span>
            <h1 className="mt-3 text-[16px] font-black">Analisis Ingatan adalah fitur Premium</h1>
            <p className="mt-1 text-[10px] leading-relaxed text-muted-foreground">Analisis retensi, keyakinan, dan kelemahan tersedia sebagai bagian dari ENO Kioku.</p>
            <button type="button" onClick={() => setUpgradeOpen(true)} className="mt-4 rounded-xl bg-primary px-4 py-2.5 text-[10px] font-bold text-primary-foreground">Lihat Premium</button>
          </section>
          <PremiumUpgradeDialog open={upgradeOpen} onOpenChange={setUpgradeOpen} feature="Analisis Ingatan" />
        </div>
      </AppShell>
    );

  if (!level)
    return (
      <AppShell compact title="Analisis Ingatan">
        <p className="p-6 text-center text-xs text-muted-foreground">Memuat level profil…</p>
      </AppShell>
    );

  const rows = reviews.data ?? [];
  const names = new Map<string, string>();
  for (const item of kanji.data ?? []) names.set(`kanji:${item.id}`, item.character ?? "Kanji");
  for (const item of vocab.data ?? []) names.set(`vocabulary:${item.id}`, item.term ?? "Kotoba");
  for (const item of grammar.data ?? []) names.set(`grammar:${item.id}`, item.pattern ?? "Bunpou");

  const flashcardRows = rows.filter((row) => row.meta?.["source"] !== "kioku");
  const kiokuRows = rows.filter((row) => row.meta?.["source"] === "kioku");
  const total = rows.length;
  const correct = rows.filter((row) => row.rating >= 2).length;
  const flashcardRemembered = flashcardRows.filter((row) => row.rating >= 2).length;
  const flashcardRetention = flashcardRows.length
    ? Math.round((flashcardRemembered / flashcardRows.length) * 100)
    : 0;
  const kiokuCorrect = kiokuRows.filter((row) => row.rating >= 2).length;
  const kiokuAccuracy = kiokuRows.length ? Math.round((kiokuCorrect / kiokuRows.length) * 100) : 0;
  const flashEasy = new Set(
    flashcardRows
      .filter((row) => row.rating >= 3)
      .map((row) => `${row.item_type}:${row.item_id}`),
  );
  const kiokuWrong = new Set(
    kiokuRows
      .filter((row) => row.rating < 2)
      .map((row) => `${row.item_type}:${row.item_id}`),
  );
  const falseMastery = [...flashEasy].filter((key) => kiokuWrong.has(key));
  const yakinWrong = kiokuRows.filter(
    (row) => row.meta?.["confidence"] === "yakin" && row.rating < 2,
  ).length;
  const raguCorrect = kiokuRows.filter(
    (row) => row.meta?.["confidence"] === "ragu" && row.rating >= 2,
  ).length;
  const memoryRows = memory.data ?? [];
  const now = Date.now();
  const memorySummary = {
    strong: memoryRows.filter((row) => row.stage >= 4).length,
    growing: memoryRows.filter((row) => row.stage >= 2 && row.stage < 4).length,
    weak: memoryRows.filter((row) => row.stage < 2).length,
    due: memoryRows.filter((row) => new Date(row.due_at).getTime() <= now).length,
    misconception: memoryRows.filter((row) => row.overconfident_wrong > 0).length,
  };
  const averageSeconds = total
    ? Math.round(rows.reduce((sum, row) => sum + Number(row.response_ms ?? 0), 0) / total / 1000)
    : 0;
  const daily = new Map<string, { label: string; total: number; correct: number }>();
  for (const row of rows.filter(
    (item) => Date.now() - new Date(item.created_at).getTime() < 7 * 86400000,
  )) {
    const key = new Date(row.created_at).toISOString().slice(0, 10);
    const stat = daily.get(key) ?? { label: dayKey(row.created_at), total: 0, correct: 0 };
    stat.total += 1;
    if (row.rating >= 2) stat.correct += 1;
    daily.set(key, stat);
  }
  const history = [...daily.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .slice(-7);
  const maxDaily = Math.max(1, ...history.map(([, stat]) => stat.total));

  const errors = new Map<
    string,
    {
      itemType: string;
      itemId: string;
      aspect: string;
      misses: number;
      attempts: number;
      lastAt: string;
    }
  >();
  for (const row of rows) {
    const aspect = row.aspect || "meaning";
    const key = `${row.item_type}:${row.item_id}:${aspect}`;
    const stat = errors.get(key) ?? {
      itemType: row.item_type,
      itemId: row.item_id,
      aspect,
      misses: 0,
      attempts: 0,
      lastAt: row.created_at,
    };
    stat.attempts += 1;
    if (row.rating < 2) stat.misses += 1;
    if (row.created_at > stat.lastAt) stat.lastAt = row.created_at;
    errors.set(key, stat);
  }
  const difficult = [...errors.values()]
    .filter((row) => row.misses > 0)
    .sort((left, right) => right.misses - left.misses || right.attempts - left.attempts)
    .slice(0, 10);

  return (
    <AppShell compact title="Analisis Ingatan">
      <div className="mx-auto w-full max-w-md space-y-3 pb-6">
        <a
          href="/kioku"
          className="inline-flex items-center gap-1.5 rounded-xl border bg-card px-3 py-2 text-[10px] font-bold"
        >
          <ArrowLeft className="size-4" /> Kembali ke Kioku
        </a>
        <section className="rounded-3xl border bg-gradient-to-b from-violet-50 to-card p-4 dark:bg-card dark:bg-none">
          <div className="flex items-center gap-3">
            <span className="grid size-11 place-items-center rounded-2xl bg-violet-100 text-violet-700 dark:bg-violet-500/15 dark:text-violet-300">
              <BarChart3 className="size-5" />
            </span>
            <div>
              <p className="text-[9px] font-bold uppercase tracking-widest text-primary">
                ENO KIOKU · ANALISIS
              </p>
              <h1 className="text-[18px] font-bold">Analisis Ingatan</h1>
              <p className="text-[9px] text-muted-foreground">
                {level} · retensi, keyakinan, kesalahan, dan kekuatan ingatan
              </p>
            </div>
          </div>
        </section>
        {reviews.isLoading ? (
          <p className="py-8 text-center text-[10px] text-muted-foreground">Menganalisis review…</p>
        ) : !total ? (
          <section className="rounded-3xl border bg-card p-6 text-center">
            <BrainCircuit className="mx-auto size-7 text-primary" />
            <p className="mt-2 text-[11px] font-bold">Belum ada data ingatan</p>
            <p className="mt-1 text-[9px] text-muted-foreground">
              Selesaikan beberapa latihan Kioku untuk melihat pola retensi dan kesalahan.
            </p>
            <a
              href="/kioku"
              className="mt-4 inline-block rounded-xl bg-primary px-4 py-2 text-[9px] font-bold text-primary-foreground"
            >
              Mulai Kioku
            </a>
          </section>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-2">
              <Metric label="Flashcard · Ingat/Mudah" value={`${flashcardRetention}%`} />
              <Metric label="Kioku · Jawaban benar" value={`${kiokuAccuracy}%`} />
            </div>
            <div className="grid grid-cols-5 gap-1.5">
              <Metric label="Kuat" value={memorySummary.strong} />
              <Metric label="Mulai kuat" value={memorySummary.growing} />
              <Metric label="Perlu diperkuat" value={memorySummary.weak} />
              <Metric label="Jatuh tempo" value={memorySummary.due} />
              <Metric label="Yakin tapi salah" value={memorySummary.misconception} />
            </div>
            <p className="text-center text-[8px] text-muted-foreground">
              {flashcardRows.length} Flashcard · {kiokuRows.length} Kioku · {total} aktivitas tersimpan · rata-rata respons {averageSeconds} dtk
            </p>
            {(falseMastery.length > 0 || yakinWrong > 0 || raguCorrect > 0) && (
              <section className="rounded-3xl border bg-card p-4">
                <h2 className="text-[12px] font-bold">Insight Ingatan</h2>
                <div className="mt-2 space-y-2 text-[9px] text-muted-foreground">
                  {falseMastery.length > 0 && (
                    <p>
                      <span className="font-bold text-foreground">{falseMastery.length} materi</span>{" "}
                      terasa Mudah di Flashcard tetapi masih salah saat diuji Kioku. Materi ini perlu
                      diuji kembali, bukan dianggap sudah kuat.
                    </p>
                  )}
                  {yakinWrong > 0 && (
                    <p>
                      <span className="font-bold text-foreground">{yakinWrong} jawaban</span> dipilih
                      dengan Yakin tetapi salah. Ini diprioritaskan sebagai kemungkinan miskonsepsi.
                    </p>
                  )}
                  {raguCorrect > 0 && (
                    <p>
                      <span className="font-bold text-foreground">{raguCorrect} jawaban</span> benar
                      meski Ragu. Ingatan ada, tetapi belum stabil sehingga interval naik lebih pelan.
                    </p>
                  )}
                </div>
                <a
                  href="/kioku"
                  className="mt-3 inline-flex rounded-xl bg-primary px-3 py-2 text-[8px] font-bold text-primary-foreground"
                >
                  Latih dengan Kioku
                </a>
              </section>
            )}
            <section className="rounded-3xl border bg-card p-4">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-[12px] font-bold">7 hari terakhir</h2>
                  <p className="text-[8px] text-muted-foreground">
                    Aktivitas latihan dan akurasi per hari
                  </p>
                </div>
                <span className="text-[9px] font-bold text-primary">
                  {correct}/{total} benar
                </span>
              </div>
              <div className="mt-4 flex h-24 items-end gap-2">
                {history.length ? (
                  history.map(([key, stat]) => (
                    <div key={key} className="flex min-w-0 flex-1 flex-col items-center gap-1">
                      <div className="flex h-16 w-full items-end rounded-lg bg-muted/70">
                        <div
                          className="w-full rounded-lg bg-primary/80"
                          style={{ height: `${Math.max(8, (stat.total / maxDaily) * 100)}%` }}
                        />
                      </div>
                      <span className="text-[8px] font-bold">{stat.label}</span>
                      <span className="text-[7px] text-muted-foreground">
                        {Math.round((stat.correct / stat.total) * 100)}%
                      </span>
                    </div>
                  ))
                ) : (
                  <p className="w-full text-center text-[9px] text-muted-foreground">
                    Belum ada aktivitas latihan dalam 7 hari terakhir.
                  </p>
                )}
              </div>
            </section>
            <section className="rounded-3xl border bg-card p-4">
              <div className="flex items-center gap-2">
                <span className="grid size-8 place-items-center rounded-xl bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300">
                  <TriangleAlert className="size-4" />
                </span>
                <div>
                  <h2 className="text-[12px] font-bold">Analisis Kesalahan</h2>
                  <p className="text-[8px] text-muted-foreground">
                    Materi yang paling sering perlu diulang
                  </p>
                </div>
              </div>
              <div className="mt-3 space-y-2">
                {difficult.map((item) => {
                  const name =
                    names.get(`${item.itemType}:${item.itemId}`) ??
                    masteryLabel(item.itemType, item.aspect);
                  const aspect = trainingAspect(item.aspect);
                  return (
                    <div
                      key={`${item.itemType}:${item.itemId}:${item.aspect}`}
                      className="flex items-center gap-2 rounded-2xl bg-muted/45 p-2.5"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-jp text-[13px] font-bold">{name}</p>
                        <p className="text-[8px] text-muted-foreground">
                          {masteryLabel(item.itemType, item.aspect)} · {item.misses}/{item.attempts}{" "}
                          belum hafal
                        </p>
                      </div>
                      <a
                        href="/kioku"
                        className="rounded-xl border bg-card px-2.5 py-2 text-[8px] font-bold"
                      >
                        Ulangi
                      </a>
                    </div>
                  );
                })}
              </div>
            </section>
            <a
              href="/kioku"
              className="flex items-center justify-center gap-2 rounded-2xl bg-primary py-3 text-[10px] font-bold text-primary-foreground"
            >
              <RotateCcw className="size-3.5" /> Kembali ke Kioku
            </a>
          </>
        )}
      </div>
    </AppShell>
  );
}

function Metric({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-2xl border bg-card p-3 text-center">
      <p className="text-[13px] font-black">{value}</p>
      <p className="mt-1 text-[8px] text-muted-foreground">{label}</p>
    </div>
  );
}
