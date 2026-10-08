import { createFileRoute, Link } from "@tanstack/react-router";
import { toast } from "sonner";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Eye,
  EyeOff,
  Star,
  Volume2,
} from "lucide-react";
import {
  clampFontStep,
  LIST_FONT_DEFAULT,
  LIST_FONT_KEY,
  LIST_FONT_MAX,
  LIST_FONT_MIN,
  LIST_FONT_SIZES,
  readFontStep,
} from "@/lib/list-font";
import { AppShell } from "@/components/layout/AppShell";
import { ItemMasteryCard } from "@/components/learn/ItemMasteryCard";
import { Button } from "@/components/ui/button";
import { fetchTargetLevel } from "@/lib/target-level";
import {
  fetchVocabById,
  fetchVocabCategoryCount,
  fetchVocabCategoryPage,
  fetchVocabCount,
  fetchVocabLessonCounts,
  fetchVocabLessonPage,
  fetchVocabSenses,
  pickUsageNote,
  VOCAB_PAGE_SIZE,
} from "@/lib/vocab-resilient";
import {
  addItemToReview,
  asExamples,
  markItemLearned,
  type Example,
  type Level,
} from "@/lib/learn-queries";
import { normalizeJapaneseSpacing, normalizeRomaji } from "@/lib/japanese-spacing";
import { exampleRomaji, wordRomaji } from "@/lib/romaji";
import { supabase } from "@/integrations/supabase/client";
import { getAuthUser } from "@/lib/auth-user";
import { learnedActionLabel } from "@/lib/material-progress";
// Referensi stabil agar efek tidak terpicu tiap render saat data pelajaran belum dimuat.
const NO_LESSONS: Awaited<ReturnType<typeof fetchVocabLessonCounts>> = [];
export const Route = createFileRoute("/_authenticated/kotoba")({
  validateSearch: (search: Record<string, unknown>): { category?: string; id?: string } => ({
    ...(typeof search["category"] === "string" ? { category: search["category"] } : {}),
    ...(typeof search["id"] === "string" ? { id: search["id"] } : {}),
  }),
  component: KotobaPage,
});
type VocabRow = {
  id: string;
  term: string;
  reading: string | null;
  romaji?: string | null;
  meaning_id: string | null;
  meaning_en?: string | null;
  part_of_speech: string | null;
  examples?: unknown;
  level: Level;
  lesson_number?: number | null;
  level_labels?: Level[];
};
const extraKey = -1;
function speak(t: string, onError?: () => void) {
  if (!("speechSynthesis" in window)) {
    onError?.();
    return false;
  }
  window.speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(t);
  u.lang = "ja-JP";
  u.rate = 0.85;
  u.onerror = () => onError?.();
  window.speechSynthesis.speak(u);
  return true;
}
function KotobaPage() {
  const params = new URLSearchParams(window.location.search),
    category = params.get("category")?.trim() || null,
    directId = params.get("id")?.trim() || null;
  const { data: targetLevel, isLoading: levelLoading } = useQuery({
    queryKey: ["target-level"],
    queryFn: fetchTargetLevel,
  });
  const level: Level = targetLevel ?? "N5",
    ready = !levelLoading && !!targetLevel;
  const [lesson, setLesson] = useState<number | null>(() => {
      const v = localStorage.getItem(`eno:materi:kotoba:${level}:lesson`);
      return v ? Number(v) : null;
    }),
    [page, setPage] = useState(() =>
      Number(localStorage.getItem(`eno:materi:kotoba:${level}:page`) || 0),
    ),
    [scrollY, setScrollY] = useState(() =>
      Number(sessionStorage.getItem(`eno:materi:kotoba:${level}:scroll`) || 0),
    );
  useEffect(() => {
    if (!targetLevel) return;
    const savedLesson = localStorage.getItem(`eno:materi:kotoba:${targetLevel}:lesson`);
    setLesson(savedLesson ? Number(savedLesson) : null);
    setPage(Number(localStorage.getItem(`eno:materi:kotoba:${targetLevel}:page`) || 0));
    setScrollY(Number(sessionStorage.getItem(`eno:materi:kotoba:${targetLevel}:scroll`) || 0));
  }, [targetLevel]);
  const { data: lessonCountsData, isLoading: countsLoading } = useQuery({
    queryKey: ["vocab-lessons", level],
    queryFn: () => fetchVocabLessonCounts(level),
    enabled: ready,
    staleTime: 10 * 60 * 1000,
    refetchOnWindowFocus: false,
  });
  const lessonCounts = lessonCountsData ?? NO_LESSONS;
  useEffect(() => {
    if (!lessonCounts.length) return;
    setLesson((v) =>
      v != null && lessonCounts.some((x) => Number(x.lesson_number) === v)
        ? v
        : (lessonCounts[0]?.lesson_number ?? null),
    );
  }, [level, lessonCounts]);
  const [fontStep, setFontStep] = useState(() => readFontStep(window.localStorage));
  useEffect(() => {
    try {
      localStorage.setItem(LIST_FONT_KEY, String(fontStep));
    } catch {
      /* penyimpanan tidak tersedia: pilihan hanya berlaku di sesi ini */
    }
  }, [fontStep]);
  useEffect(() => {
    if (lesson != null) localStorage.setItem(`eno:materi:kotoba:${level}:lesson`, String(lesson));
    localStorage.setItem(`eno:materi:kotoba:${level}:page`, String(page));
  }, [level, lesson, page]);
  useEffect(() => {
    if (ready && !directId && scrollY > 0)
      requestAnimationFrame(() => window.scrollTo({ top: scrollY }));
  }, [ready, directId, scrollY]);
  const qc = useQueryClient();
  const categoryCount = useQuery({
    queryKey: ["vocab-category-count", level, category],
    queryFn: () => fetchVocabCategoryCount(level, category!),
    enabled: ready && !!category,
    staleTime: 10 * 60 * 1000,
  });
  const fontSizes = LIST_FONT_SIZES[clampFontStep(fontStep)] ?? LIST_FONT_SIZES[LIST_FONT_DEFAULT]!;
  const currentCount = category
    ? Number(categoryCount.data ?? 0)
    : Number(lessonCounts.find((x) => x.lesson_number === lesson)?.word_count ?? 0);
  const {
    data = [],
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: category
      ? ["vocab-category", level, category, page]
      : ["vocab-lesson", level, lesson, page],
    queryFn: () =>
      category
        ? fetchVocabCategoryPage(level, category, page * VOCAB_PAGE_SIZE, VOCAB_PAGE_SIZE)
        : fetchVocabLessonPage(level, lesson!, page * VOCAB_PAGE_SIZE, VOCAB_PAGE_SIZE),
    enabled: ready && (!!category || lesson != null),
    staleTime: 10 * 60 * 1000,
    refetchOnWindowFocus: false,
  });
  const { data: total = 0 } = useQuery({
    queryKey: ["vocab-count", level],
    queryFn: () => fetchVocabCount(level),
    enabled: ready && !category,
    staleTime: 10 * 60 * 1000,
    refetchOnWindowFocus: false,
  });
  const cards = data as VocabRow[];
  useEffect(() => {
    if (!ready || currentCount <= (page + 1) * VOCAB_PAGE_SIZE) return;
    const nextPage = page + 1;
    const offset = nextPage * VOCAB_PAGE_SIZE;
    void qc.prefetchQuery({
      queryKey: category
        ? ["vocab-category", level, category, nextPage]
        : ["vocab-lesson", level, lesson, nextPage],
      queryFn: () =>
        category
          ? fetchVocabCategoryPage(level, category, offset, VOCAB_PAGE_SIZE)
          : fetchVocabLessonPage(level, lesson!, offset, VOCAB_PAGE_SIZE),
      staleTime: 10 * 60 * 1000,
    });
  }, [category, currentCount, lesson, level, page, qc, ready]);
  const { data: directItem } = useQuery({
    queryKey: ["vocab-direct", directId],
    queryFn: () => fetchVocabById(directId!),
    enabled: ready && !!directId,
    staleTime: 10 * 60 * 1000,
  });
  const [selected, setSelected] = useState<VocabRow | null>(null),
    [showKanji, setShowKanji] = useState(true),
    [showKana, setShowKana] = useState(true),
    [showMeaning, setShowMeaning] = useState(true),
    [audioError, setAudioError] = useState(false);
  const detailHistory = useRef(false);
  useEffect(() => {
    if (directItem) setSelected(directItem as VocabRow);
  }, [directItem]);
  // Hanya reaksi pada perubahan level/pelajaran/halaman; directId dibaca terbaru lewat ref.
  const directIdRef = useRef(directId);
  directIdRef.current = directId;
  useEffect(() => {
    if (!directIdRef.current) setSelected(null);
  }, [level, lesson, page]);
  const {
    data: senses = [],
    isLoading: sensesLoading,
    error: sensesError,
  } = useQuery({
    queryKey: ["vocab-senses", selected?.id],
    queryFn: () => fetchVocabSenses(selected!.id),
    enabled: !!selected,
    staleTime: 10 * 60 * 1000,
    refetchOnWindowFocus: false,
  });
  const examples = useMemo(() => {
    if (!selected) return [];
    const seen = new Set<string>();
    return [...asExamples(selected.examples), ...senses.flatMap((s) => asExamples(s.examples))]
      .filter((e) => {
        const k = String(e.jp ?? "")
          .replace(/\s/g, "")
          .toLowerCase();
        if (!k) return true;
        if (seen.has(k)) return false;
        seen.add(k);
        return true;
      })
      .slice(0, 3);
  }, [selected, senses]);
  const { data: progressRows = [] } = useQuery({
    queryKey: ["mastered-items", "vocabulary", level],
    enabled: ready,
    staleTime: 60 * 1000,
    refetchOnWindowFocus: false,
    queryFn: async () => {
      const { data: auth } = await getAuthUser();
      if (!auth.user) return [] as Array<{ item_id: string; status: string }>;
      const { data, error } = await supabase
        .from("user_item_progress")
        .select("item_id,status")
        .eq("user_id", auth.user.id)
        .eq("item_type", "vocabulary")
        .eq("level", level)
        .in("status", ["learning", "review", "mastered"]);
      if (error) throw error;
      return (data ?? []) as Array<{ item_id: string; status: string }>;
    },
  });
  const learnedIds = useMemo(() => new Set(progressRows.map((x) => x.item_id)), [progressRows]),
    reviewIds = useMemo(
      () => new Set(progressRows.filter((x) => x.status === "review").map((x) => x.item_id)),
      [progressRows],
    );
  const reviewMutation = useMutation({
    mutationFn: (id: string) => addItemToReview({ itemType: "vocabulary", itemId: id, level }),
    onMutate: async (id) => {
      await qc.cancelQueries({ queryKey: ["mastered-items", "vocabulary", level] });
      const previous =
        qc.getQueryData<Array<{ item_id: string; status: string }>>([
          "mastered-items",
          "vocabulary",
          level,
        ]) ?? [];
      qc.setQueryData(
        ["mastered-items", "vocabulary", level],
        [...previous.filter((x) => x.item_id !== id), { item_id: id, status: "review" }],
      );
      return { previous };
    },
    onError: (_e, _id, ctx) => {
      toast.error(
        navigator.onLine
          ? "Progress gagal disimpan. Coba lagi."
          : "Kamu sedang offline. Progress belum tersimpan.",
      );
      if (ctx) qc.setQueryData(["mastered-items", "vocabulary", level], ctx.previous);
    },
    onSuccess: () => {
      toast.success("Progress tersimpan");
      void qc.invalidateQueries({ queryKey: ["mastered-items", "vocabulary", level] });
      void qc.invalidateQueries({ queryKey: ["my-progress"] });
      void qc.invalidateQueries({ queryKey: ["dashboard-live"] });
    },
  });
  const learned = useMutation({
    mutationFn: (id: string) => markItemLearned({ itemType: "vocabulary", itemId: id, level }),
    onMutate: async (id) => {
      await qc.cancelQueries({ queryKey: ["mastered-items", "vocabulary", level] });
      const previous =
        qc.getQueryData<Array<{ item_id: string; status: string }>>([
          "mastered-items",
          "vocabulary",
          level,
        ]) ?? [];
      qc.setQueryData(
        ["mastered-items", "vocabulary", level],
        [...previous.filter((x) => x.item_id !== id), { item_id: id, status: "learning" }],
      );
      return { previous };
    },
    onError: (_e, _id, ctx) => {
      toast.error(
        navigator.onLine
          ? "Progress gagal disimpan. Coba lagi."
          : "Kamu sedang offline. Progress belum tersimpan.",
      );
      if (ctx) qc.setQueryData(["mastered-items", "vocabulary", level], ctx.previous);
    },
    onSuccess: () => {
      toast.success("Progress tersimpan");
      void qc.invalidateQueries({ queryKey: ["mastered-items", "vocabulary", level] });
      void qc.invalidateQueries({ queryKey: ["my-progress"] });
      void qc.invalidateQueries({ queryKey: ["dashboard-live"] });
    },
  });
  useEffect(() => {
    const onPop = () => {
      const id = new URLSearchParams(window.location.search).get("id");
      detailHistory.current = false;
      if (!id) {
        setSelected(null);
        requestAnimationFrame(() => window.scrollTo({ top: scrollY }));
        return;
      }
      void qc
        .fetchQuery({
          queryKey: ["vocab-direct", id],
          queryFn: () => fetchVocabById(id),
          staleTime: 10 * 60 * 1000,
        })
        .then((item) => {
          if (item) setSelected(item as VocabRow);
        });
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, [scrollY, qc]);
  const openItem = (item: VocabRow) => {
    const y = window.scrollY;
    if (!selected) {
      setScrollY(y);
      sessionStorage.setItem(`eno:materi:kotoba:${level}:scroll`, String(y));
    }
    setSelected(item);
    const url = new URL(window.location.href);
    url.searchParams.set("id", item.id);
    if (detailHistory.current) window.history.replaceState(null, "", url);
    else {
      window.history.pushState(null, "", url);
      detailHistory.current = true;
    }
  };
  const closeItem = () => {
    if (detailHistory.current) {
      detailHistory.current = false;
      window.history.back();
    } else {
      setSelected(null);
      requestAnimationFrame(() => window.scrollTo({ top: scrollY }));
      const url = new URL(window.location.href);
      url.searchParams.delete("id");
      window.history.replaceState(null, "", url);
    }
  };
  const index = selected ? cards.findIndex((x) => x.id === selected.id) : -1;
  useEffect(() => {
    if (index < 0) return;
    for (const candidate of [cards[index - 1], cards[index + 1]])
      if (candidate)
        void qc.prefetchQuery({
          queryKey: ["vocab-senses", candidate.id],
          queryFn: () => fetchVocabSenses(candidate.id),
          staleTime: 10 * 60 * 1000,
        });
  }, [index, cards, qc]);
  const move = (delta: number) => {
    if (!cards.length) return;
    const next = Math.min(cards.length - 1, Math.max(0, index + delta));
    const target = cards[next];
    if (target) openItem(target);
  };
  if (levelLoading)
    return (
      <AppShell title="Kotoba" backTo="/belajar" compact>
        <div
          aria-label="Memuat level"
          className="my-4 h-24 animate-pulse rounded-2xl bg-muted/60"
        />
      </AppShell>
    );
  return (
    <AppShell title="Kotoba" backTo="/belajar" compact>
      <div className="mx-auto min-w-0 max-w-lg overflow-x-hidden pb-[max(1rem,env(safe-area-inset-bottom))]">
        {selected ? (
          <Detail
            item={selected}
            senses={senses}
            examples={examples}
            canPrev={index > 0}
            canNext={index >= 0 && index < cards.length - 1}
            onPrev={() => move(-1)}
            onNext={() => move(1)}
            onBack={closeItem}
            learned={learnedIds.has(selected.id)}
            reviewing={reviewIds.has(selected.id)}
            reviewPending={reviewMutation.isPending}
            learnPending={learned.isPending}
            onReview={() => reviewMutation.mutate(selected.id)}
            onLearn={() => learned.mutate(selected.id)}
            mutationError={reviewMutation.isError || learned.isError}
            detailLoading={sensesLoading}
            detailError={!!sensesError}
            onRetryDetail={() =>
              void qc.invalidateQueries({ queryKey: ["vocab-senses", selected.id] })
            }
            audioError={audioError}
            onSpeak={(text: string) => {
              setAudioError(false);
              speak(text, () => setAudioError(true));
            }}
          />
        ) : (
          <>
            <div className="mb-3 flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h1 className="text-[22px] font-black tracking-tight">
                  {category ? "Kotoba Tambahan" : "Kosakata"} {level}
                </h1>
                <p className="mt-1 text-[11px] leading-4 text-muted-foreground">
                  {category
                    ? "Kategori pilihan · level mengikuti target JLPT."
                    : "Pilih pelajaran, buka kosakata, lalu tandai progres belajarmu."}
                </p>
              </div>
              <span className="shrink-0 rounded-full bg-primary/10 px-2.5 py-1 text-[11px] font-bold text-primary">
                {(category ? currentCount : total).toLocaleString("id-ID")} kata
              </span>
            </div>
            {category ? (
              <Link
                to="/belajar"
                className="mb-3 inline-flex items-center gap-1 text-[10px] font-semibold text-primary"
              >
                <ChevronLeft className="size-3.5" />
                Kembali ke Materi
              </Link>
            ) : (
              <div className="relative mb-3">
                <select
                  value={lesson ?? ""}
                  onChange={(e) => {
                    setLesson(Number(e.target.value));
                    setPage(0);
                  }}
                  className="h-12 w-full appearance-none rounded-xl border bg-card px-3 pr-9 text-[13px] font-semibold shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                >
                  <option value="">Pilih pelajaran</option>
                  {lessonCounts.map((x) => (
                    <option key={x.lesson_number} value={x.lesson_number}>
                      {x.lesson_number === -1 ? "Materi tambahan" : `Pelajaran ${x.lesson_number}`}{" "}
                      · {Number(x.word_count)} kata
                    </option>
                  ))}
                </select>
                <ChevronDown className="pointer-events-none absolute right-3 top-3.5 size-4" />
              </div>
            )}
            <div className="mb-2 flex items-center justify-between gap-2">
              <span className="text-[11px] font-semibold text-muted-foreground">Ukuran huruf</span>
              <div
                className="flex items-center gap-1.5"
                role="group"
                aria-label="Ukuran huruf daftar"
              >
                <button
                  type="button"
                  aria-label="Perkecil huruf"
                  disabled={fontStep <= LIST_FONT_MIN}
                  onClick={() => setFontStep((v) => clampFontStep(v - 1))}
                  className="min-h-11 min-w-11 rounded-lg border bg-card px-3 text-[13px] font-bold disabled:opacity-40"
                >
                  A−
                </button>
                <button
                  type="button"
                  aria-label="Perbesar huruf"
                  disabled={fontStep >= LIST_FONT_MAX}
                  onClick={() => setFontStep((v) => clampFontStep(v + 1))}
                  className="min-h-11 min-w-11 rounded-lg border bg-card px-3 text-[13px] font-bold disabled:opacity-40"
                >
                  A+
                </button>
              </div>
            </div>
            <div className="mb-3 grid grid-cols-3 gap-2">
              <Toggle label="Kanji" on={showKanji} set={setShowKanji} />
              <Toggle label="Hiragana" on={showKana} set={setShowKana} />
              <Toggle label="Arti" on={showMeaning} set={setShowMeaning} />
            </div>
            {error ? (
              <div className="py-8 text-center">
                <p className="text-xs text-destructive">Kosakata gagal dimuat.</p>
                <Button
                  variant="outline"
                  className="mt-3 h-11 rounded-full text-[11px]"
                  onClick={() => void refetch()}
                >
                  Coba Lagi
                </Button>
              </div>
            ) : isLoading || (!category && countsLoading) || categoryCount.isLoading ? (
              <div aria-label="Memuat materi" className="space-y-1">
                {Array.from({ length: 8 }).map((_, i) => (
                  <div key={i} className="h-11 animate-pulse rounded-lg bg-muted/60" />
                ))}
              </div>
            ) : (
              <div className="min-w-0 overflow-hidden rounded-2xl border bg-card shadow-sm">
                <div className="sticky top-0 z-10 grid grid-cols-[.85fr_.95fr_1.65fr_44px] gap-x-2 bg-background/95 px-3 py-2.5 text-[11px] font-bold backdrop-blur">
                  <span>Kanji</span>
                  <span>Hiragana</span>
                  <span>Arti</span>
                  <span className="text-center">Status</span>
                </div>
                {cards.map((w) => (
                  <button
                    type="button"
                    key={w.id}
                    onClick={() => openItem(w)}
                    className="grid min-h-[52px] w-full grid-cols-[.85fr_.95fr_1.65fr_44px] items-center gap-x-2 border-t px-3 py-3 text-left transition-colors hover:bg-primary/[.04] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary motion-reduce:transition-none"
                  >
                    <span
                      lang="ja"
                      style={{ fontSize: fontSizes.kanji }}
                      className="min-w-0 break-words font-jp font-bold leading-snug [overflow-wrap:anywhere]"
                    >
                      {showKanji ? w.term : "•••"}
                    </span>
                    <span
                      lang="ja"
                      style={{ fontSize: fontSizes.kana }}
                      className="min-w-0 break-words font-jp leading-snug text-muted-foreground [overflow-wrap:anywhere]"
                    >
                      {showKana ? w.reading || "—" : "•••"}
                    </span>
                    <span
                      style={{ fontSize: fontSizes.meaning }}
                      className="min-w-0 break-words pr-1 leading-snug [overflow-wrap:anywhere]"
                    >
                      {showMeaning ? w.meaning_id || "—" : "•••"}
                    </span>
                    {reviewIds.has(w.id) ? (
                      <Star
                        aria-label="Perlu Review"
                        className="mx-auto size-3.5 fill-current text-amber-500"
                      />
                    ) : learnedIds.has(w.id) ? (
                      <Check
                        aria-label="Sudah dipelajari"
                        className="mx-auto size-3.5 text-primary"
                      />
                    ) : (
                      <ChevronRight className="mx-auto size-4 text-primary" />
                    )}
                  </button>
                ))}
              </div>
            )}
            {currentCount > VOCAB_PAGE_SIZE && (
              <div className="mt-3 flex items-center justify-between gap-2">
                <Button
                  variant="outline"
                  className="h-11 flex-1 rounded-full text-xs"
                  disabled={page === 0 || isLoading}
                  onClick={() => setPage((p) => Math.max(0, p - 1))}
                >
                  <ChevronLeft className="mr-1 size-4" />
                  Sebelumnya
                </Button>
                <span className="text-[10px] text-muted-foreground">
                  {Math.min(page * VOCAB_PAGE_SIZE + 1, currentCount)}–
                  {Math.min((page + 1) * VOCAB_PAGE_SIZE, currentCount)} / {currentCount}
                </span>
                <Button
                  variant="outline"
                  className="h-11 flex-1 rounded-full text-xs"
                  disabled={(page + 1) * VOCAB_PAGE_SIZE >= currentCount || isLoading}
                  onClick={() => setPage((p) => p + 1)}
                >
                  Berikutnya
                  <ChevronRight className="ml-1 size-4" />
                </Button>
              </div>
            )}
          </>
        )}
      </div>
    </AppShell>
  );
}
function Toggle({ label, on, set }: { label: string; on: boolean; set: (v: boolean) => void }) {
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={() => set(!on)}
      className={`flex min-h-11 items-center justify-center gap-1 rounded-lg border text-[11px] font-semibold ${on ? "bg-primary/[.07] text-primary" : "bg-muted text-muted-foreground"}`}
    >
      {on ? <Eye className="size-3.5" /> : <EyeOff className="size-3.5" />}
      {label}
    </button>
  );
}
function Detail({
  item,
  senses,
  examples,
  canPrev,
  canNext,
  onPrev,
  onNext,
  onBack,
  learned,
  reviewing,
  reviewPending,
  learnPending,
  onReview,
  onLearn,
  mutationError,
  detailLoading,
  detailError,
  onRetryDetail,
  audioError,
  onSpeak,
}: {
  item: VocabRow;
  senses: Awaited<ReturnType<typeof fetchVocabSenses>>;
  examples: Example[];
  canPrev: boolean;
  canNext: boolean;
  onPrev: () => void;
  onNext: () => void;
  onBack: () => void;
  learned: boolean;
  reviewing: boolean;
  reviewPending: boolean;
  learnPending: boolean;
  onReview: () => void;
  onLearn: () => void;
  mutationError: boolean;
  detailLoading: boolean;
  detailError: boolean;
  onRetryDetail: () => void;
  audioError: boolean;
  onSpeak: (text: string) => void;
}) {
  const touch = useRef<number | null>(null);
  const usage = pickUsageNote(item, senses);
  const detailState = detailError ? (
    <div className="mb-3 rounded-xl border border-destructive/20 bg-destructive/5 p-3 text-center">
      <p className="text-[11px] text-destructive">Detail Kotoba gagal dimuat.</p>
      <button
        type="button"
        onClick={onRetryDetail}
        className="mt-2 min-h-11 rounded-full border px-4 text-[11px] font-semibold"
      >
        Coba Lagi
      </button>
    </div>
  ) : detailLoading ? (
    <div
      aria-label="Memuat detail Kotoba"
      className="mb-3 h-20 animate-pulse rounded-xl bg-muted/60"
    />
  ) : null;
  const levels = [...(item.level_labels ?? []), item.level]
    .filter((x, i, a) => x && a.indexOf(x) === i)
    .join(" · ");
  const termLength = Array.from(item.term || "").length;
  const termSize =
    termLength <= 4
      ? "text-[48px]"
      : termLength <= 7
        ? "text-[40px]"
        : termLength <= 11
          ? "text-[34px]"
          : "text-[28px]";
  return (
    <div>
      {detailState}
      <div
        onTouchStart={(e) => (touch.current = e.touches[0]?.clientX ?? null)}
        onTouchEnd={(e) => {
          if (touch.current == null) return;
          const endX = e.changedTouches[0]?.clientX;
          if (endX === undefined) return;
          const d = endX - touch.current;
          if (Math.abs(d) > 55) (d > 0 ? onPrev : onNext)();
          touch.current = null;
        }}
      >
        <div className="mb-2 flex items-center justify-between">
          <button
            type="button"
            onClick={onBack}
            className="flex min-h-11 items-center gap-1 rounded-lg px-2 text-xs font-semibold text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            <ChevronLeft className="size-4" />
            Kembali ke pelajaran
          </button>
          <span className="rounded-full bg-primary/[.08] px-2.5 py-1 text-[11px] font-bold text-primary">
            {levels || item.level}
          </span>
        </div>
        <section className="relative min-w-0 overflow-hidden rounded-2xl bg-card px-4 py-4">
          <div className="absolute right-4 top-4 flex gap-2">
            <button
              type="button"
              aria-label={`Putar pengucapan ${item.term}`}
              onClick={() => onSpeak(item.term)}
              className="grid size-11 place-items-center rounded-full bg-primary/[.1] text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              <Volume2 />
            </button>
          </div>
          <p lang="ja" className="font-jp text-lg text-muted-foreground">
            {item.reading}
          </p>
          <h1
            lang="ja"
            className={`mt-1 max-w-[calc(100%-3.5rem)] break-words font-jp font-bold leading-[1.15] [overflow-wrap:anywhere] ${termSize}`}
          >
            {item.term}
          </h1>
          <p className="mt-2 text-lg text-muted-foreground">
            {normalizeRomaji(item.romaji) || wordRomaji(item.reading)}
          </p>
          <p className="mt-1 pr-2 text-lg font-semibold leading-7">{item.meaning_id}</p>
        </section>
        <div className="mt-2 grid grid-cols-2 gap-2">
          <Info
            label="Kelas Kata"
            value={item.part_of_speech || senses[0]?.part_of_speech || "—"}
          />
          <Info label="Arti Inggris" value={item.meaning_en || "—"} />
        </div>
        <section className="mt-2 rounded-2xl bg-primary/[.07] p-4">
          <p className="text-xs font-bold text-primary">Penggunaan</p>
          <p className="mt-1 text-sm leading-6">{usage || "Catatan penggunaan belum tersedia."}</p>
        </section>
        <section className="mt-5">
          <h2 className="text-base font-bold">Contoh Kalimat</h2>
          {examples.length ? (
            examples.map((e, i: number) => {
              const jp = normalizeJapaneseSpacing(e.jp);
              const reading = normalizeJapaneseSpacing(e.reading);
              const romaji = exampleRomaji({ romaji: e.romaji, reading });
              return (
                <div
                  key={i}
                  className="relative mt-2 min-w-0 max-w-full overflow-hidden rounded-2xl bg-muted/40 p-4 pr-12 text-sm leading-6 [overflow-wrap:anywhere]"
                >
                  <p
                    lang="ja"
                    className="break-words font-jp text-base font-semibold [overflow-wrap:anywhere]"
                  >
                    {jp}
                  </p>
                  <p lang="ja" className="font-jp text-muted-foreground">
                    {reading || "Hiragana belum tersedia."}
                  </p>
                  <p className="break-words italic text-muted-foreground [overflow-wrap:anywhere]">
                    {romaji || "Romaji belum tersedia."}
                  </p>
                  <p>{e.id || "Terjemahan Indonesia belum tersedia."}</p>
                  <button
                    type="button"
                    aria-label="Putar contoh kalimat"
                    onClick={() => onSpeak(e.jp ?? "")}
                    className="absolute right-2 top-2 grid size-11 place-items-center rounded-full text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                  >
                    <Volume2 className="size-5" />
                  </button>
                </div>
              );
            })
          ) : (
            <p className="mt-2 text-xs text-muted-foreground">Contoh kalimat belum tersedia.</p>
          )}
        </section>
        <ItemMasteryCard itemType="vocabulary" itemId={item.id} learned={learned} />
        <div className="mt-3 border-t bg-background px-1.5 py-1">
          <div className="mx-auto grid max-w-none grid-cols-[36px_1fr_auto_1fr_36px] items-center gap-1">
            <Button
              variant="ghost"
              aria-label="Materi sebelumnya"
              disabled={!canPrev}
              onClick={onPrev}
              className="size-9 rounded-full p-0 transition-transform duration-150 active:scale-95 motion-reduce:transition-none motion-reduce:active:scale-100"
            >
              <ChevronLeft className="size-4" />
            </Button>
            <Button
              variant="outline"
              disabled={reviewPending || reviewing}
              onClick={onReview}
              className="h-9 min-w-0 rounded-full px-2 text-[11px] transition-transform duration-150 active:scale-95 motion-reduce:transition-none motion-reduce:active:scale-100"
            >
              <Star
                className={`mr-1 size-3.5 transition-transform duration-150 ${reviewing ? "fill-current scale-110" : ""} motion-reduce:transition-none`}
              />
              <span className="truncate">Review</span>
            </Button>
            <span className="min-w-11 text-center text-[10px] font-semibold text-muted-foreground">
              Materi
            </span>
            <Button
              disabled={learnPending || learned}
              onClick={onLearn}
              variant={learned ? "secondary" : "default"}
              aria-label={learned ? "Sudah dipelajari" : "Tandai dipelajari"}
              className="h-9 min-w-0 rounded-full px-2 text-[11px] transition-transform duration-150 active:scale-95 motion-reduce:transition-none motion-reduce:active:scale-100"
            >
              <Check
                className={`mr-1 size-3.5 transition-transform duration-150 ${learned ? "scale-110" : ""} motion-reduce:transition-none`}
              />
              <span className="truncate">{learnedActionLabel(learned)}</span>
            </Button>
            <Button
              variant="ghost"
              aria-label="Materi selanjutnya"
              disabled={!canNext}
              onClick={onNext}
              className="size-9 rounded-full p-0 transition-transform duration-150 active:scale-95 motion-reduce:transition-none motion-reduce:active:scale-100"
            >
              <ChevronRight className="size-4" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-primary/[.07] p-4">
      <p className="text-[12px] font-bold text-primary">{label}</p>
      <p className="mt-1 break-words text-[14px] font-semibold leading-5">{value}</p>
    </div>
  );
}
