import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Clock3, FileQuestion, Lightbulb } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { classroom, result, sessionTime } from "@/lib/classroom";
export const Route = createFileRoute("/_authenticated/kelas/$classId/quiz/$quizId")({
  validateSearch: (search: Record<string, unknown>): { attempt?: string } =>
    typeof search["attempt"] === "string" ? { attempt: search["attempt"] } : {},
  component: Page,
});
type Question = { question_id: string; question: string; choices: string[] };
type Attempt = {
  id: string;
  score: number;
  correct_count: number;
  total_questions: number;
  submitted_at: string;
};
type Review = Question & {
  selected_index: number;
  correct_index: number;
  explanation: string | null;
  is_correct: boolean;
};
function Page() {
  const { classId, quizId } = Route.useParams();
  const { attempt } = Route.useSearch();
  const q = useQuery({
    queryKey: ["student-quiz", classId, quizId],
    queryFn: async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Login diperlukan.");
      const quiz = await result<{
        id: string;
        title: string;
        description: string | null;
        due_at: string | null;
        duration_minutes: number | null;
      }>(
        classroom
          .from("class_quizzes")
          .select("id,title,description,due_at,duration_minutes")
          .eq("id", quizId)
          .eq("class_id", classId)
          .eq("is_published", true)
          .single(),
      );
      const [questions, attempts] = await Promise.all([
        result<Question[]>(classroom.rpc("get_class_quiz_for_student", { p_quiz_id: quizId })),
        result<Attempt[]>(
          classroom
            .from("class_quiz_attempts")
            .select("id,score,correct_count,total_questions,submitted_at")
            .eq("quiz_id", quizId)
            .eq("user_id", user.id)
            .order("submitted_at", { ascending: false }),
        ),
      ]);
      return { quiz, questions, attempts, userId: user.id };
    },
  });
  return (
    <AppShell title="Kuis Kelas" backTo={`/kelas/${classId}/workspace`}>
      <div className="mx-auto max-w-2xl space-y-4">
        {q.isPending && <p role="status">Memuat kuis…</p>}
        {q.isError && (
          <div role="alert">
            <p className="text-sm text-destructive">Kuis tidak dapat diakses. {q.error.message}</p>
            <Button variant="outline" onClick={() => void q.refetch()}>
              Coba Lagi
            </Button>
          </div>
        )}
        {q.data && (
          <Quiz
            key={`${quizId}:${attempt || ""}`}
            {...q.data}
            classId={classId}
            initialAttempt={attempt ?? null}
          />
        )}
      </div>
    </AppShell>
  );
}
function Quiz({
  quiz,
  questions,
  attempts,
  userId,
  classId,
  initialAttempt,
}: {
  quiz: {
    id: string;
    title: string;
    description: string | null;
    due_at: string | null;
    duration_minutes: number | null;
  };
  questions: Question[];
  attempts: Attempt[];
  userId: string;
  classId: string;
  initialAttempt: string | null;
}) {
  const qc = useQueryClient();
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [loaded, setLoaded] = useState(false);
  const [draftAvailable, setDraftAvailable] = useState(true);
  const [selected, setSelected] = useState<string | null>(initialAttempt);
  const [submitted, setSubmitted] = useState<Attempt | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [now, setNow] = useState(Date.now());
  const key = `class-quiz:${userId}:${quiz.id}`;
  const expired = !!quiz.due_at && new Date(quiz.due_at).getTime() < now;
  const completed = submitted || attempts[0] || null;
  const current = submitted?.id === selected ? submitted : attempts.find((a) => a.id === selected);
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);
  useEffect(() => {
    try {
      const draft = JSON.parse(localStorage.getItem(key) || "null");
      const valid: Record<string, number> = {};
      for (const q of questions) {
        const value = draft?.[q.question_id];
        if (Number.isInteger(value) && value >= 0 && value < q.choices.length)
          valid[q.question_id] = value;
      }
      setAnswers(valid);
    } catch {
      setDraftAvailable(false);
    }
    setLoaded(true);
  }, [key, questions]);
  useEffect(() => {
    if (!loaded || selected || expired || completed) return;
    try {
      localStorage.setItem(key, JSON.stringify(answers));
    } catch {
      setDraftAvailable(false);
    }
  }, [answers, key, loaded, selected, expired, completed]);
  const review = useQuery({
    queryKey: ["student-quiz-review", userId, selected],
    enabled: !!current,
    queryFn: () =>
      result<Review[]>(classroom.rpc("get_class_quiz_review", { p_attempt_id: selected ?? "" })),
  });
  async function submit() {
    if (busy || expired || completed || Object.keys(answers).length !== questions.length) return;
    setBusy(true);
    setError("");
    try {
      const rows = await result<
        { attempt_id: string; score: number; correct_count: number; total_questions: number }[]
      >(classroom.rpc("submit_class_quiz", { p_quiz_id: quiz.id, p_answers: answers }));
      const saved = rows[0];
      if (!saved) throw new Error("Hasil belum diterima. Periksa riwayat sebelum mencoba lagi.");
      setSubmitted({
        id: saved.attempt_id,
        score: saved.score,
        correct_count: saved.correct_count,
        total_questions: saved.total_questions,
        submitted_at: new Date().toISOString(),
      });
      setSelected(saved.attempt_id);
      setAnswers({});
      try {
        localStorage.removeItem(key);
      } catch {
        setDraftAvailable(false);
      }
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["student-quiz", classId, quiz.id] }),
        qc.invalidateQueries({ queryKey: ["class-workspace", classId] }),
      ]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Jawaban gagal dikirim.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <div className="flex items-start gap-3">
        <span className="grid size-10 shrink-0 place-items-center rounded-2xl bg-primary/10 text-primary">
          <FileQuestion className="size-5" />
        </span>
        <div>
          <h1 className="text-xl font-black">{quiz.title}</h1>
          <p className="whitespace-pre-wrap text-sm text-muted-foreground">{quiz.description}</p>
          <div className="mt-2 flex flex-wrap gap-2 text-xs text-muted-foreground">
            {quiz.duration_minutes && (
              <span className="inline-flex items-center gap-1">
                <Clock3 className="size-3.5" /> Estimasi {quiz.duration_minutes} menit
              </span>
            )}
            {quiz.due_at && <span>Batas: {sessionTime(quiz.due_at)}</span>}
          </div>
        </div>
      </div>
      {!selected && completed ? (
        <Card className="border-primary/20 bg-primary/[0.05]">
          <CardContent className="space-y-3 p-5 text-center">
            <h2 className="font-bold">Kuis sudah dikumpulkan</h2>
            <p className="text-sm text-muted-foreground">
              Setiap peserta hanya dapat mengirim kuis ini satu kali. Jawaban dan nilai sudah
              tercatat di panel guru.
            </p>
            <p className="text-3xl font-black text-primary">
              {completed.score}
              <span className="text-sm"> / 100</span>
            </p>
            <Button variant="outline" onClick={() => setSelected(completed.id)}>
              Lihat Hasil & Pembahasan
            </Button>
          </CardContent>
        </Card>
      ) : selected ? (
        <>
          {current ? (
            <>
              <Card>
                <CardContent className="space-y-2 p-5 text-center">
                  <h2 className="font-bold">Hasil Kuis</h2>
                  <p className="text-4xl font-black text-primary">
                    {current.score}
                    <span className="text-sm"> / 100</span>
                  </p>
                  <p className="text-sm">
                    {current.correct_count} benar dari {current.total_questions} soal
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {sessionTime(current.submitted_at)}
                  </p>
                </CardContent>
              </Card>
              {review.isPending && <p role="status">Memuat pembahasan…</p>}
              {review.isError && (
                <div role="alert">
                  <p className="text-sm text-destructive">
                    Pembahasan gagal dimuat. Nilai Anda sudah tersimpan.
                  </p>
                  <Button size="sm" onClick={() => void review.refetch()}>
                    Coba Lagi
                  </Button>
                </div>
              )}
              {review.data?.map((r, i) => (
                <Card key={r.question_id}>
                  <CardContent className="space-y-2 p-4">
                    <h2 className="text-sm font-bold">
                      {i + 1}. {r.question}
                    </h2>
                    {r.choices.map((choice, j) => (
                      <p
                        key={j}
                        className={`rounded-lg p-2 text-sm ${j === r.correct_index ? "bg-primary/10 font-bold" : ""}`}
                      >
                        {j + 1}. {choice}
                        {j === r.selected_index ? " · Jawaban Anda" : ""}
                        {j === r.correct_index ? " · Jawaban benar" : ""}
                      </p>
                    ))}
                    <p className="text-sm font-bold">
                      {r.is_correct ? "Benar" : "Perlu diperbaiki"}
                    </p>
                    {r.explanation && (
                      <p className="whitespace-pre-wrap text-sm text-muted-foreground">
                        {r.explanation}
                      </p>
                    )}
                  </CardContent>
                </Card>
              ))}
            </>
          ) : (
            <p role="alert">Hasil ini tidak ditemukan dalam riwayat kuis Anda.</p>
          )}
          <Button variant="outline" onClick={() => setSelected(null)}>
            Kembali ke Hasil
          </Button>
        </>
      ) : (
        <>
          {expired ? (
            <p className="rounded-xl bg-muted p-4 text-sm">
              Batas pengerjaan sudah berakhir. Hasil yang pernah dikumpulkan tetap dapat dibuka di
              bawah.
            </p>
          ) : (
            <>
              <div className="space-y-2 rounded-2xl border border-primary/15 bg-primary/[0.05] p-4">
                <p className="text-sm font-bold">
                  {Object.keys(answers).length} dari {questions.length} soal dijawab
                </p>
                <progress
                  className="h-2 w-full accent-green-600"
                  aria-label="Kemajuan jawaban kuis"
                  value={Object.keys(answers).length}
                  max={Math.max(questions.length, 1)}
                />
                <p className="text-xs">
                  {draftAvailable
                    ? "Draft tersimpan di perangkat ini. Nilai baru dikirim ke guru setelah Anda menekan Kirim Jawaban."
                    : "Draft tidak dapat disimpan di perangkat. Jangan tutup halaman sebelum mengirim jawaban."}
                </p>
                <p className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                  <Lightbulb className="size-3.5 text-primary" /> Jawaban dinilai otomatis setelah
                  dikirim.
                </p>
              </div>
              {questions.map((q, i) => (
                <Card key={q.question_id}>
                  <CardContent className="p-4">
                    <fieldset disabled={busy || !loaded}>
                      <legend className="text-sm font-bold">
                        {i + 1}. {q.question}
                      </legend>
                      <div className="mt-3 space-y-2">
                        {q.choices.map((choice, j) => (
                          <label
                            key={j}
                            className={`flex cursor-pointer items-start gap-2 rounded-xl border p-3 text-sm ${answers[q.question_id] === j ? "border-primary bg-primary/10 font-bold" : ""}`}
                          >
                            <input
                              type="radio"
                              name={q.question_id}
                              checked={answers[q.question_id] === j}
                              onChange={() => setAnswers((a) => ({ ...a, [q.question_id]: j }))}
                              className="mt-1 accent-green-600"
                            />
                            <span>{choice}</span>
                          </label>
                        ))}
                      </div>
                    </fieldset>
                  </CardContent>
                </Card>
              ))}
              {!questions.length && <p>Belum ada soal pada kuis ini.</p>}
              {!!questions.length && (
                <Button
                  className="w-full"
                  disabled={busy || !loaded || Object.keys(answers).length !== questions.length}
                  onClick={submit}
                >
                  {busy ? "Mengirim dan menilai…" : "Kirim Jawaban"}
                </Button>
              )}
            </>
          )}
          {attempts.length > 0 && (
            <section className="space-y-2">
              <h2 className="font-bold">Riwayat Kuis</h2>
              <p className="text-xs text-muted-foreground">
                Kuis hanya dapat dikumpulkan satu kali.
              </p>
              {attempts.map((a) => (
                <button
                  key={a.id}
                  className="flex w-full items-center justify-between gap-3 rounded-xl border p-3 text-left text-sm"
                  onClick={() => setSelected(a.id)}
                >
                  <span>
                    {sessionTime(a.submitted_at)}
                    <span className="block text-xs text-primary">Lihat Pembahasan</span>
                  </span>
                  <strong>{a.score}/100</strong>
                </button>
              ))}
            </section>
          )}
        </>
      )}
      {error && (
        <p role="alert" className="rounded-xl bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </p>
      )}
    </>
  );
}
