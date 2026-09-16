import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, BarChart3, BrainCircuit, RotateCcw, TriangleAlert } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { fetchGrammarList, fetchKanjiList, type Level } from "@/lib/learn-queries";
import { fetchTargetLevel } from "@/lib/target-level";
import { fetchVocabListResilient } from "@/lib/vocab-resilient";
import { masteryLabel } from "@/lib/mastery-analysis";
import { masteryTrainingHref } from "@/lib/mastery-training";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/hafalan-riwayat")({
  head: () => ({ meta: [{ title: "Riwayat Hafalan — ENO NIHONGO" }] }),
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
};

async function fetchReviews(level: Level) {
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return [] as Review[];
  const { data, error } = await (supabase as any)
    .from("flashcard_reviews")
    .select("item_type,item_id,rating,aspect,used_hint,response_ms,created_at")
    .eq("user_id", userData.user.id)
    .eq("level", level)
    .order("created_at", { ascending: false })
    .limit(500);
  if (error) throw error;
  return (data ?? []) as Review[];
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
  const target = useQuery({ queryKey: ["target-level"], queryFn: fetchTargetLevel });
  const level = target.data as Level | undefined;
  const ready = !!level;
  const reviews = useQuery({
    queryKey: ["hafalan-history", level],
    queryFn: () => fetchReviews(level!),
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

  if (!level)
    return (
      <AppShell compact title="Riwayat Hafalan">
        <p className="p-6 text-center text-xs text-muted-foreground">Memuat level profil…</p>
      </AppShell>
    );

  const rows = reviews.data ?? [];
  const names = new Map<string, string>();
  for (const item of (kanji.data ?? []) as any[])
    names.set(`kanji:${item.id}`, item.character ?? "Kanji");
  for (const item of (vocab.data ?? []) as any[])
    names.set(`vocabulary:${item.id}`, item.term ?? "Kotoba");
  for (const item of (grammar.data ?? []) as any[])
    names.set(`grammar:${item.id}`, item.pattern ?? "Bunpou");

  const total = rows.length;
  const correct = rows.filter((row) => row.rating >= 2).length;
  const accuracy = total ? Math.round((correct / total) * 100) : 0;
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
    <AppShell compact title="Riwayat Hafalan">
      <div className="mx-auto w-full max-w-md space-y-3 pb-6">
        <a
          href="/hafalan"
          className="inline-flex items-center gap-1.5 rounded-xl border bg-card px-3 py-2 text-[10px] font-bold"
        >
          <ArrowLeft className="size-4" /> Kembali ke Hafalan
        </a>
        <section className="rounded-3xl border bg-gradient-to-b from-violet-50 to-card p-4">
          <div className="flex items-center gap-3">
            <span className="grid size-11 place-items-center rounded-2xl bg-violet-100 text-violet-700">
              <BarChart3 className="size-5" />
            </span>
            <div>
              <p className="text-[9px] font-bold uppercase tracking-widest text-primary">
                SRS Performance
              </p>
              <h1 className="text-[18px] font-bold">Riwayat Hafalan</h1>
              <p className="text-[9px] text-muted-foreground">
                {level} · hasil Hafalan, Rantai Ingatan, dan Jebakan Ingatan
              </p>
            </div>
          </div>
        </section>
        {reviews.isLoading ? (
          <p className="py-8 text-center text-[10px] text-muted-foreground">Menganalisis review…</p>
        ) : !total ? (
          <section className="rounded-3xl border bg-card p-6 text-center">
            <BrainCircuit className="mx-auto size-7 text-primary" />
            <p className="mt-2 text-[11px] font-bold">Belum ada riwayat hafalan</p>
            <p className="mt-1 text-[9px] text-muted-foreground">
              Selesaikan beberapa kartu untuk melihat pola performa dan kesalahan.
            </p>
            <a
              href="/hafalan"
              className="mt-4 inline-block rounded-xl bg-primary px-4 py-2 text-[9px] font-bold text-primary-foreground"
            >
              Mulai Hafalan
            </a>
          </section>
        ) : (
          <>
            <div className="grid grid-cols-3 gap-2">
              <Metric label="Review" value={total} />
              <Metric label="Akurasi" value={`${accuracy}%`} />
              <Metric label="Rata-rata" value={`${averageSeconds} dtk`} />
            </div>
            <section className="rounded-3xl border bg-card p-4">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-[12px] font-bold">7 hari terakhir</h2>
                  <p className="text-[8px] text-muted-foreground">
                    Jumlah review dan akurasi per hari
                  </p>
                </div>
                <span className="text-[9px] font-bold text-primary">
                  {correct}/{total} hafal
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
                    Belum ada review dalam 7 hari terakhir.
                  </p>
                )}
              </div>
            </section>
            <section className="rounded-3xl border bg-card p-4">
              <div className="flex items-center gap-2">
                <span className="grid size-8 place-items-center rounded-xl bg-rose-100 text-rose-700">
                  <TriangleAlert className="size-4" />
                </span>
                <div>
                  <h2 className="text-[12px] font-bold">Laporan kesalahan</h2>
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
                        href={masteryTrainingHref({ itemType: item.itemType, aspect })}
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
              href="/hafalan"
              className="flex items-center justify-center gap-2 rounded-2xl bg-primary py-3 text-[10px] font-bold text-primary-foreground"
            >
              <RotateCcw className="size-3.5" /> Lanjutkan Hafalan
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
