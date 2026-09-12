import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, BookOpenText, Check, Clock3, Headphones, Pause, Play, RotateCcw } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { jlptSessions } from "@/lib/jlpt-simulation-config";
import type { Level } from "@/lib/learn-queries";

export const Route = createFileRoute("/_authenticated/simulasi-bagian/$level/$section")({ component: SectionRunner });

const labels: Record<string, string> = {
  vocabulary: "文字・語彙",
  grammar: "文法",
  reading: "読解",
  listening: "聴解",
};

const minutes: Record<Level, Record<string, number>> = {
  N5: { vocabulary: 20, grammar: 20, reading: 30, listening: 30 },
  N4: { vocabulary: 30, grammar: 30, reading: 30, listening: 35 },
  N3: { vocabulary: 30, grammar: 35, reading: 35, listening: 40 },
  N2: { vocabulary: 30, grammar: 45, reading: 60, listening: 50 },
  N1: { vocabulary: 35, grammar: 45, reading: 65, listening: 55 },
};

type Row = {
  id: string;
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
};

type Result = { total_questions: number; correct_count: number; score_percent: number };
type FullProgress = { sessionIndex: number; sectionIndex: number; startedAt: number; completed: string[]; results?: Record<string, Result> };
type AudioManifestItem = { id: string; level: string; mondai_no: number | null; mapping_scope: "mondai" | "session"; delivery_path: string };

async function fetchQuestions(level: Level, section: string): Promise<Row[]> {
  const { data, error } = await (supabase as any)
    .from("jlpt_simulation_questions_public")
    .select("id,mondai_no,question_no,display_question_no,question_type,instruction_jp,prompt_jp,choices,passage_title,passage_jp,audio_url,image_url,transcript_jp")
    .eq("level", level)
    .eq("section", section)
    .order("mondai_no")
    .order("question_no");
  if (error) throw error;
  return (data ?? []).filter((x: any) => x.prompt_jp && Array.isArray(x.choices) && (x.choices.length === 3 || x.choices.length === 4));
}

async function fetchAudioManifest(level: Level): Promise<AudioManifestItem[]> {
  const response = await fetch(`/api/jlpt-audio-manifest?level=${encodeURIComponent(level)}`);
  if (!response.ok) throw new Error("Grouped listening audio manifest unavailable");
  const payload = await response.json();
  return Array.isArray(payload?.items) ? payload.items : [];
}

const fmt = (s: number) => `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;

function SimulationAudio({ audioUrl, groupedLabel }: { audioUrl: string | null; groupedLabel?: string | null }) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    const audio = audioRef.current;
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
  }, [audioUrl]);

  if (!audioUrl) {
    return (
      <div className="rounded-xl border border-dashed p-4 text-center">
        <Headphones className="mx-auto mb-2 size-5 text-muted-foreground" />
        <p className="text-xs font-medium">音声問題</p>
        <p className="mt-1 text-[10px] text-muted-foreground">専用音声を準備中です。本文は試験画面に表示しません。</p>
      </div>
    );
  }

  const grouped = Boolean(groupedLabel);
  return (
    <div className="space-y-2">
      {grouped && <p className="text-[10px] font-semibold text-muted-foreground">{groupedLabel}</p>}
      <div className="flex items-center gap-2">
        <audio ref={audioRef} src={audioUrl} preload="metadata" />
        <Button
          size="sm"
          onClick={() => {
            const audio = audioRef.current;
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
              if (audioRef.current) {
                audioRef.current.currentTime = 0;
                void audioRef.current.play();
              }
            }}
          >
            <RotateCcw className="mr-1 size-4" />最初から
          </Button>
        )}
      </div>
      {grouped && <p className="text-[10px] text-muted-foreground">この音声は複数の設問で共通です。設問を移動しても同じ問題内では再生位置を維持します。</p>}
    </div>
  );
}

function ChoiceList({ current, selected, onSelect }: { current: Row; selected: number | undefined; onSelect: (i: number) => void }) {
  const star = current.question_type === "sentence_composition";
  return (
    <div className={star ? "mt-4 grid grid-cols-2 gap-2" : "mt-4 space-y-2"}>
      {current.choices.map((choice, i) => (
        <button
          key={i}
          onClick={() => onSelect(i)}
          className={`flex w-full items-center gap-3 rounded-xl border p-3 text-left font-jp text-[12px] ${selected === i ? "border-primary bg-primary/5 ring-1 ring-primary/30" : ""}`}
        >
          <span className="grid size-6 shrink-0 place-items-center rounded-full border font-bold">{i + 1}</span>
          <span>{choice}</span>
        </button>
      ))}
    </div>
  );
}

function QuestionBody({ current, selected, onSelect }: { current: Row; selected: number | undefined; onSelect: (i: number) => void }) {
  const star = current.question_type === "sentence_composition";
  const shownQuestionNo = current.display_question_no ?? current.question_no;
  return (
    <Card className="rounded-2xl">
      <CardContent className="p-4">
        <div className="mb-2 flex items-center justify-between">
          <span className="text-[10px] font-semibold text-muted-foreground">問 {shownQuestionNo}</span>
          {star && <span className="rounded-md bg-primary/10 px-2 py-1 text-[10px] font-bold text-primary">★ 文の組み立て</span>}
        </div>
        {star && <p className="mb-3 text-[11px] text-muted-foreground">文全体が正しくなるように並べたとき、★に入るものを選んでください。</p>}
        <h1 className={`font-jp font-semibold leading-8 ${star ? "rounded-xl bg-muted/40 p-4 text-center text-base tracking-wide" : "text-[15px]"}`}>{current.prompt_jp}</h1>
        <ChoiceList current={current} selected={selected} onSelect={onSelect} />
      </CardContent>
    </Card>
  );
}

function SectionRunner() {
  const params = Route.useParams();
  const navigate = useNavigate();
  const level = params.level.toUpperCase() as Level;
  const section = params.section;
  const storageKey = `eno-jlpt-full-${level}`;
  const q = useQuery({ queryKey: ["simulation-bank", level, section], queryFn: () => fetchQuestions(level, section) });
  const manifestQuery = useQuery({
    queryKey: ["simulation-audio-manifest", level],
    queryFn: () => fetchAudioManifest(level),
    enabled: section === "listening",
    staleTime: 30 * 60 * 1000,
  });
  const questions = q.data ?? [];
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [result, setResult] = useState<Result | null>(null);
  const [finished, setFinished] = useState(false);
  const [saving, setSaving] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const totalSeconds = (minutes[level]?.[section] ?? 30) * 60;
  const [remaining, setRemaining] = useState(totalSeconds);
  const started = useRef(Date.now());
  const deadline = useRef(Date.now() + totalSeconds * 1000);
  const answersRef = useRef<Record<string, number>>({});
  const finishingRef = useRef(false);
  const current = questions[index];
  const mondai = useMemo(() => Array.from(new Set(questions.map((x) => x.mondai_no))), [questions]);
  const answered = Object.keys(answers).length;

  useEffect(() => { answersRef.current = answers; }, [answers]);

  const groupedAudio = useMemo(() => {
    if (section !== "listening" || !current) return null;
    const items = manifestQuery.data ?? [];
    const mondaiSource = items.find((item) => item.mapping_scope === "mondai" && item.mondai_no === current.mondai_no);
    if (mondaiSource) return { url: mondaiSource.delivery_path, label: `問題 ${current.mondai_no} 共通音声` };
    const sessionSource = items.find((item) => item.mapping_scope === "session");
    if (sessionSource) return { url: sessionSource.delivery_path, label: "聴解セッション共通音声" };
    return null;
  }, [section, current, manifestQuery.data]);

  const activeAudioUrl = current?.audio_url ?? groupedAudio?.url ?? null;
  const activeAudioLabel = current?.audio_url ? null : groupedAudio?.label ?? null;

  const advanceFullExam = useCallback((score: Result) => {
    try {
      const raw = window.localStorage.getItem(storageKey);
      if (!raw) return null;
      const p: FullProgress = JSON.parse(raw);
      const sessions = jlptSessions[level] ?? [];
      const active = sessions[p.sessionIndex];
      if (!active || active.sections[p.sectionIndex] !== section) return null;
      const key = `${p.sessionIndex}:${section}`;
      const completed = Array.from(new Set([...(p.completed ?? []), key]));
      const results = { ...(p.results ?? {}), [key]: score };
      let sessionIndex = p.sessionIndex;
      let sectionIndex = p.sectionIndex + 1;
      if (sectionIndex >= active.sections.length) { sessionIndex += 1; sectionIndex = 0; }
      const next = { ...p, sessionIndex, sectionIndex, completed, results };
      window.localStorage.setItem(storageKey, JSON.stringify(next));
      const nextSession = sessions[sessionIndex];
      const nextSection = nextSession?.sections[sectionIndex];
      return nextSection ? { section: nextSection } : { done: true };
    } catch {
      return null;
    }
  }, [level, section, storageKey]);

  const finish = useCallback(async () => {
    if (finishingRef.current) return;
    finishingRef.current = true;
    setSaving(true);
    setSubmitError(null);
    try {
      const duration = Math.min(totalSeconds, Math.max(0, Math.round((Date.now() - started.current) / 1000)));
      const payload = Object.entries(answersRef.current).map(([question_id, selected_index]) => ({ question_id, selected_index }));
      const { data, error } = await (supabase as any).rpc("submit_jlpt_simulation_section", {
        p_level: level,
        p_section: section,
        p_duration_seconds: duration,
        p_answers: payload,
      });
      if (error) throw error;
      const r = Array.isArray(data) ? data[0] : data;
      if (!r) throw new Error("Hasil simulasi tidak tersedia");
      const score = { total_questions: Number(r.total_questions), correct_count: Number(r.correct_count), score_percent: Number(r.score_percent) };
      setResult(score);
      setFinished(true);
      advanceFullExam(score);
    } catch (e) {
      console.error(e);
      setSubmitError("Jawaban belum berhasil dikirim. Silakan coba lagi.");
      finishingRef.current = false;
    } finally {
      setSaving(false);
    }
  }, [level, section, totalSeconds, advanceFullExam]);

  useEffect(() => {
    if (finished || q.isLoading || !questions.length) return;
    const tick = () => {
      const left = Math.max(0, Math.ceil((deadline.current - Date.now()) / 1000));
      setRemaining(left);
      if (left === 0) void finish();
    };
    tick();
    const timer = window.setInterval(tick, 1000);
    return () => window.clearInterval(timer);
  }, [finished, q.isLoading, questions.length, finish]);

  const continueFull = () => {
    try {
      const raw = window.localStorage.getItem(storageKey);
      if (!raw) return;
      const p: FullProgress = JSON.parse(raw);
      const next = jlptSessions[level]?.[p.sessionIndex]?.sections[p.sectionIndex];
      if (next) void navigate({ to: "/simulasi-bagian/$level/$section", params: { level, section: next } });
      else void navigate({ to: "/simulasi-penuh/$level", params: { level } });
    } catch {
      void navigate({ to: "/simulasi", params: {} } as any);
    }
  };

  if (q.isLoading) return <AppShell title="Simulasi JLPT"><p className="py-10 text-center text-xs text-muted-foreground">問題を読み込んでいます…</p></AppShell>;
  if (!questions.length) return <AppShell title="Simulasi JLPT"><Card><CardContent className="p-6 text-center text-xs">Bank Simulasi {level} · {labels[section]} sedang disiapkan.<Button asChild className="mt-4"><Link to="/simulasi">Kembali</Link></Button></CardContent></Card></AppShell>;
  if (finished) return <AppShell title="Hasil Simulasi"><div className="mx-auto max-w-md"><Card><CardContent className="p-6 text-center"><Check className="mx-auto size-8 text-primary"/><p className="text-xs font-semibold text-primary">{level} · {labels[section]}</p><h1 className="mt-3 text-xl font-bold">{result?.correct_count ?? 0} / {result?.total_questions ?? questions.length}</h1><p className="mt-1 text-sm font-semibold">{result?.score_percent ?? 0}%</p><p className="mt-2 text-[10px] text-muted-foreground">Nilai latihan ENO NIHONGO. Skor JLPT resmi menggunakan scaled score.</p>{typeof window !== "undefined" && window.localStorage.getItem(storageKey) ? <Button className="mt-4 w-full" onClick={continueFull}>Lanjutkan simulasi penuh<ArrowRight className="ml-1 size-4"/></Button> : <Button asChild className="mt-4 w-full"><Link to="/simulasi">Kembali ke Simulasi</Link></Button>}</CardContent></Card></div></AppShell>;

  const shownQuestionNo = current.display_question_no ?? current.question_no;
  return (
    <AppShell title={`${level} · ${labels[section]}`} compact>
      <div className="mx-auto max-w-2xl space-y-3">
        <div className="sticky top-0 z-20 rounded-xl border bg-background/95 p-2 backdrop-blur">
          <div className="flex items-center justify-between px-1">
            <Link to="/simulasi" className="inline-flex items-center gap-1 text-[10px] text-muted-foreground"><ArrowLeft className="size-3"/>Simulasi</Link>
            <span className="text-[10px] font-semibold">日本語能力試験 · {answered}/{questions.length} 解答</span>
            <span className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-[11px] font-bold ${remaining <= 300 ? "bg-destructive/10 text-destructive" : "bg-primary/10 text-primary"}`}><Clock3 className="size-3"/>{fmt(remaining)}</span>
          </div>
          <div className="mt-2 flex gap-1 overflow-x-auto pb-1">
            {mondai.map((m) => {
              const first = questions.findIndex((x) => x.mondai_no === m);
              const active = current.mondai_no === m;
              const qs = questions.filter((x) => x.mondai_no === m);
              const done = qs.filter((x) => answers[x.id] !== undefined).length;
              return <button key={m} onClick={() => setIndex(first)} className={`shrink-0 rounded-lg border px-3 py-1.5 text-[10px] font-semibold ${active ? "border-primary bg-primary text-primary-foreground" : "bg-background"}`}>問題 {m} <span className={active ? "opacity-80" : "text-muted-foreground"}>{done}/{qs.length}</span></button>;
            })}
          </div>
        </div>
        <Card className="rounded-2xl"><CardContent className="p-4"><strong className="text-sm">問題 {current.mondai_no}</strong><p className="mt-2 font-jp text-[12px] leading-6">{current.instruction_jp}</p></CardContent></Card>
        {section === "reading" && current.passage_jp && <Card className="rounded-2xl"><CardContent className="max-h-[44vh] overflow-y-auto p-4"><div className="mb-2 flex items-center gap-2 text-primary"><BookOpenText className="size-4"/><span className="text-xs font-semibold">{current.passage_title || "文章"}</span></div><p className="whitespace-pre-wrap font-jp text-sm leading-7">{current.passage_jp}</p></CardContent></Card>}
        {section === "listening" && <Card className="rounded-2xl"><CardContent className="space-y-3 p-4">{current.image_url && <img src={current.image_url} alt={`問題 ${current.mondai_no} 問 ${shownQuestionNo}`} className="mx-auto w-full max-w-lg rounded-xl border bg-white object-contain" loading="eager"/>}<SimulationAudio audioUrl={activeAudioUrl} groupedLabel={activeAudioLabel}/></CardContent></Card>}
        <QuestionBody current={current} selected={answers[current.id]} onSelect={(i) => setAnswers((v) => ({ ...v, [current.id]: i }))}/>
        {submitError && <p className="rounded-lg bg-destructive/10 p-2 text-xs text-destructive">{submitError}</p>}
        <div className="flex justify-between gap-2">
          <Button variant="outline" disabled={index === 0 || saving} onClick={() => setIndex((v) => v - 1)}><ArrowLeft className="mr-1 size-4"/>前へ</Button>
          {index === questions.length - 1 ? <Button disabled={saving} onClick={() => void finish()}><Check className="mr-1 size-4"/>{saving ? "送信中…" : "終了"}</Button> : <Button disabled={saving} onClick={() => setIndex((v) => v + 1)}>次へ<ArrowRight className="ml-1 size-4"/></Button>}
        </div>
      </div>
    </AppShell>
  );
}
