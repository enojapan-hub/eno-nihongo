import { createFileRoute } from "@tanstack/react-router";
import { ContinueToFlashcard } from "@/components/learn/ContinueToFlashcard";
import { toast } from "sonner";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { ArrowLeft, Check, ChevronDown, ChevronLeft, ChevronRight, Info, Star } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { ItemMasteryCard } from "@/components/learn/ItemMasteryCard";
import { Button } from "@/components/ui/button";
import { addItemToReview, markItemLearned, type Level } from "@/lib/learn-queries";
import { fetchTargetLevel } from "@/lib/target-level";
import { normalizeJapaneseSpacing, normalizeRomaji } from "@/lib/japanese-spacing";
import { supabase } from "@/integrations/supabase/client";
import { getAuthUser } from "@/lib/auth-user";
import { learnedActionLabel } from "@/lib/material-progress";

export const Route = createFileRoute("/_authenticated/bunpo")({ component: BunpoPage });
const split = (v?: string | null) =>
  v
    ?.split(/\n|\\n|;/)
    .map((x) => x.trim())
    .filter(Boolean) ?? [];
const usable = (id?: string | null) => !!id?.trim();
const hasKanji = (v?: string | null) => !!v && /[一-龯々]/.test(v);
type GrammarExample = {
  jp?: string | undefined;
  reading?: string | undefined;
  romaji?: string | undefined;
  id?: string | undefined;
};
type WrongExample = {
  wrong?: string | undefined;
  wrong_hiragana?: string | undefined;
  wrong_romaji?: string | undefined;
  reason_id?: string | undefined;
  correct?: string | undefined;
  correct_hiragana?: string | undefined;
  correct_romaji?: string | undefined;
  id?: string | undefined;
};
function objects(value: unknown): Array<Record<string, unknown>> {
  if (!value) return [];
  const raw = Array.isArray(value)
    ? value
    : typeof value === "string"
      ? (() => {
          try {
            return JSON.parse(value);
          } catch {
            return [];
          }
        })()
      : [];
  return Array.isArray(raw)
    ? raw.filter((x): x is Record<string, unknown> => !!x && typeof x === "object")
    : [];
}
const str = (...v: unknown[]) => {
  const x = v.find((x) => typeof x === "string" && x.trim());
  return typeof x === "string" ? x.trim() : undefined;
};
function parseExamples(value: unknown): GrammarExample[] {
  return objects(value)
    .map((x) => ({
      jp: str(x["japanese"], x["jp"], x["ja"], x["sentence"], x["example"]),
      reading: str(x["hiragana"], x["reading"]),
      romaji: str(x["romaji"]),
      id: str(
        x["meaning_id"],
        x["id"],
        x["indonesian"],
        x["idn"],
        x["translation_id"],
        x["meaning"],
      ),
    }))
    .filter((x) => x.jp || x.id);
}
function parseWrong(value: unknown): WrongExample[] {
  return objects(value)
    .map((x) => ({
      wrong: str(x["wrong_japanese"], x["wrong"], x["jp"], x["ja"], x["japanese"]),
      wrong_hiragana: str(x["wrong_hiragana"], x["wrong_reading"], x["hiragana"], x["reading"]),
      wrong_romaji: str(x["wrong_romaji"], x["romaji"]),
      reason_id: str(x["reason_id"], x["reason"], x["why_wrong"]),
      correct: str(x["correct_japanese"], x["correct"], x["corrected_japanese"], x["correct_jp"]),
      correct_hiragana: str(x["correct_hiragana"], x["correct_reading"], x["corrected_hiragana"]),
      correct_romaji: str(x["correct_romaji"], x["corrected_romaji"]),
      id: str(
        x["meaning_id"],
        x["id"],
        x["indonesian"],
        x["idn"],
        x["translation_id"],
        x["meaning"],
      ),
    }))
    .filter((x) => x.wrong || x.correct);
}
async function fetchGrammarList(level: Level) {
  const { data, error } = await supabase
    .from("grammar_points")
    .select(
      "id, pattern, reading_hiragana, romaji, meaning_id, level, sort_order, lesson_number, lesson_title",
    )
    .eq("level", level)
    .eq("is_published", true)
    .order("lesson_number", { ascending: true, nullsFirst: false })
    .order("sort_order", { ascending: true });
  if (error) throw error;
  return data ?? [];
}
async function fetchGrammarDetail(id: string) {
  const { data, error } = await supabase
    .from("grammar_points")
    .select(
      "id, pattern, reading_hiragana, romaji, meaning_id, structure, explanation_id, usage_id, examples, wrong_examples, notes_id, level, sort_order, source_book, lesson_number, lesson_title",
    )
    .eq("id", id)
    .eq("is_published", true)
    .maybeSingle();
  if (error) throw error;
  return data;
}
function grammarTargets(pattern: string) {
  return [
    ...new Set(
      [pattern, ...pattern.split(/[・／/]|\s+/)]
        .map((x) => x.trim().replace(/^[～〜]|[～〜]$/g, ""))
        .filter((x) => x.length >= 2),
    ),
  ].sort((a, b) => b.length - a.length);
}
function highlightGrammar(text: string, pattern: string): ReactNode {
  if (!text || !pattern) return normalizeJapaneseSpacing(text);
  const spaced = normalizeJapaneseSpacing(text);
  const targets = grammarTargets(pattern);
  let nodes: ReactNode[] = [spaced];
  for (const target of targets) {
    const variants = [target, normalizeJapaneseSpacing(target)].filter(
      (x, i, a) => x && a.indexOf(x) === i,
    );
    for (const variant of variants) {
      nodes = nodes.flatMap((node, ni): ReactNode[] => {
        if (typeof node !== "string") return [node];
        const parts = node.split(variant);
        if (parts.length === 1) return [node];
        return parts.flatMap((p, i) =>
          i < parts.length - 1
            ? [
                p,
                <mark
                  key={`${variant}-${ni}-${i}`}
                  className="bg-transparent font-bold text-primary"
                >
                  {variant}
                </mark>,
              ]
            : [p],
        );
      });
    }
  }
  return <>{nodes}</>;
}
function FormulaText({ text }: { text: string }) {
  const parts = text.split(/(~~.*?~~)/g);
  return (
    <>
      {parts.map((part, i) =>
        part.startsWith("~~") && part.endsWith("~~") ? (
          <del key={i} className="decoration-2 opacity-70">
            {part.slice(2, -2)}
          </del>
        ) : (
          <span key={i}>{part}</span>
        ),
      )}
    </>
  );
}
function Reading({
  pattern,
  reading,
  romaji,
}: {
  pattern: string;
  reading?: string | null;
  romaji?: string | null;
}) {
  if (!hasKanji(pattern)) return null;
  const h = reading?.trim(),
    r = romaji?.trim();
  return h ? (
    <span className="block mt-1 font-normal text-muted-foreground text-[13px] leading-5">
      <FormulaText text={h} />
      {r && (
        <>
          <br />
          <span className="text-[12px]">
            <FormulaText
              text={normalizeRomaji(r)
                .replace(/-?masu\s*stem/gi, "~~masu~~")
                .replace(/ます(?:形|けい)/g, "~~ます~~")}
            />
          </span>
        </>
      )}
    </span>
  ) : (
    <span className="block mt-1 font-normal text-muted-foreground text-[12px]">
      bacaan belum tersedia
    </span>
  );
}
function BunpoPage() {
  const {
    data: targetLevel,
    isLoading: levelLoading,
    error: levelError,
  } = useQuery({ queryKey: ["target-level"], queryFn: fetchTargetLevel });
  const level: Level = targetLevel ?? "N5";
  const { data, isLoading, error } = useQuery({
    queryKey: ["grammar-list", level],
    queryFn: () => fetchGrammarList(level),
    enabled: !!targetLevel,
    staleTime: 5 * 60 * 1000,
  });
  const { data: masteredRows } = useQuery({
    queryKey: ["mastered-items", "grammar", level],
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
        .eq("item_type", "grammar")
        .eq("level", level)
        .in("status", ["learning", "review", "mastered"]);
      if (error) throw error;
      return (data ?? []) as Array<{ item_id: string; status: string }>;
    },
  });
  const cards = useMemo(() => (data ?? []).filter((c) => usable(c.meaning_id)), [data]);
  const lessons = useMemo(
    () =>
      [
        ...new Set(
          cards.map((c) => c.lesson_number).filter((n): n is number => typeof n === "number"),
        ),
      ].sort((a, b) => a - b),
    [cards],
  );
  const [lesson, setLesson] = useState<number | null>(() => {
      const v = localStorage.getItem(`eno:materi:bunpo:${level}:lesson`);
      return v ? Number(v) : null;
    }),
    [detailId, setDetailId] = useState<string | null>(() =>
      new URLSearchParams(window.location.search).get("id"),
    ),
    [learned, setLearned] = useState<Record<string, boolean>>({}),
    [review, setReview] = useState<Record<string, boolean>>({});
  const touch = useRef<number | null>(null),
    detailHistory = useRef(false),
    scrollY = useRef(Number(sessionStorage.getItem(`eno:materi:bunpo:${level}:scroll`) || 0)),
    qc = useQueryClient();
  useEffect(() => {
    if (!targetLevel) return;
    const saved = localStorage.getItem(`eno:materi:bunpo:${targetLevel}:lesson`);
    setLesson(saved ? Number(saved) : null);
  }, [targetLevel]);
  useEffect(() => {
    if (lesson != null) localStorage.setItem(`eno:materi:bunpo:${level}:lesson`, String(lesson));
  }, [level, lesson]);
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
      sessionStorage.setItem(`eno:materi:bunpo:${level}:scroll`, String(scrollY.current));
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
  const activeLesson = lesson ?? lessons[0] ?? null,
    list = activeLesson == null ? cards : cards.filter((c) => c.lesson_number === activeLesson),
    detailIndex = detailId ? cards.findIndex((c) => c.id === detailId) : -1;
  const {
    data: item,
    isLoading: detailLoading,
    error: detailError,
  } = useQuery({
    queryKey: ["grammar-detail", detailId],
    queryFn: () => fetchGrammarDetail(detailId!),
    enabled: !!detailId,
    staleTime: 10 * 60 * 1000,
  });
  const examples = item ? parseExamples(item.examples) : [],
    wrong = item ? parseWrong(item.wrong_examples) : [],
    structures = item ? split(item.structure) : [];
  useEffect(() => {
    if (detailIndex < 0) return;
    for (const candidate of [cards[detailIndex - 1], cards[detailIndex + 1]])
      if (candidate)
        void qc.prefetchQuery({
          queryKey: ["grammar-detail", candidate.id],
          queryFn: () => fetchGrammarDetail(candidate.id),
          staleTime: 10 * 60 * 1000,
        });
  }, [detailIndex, cards, qc]);
  const reviewMutation = useMutation({
    mutationFn: (id: string) => addItemToReview({ itemType: "grammar", itemId: id, level }),
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
      void qc.invalidateQueries({ queryKey: ["mastered-items", "grammar", level] });
      void qc.invalidateQueries({ queryKey: ["my-progress"] });
      void qc.invalidateQueries({ queryKey: ["dashboard-live"] });
    },
  });
  const mutation = useMutation({
    mutationFn: (id: string) => markItemLearned({ itemType: "grammar", itemId: id, level }),
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
      void qc.invalidateQueries({ queryKey: ["mastered-items", "grammar", level] });
      void qc.invalidateQueries({ queryKey: ["dashboard-live"] });
    },
  });
  const prev = () => {
      if (detailIndex > 0) {
        const t = cards[detailIndex - 1];
        if (t) openDetail(t.id);
      }
    },
    next = () => {
      if (detailIndex >= 0 && detailIndex < cards.length - 1) {
        const t = cards[detailIndex + 1];
        if (t) openDetail(t.id);
      }
    },
    finishSwipe = (x: number) => {
      if (touch.current == null) return;
      const d = x - touch.current;
      if (Math.abs(d) > 45) (d < 0 ? next : prev)();
      touch.current = null;
    };
  return (
    <AppShell title="Bunpō" backTo="/belajar" backLabel="Materi" compact>
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
          {!detailId ? (
            <>
              <div className="mb-3 eno-rise">
                <div className="flex items-end justify-between gap-3">
                  <div>
                    <h1 className="text-[22px] font-black tracking-tight">Bunpou {level}</h1>
                    <p className="mt-1 text-[11px] text-muted-foreground">
                      Pelajari pola, fungsi, rumus, serta contoh benar dan salah.
                    </p>
                  </div>
                  <span className="shrink-0 text-[11px] font-semibold text-muted-foreground">
                    {cards.filter((c) => learned[c.id]).length} / {cards.length}
                  </span>
                </div>
                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-primary transition-[width] motion-reduce:transition-none"
                    style={{
                      width: `${cards.length ? Math.round((cards.filter((c) => learned[c.id]).length / cards.length) * 100) : 0}%`,
                    }}
                  />
                </div>
              </div>
              {lessons.length > 0 && (
                <div className="relative mb-3 eno-rise">
                  <select
                    value={activeLesson ?? ""}
                    onChange={(e) => setLesson(Number(e.target.value))}
                    className="h-12 w-full appearance-none rounded-xl border bg-card px-3 pr-9 text-[13px] font-semibold shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                  >
                    {lessons.map((n) => (
                      <option key={n} value={n}>
                        Pelajaran {n}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="pointer-events-none absolute right-3 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
                </div>
              )}
              {error && (
                <div className="mb-3 rounded-xl border border-destructive/20 bg-destructive/5 p-3 text-center">
                  <p className="text-xs text-destructive">Bunpō gagal dimuat.</p>
                  <button
                    type="button"
                    onClick={() => void qc.invalidateQueries({ queryKey: ["grammar-list", level] })}
                    className="mt-2 min-h-11 rounded-full border px-4 text-[11px] font-semibold"
                  >
                    Coba Lagi
                  </button>
                </div>
              )}
              {isLoading ? (
                <div aria-label="Memuat materi" className="space-y-1.5">
                  {Array.from({ length: 7 }).map((_, i) => (
                    <div key={i} className="h-14 animate-pulse rounded-xl bg-muted/60" />
                  ))}
                </div>
              ) : (
                <div className="space-y-1.5">
                  {list.map((g) => (
                    <button
                      type="button"
                      key={g.id}
                      onClick={() => openDetail(g.id)}
                      aria-label={`Buka bunpou ${g.pattern}${learned[g.id] ? ", sudah dipelajari" : ""}`}
                      className="flex min-h-[64px] w-full items-center gap-3 rounded-2xl border bg-card px-3.5 py-2.5 text-left shadow-sm eno-rise transition-transform hover:-translate-y-0.5 hover:bg-primary/[.03] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary motion-reduce:transition-none motion-reduce:hover:translate-y-0"
                    >
                      <span className="grid size-7 shrink-0 place-items-center rounded-md bg-primary/7 text-[10px] font-bold text-primary">
                        文
                      </span>
                      <div className="min-w-0 flex-1">
                        <div lang="ja" className="font-jp text-[14px] font-bold">
                          {normalizeJapaneseSpacing(g.pattern)}
                          <Reading
                            pattern={g.pattern}
                            reading={g.reading_hiragana}
                            romaji={g.romaji}
                          />
                        </div>
                        <p className="mt-1 line-clamp-2 text-[11px] leading-4 text-muted-foreground">
                          {g.meaning_id}
                        </p>
                      </div>
                      {review[g.id] ? (
                        <Star
                          aria-label="Perlu Review"
                          className="size-3.5 fill-current text-amber-500"
                        />
                      ) : learned[g.id] ? (
                        <Check aria-label="Sudah dipelajari" className="size-3.5 text-primary" />
                      ) : null}
                      <ChevronRight className="size-3.5 text-muted-foreground" />
                    </button>
                  ))}
                </div>
              )}
            </>
          ) : detailError ? (
            <div className="py-10 text-center">
              <p className="text-xs text-destructive">Detail Bunpou gagal dimuat.</p>
              <Button
                variant="outline"
                className="mt-3 h-12 rounded-full text-[13px]"
                onClick={() =>
                  void qc.invalidateQueries({ queryKey: ["grammar-detail", detailId] })
                }
              >
                Coba Lagi
              </Button>
            </div>
          ) : detailLoading || !item ? (
            <div aria-label="Memuat detail" className="space-y-3 py-3">
              <div className="h-20 animate-pulse rounded-xl bg-muted/60" />
              <div className="h-48 animate-pulse rounded-xl bg-muted/60" />
            </div>
          ) : (
            <div
              className="eno-rise"
              onTouchStart={(e) => (touch.current = e.touches[0]?.clientX ?? null)}
              onTouchEnd={(e) => {
                const endX = e.changedTouches[0]?.clientX;
                if (endX !== undefined) finishSwipe(endX);
              }}
            >
              <div className="mb-1 flex items-center justify-between">
                <button
                  type="button"
                  onClick={closeDetail}
                  className="flex min-h-11 items-center gap-1 rounded-lg px-2 text-[11px] font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                >
                  <ArrowLeft className="size-3.5" />
                  Bunpou {level}
                </button>
                <span className="text-[13px] font-semibold text-muted-foreground">
                  {detailIndex + 1} / {cards.length}
                </span>
              </div>
              <p className="mb-2 text-center text-[12px] text-muted-foreground">
                ← Geser ke kiri / kanan untuk pindah materi →
              </p>
              <div className="min-w-0 max-w-full overflow-hidden rounded-xl border bg-card px-3.5 py-2.5 [overflow-wrap:anywhere]">
                <h1
                  lang="ja"
                  className="font-jp text-[26px] sm:text-[28px] font-bold leading-[1.35] break-words"
                >
                  <FormulaText text={item.pattern} />
                  <Reading
                    pattern={item.pattern}
                    reading={item.reading_hiragana}
                    romaji={item.romaji}
                  />
                </h1>
                <DetailSection title="Arti">
                  <p>{item.meaning_id}</p>
                </DetailSection>
                <DetailSection title="Fungsi">
                  <p className="whitespace-pre-line">
                    {item.explanation_id?.trim() ||
                      "Penjelasan fungsi belum tersedia pada data materi."}
                  </p>
                </DetailSection>
                <DetailSection title="Struktur / Rumus">
                  <details className="mb-1.5">
                    <summary className="ml-auto flex w-fit cursor-pointer select-none items-center gap-1 text-[12px] font-semibold text-muted-foreground">
                      <Info className="size-3.5" /> Panduan
                    </summary>
                  <div className="mt-1 rounded-md bg-muted/50 px-2 py-1.5 text-[12px] leading-5 text-muted-foreground">
                    <span className="font-semibold text-foreground">Singkatan:</span> KK = Kata
                    Kerja · KB = Kata Benda · KS-i = Kata Sifat-i · KS-na = Kata Sifat-na · KKet =
                    Kata Keterangan · KT = Kata Tempat · KW = Kata Waktu · KBil = Kata Bilangan ·
                    KTa = Kata Tanya
                    <br />
                    <span className="font-semibold text-foreground">Simbol:</span>{" "}
                    <del>coretan</del> = buang · + = tambahkan · → = hasil/perubahan
                  </div>
                  </details>
                  {structures.length ? (
                    structures.map((s, i) => (
                      <p key={i} lang="ja" className="font-jp">
                        <FormulaText text={s} />
                      </p>
                    ))
                  ) : (
                    <p className="text-muted-foreground">Rumus belum tersedia pada data materi.</p>
                  )}
                </DetailSection>
                <DetailSection title="Cara Penggunaan">
                  <p className="whitespace-pre-line">
                    {item.usage_id?.trim() || "Cara penggunaan belum tersedia pada data materi."}
                  </p>
                </DetailSection>
                <DetailSection title="Contoh Benar" tone="good">
                  {examples.length ? (
                    examples.slice(0, 3).map((e, i) => (
                      <div key={i} className={i ? "mt-3" : ""}>
                        <p lang="ja" className="font-jp">
                          {i + 1}. {e.jp && highlightGrammar(e.jp, item.pattern)}
                        </p>
                        {e.reading && (
                          <p className="text-muted-foreground">
                            Hiragana: {normalizeJapaneseSpacing(e.reading)}
                          </p>
                        )}
                        {e.romaji && (
                          <p className="text-muted-foreground">
                            Romaji: {normalizeRomaji(e.romaji)}
                          </p>
                        )}
                        {e.id && <p className="text-muted-foreground">Arti: {e.id}</p>}
                      </div>
                    ))
                  ) : (
                    <p className="text-muted-foreground">
                      Contoh benar belum tersedia pada data materi level {level}.
                    </p>
                  )}
                </DetailSection>
                <DetailSection title="Contoh Salah ✕" tone="bad" collapsible>
                  {wrong.length ? (
                    wrong.slice(0, 3).map((e, i) => (
                      <div key={i} className={i ? "mt-3" : ""}>
                        {e.wrong && (
                          <p lang="ja" className="font-jp">
                            ❌ {normalizeJapaneseSpacing(e.wrong)}
                          </p>
                        )}
                        {e.wrong_hiragana && (
                          <p className="text-muted-foreground">
                            Hiragana: {normalizeJapaneseSpacing(e.wrong_hiragana)}
                          </p>
                        )}
                        {e.wrong_romaji && (
                          <p className="text-muted-foreground">
                            Romaji: {normalizeRomaji(e.wrong_romaji)}
                          </p>
                        )}
                        {e.reason_id && (
                          <div className="mt-1">
                            <p className="font-semibold">Kenapa salah:</p>
                            <p>{e.reason_id}</p>
                          </div>
                        )}
                        {e.correct && (
                          <div className="mt-2">
                            <p className="font-semibold text-primary">✓ Perbaikan:</p>
                            <p lang="ja" className="font-jp">
                              {normalizeJapaneseSpacing(e.correct)}
                            </p>
                            {e.correct_hiragana && (
                              <p className="text-muted-foreground">
                                Hiragana: {normalizeJapaneseSpacing(e.correct_hiragana)}
                              </p>
                            )}
                            {e.correct_romaji && (
                              <p className="text-muted-foreground">
                                Romaji: {normalizeRomaji(e.correct_romaji)}
                              </p>
                            )}
                            {e.id && <p className="text-muted-foreground">Arti: {e.id}</p>}
                          </div>
                        )}
                      </div>
                    ))
                  ) : (
                    <p className="text-muted-foreground">
                      Contoh salah belum tersedia pada data materi.
                    </p>
                  )}
                </DetailSection>
                <DetailSection title="Catatan" collapsible>
                  <p className="whitespace-pre-line text-muted-foreground">
                    {item.notes_id?.trim() || "Catatan khusus belum tersedia pada data materi."}
                  </p>
                </DetailSection>
              </div>
              <ItemMasteryCard itemType="grammar" itemId={item.id} learned={Boolean(learned[item.id])} />
              {mutation.isSuccess && mutation.variables === item.id && <ContinueToFlashcard />}
              <div className="mt-3 border-t bg-background px-1.5 py-1">
                <div className="mx-auto grid max-w-none grid-cols-[36px_1fr_auto_1fr_36px] items-center gap-1">
                  <Button
                    variant="ghost"
                    aria-label="Materi sebelumnya"
                    disabled={detailIndex === 0}
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
                    {detailIndex + 1}/{cards.length}
                  </span>
                  <Button
                    onClick={() => mutation.mutate(item.id)}
                    disabled={mutation.isPending || learned[item.id]}
                    variant={learned[item.id] ? "secondary" : "default"}
                    aria-label={learned[item.id] ? "Sudah dipelajari" : "Tandai dipelajari"}
                    className="h-9 min-w-0 rounded-full px-2 text-[11px] transition-transform duration-150 active:scale-95 motion-reduce:transition-none motion-reduce:active:scale-100"
                  >
                    <Check
                      className={`mr-1 size-3.5 transition-transform duration-150 ${learned[item.id] ? "scale-110" : ""} motion-reduce:transition-none`}
                    />
                    <span className="truncate">{learnedActionLabel(Boolean(learned[item.id]))}</span>
                  </Button>
                  <Button
                    variant="ghost"
                    aria-label="Materi selanjutnya"
                    disabled={detailIndex === cards.length - 1}
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
function DetailSection({
  title,
  tone,
  collapsible = false,
  children,
}: {
  title: string;
  tone?: "good" | "bad";
  collapsible?: boolean;
  children: React.ReactNode;
}) {
  const titleClass = `text-[14px] font-bold ${tone === "good" ? "text-emerald-600" : tone === "bad" ? "text-rose-600" : ""}`;
  if (collapsible)
    return (
      <details className="border-b py-2.5 last:border-b-0">
        <summary className={`${titleClass} cursor-pointer select-none`}>{title}</summary>
        <div className="mt-2 text-[14px] leading-6">{children}</div>
      </details>
    );
  return (
    <section className="border-b py-2.5 last:border-b-0">
      <h2 className={titleClass}>{title}</h2>
      <div className="mt-1 text-[14px] leading-6">{children}</div>
    </section>
  );
}
