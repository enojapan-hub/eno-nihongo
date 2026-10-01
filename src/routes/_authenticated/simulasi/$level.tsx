import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  Check,
  Clock3,
  Flag,
  Headphones,
  Languages,
  Play,
  RotateCcw,
  Square,
} from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  fetchSimulationQuestionSet,
  getSimulationTarget,
  type SimulationGroup,
  type SimulationQuestion,
} from "@/lib/simulation-queries";
import { saveAttempt, type Level } from "@/lib/learn-queries";

export const Route = createFileRoute("/_authenticated/simulasi/$level")({
  component: SimulationRunner,
});

const levels: Level[] = ["N5", "N4", "N3", "N2", "N1"];
type SectionKey = "vocabulary" | "grammar_reading" | "listening";
type Section = {
  key: SectionKey;
  title: string;
  subtitle: string;
  minutes: number;
  group: SimulationGroup;
  icon: typeof Languages;
};

const sections: Record<Level, Section[]> = {
  N5: [
    { key: "vocabulary", title: "言語知識（文字・語彙）", subtitle: "Bahasa · Kosakata", minutes: 20, group: "vocabulary", icon: Languages },
    { key: "grammar_reading", title: "言語知識（文法）・読解", subtitle: "Bahasa · Tata Bahasa & Membaca", minutes: 40, group: "grammar_reading", icon: BookOpen },
    { key: "listening", title: "聴解", subtitle: "Menyimak", minutes: 30, group: "listening", icon: Headphones },
  ],
  N4: [
    { key: "vocabulary", title: "言語知識（文字・語彙）", subtitle: "Bahasa · Kosakata", minutes: 25, group: "vocabulary", icon: Languages },
    { key: "grammar_reading", title: "言語知識（文法）・読解", subtitle: "Bahasa · Tata Bahasa & Membaca", minutes: 55, group: "grammar_reading", icon: BookOpen },
    { key: "listening", title: "聴解", subtitle: "Menyimak", minutes: 35, group: "listening", icon: Headphones },
  ],
  N3: [
    { key: "vocabulary", title: "言語知識（文字・語彙）", subtitle: "Bahasa · Kosakata", minutes: 30, group: "vocabulary", icon: Languages },
    { key: "grammar_reading", title: "言語知識（文法）・読解", subtitle: "Bahasa · Tata Bahasa & Membaca", minutes: 70, group: "grammar_reading", icon: BookOpen },
    { key: "listening", title: "聴解", subtitle: "Menyimak", minutes: 40, group: "listening", icon: Headphones },
  ],
  N2: [
    { key: "grammar_reading", title: "言語知識（文字・語彙・文法）・読解", subtitle: "Bahasa · Kosakata/Tata Bahasa & Membaca", minutes: 105, group: "language_reading", icon: BookOpen },
    { key: "listening", title: "聴解", subtitle: "Menyimak", minutes: 50, group: "listening", icon: Headphones },
  ],
  N1: [
    { key: "grammar_reading", title: "言語知識（文字・語彙・文法）・読解", subtitle: "Bahasa · Kosakata/Tata Bahasa & Membaca", minutes: 110, group: "language_reading", icon: BookOpen },
    { key: "listening", title: "聴解", subtitle: "Menyimak", minutes: 55, group: "listening", icon: Headphones },
  ],
};

const passMarks: Record<Level, number> = { N5: 80, N4: 90, N3: 95, N2: 90, N1: 100 };
const typeLabels: Record<string, string> = {
  task_based: "課題理解 · Pemahaman tugas",
  point: "ポイント理解 · Pemahaman poin penting",
  outline: "概要理解 · Pemahaman garis besar",
  expression: "発話表現 · Ungkapan lisan",
  quick_response: "即時応答 · Respons cepat",
  integrated: "統合理解 · Pemahaman terpadu",
};

function SimulationRunner() {
  const raw = Route.useParams().level.toUpperCase();
  const level = levels.includes(raw as Level) ? (raw as Level) : "N5";
  const levelSections = sections[level];
  const [started, setStarted] = useState(false);
  const [sectionIndex, setSectionIndex] = useState(0);
  const section = levelSections[sectionIndex];
  const [questionSets, setQuestionSets] = useState<Record<string, SimulationQuestion[]>>({});
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [index, setIndex] = useState(0);
  const [seconds, setSeconds] = useState(section.minutes * 60);
  const [sectionFinished, setSectionFinished] = useState(false);
  const [finished, setFinished] = useState(false);
  const [saving, setSaving] = useState(false);
  const [speaking, setSpeaking] = useState(false);

  const query = useQuery({
    queryKey: ["jlpt-simulation-v3", level, section.key],
    queryFn: () => fetchSimulationQuestionSet(level, section.group),
    enabled: started,
  });

  const questions = questionSets[section.key] ?? query.data ?? [];
  const current = questions[index];
  const selected = current ? answers[current.id] : undefined;

  useEffect(() => {
    if (!query.data) return;
    setQuestionSets((old) => ({ ...old, [section.key]: query.data }));
    setIndex(0);
    setSeconds(section.minutes * 60);
    setSectionFinished(false);
  }, [query.data, section.key, section.minutes]);

  useEffect(() => {
    if (!started || sectionFinished || finished || !questions.length) return;
    const timerId = window.setInterval(() => setSeconds((value) => Math.max(0, value - 1)), 1000);
    return () => window.clearInterval(timerId);
  }, [started, sectionFinished, finished, questions.length, section.key]);

  useEffect(() => {
    if (started && seconds === 0 && questions.length && !sectionFinished && !finished) {
      void finishSection();
    }
  }, [seconds, started, questions.length, sectionFinished, finished]);

  useEffect(() => {
    window.speechSynthesis?.cancel();
    setSpeaking(false);
  }, [current?.listeningId, current?.id, sectionFinished]);

  const answeredHere = questions.filter((q) => answers[q.id] !== undefined).length;
  const timer = `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
  const timerUrgent = seconds <= 60;
  const totals = useMemo(() => Object.values(questionSets).flat(), [questionSets]);
  const totalCorrect = totals.reduce((n, q) => n + (answers[q.id] === q.correct_index ? 1 : 0), 0);
  const totalAnswered = totals.filter((q) => answers[q.id] !== undefined).length;
  const totalQuestions = totals.length;
  const percentage = totalQuestions ? Math.round((totalCorrect / totalQuestions) * 100) : 0;

  const clipQuestions = current?.listeningId
    ? questions.filter((q) => q.listeningId === current.listeningId)
    : current
      ? [current]
      : [];
  const clipQuestionIndex = current
    ? Math.max(0, clipQuestions.findIndex((q) => q.id === current.id))
    : 0;

  function chooseAnswer(choice: number) {
    if (!current || sectionFinished) return;
    setAnswers((old) => ({ ...old, [current.id]: choice }));
  }

  function playListening() {
    if (!current?.transcriptJp || current.audioUrl) return;
    window.speechSynthesis?.cancel();
    const utterance = new SpeechSynthesisUtterance(current.transcriptJp);
    utterance.lang = "ja-JP";
    utterance.rate = 0.82;
    utterance.onstart = () => setSpeaking(true);
    utterance.onend = () => setSpeaking(false);
    utterance.onerror = () => setSpeaking(false);
    window.speechSynthesis?.speak(utterance);
  }

  function stopListening() {
    window.speechSynthesis?.cancel();
    setSpeaking(false);
  }

  async function finishSection() {
    if (sectionFinished || finished || !questions.length) return;
    setSectionFinished(true);
    stopListening();
    if (sectionIndex < levelSections.length - 1) return;

    setFinished(true);
    setSaving(true);
    try {
      const allQuestions = Object.values({ ...questionSets, [section.key]: questions }).flat();
      const correct = allQuestions.reduce(
        (n, q) => n + (answers[q.id] === q.correct_index ? 1 : 0),
        0,
      );
      const persistable = allQuestions.filter((q) => q.persistAnswer);
      await saveAttempt({
        level,
        skill: null,
        total: allQuestions.length,
        correct,
        durationSeconds: levelSections.reduce((n, s) => n + s.minutes * 60, 0) - seconds,
        answers: persistable.map((q) => ({
          questionId: q.id,
          selectedIndex: answers[q.id] ?? -1,
          isCorrect: answers[q.id] === q.correct_index,
        })),
      });
    } finally {
      setSaving(false);
    }
  }

  function nextSection() {
    setSectionIndex((value) => value + 1);
    setIndex(0);
    setSectionFinished(false);
  }

  if (!started) {
    return (
      <AppShell
        title={`Simulasi JLPT ${level}`}
        description="Simulasi ENO JAPAN mengikuti struktur dan pembagian waktu JLPT."
      >
        <div className="mx-auto max-w-3xl">
          <Card>
            <CardContent className="p-6 sm:p-8">
              <Badge>{level}</Badge>
              <h1 className="mt-3 text-2xl font-bold">Simulasi JLPT {level}</h1>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                Setiap bagian memiliki timer sendiri. Setelah bagian dikumpulkan, jawaban dikunci.
              </p>
              <div className="mt-6 space-y-2">
                {levelSections.map((s, i) => {
                  const Icon = s.icon;
                  const target = getSimulationTarget(level, s.group);
                  return (
                    <div key={s.key} className="flex items-center justify-between gap-3 rounded-xl border p-4">
                      <div className="flex items-center gap-3">
                        <div className="grid size-9 place-items-center rounded-lg bg-primary/10 text-primary">
                          <Icon className="size-4" />
                        </div>
                        <div>
                          <p className="text-sm font-semibold">Bagian {i + 1} · {s.title}</p>
                          <p className="text-xs text-muted-foreground">{s.subtitle}</p>
                          <p className="mt-1 text-[11px] text-muted-foreground">
                            Target bank soal: {target} · jumlah aktual mengikuti materi yang tersedia
                          </p>
                        </div>
                      </div>
                      <span className="text-sm font-bold">{s.minutes} mnt</span>
                    </div>
                  );
                })}
              </div>
              <div className="mt-5 rounded-xl bg-muted/40 p-4 text-xs leading-5 text-muted-foreground">
                Hasil ENO JAPAN adalah estimasi latihan. JLPT resmi menggunakan scaled score.
              </div>
              <Button className="mt-6 w-full" size="lg" onClick={() => setStarted(true)}>
                Mulai Simulasi {level}<ArrowRight className="ml-2 size-4" />
              </Button>
            </CardContent>
          </Card>
        </div>
      </AppShell>
    );
  }

  if (query.isLoading && !questions.length) {
    return <AppShell title={`JLPT ${level}`}><p className="text-sm text-muted-foreground">Menyiapkan bagian ujian…</p></AppShell>;
  }

  if (query.error) {
    return (
      <AppShell title={`JLPT ${level}`}>
        <Card><CardContent className="py-10 text-center">
          <p className="text-sm text-destructive">Soal belum dapat dimuat.</p>
          <Button asChild className="mt-4"><Link to="/simulasi">Kembali</Link></Button>
        </CardContent></Card>
      </AppShell>
    );
  }

  if (!questions.length) {
    return (
      <AppShell title={`JLPT ${level}`}>
        <Card><CardContent className="py-10 text-center">
          <p className="text-sm text-muted-foreground">Belum ada soal tersedia untuk bagian {section.subtitle}.</p>
          <Button asChild className="mt-4"><Link to="/simulasi">Kembali</Link></Button>
        </CardContent></Card>
      </AppShell>
    );
  }

  if (finished) {
    return (
      <AppShell title="Hasil Simulasi" description={`JLPT ${level}`}>
        <div className="mx-auto max-w-2xl">
          <Card><CardContent className="p-7 sm:p-9">
            <div className="text-center">
              <div className="mx-auto grid size-14 place-items-center rounded-2xl bg-primary/10 text-primary"><Check className="size-7" /></div>
              <p className="mt-4 text-xs text-muted-foreground">Simulasi JLPT {level} selesai</p>
              <p className="mt-1 text-4xl font-bold">{percentage}%</p>
              <p className="mt-2 text-sm text-muted-foreground">{totalCorrect} benar dari {totalQuestions} soal · {totalAnswered} dijawab</p>
            </div>
            <div className="mt-6 rounded-xl border p-4">
              <p className="text-sm font-semibold">Catatan nilai</p>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">Batas lulus resmi JLPT {level}: {passMarks[level]}/180. Nilai latihan ini bukan scaled score resmi.</p>
            </div>
            <div className="mt-5 grid gap-2">
              {levelSections.map((s, i) => {
                const qs = questionSets[s.key] ?? [];
                const correct = qs.reduce((n, q) => n + (answers[q.id] === q.correct_index ? 1 : 0), 0);
                return (
                  <div key={s.key} className="flex items-center justify-between rounded-xl border p-4">
                    <div>
                      <p className="text-sm font-semibold">Bagian {i + 1} · {s.subtitle}</p>
                      <p className="text-xs text-muted-foreground">{s.minutes} menit · {qs.length} soal</p>
                    </div>
                    <Badge variant="secondary">{correct}/{qs.length}</Badge>
                  </div>
                );
              })}
            </div>
            <p className="mt-4 text-center text-xs text-muted-foreground">{saving ? "Menyimpan hasil…" : "Hasil simulasi tersimpan ke Progress."}</p>
            <div className="mt-5 flex flex-col gap-2 sm:flex-row">
              <Button asChild className="flex-1"><Link to="/simulasi"><ArrowLeft className="mr-1 size-4" />Pilih level</Link></Button>
              <Button variant="outline" className="flex-1" onClick={() => window.location.reload()}><RotateCcw className="mr-1 size-4" />Ulangi</Button>
            </div>
          </CardContent></Card>
        </div>
      </AppShell>
    );
  }

  const progress = questions.length ? ((index + 1) / questions.length) * 100 : 0;
  const typeLabel = current?.questionType
    ? typeLabels[current.questionType] ?? current.questionType
    : current?.skill ?? section.subtitle;

  return (
    <AppShell title={`JLPT ${level}`} description={`${section.subtitle} · Bagian ${sectionIndex + 1} dari ${levelSections.length}`}>
      <div className="mx-auto max-w-3xl pb-8">
        <div className="mb-4 rounded-xl border bg-card p-3">
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold">Bagian {sectionIndex + 1} / {levelSections.length}</span>
            <span className={`inline-flex items-center gap-1.5 font-semibold ${timerUrgent ? "text-destructive" : "text-muted-foreground"}`}><Clock3 className="size-3.5" />{timer}</span>
          </div>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-primary" style={{ width: `${progress}%` }} /></div>
        </div>

        <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-3">
          {levelSections.map((s, i) => {
            const Icon = s.icon;
            return (
              <div key={s.key} className={`rounded-xl border p-3 ${i === sectionIndex ? "border-primary bg-primary/5" : "bg-card"}`}>
                <div className="flex items-center gap-2"><Icon className="size-4 text-primary" /><span className="text-[11px] font-semibold">{s.subtitle}</span></div>
                <p className="mt-1 text-[10px] text-muted-foreground">{s.minutes} menit</p>
              </div>
            );
          })}
        </div>

        <Card className="mb-4 shadow-none"><CardContent className="p-4">
          <div className="flex items-center justify-between text-xs text-muted-foreground"><span>Soal {index + 1} dari {questions.length}</span><span>{answeredHere}/{questions.length} dijawab</span></div>
          <div className="mt-3 flex flex-wrap gap-1.5">
            {questions.map((q, i) => (
              <button key={q.id} type="button" onClick={() => setIndex(i)} className={`grid size-8 place-items-center rounded-lg border text-xs font-medium ${i === index ? "border-primary bg-primary text-primary-foreground" : answers[q.id] !== undefined ? "border-primary/30 bg-primary/10 text-primary" : "border-border text-muted-foreground hover:bg-muted"}`}>{i + 1}</button>
            ))}
          </div>
        </CardContent></Card>

        <Card><CardContent className="p-5 sm:p-7">
          <div className="mb-5 flex items-center justify-between gap-3">
            <div><Badge variant="secondary">{section.title}</Badge><p className="mt-2 text-[11px] text-muted-foreground">{typeLabel}</p></div>
            {selected !== undefined ? <span className="inline-flex items-center gap-1 text-xs text-primary"><Flag className="size-3.5" />Sudah dijawab</span> : <span className="text-xs text-muted-foreground">Belum dijawab</span>}
          </div>

          {section.key === "listening" && (
            <div className="mb-5 rounded-xl border bg-muted/30 p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold">聴解 · Listening</p>
                  {current.listeningTitle && <p className="mt-1 text-[11px] text-muted-foreground">{current.listeningTitle}</p>}
                </div>
                {clipQuestions.length > 1 && <Badge variant="outline">Soal {clipQuestionIndex + 1}/{clipQuestions.length} · audio sama</Badge>}
              </div>
              {current.audioUrl ? (
                <audio className="mt-3 w-full" controls preload="metadata" src={current.audioUrl} />
              ) : current.transcriptJp ? (
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button variant="outline" size="sm" onClick={speaking ? stopListening : playListening}>
                    {speaking ? <Square className="mr-1 size-3.5" /> : <Play className="mr-1 size-3.5" />}
                    {speaking ? "Berhenti" : "Putar audio"}
                  </Button>
                  <span className="self-center text-[11px] text-muted-foreground">TTS Jepang hanya dipakai sebagai fallback bila audio sumber belum tersedia.</span>
                </div>
              ) : (
                <p className="mt-2 text-[11px] text-muted-foreground">Audio belum tersedia untuk blok soal ini.</p>
              )}
            </div>
          )}

          <h2 className="text-base font-semibold leading-7 sm:text-lg">{current.prompt}</h2>
          {current.prompt_note && <p className="mt-2 text-xs text-muted-foreground">{current.prompt_note}</p>}
          <div className="mt-6 space-y-2.5">
            {current.choices.map((choice, i) => (
              <button key={`${current.id}-${i}`} type="button" onClick={() => chooseAnswer(i)} className={`flex w-full items-start gap-3 rounded-xl border p-3.5 text-left text-sm ${selected === i ? "border-primary bg-primary/5 ring-1 ring-primary/20" : "border-border hover:bg-muted/40"}`}>
                <span className="grid size-6 shrink-0 place-items-center rounded-md bg-muted text-xs font-semibold">{String.fromCharCode(65 + i)}</span>
                <span>{choice}</span>
              </button>
            ))}
          </div>
          <div className="mt-7 flex items-center justify-between gap-2 border-t pt-4">
            <Button variant="outline" disabled={index === 0} onClick={() => setIndex((value) => value - 1)}><ArrowLeft className="mr-1 size-4" />Sebelumnya</Button>
            {index === questions.length - 1 ? (
              <Button onClick={() => void finishSection()}><Check className="mr-1 size-4" />Selesai Bagian</Button>
            ) : (
              <Button onClick={() => setIndex((value) => value + 1)} disabled={selected === undefined}>Berikutnya<ArrowRight className="ml-1 size-4" /></Button>
            )}
          </div>
          <p className="mt-3 text-center text-[11px] text-muted-foreground">Setelah bagian dikumpulkan, jawaban dikunci. Tidak ada kembali ke bagian sebelumnya.</p>
        </CardContent></Card>

        {sectionFinished && sectionIndex < levelSections.length - 1 && (
          <Card className="mt-4 border-primary/20"><CardContent className="p-5">
            <p className="text-sm font-semibold">Bagian selesai</p>
            <p className="mt-1 text-xs text-muted-foreground">Bagian ini sudah dikunci.</p>
            <Button className="mt-4" onClick={nextSection}>Lanjut ke {levelSections[sectionIndex + 1].subtitle}<ArrowRight className="ml-1 size-4" /></Button>
          </CardContent></Card>
        )}
      </div>
    </AppShell>
  );
}
