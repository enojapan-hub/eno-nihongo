import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, BrainCircuit, CheckCircle2, Lightbulb, XCircle } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { FeatureGuide } from "@/components/learn/FeatureGuide";
import { supabase } from "@/integrations/supabase/client";
import { classifyError, SLOW_MS } from "@/lib/kioku/classify";
import { createOutbox } from "@/lib/kioku/outbox";
import { prefetchSession, sendEvents } from "@/lib/kioku/prefetch";
import { queueRepeat, scheduleDelayed } from "@/lib/kioku/session";
import type { Exercise, KiokuSession } from "@/lib/kioku/session-types";
import { clearSession, loadSession, saveSession } from "@/lib/kioku/session-store";
import type { Confidence } from "@/lib/kioku/types";

export const Route = createFileRoute("/_authenticated/kioku")({
  head: () => ({ meta: [{ title: "Kioku — ENO NIHONGO" }] }),
  component: KiokuPage,
});

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const FLUSH_EVERY = 5;
const FLUSH_INTERVAL_MS = 15000;
const AUTO_ADVANCE_MS = 700;

type Answer = {
  correct: boolean;
  selectedId: string | null;
  confidence: Confidence | null;
  usedHint: boolean;
  responseMs: number;
};

function KiokuPage() {
  const [userId, setUserId] = useState<string | null>(null);
  const [session, setSession] = useState<KiokuSession | null>(null);
  const [ready, setReady] = useState<KiokuSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [picked, setPicked] = useState<string | null>(null);
  const [revealed, setRevealed] = useState(false);
  const [confidence, setConfidence] = useState<Confidence | null>(null);
  const [hintOpen, setHintOpen] = useState(false);
  const [usedHint, setUsedHint] = useState(false);
  const [orderedParts, setOrderedParts] = useState<string[]>([]);
  const revealMs = useRef(0);
  const shownAt = useRef(Date.now());
  const outbox = useRef<ReturnType<typeof createOutbox> | null>(null);
  const sinceFlush = useRef(0);

  // Identity comes from the locally cached session (no network round trip).
  useEffect(() => {
    void supabase.auth.getSession().then(({ data }) => setUserId(data.session?.user.id ?? null));
  }, []);

  // Restore an unfinished session, retry pending outbox events, and prefetch the next session in the background.
  useEffect(() => {
    if (!userId) return;
    const box = createOutbox(userId, window.localStorage, sendEvents);
    outbox.current = box;
    void box.flush();
    const restored = loadSession(window.localStorage, userId);
    if (restored) {
      setSession(restored);
      setLoading(false);
      shownAt.current = Date.now();
      return undefined;
    }
    let alive = true;
    prefetchSession(userId)
      .then((s) => {
        if (alive) setReady(s);
      })
      .catch(() => {
        if (alive) setError("Gagal menyiapkan sesi. Coba lagi.");
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [userId]);

  // Safe flush points: interval, tab hidden, page hide.
  useEffect(() => {
    const flush = () => void outbox.current?.flush();
    const t = window.setInterval(flush, FLUSH_INTERVAL_MS);
    const vis = () => {
      if (document.visibilityState === "hidden") flush();
    };
    document.addEventListener("visibilitychange", vis);
    window.addEventListener("pagehide", flush);
    return () => {
      window.clearInterval(t);
      document.removeEventListener("visibilitychange", vis);
      window.removeEventListener("pagehide", flush);
      flush();
    };
  }, []);

  const ex: Exercise | undefined =
    session && !session.finished ? session.exercises[session.index] : undefined;
  const total = session?.exercises.length ?? 0;
  const answered = ex ? ex.id in (session?.results ?? {}) : false;
  const isSentenceOrder = !!ex && ex.exerciseType === "sentence_order";
  const isChoice = !!ex && ex.exerciseType !== "recall_flip" && !isSentenceOrder;
  const showHint = !!ex && !isChoice && ex.hintLevel >= 1 && (hintOpen || ex.hintLevel === 2);

  const resetExerciseUi = () => {
    setPicked(null);
    setRevealed(false);
    setConfidence(null);
    setHintOpen(false);
    setUsedHint(false);
    setOrderedParts([]);
    revealMs.current = 0;
    shownAt.current = Date.now();
  };

  const start = useCallback(() => {
    if (!ready || !userId) return;
    saveSession(window.localStorage, userId, ready);
    setSession(ready);
    setReady(null);
    resetExerciseUi();
  }, [ready, userId]);

  // Local-first: state + outbox (sync localStorage write) only; the network flush is fire-and-forget.
  const record = useCallback(
    (exercise: Exercise, a: Answer): KiokuSession | null => {
      if (!session || !userId) return null;
      const chosen = a.selectedId ? exercise.options.find((o) => o.id === a.selectedId) : undefined;
      const errorType = classifyError({
        correct: a.correct,
        aspect: exercise.aspect,
        exerciseType: exercise.exerciseType,
        responseMs: a.responseMs,
        usedHint: a.usedHint,
        selectedWasConfusable: !a.correct && !!chosen?.confusable,
      });
      outbox.current?.push({
        client_event_id: crypto.randomUUID(),
        session_id: session.sessionId,
        item_type: exercise.itemType,
        item_id: exercise.itemId,
        level: exercise.level,
        aspect: exercise.aspect,
        direction: exercise.direction,
        exercise_type: exercise.exerciseType,
        correct: a.correct,
        selected_answer: chosen?.text ?? null,
        selected_item_id: chosen && UUID.test(chosen.id) ? chosen.id : null,
        variant: exercise.isRepeat ? "repeat" : (exercise.variant ?? null),
        retention: exercise.isDelayed
          ? "delayed"
          : exercise.retention === "retest"
            ? "retest"
            : "immediate",
        context_ref: exercise.contextRef ?? null,
        confidence: a.confidence,
        hint_level: exercise.hintLevel,
        used_hint: a.usedHint,
        response_ms: a.responseMs,
        error_type: errorType,
        occurred_at: new Date().toISOString(),
      });
      if (++sinceFlush.current >= FLUSH_EVERY) {
        sinceFlush.current = 0;
        void outbox.current?.flush();
      }
      let next: KiokuSession = {
        ...session,
        results: { ...session.results, [exercise.id]: a.correct },
      };
      if (!a.correct) next = queueRepeat(next, exercise);
      else {
        // Ingatan Tertunda: schedule the retention check locally (position gap in the session, no timer, no request).
        const independent = !a.usedHint && a.confidence !== "ragu" && a.responseMs <= SLOW_MS;
        next = scheduleDelayed(next, exercise, independent);
      }
      setSession(next);
      saveSession(window.localStorage, userId, next);
      return next;
    },
    [session, userId],
  );

  const advance = useCallback(
    (base?: KiokuSession | null) => {
      const cur = base ?? session;
      if (!cur || !userId) return;
      const idx = cur.index + 1;
      const finished = idx >= cur.exercises.length;
      const next = { ...cur, index: idx, finished };
      setSession(next);
      resetExerciseUi();
      if (finished) {
        clearSession(window.localStorage, userId);
        void outbox.current?.flush();
      } else saveSession(window.localStorage, userId, next);
    },
    [session, userId],
  );

  // A correct choice answer moves on by itself; a wrong one waits so the right answer can be read.
  const advanceRef = useRef(advance);
  advanceRef.current = advance;
  const lastCorrect = ex ? session?.results[ex.id] : undefined;
  const exId = ex?.id;
  useEffect(() => {
    if (!exId || !isChoice || lastCorrect !== true) return;
    const t = window.setTimeout(() => advanceRef.current(), AUTO_ADVANCE_MS);
    return () => window.clearTimeout(t);
  }, [exId, isChoice, lastCorrect]);

  // After a wrong answer keep "Lanjut" reachable on short screens (the fixed bottom nav would otherwise cover it).
  const nextRef = useRef<HTMLButtonElement | null>(null);
  useEffect(() => {
    if (answered && lastCorrect === false)
      nextRef.current?.scrollIntoView({ block: "center", behavior: "instant" as ScrollBehavior });
  }, [answered, lastCorrect, ex?.id]);

  const summary = useMemo(() => {
    if (!session) return { right: 0, wrong: 0 };
    const v = Object.values(session.results);
    return { right: v.filter(Boolean).length, wrong: v.filter((x) => !x).length };
  }, [session]);

  const reasonText = (reason: string) => {
    if (reason.includes("overconfident_wrong")) return "Dipilih karena sebelumnya kamu yakin tetapi salah.";
    if (reason.includes("repeated_error") || reason.includes("remediate_"))
      return "Dipilih untuk memperkuat bagian yang masih sering salah.";
    if (reason.includes("due_") || reason.includes("progress_due"))
      return "Dipilih karena review materi ini sudah jatuh tempo.";
    if (reason.includes("retest_mastered") || reason.includes("delayed_recall"))
      return "Dipilih untuk memastikan ingatanmu masih bertahan.";
    if (reason.includes("context")) return "Dipilih untuk menguji penggunaan dalam konteks.";
    return "Dipilih sebagai penguatan ingatan berdasarkan progresmu.";
  };

  const pill = (value: Confidence, label: string) => (
    <button
      type="button"
      aria-pressed={confidence === value}
      disabled={answered}
      onClick={() => setConfidence(confidence === value ? null : value)}
      className={`min-h-9 flex-1 rounded-xl border px-3 text-[11px] font-bold ${confidence === value ? "border-primary bg-primary text-primary-foreground" : "bg-card"}`}
    >
      {label}
    </button>
  );

  const reveal = (c: Confidence) => {
    revealMs.current = Math.max(0, Date.now() - shownAt.current);
    setConfidence(c);
    setRevealed(true);
  };
  const grade = (correct: boolean) => {
    if (!ex) return;
    advance(
      record(ex, { correct, selectedId: null, confidence, usedHint, responseMs: revealMs.current }),
    );
  };

  return (
    <AppShell compact title="Kioku">
      <div
        data-layout="wide"
        className="mx-auto w-full max-w-md space-y-3 pb-4 md:max-w-2xl md:space-y-4 lg:max-w-3xl"
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <a
            href="/belajar"
            className="inline-flex items-center gap-1.5 rounded-xl border bg-card px-3 py-2 text-[10px] font-bold"
          >
            <ArrowLeft className="size-4" /> Kembali ke Materi
          </a>
          <FeatureGuide
            storageKey="eno:guide:kioku:v2"
            title="Kioku untuk Menguji Ingatan"
            intro="Kioku bukan Flashcard. Kioku hanya menguji materi yang sudah tercatat pernah kamu pelajari dan memilih latihan secara adaptif."
            steps={[
              {
                title: "Pool berasal dari progresmu",
                body: "Materi yang ditandai Dipelajari atau sudah kamu kerjakan di Flashcard dapat masuk ke pool Kioku. Materi yang masih benar-benar baru tidak dipilih.",
              },
              {
                title: "Pilih Yakin atau Ragu dulu",
                body: "Sebelum menjawab, pilih Yakin jika kamu merasa tahu jawabannya atau Ragu jika belum yakin. Benar + Yakin memperkuat interval lebih besar, Benar + Ragu naik lebih pelan, dan Salah + Yakin dianggap sinyal miskonsepsi yang perlu diuji lebih cepat.",
              },
              {
                title: "Soal dan waktunya adaptif",
                body: "Materi lemah, jatuh tempo, lambat dijawab, memakai petunjuk, atau pernah salah diprioritaskan. Jika sering benar, jarak tes diperpanjang; materi kuat tetap diuji lagi setelah beberapa waktu.",
              },
              {
                title: "Kioku menguji dari beberapa sisi",
                body: "Arti, bacaan, arah Indonesia ke Jepang, penggunaan, konteks, dan tes ulang dinilai terpisah agar sisi yang masih lemah lebih sering dilatih.",
              },
              {
                title: "Susun Kalimat",
                body: "Pada latihan Susun Kalimat, pilih Ragu atau Yakin lalu tekan potongan sesuai urutan. Potongan pertama menjadi nomor ①. Tekan potongan yang sudah dipilih untuk membatalkan. Latihan ini hanya memakai kalimat sumber yang memiliki potongan tervalidasi.",
              },
              {
                title: "Partikel & Perbaiki Kesalahan",
                body: "Latihan Partikel meminta kamu melengkapi partikel pada kalimat sumber. Perbaiki Kesalahan menampilkan contoh salah yang memang tersimpan di materi Bunpou, lalu kamu memilih bentuk yang benar. Keduanya tetap memakai Yakin/Ragu dan hasilnya masuk ke statistik Kioku.",
              },
              {
                title: "Konjugasi",
                body: "Latihan Konjugasi hanya muncul untuk Kotoba yang memiliki bentuk kata kerja tervalidasi. Kioku menyebut bentuk target, lalu kamu memilih jawabannya. Jika data bentuk belum tersedia, latihan ini tidak dibuat.",
              },
            ]}
          />
        </div>
        {!session && (
          <section className="overflow-hidden rounded-[30px] border border-primary/20 bg-gradient-to-b from-primary/[.08] to-card p-6 text-center md:p-10 shadow-[0_18px_50px_-34px_rgba(0,0,0,.55)]">
            <span className="mx-auto grid size-12 place-items-center rounded-2xl bg-primary/10">
              <BrainCircuit className="size-6 text-primary" />
            </span>
            <p className="mt-3 text-[9px] font-black uppercase tracking-[.18em] text-primary">
              ENO NIHONGO
            </p>
            <h1 className="mt-1 text-[22px] font-black md:text-[30px]">ENO Kioku</h1>
            <p className="mt-1 text-[10px] text-muted-foreground">
              Latihan ingatan adaptif dari materi yang sudah kamu pelajari.
            </p>
            {error && <p className="mt-3 text-[10px] text-red-600 dark:text-red-300">{error}</p>}
            {!loading && ready && ready.exercises.length === 0 && (
              <p className="mt-4 text-[10px] text-muted-foreground">
                Belum ada materi yang dipelajari. Pelajari Kanji, Kotoba, atau Bunpou dulu di
                Materi.
              </p>
            )}
            <button
              disabled={loading || !ready || ready.exercises.length === 0}
              onClick={start}
              className="mx-auto mt-5 w-full rounded-2xl bg-primary py-3 text-[11px] font-bold text-primary-foreground disabled:opacity-50 md:mt-7 md:max-w-sm md:py-3.5 md:text-[13px]"
            >
              {loading ? "Menyiapkan…" : "Mulai Kioku"}
            </button>
          </section>
        )}
        {session?.finished && (
          <section className="rounded-3xl border bg-card p-6 text-center">
            <h2 className="text-[16px] font-bold">Sesi selesai</h2>
            <p className="mt-2 text-[11px]">
              Benar {summary.right} · Perlu diulang {summary.wrong}
            </p>
            <button
              onClick={() => {
                setSession(null);
                setLoading(true);
                if (userId)
                  prefetchSession(userId)
                    .then(setReady)
                    .catch(() => setError("Gagal menyiapkan sesi."))
                    .finally(() => setLoading(false));
              }}
              className="mt-5 w-full rounded-2xl bg-primary py-3 text-[11px] font-bold text-primary-foreground"
            >
              Sesi berikutnya
            </button>
          </section>
        )}
        {ex && (
          <>
            <div className="flex items-center justify-between text-[9px] text-muted-foreground">
              <span>
                {session!.index + 1}/{total}
              </span>
              <span>
                Benar {summary.right} · Salah {summary.wrong}
              </span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-primary"
                style={{ width: `${(session!.index / Math.max(1, total)) * 100}%` }}
              />
            </div>
            <section className="relative min-h-[210px] overflow-hidden rounded-[30px] border border-primary/20 bg-gradient-to-b from-primary/[.055] to-card p-6 text-center md:min-h-[300px] md:p-10 shadow-[0_18px_50px_-32px_rgba(0,0,0,.5)]">
              <div className="pointer-events-none absolute inset-x-0 top-0 h-1 bg-primary/70" />
              <p className="text-[9px] font-bold uppercase tracking-widest text-primary">
                {ex.label
                  ? ex.label
                  : ex.direction === "reverse"
                    ? "Indonesia → Jepang"
                    : ex.aspect === "reading"
                      ? "Bacaan"
                      : "Arti"}
              </p>
              <p
                data-testid="prompt"
                className={`mt-5 font-jp font-bold leading-relaxed ${ex.prompt.length > 12 ? "text-[19px] md:text-[26px]" : "text-[30px] md:text-[44px]"}`}
              >
                {ex.prompt}
              </p>
              <p className="mx-auto mt-2 max-w-lg text-[9px] leading-relaxed text-muted-foreground">
                {reasonText(ex.reason)}
              </p>
              {ex.promptSub && (
                <p className="mt-1 font-jp text-[11px] text-muted-foreground">{ex.promptSub}</p>
              )}
              {showHint && !revealed && (
                <p
                  data-testid="hint"
                  className="mt-4 rounded-xl bg-amber-50 px-3 py-2 font-jp text-[13px] font-semibold tracking-widest text-amber-900 dark:bg-amber-500/15 dark:text-amber-200"
                >
                  {ex.hintText}
                </p>
              )}
              {!isChoice && revealed && (
                <p className="mt-5 border-t pt-4 font-jp text-[16px] font-semibold">{ex.answer}</p>
              )}
              {isChoice && answered && (
                <p
                  className={`mt-4 text-[11px] font-bold ${lastCorrect ? "text-emerald-700 dark:text-emerald-300" : "text-red-700 dark:text-red-300"}`}
                >
                  {lastCorrect ? "Benar" : `Jawaban: ${ex.answer}`}
                </p>
              )}
              {isChoice && answered && ex.feedback && (
                <p
                  data-testid="feedback"
                  className="mt-1 font-jp text-[11px] text-muted-foreground"
                >
                  {ex.feedback}
                </p>
              )}
            </section>
            {isSentenceOrder ? (
              <div className="grid gap-2">
                {!answered && (
                  <>
                    <div className="flex items-center gap-2" role="group" aria-label="Keyakinan">
                      {pill("ragu", "Ragu")}
                      {pill("yakin", "Yakin")}
                    </div>
                    {!confidence && (
                      <p className="text-center text-[9px] text-muted-foreground">
                        Pilih Ragu atau Yakin sebelum menyusun kalimat.
                      </p>
                    )}
                    <div className="min-h-14 rounded-2xl border bg-muted/35 p-2">
                      <div className="flex flex-wrap gap-2">
                        {orderedParts.map((id, index) => {
                          const part = ex.options.find((o) => o.id === id);
                          if (!part) return null;
                          return (
                            <button
                              key={id}
                              type="button"
                              onClick={() => setOrderedParts((v) => v.filter((x) => x !== id))}
                              className="rounded-xl border bg-card px-3 py-2 font-jp text-[11px] font-semibold"
                            >
                              {index + 1}. {part.text}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {ex.options
                        .filter((o) => !orderedParts.includes(o.id))
                        .map((o) => (
                          <button
                            key={o.id}
                            type="button"
                            disabled={!confidence}
                            onClick={() => setOrderedParts((v) => [...v, o.id])}
                            className="rounded-xl border bg-card px-3 py-2 font-jp text-[11px] font-semibold disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            {o.text}
                          </button>
                        ))}
                    </div>
                    <button
                      type="button"
                      disabled={!confidence || orderedParts.length !== ex.options.length}
                      onClick={() => {
                        const answer = orderedParts
                          .map((id) => ex.options.find((o) => o.id === id)?.text ?? "")
                          .join(" ");
                        record(ex, {
                          correct: answer === ex.answer,
                          selectedId: null,
                          confidence,
                          usedHint: false,
                          responseMs: Math.max(0, Date.now() - shownAt.current),
                        });
                      }}
                      className="min-h-12 rounded-2xl bg-primary text-[11px] font-bold text-primary-foreground disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      Periksa Jawaban
                    </button>
                  </>
                )}
                {answered && (
                  <>
                    <div className={`rounded-2xl border p-3 text-center font-jp text-[12px] font-semibold ${
                      lastCorrect
                        ? "border-emerald-300 bg-emerald-50 dark:bg-emerald-500/[.12]"
                        : "border-red-300 bg-red-50 dark:bg-red-500/[.12]"
                    }`}>
                      <p>{lastCorrect ? "Benar" : "Urutan yang benar:"}</p>
                      <p className="mt-1">{ex.answer}</p>
                      {ex.feedback && (
                        <p className="mt-1 text-[10px] font-normal text-muted-foreground">
                          {ex.feedback}
                        </p>
                      )}
                    </div>
                    <button
                      ref={nextRef}
                      onClick={() => advance()}
                      className="w-full rounded-2xl bg-primary py-3 text-[11px] font-bold text-primary-foreground"
                    >
                      Lanjut
                    </button>
                  </>
                )}
              </div>
            ) : isChoice ? (
              <div className="grid gap-2 md:grid-cols-2">
                {!answered && (
                  <div
                    className="flex items-center gap-2 md:col-span-2"
                    role="group"
                    aria-label="Keyakinan"
                  >
                    {pill("ragu", "Ragu")}
                    {pill("yakin", "Yakin")}
                  </div>
                )}
                {!answered && !confidence && (
                  <p className="text-center text-[9px] text-muted-foreground md:col-span-2">
                    Pilih Ragu atau Yakin sebelum memilih jawaban.
                  </p>
                )}
                {ex.options.map((o) => {
                  const isAnswer = o.text === ex.answer;
                  const chosen = picked === o.id;
                  const tone = !answered
                    ? "bg-card"
                    : isAnswer
                      ? "border-emerald-400 bg-emerald-50 dark:bg-emerald-500/[.15]"
                      : chosen
                        ? "border-red-300 bg-red-50 dark:bg-red-500/[.15]"
                        : "bg-card opacity-70";
                  return (
                    <button
                      key={o.id}
                      disabled={answered || !confidence}
                      onClick={() => {
                        setPicked(o.id);
                        record(ex, {
                          correct: isAnswer,
                          selectedId: o.id,
                          confidence,
                          usedHint: false,
                          responseMs: Math.max(0, Date.now() - shownAt.current),
                        });
                      }}
                      className={`flex min-h-12 items-center justify-between rounded-2xl border px-4 py-3 text-left font-jp text-[12px] font-semibold md:min-h-14 md:text-[15px] disabled:cursor-not-allowed disabled:opacity-50 ${tone}`}
                    >
                      <span>{o.text}</span>
                      {answered && isAnswer && <CheckCircle2 className="size-4 text-emerald-600" />}
                      {answered && chosen && !isAnswer && (
                        <XCircle className="size-4 text-red-600" />
                      )}
                    </button>
                  );
                })}
                {answered && (
                  <button
                    ref={nextRef}
                    onClick={() => advance()}
                    className="mt-1 w-full rounded-2xl bg-primary py-3 text-[11px] font-bold text-primary-foreground md:col-span-2 md:py-3.5 md:text-[13px]"
                  >
                    Lanjut
                  </button>
                )}
              </div>
            ) : !revealed ? (
              <div className="grid gap-2">
                {ex.hintLevel === 1 && !hintOpen && (
                  <button
                    onClick={() => {
                      setHintOpen(true);
                      setUsedHint(true);
                    }}
                    className="inline-flex min-h-11 items-center justify-center gap-1.5 rounded-2xl border bg-card text-[11px] font-bold"
                  >
                    <Lightbulb className="size-4" /> Petunjuk
                  </button>
                )}
                <p className="text-center text-[10px] text-muted-foreground">
                  Coba ingat dulu, lalu buka jawaban.
                </p>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => reveal("ragu")}
                    className="min-h-12 rounded-2xl border bg-card text-[11px] font-bold md:min-h-14 md:text-[13px]"
                  >
                    Ragu · lihat jawaban
                  </button>
                  <button
                    onClick={() => reveal("yakin")}
                    className="min-h-12 rounded-2xl bg-primary text-[11px] font-bold text-primary-foreground md:min-h-14 md:text-[13px]"
                  >
                    Yakin · lihat jawaban
                  </button>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => grade(false)}
                  className="min-h-12 rounded-2xl border border-red-200 bg-red-50 text-[11px] font-bold md:min-h-14 md:text-[13px] text-red-700 dark:border-red-500/35 dark:bg-red-500/[.12] dark:text-red-200"
                >
                  Belum ingat
                </button>
                <button
                  onClick={() => grade(true)}
                  className="min-h-12 rounded-2xl bg-primary text-[11px] font-bold text-primary-foreground md:min-h-14 md:text-[13px]"
                >
                  Masih ingat
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </AppShell>
  );
}
