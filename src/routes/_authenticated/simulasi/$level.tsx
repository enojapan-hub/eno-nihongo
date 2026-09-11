import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useEffectEvent, useMemo, useState } from "react";
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

  const finishSectionOnTimeout = useEffectEvent(finishSection);

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
      void finishSectionOnTimeout();
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
    : [];
  const clipIndex = current?.listeningId
    ? clipQuestions.findIndex((q) => q.id === current.id)
    : -1;

  function selectAnswer(value: number) {
    if (!current || sectionFinished) return;
    setAnswers((old) => ({ ...old, [current.id]: value }));
  }

  function nextQuestion() {
    if (index < questions.length - 1) {
      setIndex((value) => value + 1);
      return;
    }
    void finishSection();
  }

  function previousQuestion() {
    setIndex((value) => Math.max(0, value - 1));
  }

  function nextSection() {
    if (sectionIndex >= levelSections.length - 1) return;
    setSectionIndex((value) => value + 1);
    setIndex(0);
    setSectionFinished(false);
    setSeconds(levelSections[sectionIndex + 1].minutes * 60);
  }

  function speakCurrent() {
    if (!current?.listeningText || typeof window === "undefined") return;
    window.speechSynthesis?.cancel();
    const utterance = new SpeechSynthesisUtterance(current.listeningText);
    utterance.lang = "ja-JP";
    utterance.rate = 0.9;
    utterance.onstart = () => setSpeaking(true);
    utterance.onend = () => setSpeaking(false);
    utterance.onerror = () => setSpeaking(false);
    window.speechSynthesis?.speak(utterance);
  }

  if (!started) {
    return (
      <AppShell>
        <div className="mx-auto max-w-3xl space-y-6 px-4 py-6">
          <Link to="/simulasi" className="inline-flex items-center gap-2 text-sm font-semibold text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-4 w-4" /> Kembali ke simulasi
          </Link>
          <Card>
            <CardContent className="space-y-5 p-6">
              <div className="space-y-2">
                <Badge variant="secondary">Simulasi JLPT {level}</Badge>
                <h1 className="text-2xl font-bold">Simulasi ujian {level}</h1>
                <p className="text-sm text-muted-foreground">
                  Kerjakan tiap bagian sesuai waktu ujian. Jawaban disimpan setelah bagian terakhir selesai.
                </p>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                {levelSections.map((item) => {
                  const Icon = item.icon;
                  return (
                    <div key={item.key} className="rounded-xl border p-4">
                      <div className="flex items-start gap-3">
                        <Icon className="mt-0.5 h-5 w-5" />
                        <div>
                          <p className="font-semibold">{item.title}</p>
                          <p className="text-sm text-muted-foreground">{item.subtitle}</p>
                          <p className="mt-1 text-xs text-muted-foreground">{item.minutes} menit</p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
              <Button className="w-full" onClick={() => setStarted(true)}>
                <Play className="mr-2 h-4 w-4" /> Mulai simulasi
              </Button>
            </CardContent>
          </Card>
        </div>
      </AppShell>
    );
  }

  if (finished) {
    return (
      <AppShell>
        <div className="mx-auto max-w-3xl space-y-6 px-4 py-6">
          <Card>
            <CardContent className="space-y-5 p-6 text-center">
              <Check className="mx-auto h-12 w-12" />
              <div>
                <p className="text-sm text-muted-foreground">Simulasi selesai</p>
                <h1 className="text-2xl font-bold">Hasil JLPT {level}</h1>
              </div>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <div className="rounded-xl border p-3"><p className="text-xs text-muted-foreground">Benar</p><p className="text-xl font-bold">{totalCorrect}</p></div>
                <div className="rounded-xl border p-3"><p className="text-xs text-muted-foreground">Terjawab</p><p className="text-xl font-bold">{totalAnswered}</p></div>
                <div className="rounded-xl border p-3"><p className="text-xs text-muted-foreground">Nilai</p><p className="text-xl font-bold">{percentage}%</p></div>
                <div className="rounded-xl border p-3"><p className="text-xs text-muted-foreground">Target lulus</p><p className="text-xl font-bold">{passMarks[level]}</p></div>
              </div>
              <p className="text-sm text-muted-foreground">
                Nilai ini adalah skor latihan internal berdasarkan jumlah jawaban benar, bukan skor resmi JLPT berskala.
              </p>
              <div className="flex flex-wrap justify-center gap-3">
                <Button variant="outline" asChild><Link to="/simulasi"><ArrowLeft className="mr-2 h-4 w-4" /> Simulasi lain</Link></Button>
                <Button onClick={() => window.location.reload()}><RotateCcw className="mr-2 h-4 w-4" /> Ulangi</Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="mx-auto max-w-5xl space-y-4 px-4 py-4">
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-card p-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">JLPT {level}</p>
            <h1 className="font-bold">{section.title}</h1>
            <p className="text-xs text-muted-foreground">{section.subtitle}</p>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline">{answeredHere}/{questions.length}</Badge>
            <Badge variant={timerUrgent ? "destructive" : "secondary"} className="gap-1"><Clock3 className="h-3.5 w-3.5" /> {timer}</Badge>
          </div>
        </div>

        {query.isLoading && !questions.length ? (
          <Card><CardContent className="p-8 text-center text-sm text-muted-foreground">Memuat soal simulasi...</CardContent></Card>
        ) : query.isError ? (
          <Card><CardContent className="p-8 text-center text-sm text-destructive">Gagal memuat soal simulasi.</CardContent></Card>
        ) : sectionFinished ? (
          <Card>
            <CardContent className="space-y-4 p-8 text-center">
              <Flag className="mx-auto h-10 w-10" />
              <h2 className="text-xl font-bold">Bagian selesai</h2>
              <p className="text-sm text-muted-foreground">Jawaban bagian ini sudah dikunci.</p>
              {sectionIndex < levelSections.length - 1 ? (
                <Button onClick={nextSection}>Lanjut ke bagian berikutnya <ArrowRight className="ml-2 h-4 w-4" /></Button>
              ) : saving ? (
                <p className="text-sm text-muted-foreground">Menyimpan hasil...</p>
              ) : null}
            </CardContent>
          </Card>
        ) : current ? (
          <Card>
            <CardContent className="space-y-5 p-5 sm:p-6">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="secondary">Soal {index + 1}</Badge>
                  {current.questionType ? <Badge variant="outline">{typeLabels[current.questionType] ?? current.questionType}</Badge> : null}
                  {clipIndex >= 0 ? <Badge variant="outline">Audio {clipIndex + 1}/{clipQuestions.length}</Badge> : null}
                </div>
                <span className="text-xs text-muted-foreground">Target bagian: {getSimulationTarget(level, section.group)} soal</span>
              </div>

              {current.listeningText ? (
                <div className="rounded-xl border bg-muted/30 p-4">
                  <div className="mb-2 flex items-center justify-between gap-3">
                    <p className="text-sm font-semibold">Audio latihan</p>
                    <Button size="sm" variant="outline" onClick={speaking ? stopListening : speakCurrent}>
                      {speaking ? <Square className="mr-2 h-4 w-4" /> : <Headphones className="mr-2 h-4 w-4" />}
                      {speaking ? "Stop" : "Putar"}
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">Gunakan audio untuk menjawab. Teks tidak ditampilkan saat simulasi.</p>
                </div>
              ) : null}

              <div>
                <p className="whitespace-pre-line text-base font-semibold leading-7">{current.prompt}</p>
              </div>

              <div className="space-y-2">
                {current.options.map((option, optionIndex) => (
                  <button
                    key={`${current.id}-${optionIndex}`}
                    type="button"
                    onClick={() => selectAnswer(optionIndex)}
                    className={`w-full rounded-xl border px-4 py-3 text-left text-sm transition ${selected === optionIndex ? "border-primary bg-primary/10" : "hover:bg-muted/50"}`}
                  >
                    <span className="mr-2 font-semibold">{optionIndex + 1}.</span>{option}
                  </button>
                ))}
              </div>

              <div className="flex items-center justify-between gap-3 border-t pt-4">
                <Button variant="outline" onClick={previousQuestion} disabled={index === 0}>
                  <ArrowLeft className="mr-2 h-4 w-4" /> Sebelumnya
                </Button>
                <Button onClick={nextQuestion} disabled={selected === undefined}>
                  {index < questions.length - 1 ? "Berikutnya" : "Selesaikan bagian"}
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : (
          <Card><CardContent className="p-8 text-center text-sm text-muted-foreground">Soal belum tersedia untuk bagian ini.</CardContent></Card>
        )}
      </div>
    </AppShell>
  );
}
