import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, Check, Headphones, Pause, Play, RotateCcw } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { PassagePanel, QuestionCard } from "@/components/simulation/QuestionView";
import { passagePosition } from "@/lib/passage-position";
import { ExamExitDialog, ExamHeader, ExamPausedScreen } from "@/components/simulation/ExamFocus";
import { useExamLeaveGuard } from "@/lib/exam-focus";
import { ListeningAudioNotice } from "@/components/simulation/ListeningAudioNotice";
import {
  ChokaiStartGate,
  ContinuousChokaiAudio,
  type ChokaiAudioHandle,
} from "@/components/simulation/ContinuousChokai";
import {
  forwardOnly,
  isValidTimeline,
  readChokaiProgress,
  type TimelineEntry,
} from "@/lib/chokai-timeline";
import { supabase } from "@/integrations/supabase/client";
import { selectExamRows } from "@/lib/audio-manifest";
import {
  examQuery,
  fullStorageKey,
  jlptSessions,
  parseExamNo,
  sectionLabels,
  type SimulationSection,
} from "@/lib/jlpt-simulation-config";
import type { FullProgress } from "@/lib/jlpt-simulation-result";
import type { Level } from "@/lib/learn-queries";

export const Route = createFileRoute("/_authenticated/simulasi-penuh/$level/$session")({
  component: FullSessionRunner,
});

type Row = {
  id: string;
  section: SimulationSection;
  mondai_no: number;
  question_no: number;
  display_question_no: number | null;
  question_type: string;
  instruction_jp: string;
  prompt_jp: string;
  choices: string[];
  passage_title: string | null;
  passage_jp: string | null;
  audio_url: string | null;
  image_url: string | null;
  transcript_jp: string | null;
  target_text: string | null;
  target_occurrence: number | null;
};
type Result = { total_questions: number; correct_count: number; score_percent: number };
type AudioManifestItem = {
  id: string;
  level: string;
  exam_no?: number;
  mondai_no: number | null;
  mapping_scope: "mondai" | "session";
  delivery_path: string;
  timeline?: TimelineEntry[] | null;
};
const fmt = (s: number) =>
  `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;

async function fetchQuestions(level: Level, examNo: number, sections: SimulationSection[]) {
  const results = await Promise.all(
    sections.map(async (section) => {
      const { data, error } = await supabase.rpc("get_published_simulation_questions", {
        p_level: level,
        p_section: section,
        p_exam_no: examNo,
      });
      if (error) throw error;
      return (data ?? []).map((x) => ({ ...x, section }));
    }),
  );
  const data = results.flat();
  const order = new Map(sections.map((s, i) => [s, i]));
  return (data ?? [])
    .filter(
      (x) =>
        x.prompt_jp &&
        Array.isArray(x.choices) &&
        (x.choices.length === 3 || x.choices.length === 4),
    )
    .sort(
      (a, b) =>
        (order.get(a.section) ?? 99) - (order.get(b.section) ?? 99) ||
        a.mondai_no - b.mondai_no ||
        a.question_no - b.question_no,
    ) as Row[];
}
async function fetchAudioManifest(level: Level, examNo: number): Promise<AudioManifestItem[]> {
  const response = await fetch(
    `/api/jlpt-audio-manifest?level=${encodeURIComponent(level)}&exam=${examNo}`,
  );
  if (!response.ok) throw new Error("Grouped listening audio manifest unavailable");
  const payload = await response.json();
  return Array.isArray(payload?.items) ? payload.items : [];
}

function Audio({ url, groupedLabel }: { url: string | null; groupedLabel?: string | null }) {
  const ref = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState(false);
  useEffect(() => {
    const audio = ref.current;
    if (!audio) return;
    const stop = () => setPlaying(false);
    const start = () => setPlaying(true);
    audio.addEventListener("play", start);
    audio.addEventListener("pause", stop);
    audio.addEventListener("ended", stop);
    return () => {
      audio.removeEventListener("play", start);
      audio.removeEventListener("pause", stop);
      audio.removeEventListener("ended", stop);
    };
  }, [url]);
  if (!url)
    return (
      <div className="rounded-xl border border-dashed p-4 text-center">
        <Headphones className="mx-auto mb-2 size-5 text-muted-foreground" />
        <p className="text-xs font-medium">音声問題</p>
        <p className="mt-1 text-[10px] text-muted-foreground">専用音声を準備中です。</p>
      </div>
    );
  const grouped = Boolean(groupedLabel);
  return (
    <div className="space-y-2">
      {grouped && <p className="text-[10px] font-semibold text-muted-foreground">{groupedLabel}</p>}
      <div className="flex gap-2">
        <audio ref={ref} src={url} preload="metadata" />
        <Button
          size="sm"
          onClick={() => {
            const audio = ref.current;
            if (!audio) return;
            if (audio.paused) void audio.play();
            else audio.pause();
          }}
        >
          {playing ? <Pause className="mr-1 size-4" /> : <Play className="mr-1 size-4" />}
          {playing ? "一時停止" : "再生"}
        </Button>
        {!grouped && (
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              if (ref.current) {
                ref.current.currentTime = 0;
                void ref.current.play();
              }
            }}
          >
            <RotateCcw className="mr-1 size-4" />
            最初から
          </Button>
        )}
      </div>
      {grouped && (
        <p className="text-[10px] text-muted-foreground">
          共通音声です。設問を移動しても同じ音源では再生位置を維持します。
        </p>
      )}
    </div>
  );
}

function FullSessionRunner() {
  const { level: raw, session: rawSession } = Route.useParams();
  const level = raw.toUpperCase() as Level;
  const sessionIndex = Math.max(0, Number(rawSession));
  const sessions = jlptSessions[level] ?? [];
  const session = sessions[sessionIndex];
  const examNo = parseExamNo(Route.useSearch().exam);
  const storageKey = fullStorageKey(level, examNo);
  const serverKey = `${storageKey}-server-id`;
  const answerKey = `${storageKey}-session-${sessionIndex}-answers`;
  const deadlineKey = `${storageKey}-session-${sessionIndex}-deadline`;
  const sections = useMemo(() => session?.sections ?? [], [session]);
  const q = useQuery({
    queryKey: ["simulation-full-session", level, examNo, sessionIndex, sections.join("-")],
    queryFn: () => fetchQuestions(level, examNo, sections),
    enabled: !!session,
  });
  const manifestQuery = useQuery({
    queryKey: ["simulation-audio-manifest", level, examNo],
    queryFn: () => fetchAudioManifest(level, examNo),
    enabled: !!session && sections.includes("listening"),
    staleTime: 30 * 60 * 1000,
  });
  const questions = useMemo(() => q.data ?? [], [q.data]);
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [remaining, setRemaining] = useState((session?.minutes ?? 0) * 60);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [paused, setPaused] = useState(false);
  const [restoredKey, setRestoredKey] = useState<string | null>(null);
  const [exitOpen, setExitOpen] = useState(false);
  const allowLeave = useRef(false);
  const pauseKey = `${storageKey}-session-${sessionIndex}-pausedAt`;
  const indexKey = `${storageKey}-session-${sessionIndex}-index`;
  const finishing = useRef(false);
  const answersRef = useRef<Record<string, number>>({});
  const current = questions[index];
  useEffect(() => {
    setIndex(0);
    setPaused(false);
    setExitOpen(false);
    allowLeave.current = false;
    setAnswers({});
    answersRef.current = {};
    finishing.current = false;
    setSaving(false);
    setError(null);
    setRemaining((session?.minutes ?? 0) * 60);
    try {
      const a = window.localStorage.getItem(answerKey);
      if (a) {
        const restored = JSON.parse(a);
        setAnswers(restored);
        answersRef.current = restored;
      }
      const savedIndex = Number(window.localStorage.getItem(indexKey));
      if (Number.isInteger(savedIndex) && savedIndex > 0) setIndex(savedIndex);
      if (window.localStorage.getItem(pauseKey)) setPaused(true);
      const existing = Number(window.localStorage.getItem(deadlineKey));
      if (!existing && session)
        window.localStorage.setItem(deadlineKey, String(Date.now() + session.minutes * 60000));
    } catch (e) {
      console.warn("Gagal memulihkan sesi simulasi", e);
    }
    setRestoredKey(indexKey);
  }, [sessionIndex, answerKey, deadlineKey, indexKey, pauseKey, session]);
  useEffect(() => {
    if (restoredKey !== indexKey) return;
    try {
      window.localStorage.setItem(indexKey, String(index));
    } catch (e) {
      console.warn("Gagal menyimpan posisi soal", e);
    }
  }, [index, indexKey, restoredKey]);
  useEffect(() => {
    answersRef.current = answers;
    try {
      window.localStorage.setItem(answerKey, JSON.stringify(answers));
    } catch (e) {
      console.warn("Gagal menyimpan jawaban simulasi", e);
    }
  }, [answers, answerKey]);
  const groupedAudio = useMemo(() => {
    if (!current || current.section !== "listening") return null;
    const items = selectExamRows(manifestQuery.data ?? [], examNo);
    const mondaiSource = items.find(
      (item) => item.mapping_scope === "mondai" && item.mondai_no === current.mondai_no,
    );
    if (mondaiSource)
      return { url: mondaiSource.delivery_path, label: `問題 ${current.mondai_no} 共通音声` };
    const sessionSource = items.find((item) => item.mapping_scope === "session");
    return sessionSource
      ? { url: sessionSource.delivery_path, label: "聴解セッション共通音声" }
      : null;
  }, [current, manifestQuery.data, examNo]);
  const activeAudioUrl = current?.audio_url ?? groupedAudio?.url ?? null;
  const activeAudioLabel = current?.audio_url ? null : (groupedAudio?.label ?? null);
  // Chōkai penuh berkelanjutan: hanya bila sesi murni listening dan manifest membawa timeline
  // valid untuk seluruh soal. Tanpa timeline valid, sesi memakai pemutar lama (tidak ditebak).
  const listeningIdx = useMemo(
    () => questions.flatMap((x, i) => (x.section === "listening" ? [i] : [])),
    [questions],
  );
  const continuous = useMemo(() => {
    if (!sections.length || !sections.every((x) => x === "listening")) return null;
    const source = selectExamRows(manifestQuery.data ?? [], examNo).find(
      (x) =>
        x.mapping_scope === "session" && isValidTimeline(x.timeline ?? null, listeningIdx.length),
    );
    return source && source.timeline
      ? { url: source.delivery_path, timeline: source.timeline }
      : null;
  }, [sections, manifestQuery.data, listeningIdx.length, examNo]);
  const chokaiKey = `${storageKey}-session-${sessionIndex}-chokai`;
  const chokaiHandle = useRef<ChokaiAudioHandle | null>(null);
  const [chokaiPhase, setChokaiPhase] = useState<"gate" | "playing" | "finished">("gate");
  const [chokaiResuming, setChokaiResuming] = useState(false);
  useEffect(() => {
    const saved = readChokaiProgress(window.localStorage, chokaiKey);
    setChokaiPhase(saved?.finished ? "finished" : "gate");
    setChokaiResuming(Boolean(saved && !saved.finished && saved.t > 0));
  }, [chokaiKey]);
  const onChokaiPosition = useCallback(
    (position: number) => {
      const target = listeningIdx[position];
      if (target !== undefined) setIndex((i) => forwardOnly(i, target));
    },
    [listeningIdx],
  );
  const onChokaiEnded = useCallback(() => {
    setChokaiPhase("finished");
    const last = listeningIdx[listeningIdx.length - 1];
    if (last !== undefined) setIndex(last);
  }, [listeningIdx]);
  const startChokai = async () => {
    try {
      if (!chokaiResuming && session) {
        const deadline = Date.now() + session.minutes * 60000;
        window.localStorage.setItem(deadlineKey, String(deadline));
        setRemaining(session.minutes * 60);
      }
      await chokaiHandle.current?.start();
      setChokaiPhase("playing");
    } catch (e) {
      console.warn("Audio Chōkai belum dapat dimulai", e);
      setError(
        "Audio belum dapat diputar. Periksa koneksi/izin audio lalu tekan Mulai Chōkai lagi.",
      );
    }
  };
  const chokaiLocked = Boolean(continuous);
  const ensureServerSession = useCallback(async () => {
    const existing = window.localStorage.getItem(serverKey);
    if (existing) return existing;
    const { data, error: rpcError } = await supabase.rpc("start_jlpt_simulation_full", {
      p_level: level,
      p_exam_no: examNo,
    });
    if (rpcError) throw rpcError;
    const id = String(data);
    window.localStorage.setItem(serverKey, id);
    return id;
  }, [serverKey, level, examNo]);
  const finish = useCallback(async () => {
    if (finishing.current || !session) return;
    finishing.current = true;
    setSaving(true);
    setError(null);
    try {
      const fullId = await ensureServerSession();
      const results: Record<string, Result> = {};
      const deadline = Number(window.localStorage.getItem(deadlineKey));
      const elapsed = Math.max(
        0,
        Math.min(
          session.minutes * 60,
          session.minutes * 60 - Math.max(0, Math.ceil((deadline - Date.now()) / 1000)),
        ),
      );
      for (const section of session.sections) {
        const sectionAnswers = questions
          .filter((x) => x.section === section)
          .map((x) => ({ question_id: x.id, selected_index: answersRef.current[x.id] }))
          .filter((x) => x.selected_index !== undefined);
        const { data, error: rpcError } = await supabase.rpc(
          "submit_jlpt_simulation_full_section",
          {
            p_full_session_id: fullId,
            p_session_index: sessionIndex,
            p_level: level,
            p_section: section,
            p_duration_seconds: elapsed,
            p_answers: sectionAnswers,
          },
        );
        if (rpcError) throw rpcError;
        const r = Array.isArray(data) ? data[0] : data;
        if (!r) throw new Error("Hasil sesi tidak tersedia");
        results[`${sessionIndex}:${section}`] = {
          total_questions: Number(r.total_questions),
          correct_count: Number(r.correct_count),
          score_percent: Number(r.score_percent),
        };
      }
      const rawProgress = window.localStorage.getItem(storageKey);
      const p: FullProgress = rawProgress
        ? JSON.parse(rawProgress)
        : { sessionIndex, sectionIndex: 0, startedAt: Date.now(), completed: [], results: {} };
      const completed = Array.from(
        new Set([...(p.completed ?? []), ...session.sections.map((s) => `${sessionIndex}:${s}`)]),
      );
      const nextIndex = sessionIndex + 1;
      const next: FullProgress = {
        ...p,
        sessionIndex: nextIndex,
        sectionIndex: 0,
        completed,
        results: { ...(p.results ?? {}), ...results },
      };
      window.localStorage.setItem(storageKey, JSON.stringify(next));
      window.localStorage.removeItem(answerKey);
      window.localStorage.removeItem(deadlineKey);
      window.localStorage.removeItem(indexKey);
      window.localStorage.removeItem(pauseKey);
      window.localStorage.removeItem(chokaiKey);
      allowLeave.current = true;
      if (nextIndex < sessions.length) {
        window.location.replace(
          `/simulasi-penuh/${encodeURIComponent(level)}/${nextIndex}${examQuery(examNo)}`,
        );
        return;
      }
      const { data: finalData, error: finalError } = await supabase.rpc(
        "finalize_jlpt_simulation_full",
        { p_full_session_id: fullId },
      );
      if (finalError) throw finalError;
      const finalRow = Array.isArray(finalData) ? finalData[0] : finalData;
      if (finalRow) {
        window.localStorage.setItem(`${storageKey}-server-result`, JSON.stringify(finalRow));
        next.completedAt = new Date(finalRow.completed_at).getTime();
        window.localStorage.setItem(storageKey, JSON.stringify(next));
      }
      window.location.replace(`/simulasi-penuh/${encodeURIComponent(level)}${examQuery(examNo)}`);
    } catch (e) {
      console.error(e);
      setError("Sesi belum berhasil dikirim. Jawaban tetap tersimpan; silakan coba lagi.");
      allowLeave.current = false;
      finishing.current = false;
      setSaving(false);
    }
  }, [
    session,
    questions,
    level,
    examNo,
    sessionIndex,
    storageKey,
    answerKey,
    deadlineKey,
    indexKey,
    pauseKey,
    chokaiKey,
    sessions.length,
    ensureServerSession,
  ]);
  useEffect(() => {
    if (!session || saving || paused || (continuous && chokaiPhase === "gate")) return;
    const tick = () => {
      const deadline =
        Number(window.localStorage.getItem(deadlineKey)) || Date.now() + session.minutes * 60000;
      const left = Math.max(0, Math.ceil((deadline - Date.now()) / 1000));
      setRemaining(left);
      if (left === 0) void finish();
    };
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, [session, deadlineKey, finish, saving, paused, continuous, chokaiPhase]);
  const pauseExam = () => {
    try {
      window.localStorage.setItem(pauseKey, String(Date.now()));
    } catch (e) {
      console.warn("Gagal menyimpan jeda", e);
    }
    setPaused(true);
    setExitOpen(false);
  };
  const resumeExam = () => {
    try {
      const at = Number(window.localStorage.getItem(pauseKey));
      const deadline = Number(window.localStorage.getItem(deadlineKey));
      if (at && deadline)
        window.localStorage.setItem(deadlineKey, String(deadline + Math.max(0, Date.now() - at)));
      window.localStorage.removeItem(pauseKey);
    } catch (e) {
      console.warn("Gagal melanjutkan ujian", e);
    }
    setPaused(false);
  };
  const leaveGuard = useExamLeaveGuard(Boolean(session) && !saving, allowLeave);
  const blocked = leaveGuard.status === "blocked";
  const closeExit = () => {
    setExitOpen(false);
    if (leaveGuard.status === "blocked") leaveGuard.reset();
  };
  const sectionNav = useMemo(
    () =>
      sections
        .map((s) => ({
          section: s,
          first: questions.findIndex((q) => q.section === s),
          count: questions.filter((q) => q.section === s).length,
          done: questions.filter((q) => q.section === s && answers[q.id] !== undefined).length,
        }))
        .filter((x) => x.first >= 0),
    [sections, questions, answers],
  );
  if (!session)
    return (
      <AppShell title="Simulasi Penuh">
        <p className="py-10 text-center text-sm">Sesi tidak ditemukan.</p>
      </AppShell>
    );
  if (q.isLoading || manifestQuery.isLoading)
    return (
      <AppShell title={`JLPT ${level}`}>
        <p className="py-10 text-center text-xs text-muted-foreground">問題を読み込んでいます…</p>
      </AppShell>
    );
  if (q.isError)
    return (
      <AppShell title={`JLPT ${level}`}>
        <p className="py-10 text-center text-sm text-destructive">
          Gagal memuat soal sesi. Silakan muat ulang halaman.
        </p>
      </AppShell>
    );
  if (!current)
    return (
      <AppShell title={`JLPT ${level}`}>
        <p className="py-10 text-center text-sm">Bank soal sesi ini belum tersedia.</p>
      </AppShell>
    );
  const shownQuestionNo = current.display_question_no ?? current.question_no;
  const audioScope: "session" | "mondai" | "question" = current.audio_url
    ? "question"
    : groupedAudio?.label === "聴解セッション共通音声"
      ? "session"
      : "mondai";
  return (
    <AppShell title={`JLPT ${level} · 第${sessionIndex + 1}セッション`} focus>
      {continuous && (
        <ContinuousChokaiAudio
          ref={chokaiHandle}
          url={continuous.url}
          timeline={continuous.timeline}
          progressKey={chokaiKey}
          onPosition={onChokaiPosition}
          onEnded={onChokaiEnded}
        />
      )}
      <ExamHeader title={session.labelJp} remaining={remaining} onExit={() => setExitOpen(true)}>
        {!chokaiLocked && (
          <div className="flex gap-1 overflow-x-auto">
            {sectionNav.map((x) => (
              <button
                key={x.section}
                onClick={() => setIndex(x.first)}
                className={`shrink-0 rounded-lg border px-3 py-1.5 text-[10px] font-semibold ${current.section === x.section ? "border-primary bg-primary text-primary-foreground" : ""}`}
              >
                {sectionLabels[x.section]} {x.done}/{x.count}
              </button>
            ))}
          </div>
        )}
      </ExamHeader>
      <div className="mx-auto max-w-2xl space-y-3 pt-3">
        {paused ? (
          <ExamPausedScreen
            remaining={remaining}
            onResume={resumeExam}
            onExit={() => setExitOpen(true)}
          />
        ) : continuous && chokaiPhase === "gate" ? (
          <>
            <ChokaiStartGate onStart={() => void startChokai()} resuming={chokaiResuming} />
            {error && (
              <p className="rounded-lg bg-destructive/10 p-2 text-xs text-destructive">{error}</p>
            )}
          </>
        ) : (
          <>
            <Card>
              <CardContent className="p-4">
                <p className="text-[10px] font-semibold text-muted-foreground">
                  {sectionLabels[current.section]} · 問題 {current.mondai_no} · 問 {shownQuestionNo}
                </p>
                <p className="mt-2 font-jp text-xs leading-6">{current.instruction_jp}</p>
              </CardContent>
            </Card>
            {current.section !== "listening" && current.passage_jp && (
              <PassagePanel
                title={current.passage_title}
                text={current.passage_jp}
                position={passagePosition(questions, current)}
              />
            )}
            {current.section === "listening" && (
              <Card>
                <CardContent className="space-y-3 p-4">
                  {!chokaiLocked && <ListeningAudioNotice scope={audioScope} />}
                  {chokaiLocked && (
                    <p className="text-center text-[11px] font-semibold text-muted-foreground">
                      {chokaiPhase === "finished"
                        ? "Audio Chōkai selesai."
                        : `Audio berjalan · soal ${listeningIdx.indexOf(index) + 1} dari ${listeningIdx.length}`}
                    </p>
                  )}
                  {current.image_url && (
                    <img
                      src={current.image_url}
                      alt={`問題 ${current.mondai_no} 問 ${shownQuestionNo}`}
                      className="mx-auto w-full max-w-lg rounded-xl border bg-white object-contain"
                      loading="eager"
                    />
                  )}
                  {!chokaiLocked && <Audio url={activeAudioUrl} groupedLabel={activeAudioLabel} />}
                </CardContent>
              </Card>
            )}
            <QuestionCard
              q={current}
              number={shownQuestionNo}
              selected={answers[current.id]}
              onSelect={(i) => setAnswers((v) => ({ ...v, [current.id]: i }))}
            />
            {error && (
              <p className="rounded-lg bg-destructive/10 p-2 text-xs text-destructive">{error}</p>
            )}
            <div className="flex justify-between gap-2">
              {!chokaiLocked && (
                <Button
                  variant="outline"
                  disabled={index === 0 || saving}
                  onClick={() => setIndex((i) => i - 1)}
                >
                  <ArrowLeft className="mr-1 size-4" />
                  前へ
                </Button>
              )}
              {chokaiLocked ? (
                chokaiPhase === "finished" ? (
                  <Button className="ml-auto" disabled={saving} onClick={() => void finish()}>
                    <Check className="mr-1 size-4" />
                    {saving ? "送信中…" : "セッション終了"}
                  </Button>
                ) : (
                  <p className="w-full text-center text-[11px] text-muted-foreground">
                    Soal berganti otomatis mengikuti audio.
                  </p>
                )
              ) : index === questions.length - 1 ? (
                <Button disabled={saving} onClick={() => void finish()}>
                  <Check className="mr-1 size-4" />
                  {saving ? "送信中…" : "セッション終了"}
                </Button>
              ) : (
                <Button disabled={saving} onClick={() => setIndex((i) => i + 1)}>
                  次へ
                  <ArrowRight className="ml-1 size-4" />
                </Button>
              )}
            </div>
          </>
        )}
      </div>
      <ExamExitDialog
        open={exitOpen || blocked}
        finishing={saving}
        finishHint="Akhiri Ujian akan mengirim dan menilai sesi ini; sesi berikutnya (jika ada) langsung dilanjutkan."
        onContinue={closeExit}
        onFinish={() => {
          setExitOpen(false);
          void finish();
          if (leaveGuard.status === "blocked") leaveGuard.reset();
        }}
        onPause={paused || (continuous && chokaiPhase !== "gate") ? undefined : pauseExam}
      />
    </AppShell>
  );
}
