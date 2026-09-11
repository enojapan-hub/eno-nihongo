import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { ArrowLeft, Check, ChevronLeft, ChevronRight, ListChecks } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { saveAttempt, type Level, type RunnerQuestion } from "@/lib/learn-queries";

export const Route = createFileRoute("/_authenticated/quiz/$slug")({ component: QuizRunner });

type Skill = "kanji" | "vocabulary" | "grammar" | "reading" | "listening";
const SKILLS: Skill[] = ["kanji", "vocabulary", "grammar", "reading", "listening"];
const SKILL_LABEL: Record<Skill, string> = { kanji: "Kanji", vocabulary: "Kotoba", grammar: "Bunpou", reading: "Dokkai", listening: "Choukai" };

function parseSlug(slug: string): { level: Level | null; skill: Skill | null } {
  const match = slug.match(/^latihan-(n[1-5])(?:-(kanji|vocabulary|grammar|reading|listening))?$/i);
  if (!match) return { level: null, skill: null };
  return { level: match[1].toUpperCase() as Level, skill: (match[2]?.toLowerCase() as Skill | undefined) ?? null };
}

function shuffle<T>(items: T[]): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

function balanceAnswerPositions(questions: RunnerQuestion[]): RunnerQuestion[] {
  const targets = shuffle(Array.from({ length: questions.length }, (_, i) => i % 4));
  return questions.map((q, questionIndex) => {
    const target = targets[questionIndex];
    if (q.correct_index === target) return q;
    const choices = [...q.choices];
    [choices[q.correct_index], choices[target]] = [choices[target], choices[q.correct_index]];
    return { ...q, choices, correct_index: target };
  });
}

async function loadPracticeQuestions(level: Level, skill: Skill | null): Promise<RunnerQuestion[]> {
  let query = supabase
    .from("questions")
    .select("id, prompt_id, prompt_note, choices_id, correct_index, explanation_id")
    .eq("is_published", true)
    .eq("level", level)
    .not("prompt_id", "is", null)
    .not("choices_id", "is", null);
  if (skill) query = query.eq("skill", skill);

  const { data, error } = await query.limit(80);
  if (error) throw new Error(error.message);
  if (!data?.length) return [];

  const normalized = data.map(q => ({
    id: String(q.id),
    prompt: String(q.prompt_id ?? ""),
    prompt_note: q.prompt_note ?? null,
    choices: Array.isArray(q.choices_id) ? q.choices_id.map(String) : [],
    correct_index: Number(q.correct_index),
    explanation_id: q.explanation_id ?? null,
  })).filter(q => q.prompt.trim().length > 0 && q.choices.length === 4 && q.choices.every(choice => choice.trim().length > 0) && q.correct_index >= 0 && q.correct_index < 4);

  const selected = shuffle(normalized).slice(0, 10);
  return balanceAnswerPositions(selected);
}

function QuizRunner() {
  const { slug } = Route.useParams();
  const parsed = parseSlug(slug);
  const level = parsed.level;
  const skill = parsed.skill;
  const validLevel = !!level && ["N5", "N4", "N3", "N2", "N1"].includes(level);
  const validSkill = !skill || SKILLS.includes(skill);
  const title = level ? `Quiz ${skill ? SKILL_LABEL[skill] : "Campuran"} ${level}` : "Quiz";

  const { data: questions = [], isLoading, error } = useQuery({ queryKey: ["practice-quiz-id", level, skill], enabled: validLevel && validSkill, queryFn: () => loadPracticeQuestions(level!, skill), retry: 1 });
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [finished, setFinished] = useState(false);
  const [startedAt] = useState(() => Date.now());
  const [saving, setSaving] = useState(false);
  const current = questions[index];
  const score = useMemo(() => questions.reduce((n, q) => n + (answers[q.id] === q.correct_index ? 1 : 0), 0), [questions, answers]);

  async function finish() {
    if (finished || !questions.length || !level) return;
    setFinished(true); setSaving(true);
    try { await saveAttempt({ quizId: null, level, skill, total: questions.length, correct: score, durationSeconds: Math.round((Date.now() - startedAt) / 1000), answers: questions.map(q => ({ questionId: q.id, selectedIndex: answers[q.id] ?? -1, isCorrect: answers[q.id] === q.correct_index })) }); }
    finally { setSaving(false); }
  }

  if (!validLevel || !validSkill || !level) return <AppShell title="Quiz"><Card><CardContent className="py-10 text-center"><p className="text-sm font-semibold">Quiz tidak ditemukan</p><Button className="mt-4" asChild size="sm"><Link to="/quiz">Kembali ke Quiz</Link></Button></CardContent></Card></AppShell>;
  if (isLoading) return <AppShell title={title}><p className="text-xs text-muted-foreground">Menyiapkan soal…</p></AppShell>;
  if (error) return <AppShell title={title}><Card><CardContent className="py-10 text-center"><p className="text-sm font-semibold text-destructive">Bank soal gagal dimuat</p><Button className="mt-4" asChild size="sm"><Link to="/quiz">Kembali</Link></Button></CardContent></Card></AppShell>;
  if (!questions.length) return <AppShell title={title}><Card><CardContent className="py-10 text-center"><p className="text-sm font-semibold">Soal Indonesia belum tersedia</p><Button className="mt-4" asChild size="sm"><Link to="/quiz">Kembali</Link></Button></CardContent></Card></AppShell>;

  if (finished) return <AppShell title={`Hasil ${title}`}><div className="mx-auto max-w-2xl space-y-4"><Card><CardContent className="p-6 text-center"><div className="mx-auto mb-3 grid size-14 place-items-center rounded-2xl bg-primary/10 text-primary"><Check className="size-7" /></div><p className="text-xs text-muted-foreground">Skor kamu</p><div className="mt-1 text-4xl font-semibold">{score}/{questions.length}</div><Badge className="mt-2">{Math.round(score / questions.length * 100)}%</Badge><p className="mt-3 text-xs text-muted-foreground">{saving ? "Menyimpan hasil…" : "Hasil tersimpan jika kamu sudah login."}</p></CardContent></Card><Card><CardContent className="p-4"><h2 className="text-sm font-semibold">Pembahasan</h2><div className="mt-3 space-y-3">{questions.map((q, i) => <div key={q.id} className="rounded-xl border p-3"><p className="text-xs font-medium">{i + 1}. {q.prompt}</p><p className="mt-1 text-[11px] text-muted-foreground">Jawaban: {q.choices[q.correct_index]}</p><p className="mt-1 text-[11px] leading-5 text-muted-foreground">{q.explanation_id ?? "Pembahasan Bahasa Indonesia belum tersedia untuk soal ini."}</p></div>)}</div></CardContent></Card><div className="flex gap-2"><Button className="flex-1" onClick={() => window.location.reload()}>Ulangi</Button><Button className="flex-1" variant="outline" asChild><Link to="/quiz">Daftar Quiz</Link></Button></div></div></AppShell>;

  const progress = Math.round((index + 1) / questions.length * 100);
  return <AppShell title={title} description="Pilih satu jawaban yang paling tepat."><div className="mx-auto max-w-2xl pb-6"><div className="mb-4 flex items-center justify-between"><Button variant="ghost" size="sm" asChild><Link to="/quiz"><ArrowLeft className="mr-1.5 size-4" />Keluar</Link></Button><span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground"><ListChecks className="size-3.5" />{Object.keys(answers).length}/{questions.length}</span></div><div className="mb-4"><div className="mb-1.5 flex justify-between text-[10px] text-muted-foreground"><span>Soal {index + 1} dari {questions.length}</span><span>{progress}%</span></div><div className="h-1.5 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-primary" style={{ width: `${progress}%` }} /></div></div><Card><CardContent className="p-5 sm:p-6"><div className="mb-4 flex items-center justify-between"><Badge>{level}</Badge><span className="text-[10px] text-muted-foreground">{skill ? SKILL_LABEL[skill] : "Campuran"}</span></div><h2 className="text-base font-semibold leading-7">{current.prompt}</h2>{current.prompt_note && <p className="mt-2 text-xs text-muted-foreground">{current.prompt_note}</p>}<div className="mt-5 space-y-2">{current.choices.map((choice, i) => { const selected = answers[current.id] === i; return <button key={i} type="button" className={`flex min-h-12 w-full items-start gap-3 rounded-xl border px-3 py-3 text-left text-xs transition ${selected ? "border-primary bg-primary/5" : "border-border/70 hover:bg-muted/50"}`} onClick={() => setAnswers(a => ({ ...a, [current.id]: i }))}><span className={`grid size-6 shrink-0 place-items-center rounded-full text-[10px] font-semibold ${selected ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>{String.fromCharCode(65 + i)}</span><span>{choice}</span></button>; })}</div><div className="mt-6 flex items-center justify-between gap-2"><Button variant="outline" size="sm" disabled={index === 0} onClick={() => setIndex(i => i - 1)}><ChevronLeft className="mr-1 size-4" />Sebelumnya</Button>{index === questions.length - 1 ? <Button size="sm" disabled={answers[current.id] === undefined} onClick={() => void finish()}>Selesai</Button> : <Button size="sm" disabled={answers[current.id] === undefined} onClick={() => setIndex(i => i + 1)}>Berikutnya<ChevronRight className="ml-1 size-4" /></Button>}</div></CardContent></Card></div></div></AppShell>;
}
