import { createFileRoute } from "@tanstack/react-router";
import { toast } from "sonner";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  ChevronLeft,
  ChevronRight,
  Star,
  Volume2,
} from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";
import { KanjiGuide } from "@/components/learn/KanjiGuide";
import { KanjiStructureSection } from "@/components/learn/KanjiStructureSection";
import {
  fetchKanjiList,
  fetchKanjiOne,
  fetchKanjiStudy,
  addItemToReview,
  markItemLearned,
  asExamples,
  type Level,
} from "@/lib/learn-queries";
import { fetchTargetLevel } from "@/lib/target-level";
import { normalizeJapaneseSpacing } from "@/lib/japanese-spacing";
import { exampleRomaji } from "@/lib/romaji";
import { supabase } from "@/integrations/supabase/client";
import { getAuthUser } from "@/lib/auth-user";
import {
  EXTRA_LESSON,
  filterByLesson,
  hasExtraKanji,
  lessonNumbers,
  normalizeLesson,
} from "@/lib/kanji-lessons";

export const Route = createFileRoute("/_authenticated/kanji")({
  validateSearch: (search: Record<string, unknown>): { id?: string } =>
    typeof search["id"] === "string" ? { id: search["id"] } : {},
  component: KanjiPage,
});
type KanjiRow = {
  id: string;
  character: string;
  level: Level;
  onyomi: string[] | null;
  kunyomi: string[] | null;
  meaning_id: string | null;
  stroke_count?: number | null;
  source_book?: string | null;
  lesson_number?: number | null;
  lesson_title?: string | null;
};
function highlight(text: string, target: string): ReactNode {
  if (!text || !target) return text;
  const parts = text.split(target);
  return (
    <>
      {parts.map((p, i) => (
        <span key={i}>
          {p}
          {i < parts.length - 1 && (
            <mark className="bg-transparent font-bold text-primary">{target}</mark>
          )}
        </span>
      ))}
    </>
  );
}
function lessonLabel(level: Level, n: number) {
  return level === "N4" ? n + 25 : n;
}
function KanjiPage() {
  const {
    data: targetLevel,
    isLoading: levelLoading,
    error: levelError,
  } = useQuery({ queryKey: ["target-level"], queryFn: fetchTargetLevel });
  const level: Level = targetLevel ?? "N5";
  const { data, isLoading, error } = useQuery({
    queryKey: ["kanji", level],
    queryFn: () => fetchKanjiList(level),
    enabled: !!targetLevel,
    staleTime: 10 * 60 * 1000,
    refetchOnWindowFocus: false,
  });
  const { data: masteredRows } = useQuery({
    queryKey: ["mastered-items", "kanji", level],
    enabled: !!targetLevel,
    staleTime: 60 * 1000,
    refetchOnWindowFocus: false,
    queryFn: async () => {
      const { data: auth } = await getAuthUser();
      if (!auth.user) return [] as Array<{ item_id: string; status: string }>;
      const { data, error } = await supabase
        .from("user_item_progress")
        .select("item_id,status")
        .eq("user_id", auth.user.id)
        .eq("item_type", "kanji")
        .eq("level", level)
        .in("status", ["learning", "review", "mastered"]);
      if (error) throw error;
      return (data ?? []) as Array<{ item_id: string; status: string }>;
    },
  });
  const allCards = useMemo(() => (data ?? []) as KanjiRow[], [data]);
  const lessons = useMemo(() => lessonNumbers(allCards), [allCards]),
    extraLesson = useMemo(() => hasExtraKanji(allCards), [allCards]);
  const [lesson, setLesson] = useState<number | null>(() => {
      const v = localStorage.getItem(`eno:materi:kanji:${level}:lesson`);
      return v ? Number(v) : null;
    }),
    [detailId, setDetailId] = useState<string | null>(() =>
      new URLSearchParams(window.location.search).get("id"),
    ),
    [learned, setLearned] = useState<Record<string, boolean>>({}),
    [review, setReview] = useState<Record<string, boolean>>({}),
    [page, setPage] = useState(() =>
      Number(localStorage.getItem(`eno:materi:kanji:${level}:page`) || 0),
    );
  const touchStart = useRef<number | null>(null),
    lessonReady = useRef(false),
    detailHistory = useRef(false),
    scrollY = useRef(Number(sessionStorage.getItem(`eno:materi:kanji:${level}:scroll`) || 0)),
    qc = useQueryClient();
  useEffect(() => {
    if (!targetLevel) return;
    const savedLesson = localStorage.getItem(`eno:materi:kanji:${targetLevel}:lesson`),
      savedPage = localStorage.getItem(`eno:materi:kanji:${targetLevel}:page`);
    lessonReady.current = false;
    setLesson(savedLesson ? Number(savedLesson) : null);
    setPage(Number(savedPage || 0));
  }, [targetLevel]);
  useEffect(() => {
    if (lessons.length) setLesson((c) => normalizeLesson(c, lessons, extraLesson));
  }, [level, lessons, extraLesson]);
  useEffect(() => {
    if (lesson != null) localStorage.setItem(`eno:materi:kanji:${level}:lesson`, String(lesson));
    if (lessonReady.current) setPage(0);
    else lessonReady.current = true;
  }, [level, lesson]);
  useEffect(() => {
    localStorage.setItem(`eno:materi:kanji:${level}:page`, String(page));
  }, [level, page]);
  useEffect(() => {
    const onPop = () => {
      const id = new URLSearchParams(window.location.search).get("id");
      if (!id) {
        detailHistory.current = false;
        requestAnimationFrame(() => window.scrollTo({ top: scrollY.current }));
      }
      setDetailId(id);
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);
  const openDetail = (id: string) => {
    if (!detailId) {
      scrollY.current = window.scrollY;
      sessionStorage.setItem(`eno:materi:kanji:${level}:scroll`, String(scrollY.current));
    }
    setDetailId(id);
    const url = new URL(window.location.href);
    url.searchParams.set("id", id);
    if (detailHistory.current) window.history.replaceState(null, "", url);
    else {
      window.history.pushState(null, "", url);
      detailHistory.current = true;
    }
  };
  const closeDetail = () => {
    if (detailHistory.current) {
      detailHistory.current = false;
      window.history.back();
    } else {
      setDetailId(null);
      requestAnimationFrame(() => window.scrollTo({ top: scrollY.current }));
      const url = new URL(window.location.href);
      url.searchParams.delete("id");
      window.history.replaceState(null, "", url);
    }
  };
  useEffect(() => {
    if (masteredRows) {
      setLearned(Object.fromEntries(masteredRows.map((r) => [r.item_id, true])));
      setReview(
        Object.fromEntries(
          masteredRows.filter((r) => r.status === "review").map((r) => [r.item_id, true]),
        ),
      );
    }
  }, [masteredRows]);
  const chapterCards = filterByLesson(allCards, lesson),
    pageSize = 60,
    pageCount = Math.max(1, Math.ceil(chapterCards.length / pageSize)),
    visibleCards = chapterCards.slice(page * pageSize, (page + 1) * pageSize);
  useEffect(() => {
    if (page >= pageCount) setPage(Math.max(0, pageCount - 1));
  }, [page, pageCount]);
  const detailIndex = detailId ? allCards.findIndex((x) => x.id === detailId) : -1,
    listItem = detailIndex >= 0 ? allCards[detailIndex] : null;
  // Detail dari relasi (keluarga/komponen) boleh berada di luar level target: ambil barisnya sendiri.
  const { data: relatedItem, isLoading: relatedLoading } = useQuery({
    queryKey: ["kanji-one", detailId],
    enabled: !!detailId && !!data && !listItem,
    staleTime: 10 * 60 * 1000,
    refetchOnWindowFocus: false,
    queryFn: () => fetchKanjiOne(detailId!),
  });
  const item: KanjiRow | null = listItem ?? (relatedItem as KanjiRow | null | undefined) ?? null;
  const itemLevel: Level = item?.level ?? level;
  const { data: relatedProgress } = useQuery({
    queryKey: ["kanji-one-progress", detailId],
    enabled: !!relatedItem && !listItem,
    staleTime: 60 * 1000,
    refetchOnWindowFocus: false,
    queryFn: async () => {
      const { data: auth } = await getAuthUser();
      if (!auth.user) return null;
      const { data: row, error } = await supabase
        .from("user_item_progress")
        .select("status")
        .eq("user_id", auth.user.id)
        .eq("item_type", "kanji")
        .eq("item_id", detailId!)
        .maybeSingle();
      if (error) throw error;
      return (row?.status as string | undefined) ?? null;
    },
  });
  useEffect(() => {
    if (!detailId || listItem || !relatedProgress) return;
    if (!["learning", "review", "mastered"].includes(relatedProgress)) return;
    setLearned((v) => ({ ...v, [detailId]: true }));
    if (relatedProgress === "review") setReview((v) => ({ ...v, [detailId]: true }));
  }, [detailId, listItem, relatedProgress]);
  const prev = () => {
      if (detailIndex > 0) {
        const t = allCards[detailIndex - 1];
        if (t) openDetail(t.id);
      }
    },
    next = () => {
      if (detailIndex >= 0 && detailIndex < allCards.length - 1) {
        const t = allCards[detailIndex + 1];
        if (t) openDetail(t.id);
      }
    };
  const {
    data: study,
    isLoading: studyLoading,
    error: studyError,
  } = useQuery({
    queryKey: ["kanji-study", item?.id],
    queryFn: () => fetchKanjiStudy(item!.id),
    enabled: !!item?.id,
    staleTime: 10 * 60 * 1000,
  });
  useEffect(() => {
    if (detailIndex < 0) return;
    for (const candidate of [allCards[detailIndex - 1], allCards[detailIndex + 1]])
      if (candidate)
        void qc.prefetchQuery({
          queryKey: ["kanji-study", candidate.id],
          queryFn: () => fetchKanjiStudy(candidate.id),
          staleTime: 10 * 60 * 1000,
        });
  }, [detailIndex, allCards, qc]);
  const reviewMutation = useMutation({
    mutationFn: (id: string) =>
      addItemToReview({ itemType: "kanji", itemId: id, level: itemLevel }),
    onMutate: (id) => {
      const previous = review[id];
      setReview((v) => ({ ...v, [id]: true }));
      return { previous, id };
    },
    onError: (_e, _id, ctx) => {
      toast.error(
        navigator.onLine
          ? "Progress gagal disimpan. Coba lagi."
          : "Kamu sedang offline. Progress belum tersimpan.",
      );
      if (ctx) setReview((v) => ({ ...v, [ctx.id]: Boolean(ctx.previous) }));
    },
    onSuccess: (_, id) => {
      toast.success("Progress tersimpan");
      setReview((v) => ({ ...v, [id]: true }));
      void qc.invalidateQueries({ queryKey: ["mastered-items", "kanji", level] });
      void qc.invalidateQueries({ queryKey: ["kanji-one-progress"] });
      void qc.invalidateQueries({ queryKey: ["my-progress"] });
      void qc.invalidateQueries({ queryKey: ["dashboard-live"] });
    },
  });
  const mutation = useMutation({
    mutationFn: (id: string) =>
      markItemLearned({ itemType: "kanji", itemId: id, level: itemLevel }),
    onMutate: (id) => {
      const previous = learned[id];
      setLearned((v) => ({ ...v, [id]: true }));
      return { previous, id };
    },
    onError: (_e, _id, ctx) => {
      toast.error(
        navigator.onLine
          ? "Progress gagal disimpan. Coba lagi."
          : "Kamu sedang offline. Progress belum tersimpan.",
      );
      if (ctx) setLearned((v) => ({ ...v, [ctx.id]: Boolean(ctx.previous) }));
    },
    onSuccess: (_, id) => {
      toast.success("Progress tersimpan");
      setLearned((v) => ({ ...v, [id]: true }));
      void qc.invalidateQueries({ queryKey: ["my-progress"] });
      void qc.invalidateQueries({ queryKey: ["mastered-items", "kanji", level] });
      void qc.invalidateQueries({ queryKey: ["kanji-one-progress"] });
      void qc.invalidateQueries({ queryKey: ["dashboard-live"] });
    },
  });
  const [audioError, setAudioError] = useState(false),
    speak = (text: string) => {
      if (!("speechSynthesis" in window)) {
        setAudioError(true);
        return false;
      }
      setAudioError(false);
      window.speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(text);
      u.lang = "ja-JP";
      u.rate = 0.85;
      u.onerror = () => setAudioError(true);
      window.speechSynthesis.speak(u);
      return true;
    },
    goPrev = () => {
      if (detailIndex > 0) {
        const t = allCards[detailIndex - 1];
        if (t) openDetail(t.id);
      }
    },
    goNext = () => {
      if (detailIndex >= 0 && detailIndex < allCards.length - 1) {
        const t = allCards[detailIndex + 1];
        if (t) openDetail(t.id);
      }
    },
    masteredCount = allCards.filter((k) => learned[k.id]).length;
  return (
    <AppShell
      title={item ? `Kanji ${level}` : "Kanji"}
      backTo="/belajar"
      backLabel="Materi"
      compact
    >
      {levelLoading ? (
        <div
          aria-label="Memuat level"
          className="my-4 h-24 animate-pulse rounded-2xl bg-muted/60"
        />
      ) : levelError ? (
        <p className="py-8 text-center text-xs text-destructive">
          Level profil tidak dapat dimuat.
        </p>
      ) : (
        <div className="mx-auto min-w-0 max-w-lg overflow-x-hidden pb-[max(1rem,env(safe-area-inset-bottom))]">
          {!item && detailId && relatedLoading ? (
            <div
              aria-label="Memuat kanji"
              className="my-4 h-40 animate-pulse rounded-2xl bg-muted/60"
            />
          ) : !item ? (
            <>
              <div className="mb-3">
                <div className="flex items-end justify-between gap-3">
                  <div>
                    <h1 className="text-[22px] font-black tracking-tight">Kanji {level}</h1>
                    <p className="mt-1 text-[11px] text-muted-foreground">
                      Pilih kanji untuk melihat bacaan, arti, contoh, dan progres.
                    </p>
                  </div>
                  <span className="shrink-0 text-[11px] font-semibold text-muted-foreground">
                    {masteredCount} / {allCards.length}
                  </span>
                </div>
                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-primary transition-[width] motion-reduce:transition-none"
                    style={{
                      width: `${allCards.length ? Math.round((masteredCount / allCards.length) * 100) : 0}%`,
                    }}
                  />
                </div>
              </div>
              <KanjiGuide />
              {lessons.length > 0 && (
                <select
                  value={lesson ?? ""}
                  onChange={(e) => setLesson(Number(e.target.value))}
                  className="mb-3 h-12 w-full rounded-xl border bg-card px-3 text-[13px] font-semibold shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                >
                  <option value="">Pilih pelajaran</option>
                  {lessons.map((n) => (
                    <option key={n} value={n}>
                      Pelajaran Kanji Ke {lessonLabel(level, n)}
                    </option>
                  ))}
                  {extraLesson && <option value={EXTRA_LESSON}>Kanji Tambahan</option>}
                </select>
              )}
              {error && (
                <div className="mb-3 rounded-xl border border-destructive/20 bg-destructive/5 p-3 text-center">
                  <p className="text-xs text-destructive">Gagal memuat materi Kanji.</p>
                  <button
                    type="button"
                    onClick={() => void qc.invalidateQueries({ queryKey: ["kanji", level] })}
                    className="mt-2 min-h-11 rounded-full border px-4 text-[11px] font-semibold"
                  >
                    Coba Lagi
                  </button>
                </div>
              )}
              {isLoading ? (
                <div aria-label="Memuat materi" className="grid grid-cols-4 gap-1.5">
                  {Array.from({ length: 12 }).map((_, i) => (
                    <div key={i} className="h-[68px] animate-pulse rounded-xl bg-muted/60" />
                  ))}
                </div>
              ) : (
                <div className="grid grid-cols-4 gap-1.5">
                  {visibleCards.map((k) => (
                    <button
                      type="button"
                      key={k.id}
                      onClick={() => openDetail(k.id)}
                      aria-label={`Buka kanji ${k.character}${learned[k.id] ? ", sudah dipelajari" : ""}`}
                      className="relative min-h-[76px] rounded-2xl border bg-card px-1 py-2.5 text-center shadow-sm transition-transform hover:-translate-y-0.5 hover:bg-primary/[.04] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary motion-reduce:transition-none motion-reduce:hover:translate-y-0"
                    >
                      <div lang="ja" className="font-jp text-[25px] font-semibold">
                        {k.character}
                      </div>
                      <div className="line-clamp-1 text-[13px] leading-4 text-muted-foreground">
                        {k.meaning_id || "—"}
                      </div>
                      {review[k.id] ? (
                        <Star
                          aria-label="Perlu Review"
                          className="absolute right-1.5 top-1.5 size-3.5 fill-current text-amber-500"
                        />
                      ) : learned[k.id] ? (
                        <Check
                          aria-label="Sudah dipelajari"
                          className="absolute right-1.5 top-1.5 size-3.5 text-primary"
                        />
                      ) : null}
                    </button>
                  ))}
                </div>
              )}
              {pageCount > 1 && (
                <div className="mt-3 flex items-center justify-between gap-2 border-t bg-background py-2">
                  <Button
                    variant="outline"
                    className="h-11 flex-1 rounded-full text-xs"
                    disabled={page === 0}
                    onClick={() => setPage((p) => Math.max(0, p - 1))}
                  >
                    <ChevronLeft className="mr-1 size-4" />
                    Sebelumnya
                  </Button>
                  <span className="text-[13px] font-semibold text-muted-foreground">
                    {page + 1} / {pageCount}
                  </span>
                  <Button
                    variant="outline"
                    className="h-11 flex-1 rounded-full text-xs"
                    disabled={page >= pageCount - 1}
                    onClick={() => setPage((p) => Math.min(pageCount - 1, p + 1))}
                  >
                    Berikutnya
                    <ChevronRight className="ml-1 size-4" />
                  </Button>
                </div>
              )}
            </>
          ) : (
            <div
              onTouchStart={(e) => (touchStart.current = e.touches[0]?.clientX ?? null)}
              onTouchEnd={(e) => {
                const endX = e.changedTouches[0]?.clientX;
                if (
                  touchStart.current != null &&
                  endX !== undefined &&
                  Math.abs(endX - touchStart.current) > 45
                )
                  (endX < touchStart.current ? goNext : goPrev)();
                touchStart.current = null;
              }}
            >
              <div className="mb-2 flex justify-between">
                <button
                  type="button"
                  onClick={closeDetail}
                  className="flex min-h-11 items-center gap-1 rounded-lg px-2 text-[11px] font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                >
                  <ArrowLeft className="size-3.5" />
                  Kanji {level}
                </button>
                <span className="text-[13px] font-semibold text-muted-foreground">
                  {detailIndex >= 0 ? `${detailIndex + 1} / ${allCards.length}` : item.level}
                </span>
              </div>
              <div className="grid grid-cols-[44px_1fr_44px] items-center gap-2">
                <button
                  type="button"
                  aria-label="Kanji sebelumnya"
                  onClick={goPrev}
                  disabled={detailIndex <= 0}
                  className="grid size-11 place-items-center rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:opacity-40"
                >
                  <ArrowLeft className="mx-auto size-4" />
                </button>
                <div className="text-center">
                  <div lang="ja" className="font-jp text-[66px] font-semibold">
                    {item.character}
                  </div>
                  <p lang="ja" className="font-jp text-[14px] leading-6 text-muted-foreground">
                    {(item.onyomi ?? []).join("・")} {(item.kunyomi ?? []).join("・")}
                  </p>
                  <p className="text-[16px] font-bold">
                    {item.meaning_id || "Arti belum tersedia"}
                  </p>
                </div>
                <button
                  type="button"
                  aria-label="Kanji selanjutnya"
                  onClick={goNext}
                  disabled={detailIndex < 0 || detailIndex === allCards.length - 1}
                  className="grid size-11 place-items-center rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:opacity-40"
                >
                  <ArrowRight className="mx-auto size-4" />
                </button>
              </div>
              <div className="mt-3 flex justify-center">
                <button
                  type="button"
                  aria-label={`Putar pengucapan ${item.character}`}
                  onClick={() => speak(item.character)}
                  className="grid size-11 place-items-center rounded-full bg-primary text-primary-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                >
                  <Volume2 className="size-4" />
                </button>
              </div>
              {audioError && (
                <p role="alert" className="mt-2 text-center text-[11px] text-destructive">
                  Audio tidak tersedia di perangkat ini.
                </p>
              )}
              <div className="mt-4 grid grid-cols-3 gap-1.5">
                <Info label="Onyomi" value={(item.onyomi ?? []).join("・") || "—"} />
                <Info label="Kunyomi" value={(item.kunyomi ?? []).join("・") || "—"} />
                <Info label="Jumlah Coretan" value={String(item.stroke_count ?? "—")} />
              </div>
              <KanjiStructureSection
                kanjiId={item.id}
                character={item.character}
                level={level}
                onOpen={(id) => {
                  openDetail(id);
                  window.scrollTo({ top: 0 });
                }}
              />
              {studyError && (
                <div className="mt-4 rounded-xl border border-destructive/20 bg-destructive/5 p-3 text-center">
                  <p className="text-[11px] text-destructive">Detail Kanji gagal dimuat.</p>
                  <button
                    type="button"
                    onClick={() =>
                      void qc.invalidateQueries({ queryKey: ["kanji-study", item.id] })
                    }
                    className="mt-2 min-h-11 rounded-full border px-4 text-[11px] font-semibold"
                  >
                    Coba Lagi
                  </button>
                </div>
              )}
              {studyLoading && (
                <div
                  aria-label="Memuat detail Kanji"
                  className="mt-4 h-24 animate-pulse rounded-xl bg-muted/60"
                />
              )}
              {(study?.relatedWords?.length ?? 0) > 0 && (
                <section className="mt-4">
                  <h3 className="text-[16px] font-bold">Contoh Kosakata</h3>
                  <div className="mt-2 space-y-2">
                    {(study?.relatedWords ?? []).slice(0, 4).map((w, i: number) => (
                      <div key={i} className="border-b pb-2 last:border-0">
                        <p lang="ja" className="font-jp text-[15px] font-semibold">
                          {highlight(w.term, item.character)}{" "}
                          <span className="font-normal text-muted-foreground">
                            — {w.reading || "—"}
                          </span>
                        </p>
                        <p className="mt-0.5 text-[14px] leading-5 text-muted-foreground">
                          {w.meaning || "Arti belum tersedia"}
                        </p>
                      </div>
                    ))}
                  </div>
                </section>
              )}
              {asExamples(study?.examples).length > 0 && (
                <section className="mt-4">
                  <h3 className="text-[16px] font-bold">Contoh Kalimat</h3>
                  {asExamples(study?.examples)
                    .slice(0, 1)
                    .map((e, i) => {
                      const reading = normalizeJapaneseSpacing(e.reading);
                      const romaji = exampleRomaji({ romaji: e.romaji, reading });
                      return (
                        <div key={i} className="mt-2 rounded-lg bg-muted/35 p-2.5">
                          <p
                            lang="ja"
                            className="break-words font-jp text-[16px] leading-7 [overflow-wrap:anywhere]"
                          >
                            {highlight(e.jp || "", item.character)}
                          </p>
                          {reading && (
                            <p
                              lang="ja"
                              className="mt-0.5 font-jp text-[14px] leading-6 text-muted-foreground"
                            >
                              {reading}
                            </p>
                          )}
                          {romaji && (
                            <p className="break-words text-[13px] italic leading-5 text-muted-foreground [overflow-wrap:anywhere]">
                              {romaji}
                            </p>
                          )}
                          <p className="mt-1 text-[14px] leading-6">
                            {e.id || "Arti Bahasa Indonesia belum tersedia"}
                          </p>
                        </div>
                      );
                    })}
                </section>
              )}
              <div className="mt-3 border-t bg-background px-1.5 py-1">
                <div className="mx-auto grid max-w-none grid-cols-[36px_1fr_auto_1fr_36px] items-center gap-1">
                  <Button
                    variant="ghost"
                    aria-label="Materi sebelumnya"
                    disabled={detailIndex <= 0}
                    onClick={prev}
                    className="size-9 rounded-full p-0 transition-transform duration-150 active:scale-95 motion-reduce:transition-none motion-reduce:active:scale-100"
                  >
                    <ChevronLeft className="size-4" />
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => reviewMutation.mutate(item.id)}
                    disabled={reviewMutation.isPending || review[item.id]}
                    className="h-9 min-w-0 rounded-full px-2 text-[11px] transition-transform duration-150 active:scale-95 motion-reduce:transition-none motion-reduce:active:scale-100"
                  >
                    <Star
                      className={`mr-1 size-3.5 transition-transform duration-150 ${review[item.id] ? "fill-current scale-110" : ""} motion-reduce:transition-none`}
                    />
                    <span className="truncate">Review</span>
                  </Button>
                  <span className="min-w-11 text-center text-[10px] font-semibold text-muted-foreground">
                    {detailIndex >= 0 ? `${detailIndex + 1}/${allCards.length}` : item.level}
                  </span>
                  <Button
                    onClick={() => mutation.mutate(item.id)}
                    disabled={mutation.isPending || learned[item.id]}
                    className="h-9 min-w-0 rounded-full px-2 text-[11px] transition-transform duration-150 active:scale-95 motion-reduce:transition-none motion-reduce:active:scale-100"
                  >
                    <Check
                      className={`mr-1 size-3.5 transition-transform duration-150 ${learned[item.id] ? "scale-110" : ""} motion-reduce:transition-none`}
                    />
                    <span className="truncate">Dipelajari</span>
                  </Button>
                  <Button
                    variant="ghost"
                    aria-label="Materi selanjutnya"
                    disabled={detailIndex < 0 || detailIndex === allCards.length - 1}
                    onClick={next}
                    className="size-9 rounded-full p-0 transition-transform duration-150 active:scale-95 motion-reduce:transition-none motion-reduce:active:scale-100"
                  >
                    <ChevronRight className="size-4" />
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </AppShell>
  );
}
function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 rounded-xl bg-primary/[.07] p-3">
      <p className="text-[12px] text-muted-foreground">{label}</p>
      <p className="mt-1 break-words font-jp text-[14px] font-semibold leading-5">{value}</p>
    </div>
  );
}
