import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, BrainCircuit, CheckCircle2, XCircle } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { supabase } from "@/integrations/supabase/client";
import { classifyError } from "@/lib/kioku/classify";
import { createOutbox } from "@/lib/kioku/outbox";
import { prefetchSession, sendEvents } from "@/lib/kioku/prefetch";
import { queueRepeat } from "@/lib/kioku/session";
import type { Exercise, KiokuSession } from "@/lib/kioku/session-types";
import { clearSession, loadSession, saveSession } from "@/lib/kioku/session-store";

export const Route = createFileRoute("/_authenticated/kioku")({
  head: () => ({ meta: [{ title: "Kioku — ENO NIHONGO" }] }),
  component: KiokuPage,
});

const FLUSH_EVERY = 5;
const FLUSH_INTERVAL_MS = 15000;

function KiokuPage() {
  const [userId, setUserId] = useState<string | null>(null);
  const [session, setSession] = useState<KiokuSession | null>(null);
  const [ready, setReady] = useState<KiokuSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [picked, setPicked] = useState<string | null>(null);
  const [revealed, setRevealed] = useState(false);
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

  const start = useCallback(() => {
    if (!ready || !userId) return;
    saveSession(window.localStorage, userId, ready);
    setSession(ready);
    setReady(null);
    setPicked(null);
    setRevealed(false);
    shownAt.current = Date.now();
  }, [ready, userId]);

  // Local-first: state + outbox (sync localStorage write) only; the network flush is fire-and-forget.
  const record = useCallback(
    (exercise: Exercise, correct: boolean, selectedId: string | null): KiokuSession | null => {
      if (!session || !userId) return null;
      const responseMs = Math.max(0, Date.now() - shownAt.current);
      const chosen = selectedId ? exercise.options.find((o) => o.id === selectedId) : undefined;
      const errorType = classifyError({
        correct,
        aspect: exercise.aspect,
        exerciseType: exercise.exerciseType,
        responseMs,
        usedHint: false,
        selectedWasConfusable: !correct && !!chosen?.confusable,
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
        correct,
        selected_answer: chosen?.text ?? null,
        confidence: null,
        hint_level: exercise.hintLevel,
        used_hint: false,
        response_ms: responseMs,
        error_type: errorType,
        occurred_at: new Date().toISOString(),
      });
      if (++sinceFlush.current >= FLUSH_EVERY) {
        sinceFlush.current = 0;
        void outbox.current?.flush();
      }
      let next: KiokuSession = {
        ...session,
        results: { ...session.results, [exercise.id]: correct },
      };
      if (!correct) next = queueRepeat(next, exercise);
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
      setPicked(null);
      setRevealed(false);
      shownAt.current = Date.now();
      if (finished) {
        clearSession(window.localStorage, userId);
        void outbox.current?.flush();
      } else saveSession(window.localStorage, userId, next);
    },
    [session, userId],
  );

  const summary = useMemo(() => {
    if (!session) return { right: 0, wrong: 0 };
    const v = Object.values(session.results);
    return { right: v.filter(Boolean).length, wrong: v.filter((x) => !x).length };
  }, [session]);

  const answered = ex ? ex.id in (session?.results ?? {}) : false;

  return (
    <AppShell compact title="Kioku">
      <div className="mx-auto w-full max-w-md space-y-3 pb-4">
        <a
          href="/belajar"
          className="inline-flex items-center gap-1.5 rounded-xl border bg-card px-3 py-2 text-[10px] font-bold"
        >
          <ArrowLeft className="size-4" /> Kembali ke Materi
        </a>
        {!session && (
          <section className="rounded-3xl border bg-card p-6 text-center">
            <span className="mx-auto grid size-12 place-items-center rounded-2xl bg-primary/10">
              <BrainCircuit className="size-6 text-primary" />
            </span>
            <h1 className="mt-3 text-[18px] font-bold">Kioku</h1>
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
              className="mt-5 w-full rounded-2xl bg-primary py-3 text-[11px] font-bold text-primary-foreground disabled:opacity-50"
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
            <div className="h-1.5 rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-primary"
                style={{ width: `${(session!.index / Math.max(1, total)) * 100}%` }}
              />
            </div>
            <section className="min-h-[190px] rounded-[28px] border bg-card p-6 text-center">
              <p className="text-[9px] font-bold uppercase tracking-widest text-primary">
                {ex.direction === "reverse"
                  ? "Indonesia → Jepang"
                  : ex.aspect === "reading"
                    ? "Bacaan"
                    : "Arti"}
              </p>
              <p className="mt-6 font-jp text-[30px] font-bold leading-relaxed">{ex.prompt}</p>
              {ex.promptSub && (
                <p className="mt-1 font-jp text-[11px] text-muted-foreground">{ex.promptSub}</p>
              )}
              {ex.exerciseType === "recall_flip" && revealed && (
                <p className="mt-5 border-t pt-4 font-jp text-[16px] font-semibold">{ex.answer}</p>
              )}
            </section>
            {ex.exerciseType === "choice" ? (
              <div className="grid gap-2">
                {ex.options.map((o) => {
                  const isAnswer = o.text === ex.answer,
                    chosen = picked === o.id;
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
                      disabled={answered}
                      onClick={() => {
                        setPicked(o.id);
                        record(ex, isAnswer, o.id);
                      }}
                      className={`flex items-center justify-between rounded-2xl border px-4 py-3 text-left font-jp text-[12px] font-semibold ${tone}`}
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
                    onClick={() => advance()}
                    className="mt-1 w-full rounded-2xl bg-primary py-3 text-[11px] font-bold text-primary-foreground"
                  >
                    Lanjut
                  </button>
                )}
              </div>
            ) : !revealed ? (
              <button
                onClick={() => setRevealed(true)}
                className="w-full rounded-2xl border bg-card py-3 text-[11px] font-bold"
              >
                Buka Jawaban
              </button>
            ) : answered ? (
              <button
                onClick={() => advance()}
                className="w-full rounded-2xl bg-primary py-3 text-[11px] font-bold text-primary-foreground"
              >
                Lanjut
              </button>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => {
                    advance(record(ex, false, null));
                  }}
                  className="rounded-2xl border border-red-200 bg-red-50 py-3 text-[11px] font-bold text-red-700 dark:border-red-500/35 dark:bg-red-500/[.12] dark:text-red-200"
                >
                  Belum ingat
                </button>
                <button
                  onClick={() => {
                    advance(record(ex, true, null));
                  }}
                  className="rounded-2xl bg-primary py-3 text-[11px] font-bold text-primary-foreground"
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
