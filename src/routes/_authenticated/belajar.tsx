import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  BookOpen,
  ChevronRight,
  FileText,
  Headphones,
  Layers,
  NotebookTabs,
  PlayCircle,
  Search,
  Sparkles,
  Tags,
  X,
} from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { DailyNewLimit } from "@/components/learn/DailyNewLimit";
import { FeatureGuide } from "@/components/learn/FeatureGuide";
import { fetchGrammarList, fetchKanjiList, fetchMyProgress, type Level } from "@/lib/learn-queries";
import { fetchVocabCategoryCount, fetchVocabListResilient } from "@/lib/vocab-resilient";
import { VOCAB_PRIMARY_CATEGORIES } from "@/lib/vocabulary-taxonomy";
import { fetchTargetLevel } from "@/lib/target-level";
import { supabase } from "@/integrations/supabase/client";
import {
  fetchContinueLearning,
  kindLabel,
  type ContinueItem,
} from "@/lib/learning-hub";
export const Route = createFileRoute("/_authenticated/belajar")({
  head: () => ({ meta: [{ title: "Materi — ENO NIHONGO" }] }),
  component: BelajarPage,
});
const norm = (v: unknown) =>
  String(v ?? "")
    .toLocaleLowerCase()
    .trim();
const pct = (a: number, b: number) => (b ? Math.min(100, Math.round((a / b) * 100)) : 0);
type CategoryCountRow = { category_slug: string; item_count: number | string };
async function fetchExtra(level: Level) {
  const batch = await supabase.rpc(
    "get_vocabulary_primary_category_counts" as never,
    { p_level: level } as never,
  );
  const batchRows = batch.error ? null : (batch.data as unknown as CategoryCountRow[] | null);
  const bySlug = new Map((batchRows ?? []).map((r) => [r.category_slug, Number(r.item_count)]));
  const counts = batchRows
    ? VOCAB_PRIMARY_CATEGORIES.map((x) => bySlug.get(x.slug) ?? 0)
    : await Promise.all(
        VOCAB_PRIMARY_CATEGORIES.map((x) => fetchVocabCategoryCount(level, x.slug)),
      );
  return {
    categories: VOCAB_PRIMARY_CATEGORIES.map((x, i) => ({
      slug: x.slug,
      labelJa: x.labelJa,
      label: x.label,
      hint: x.hint,
      count: counts[i] ?? 0,
    })),
  };
}
function BelajarPage() {
  const [search, setSearch] = useState(() =>
      typeof window === "undefined" ? "" : (sessionStorage.getItem("eno:materi:search") ?? ""),
    ),
    [online, setOnline] = useState(() => typeof navigator === "undefined" || navigator.onLine);
  const target = useQuery({ queryKey: ["target-level"], queryFn: fetchTargetLevel, retry: 1 });
  const level = target.data as Level | undefined;
  const ready = !!level;
  const kanji = useQuery({
    queryKey: ["materi-kanji", level],
    queryFn: () => fetchKanjiList(level!),
    enabled: ready,
  });
  const vocab = useQuery({
    queryKey: ["materi-vocab", level],
    queryFn: () => fetchVocabListResilient(level!),
    enabled: ready,
    retry: 1,
  });
  const grammar = useQuery({
    queryKey: ["materi-grammar", level],
    queryFn: () => fetchGrammarList(level!),
    enabled: ready,
  });
  const progress = useQuery({
    queryKey: ["my-progress"],
    queryFn: fetchMyProgress,
    enabled: ready,
  });
  // Sepuluh kategori baku dimuat saat bagian Kotoba Tambahan mendekati layar.
  const [extraNear, setExtraNear] = useState(false);
  const extraRef = useCallback((node: HTMLElement | null) => {
    if (!node) return;
    if (typeof IntersectionObserver === "undefined") {
      setExtraNear(true);
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setExtraNear(true);
          observer.disconnect();
        }
      },
      { rootMargin: "600px 0px" },
    );
    observer.observe(node);
  }, []);
  const extra = useQuery({
    queryKey: ["materi-extra-vocab", level],
    queryFn: () => fetchExtra(level!),
    enabled: ready && extraNear,
  });
  const cont = useQuery({
    queryKey: ["hub-continue", level],
    queryFn: () => fetchContinueLearning(level!),
    enabled: ready,
    staleTime: 15000,
  });
  const rows = progress.data?.progress ?? [];
  const learned = (t: string) =>
    rows.filter(
      (r) =>
        r.level === level &&
        r.item_type === t &&
        (r.status === "learning" || r.status === "review" || r.status === "mastered"),
    ).length;
  useEffect(() => {
    sessionStorage.setItem("eno:materi:search", search);
  }, [search]);
  useEffect(() => {
    const sync = () => setOnline(navigator.onLine);
    window.addEventListener("online", sync);
    window.addEventListener("offline", sync);
    return () => {
      window.removeEventListener("online", sync);
      window.removeEventListener("offline", sync);
    };
  }, []);
  const q = norm(search);
  const results = useMemo(() => {
    if (!q) return [];
    const out: Array<{ type: string; title: string; sub: string; to: string }> = [];
    for (const x of kanji.data ?? [])
      if ([x.character, x.meaning_id, x.onyomi, x.kunyomi].some((v) => norm(v).includes(q)))
        out.push({ type: "Kanji", title: x.character, sub: x.meaning_id, to: `/kanji?id=${x.id}` });
    for (const x of vocab.data ?? [])
      if ([x.term, x.reading, x.romaji, x.meaning_id].some((v) => norm(v).includes(q)))
        out.push({
          type: "Kosakata",
          title: x.term,
          sub: [x.reading, x.meaning_id].filter(Boolean).join(" · "),
          to: `/kotoba?id=${x.id}`,
        });
    for (const x of grammar.data ?? [])
      if ([x.pattern, x.meaning_id, x.structure].some((v) => norm(v).includes(q)))
        out.push({ type: "Bunpou", title: x.pattern, sub: x.meaning_id, to: `/bunpo?id=${x.id}` });
    return out.slice(0, 30);
  }, [q, kanji.data, vocab.data, grammar.data]);
  const cards = [
    {
      to: "/kotoba",
      label: "Kotoba",
      icon: BookOpen,
      tone: "bg-rose-100 text-rose-600",
      meta: `${vocab.data?.length ?? 0} kata · ${learned("vocabulary")} dipelajari`,
      total: vocab.data?.length ?? 0,
      done: learned("vocabulary"),
      showLevel: true,
    },
    {
      to: "/kanji",
      label: "Kanji",
      icon: "井",
      tone: "bg-emerald-100 text-emerald-700",
      meta: `${kanji.data?.length ?? 0} kanji · ${learned("kanji")} dipelajari`,
      total: kanji.data?.length ?? 0,
      done: learned("kanji"),
      showLevel: true,
    },
    {
      to: "/bunpo",
      label: "Bunpou",
      icon: FileText,
      tone: "bg-blue-100 text-blue-600",
      meta: `${grammar.data?.length ?? 0} pola · ${learned("grammar")} dipelajari`,
      total: grammar.data?.length ?? 0,
      done: learned("grammar"),
      showLevel: true,
    },
  ] as const;
  return (
    <AppShell compact title="Materi">
      <div className="mx-auto w-full max-w-lg pb-[max(1rem,env(safe-area-inset-bottom))]">
        {!online && (
          <div
            role="status"
            className="mb-3 rounded-xl border border-amber-300/60 bg-amber-50 px-3 py-2 text-[11px] font-semibold text-amber-900 dark:bg-amber-500/10 dark:text-amber-200"
          >
            Kamu sedang offline. Materi yang belum tersimpan mungkin tidak dapat diperbarui.
          </div>
        )}
        <section className="mb-3">
          <div className="flex items-center justify-between gap-3">
            <h1 className="text-[22px] font-black tracking-tight">Materi</h1>
        <div className="mb-3 flex justify-end">
            <FeatureGuide
              storageKey="eno:guide:materi:v1"
              title="Mulai dari Materi"
              intro="Materi adalah titik awal belajar. Pahami dulu isinya, lalu tandai progresmu agar latihan berikutnya tahu apa yang sudah kamu pelajari."
              steps={[
                {
                  title: "Pelajari Kanji, Kotoba, atau Bunpou",
                  body: "Buka materi sesuai target JLPT dan pahami arti, bacaan, penggunaan, serta contohnya.",
                },
                {
                  title: "Tandai Dipelajari",
                  body: "Setelah memahami sebuah materi, tekan Dipelajari. Materi itu masuk ke pool yang dapat diuji oleh Kioku.",
                },
                {
                  title: "Hafalkan lalu uji",
                  body: "Gunakan Flashcard untuk membangun hafalan. Gunakan Kioku untuk menguji apakah materi yang sudah dipelajari masih benar-benar kamu ingat.",
                },
              ]}
            />
        </div>
          </div>
          <div className="mt-1 flex items-center justify-between gap-3">
            <p className="text-[11px] leading-4 text-muted-foreground">
              Belajar terarah sesuai target JLPT di Profil
            </p>
            {level && (
              <span className="shrink-0 rounded-full bg-primary/10 px-2.5 py-1 text-[10px] font-bold text-emerald-800 dark:text-primary">
                {level}
              </span>
            )}
          </div>
        </section>
        {target.isLoading ? (
          <p className="py-8 text-center text-xs text-muted-foreground">Memuat level profil…</p>
        ) : !level ? (
          <p className="rounded-xl border p-3 text-center text-[11px] text-destructive">
            Atur target JLPT di Profil terlebih dahulu.
          </p>
        ) : (
          <>
            <div className="relative mb-3">
              <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={`Cari kanji, kosakata, atau bunpou ${level}...`}
                className="h-12 w-full rounded-2xl border bg-card pl-10 pr-10 text-[13px] shadow-sm outline-none transition-shadow focus-visible:ring-2 focus-visible:ring-primary motion-reduce:transition-none"
              />
              {search && (
                <button
                  type="button"
                  aria-label="Hapus pencarian"
                  onClick={() => setSearch("")}
                  className="absolute right-1 top-1/2 grid size-10 -translate-y-1/2 place-items-center rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                >
                  <X className="size-4 text-muted-foreground" />
                </button>
              )}
            </div>
            {q ? (
              <section className="space-y-1.5">
                {results.length ? (
                  results.map((r, i) => (
                    <Link
                      key={`${r.to}-${i}`}
                      to={r.to}
                      className="flex items-center gap-3 rounded-xl border bg-card px-3 py-2.5"
                    >
                      <span className="w-16 text-[10px] font-bold uppercase text-primary">
                        {r.type}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-jp text-[12px] font-semibold">{r.title}</p>
                        <p className="truncate text-[10px] text-muted-foreground">{r.sub}</p>
                      </div>
                      <ChevronRight className="size-4 text-muted-foreground" />
                    </Link>
                  ))
                ) : (
                  <p className="rounded-xl border p-5 text-center text-[10px] text-muted-foreground">
                    Tidak ada materi yang cocok.
                  </p>
                )}
              </section>
            ) : (
              <div className="space-y-4">
                <ContinueCard level={level} loading={cont.isLoading} item={cont.data ?? null} />
                <DailyNewLimit />
                <FlashcardCard />
                <KiokuCard />
                <section>
                  <h2 className="mb-2 px-1 text-[13px] font-bold">Dasar Bahasa Jepang</h2>
                  <Link
                    to="/kana"
                    className="flex items-center gap-3 rounded-2xl border bg-card px-3 py-3"
                  >
                    <span
                      lang="ja"
                      className="grid size-12 shrink-0 place-items-center rounded-xl bg-teal-100 font-jp text-[20px] font-bold text-teal-700"
                    >
                      あア
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-[12px] font-bold">Hiragana & Katakana</span>
                      <span className="block text-[10px] text-muted-foreground">
                        Belajar dan latihan huruf Jepang
                      </span>
                    </span>
                    <ChevronRight className="size-4 text-muted-foreground" />
                  </Link>
                </section>
                <section>
                  <h2 className="mb-2 px-1 text-[13px] font-bold">Materi JLPT {level}</h2>
                  <div className="space-y-2">
                    {cards.map((card) => {
                      const Icon = card.icon;
                      const p = pct(card.done, card.total);
                      return (
                        <Link
                          key={card.to}
                          to={card.to}
                          className="flex items-center gap-3 rounded-2xl border bg-card px-3 py-3"
                        >
                          <span
                            className={`grid size-12 shrink-0 place-items-center rounded-xl ${card.tone}`}
                          >
                            {typeof Icon === "string" ? (
                              <span className="font-jp text-[26px] font-bold">{Icon}</span>
                            ) : (
                              <Icon className="size-6" />
                            )}
                          </span>
                          <div className="min-w-0 flex-1">
                            <div className="flex justify-between gap-2">
                              <p className="text-[12px] font-bold">
                                {card.label}
                                {card.showLevel ? ` ${level}` : ""}
                              </p>
                              <ChevronRight className="size-4 text-muted-foreground" />
                            </div>
                            <p className="mt-0.5 truncate text-[10px] text-muted-foreground">
                              {card.meta}
                            </p>
                            {card.total > 0 && (
                              <div className="mt-2 flex items-center gap-2">
                                <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                                  <div
                                    className="h-full rounded-full bg-primary"
                                    style={{ width: `${p}%` }}
                                  />
                                </div>
                                <span className="w-8 text-right text-[10px]">{p}%</span>
                              </div>
                            )}
                          </div>
                        </Link>
                      );
                    })}
                    {[
                      {
                        label: "Dokkai",
                        icon: NotebookTabs,
                        tone: "bg-orange-100 text-orange-600",
                      },
                      { label: "Choukai", icon: Headphones, tone: "bg-sky-100 text-sky-600" },
                    ].map(({ label, icon: Icon, tone }) => (
                      <div
                        key={label}
                        aria-disabled="true"
                        className="flex cursor-not-allowed items-center gap-3 rounded-2xl border bg-card/60 px-3 py-3"
                      >
                        <span className={`grid size-12 place-items-center rounded-xl ${tone}`}>
                          <Icon className="size-6" />
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between gap-2">
                            <p className="text-[12px] font-bold">
                              {label} {level}
                            </p>
                            <span className="rounded-full bg-amber-100 px-2 py-1 text-[10px] font-bold text-amber-800 dark:bg-amber-500/20 dark:text-amber-300">
                              Segera hadir
                            </span>
                          </div>
                          <p className="mt-1 text-[10px] text-muted-foreground">
                            Sedang disempurnakan sebelum dibuka untuk belajar.
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
                
              </div>
            )}
          </>
        )}
        {!q && (
          <div className="mt-3 rounded-2xl bg-emerald-50/80 px-4 py-3 text-center dark:bg-emerald-500/10">
            <p className="text-[10px] text-emerald-900 dark:text-emerald-100">
              Konsistensi hari ini, hasil luar biasa nanti.
            </p>
            <p
              lang="ja"
              className="mt-1 font-jp text-[11px] font-semibold text-emerald-700 dark:text-emerald-300"
            >
              継続は力なり
            </p>
          </div>
        )}
      </div>
    </AppShell>
  );
}

function ContinueCard({
  level,
  loading,
  item,
}: {
  level: Level;
  loading: boolean;
  item: ContinueItem | null;
}) {
  if (loading) return <div className="h-[118px] animate-pulse rounded-2xl border bg-card" />;
  if (!item)
    return (
      <section className="rounded-2xl border border-dashed bg-card p-4">
        <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-800 dark:text-primary">
          Lanjutkan Belajar
        </p>
        <p className="mt-1 text-[13px] font-bold">Mulai belajar {level}</p>
        <p className="mt-1 text-[10px] leading-relaxed text-muted-foreground">
          Belum ada pelajaran yang diselesaikan di level ini. Pilih Kotoba, Kanji, atau Bunpou di
          bawah untuk memulai.
        </p>
      </section>
    );
  return (
    <Link
      to={item.href}
      className="block rounded-2xl border border-primary/25 bg-primary/[.04] p-4"
    >
      <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-800 dark:text-primary">
        Lanjutkan Belajar
      </p>
      <div className="mt-1 flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-[14px] font-bold">
            <span className="text-muted-foreground">{kindLabel[item.kind]} · </span>
            <span className="font-jp">{item.title}</span>
          </p>
          {item.sub && (
            <p className="mt-0.5 truncate text-[10px] text-muted-foreground">{item.sub}</p>
          )}
        </div>
        <span className="inline-flex shrink-0 items-center gap-1 rounded-xl bg-emerald-700 px-3 py-2 text-[11px] font-bold text-white dark:bg-primary dark:text-primary-foreground">
          <PlayCircle className="size-4" />
          Lanjutkan
        </span>
      </div>
      <div className="mt-3 flex items-center gap-2">
        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
          <div className="h-full rounded-full bg-primary" style={{ width: `${item.percent}%` }} />
        </div>
        <span className="text-[10px] font-semibold">Progress {item.percent}%</span>
      </div>
      <p className="mt-1 text-[10px] text-muted-foreground">
        {item.learned}/{item.total} {kindLabel[item.kind]} {level} dipelajari
      </p>
    </Link>
  );
}

function KiokuCard() {
  return (
    <section className="rounded-2xl bg-gradient-to-br from-emerald-600 to-emerald-800 p-4 text-white">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="flex items-center gap-1.5 text-[15px] font-black">
            <Sparkles className="size-4" />
            ENO Kioku
          </p>
          <p className="mt-0.5 text-[11px] text-white">Latihan ingatan adaptif</p>
          <p className="mt-2 text-[10px] text-emerald-50">Kotoba · Kanji · Bunpou</p>
        </div>
        <Link
          to="/kioku"
          className="shrink-0 rounded-xl bg-[#f0fdf4] px-3.5 py-2 text-[11px] font-bold text-[#065f46]"
        >
          Buka Menu Kioku
        </Link>
      </div>
      <p className="mt-3 text-[10px] leading-relaxed text-emerald-50">
        Mesin adaptif memilih latihan berdasarkan retensi, kesalahan, konteks, dan tahap ingatanmu.
      </p>
    </section>
  );
}

function FlashcardCard() {
  return (
    <Link to="/hafalan" className="flex items-center gap-3 rounded-2xl border bg-card px-4 py-3">
      <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-violet-100 text-violet-700">
        <Layers className="size-5" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[13px] font-bold">Flashcard</p>
        <p className="mt-0.5 text-[10px] text-muted-foreground">
          Hafalkan materi yang sudah kamu pelajari sebelum mengujinya di Kioku.
        </p>
      </div>
      <span
        className={`shrink-0 rounded-xl px-3 py-2 text-[11px] font-bold $border bg-background`}
      >
        Buka Flashcard
      </span>
    </Link>
  );
}
