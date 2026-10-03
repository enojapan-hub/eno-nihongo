import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  CheckCircle2,
  CircleHelp,
  FileQuestion,
  Lightbulb,
  LockKeyhole,
  Pencil,
  Plus,
  Save,
  Trash2,
} from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { classroom, result, categories } from "@/lib/classroom";
export const Route = createFileRoute("/_authenticated/guru-kelas/$classId/quiz/$quizId")({
  component: Page,
});
function Page() {
  const { classId, quizId } = Route.useParams();
  const qc = useQueryClient();
  const [id, setId] = useState<string | null>(null);
  const [question, setQuestion] = useState("");
  const [choices, setChoices] = useState(["", "", "", ""]);
  const [correct, setCorrect] = useState(-1);
  const [explanation, setExplanation] = useState("");
  const [category, setCategory] = useState("Umum");
  const [topic, setTopic] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const q = useQuery({
    queryKey: ["teacher-quiz-editor", quizId],
    queryFn: async () => {
      if (!(await result(classroom.rpc("can_manage_class", { p_class_id: classId }))))
        throw new Error("Akses guru diperlukan.");
      const quiz = await result(
        classroom
          .from("class_quizzes")
          .select("id,title,is_published")
          .eq("class_id", classId)
          .eq("id", quizId)
          .single(),
      );
      const [questions, attempts] = await Promise.all([
        result(
          classroom
            .from("class_quiz_questions")
            .select("*")
            .eq("quiz_id", quizId)
            .order("sort_order"),
        ),
        result(classroom.from("class_quiz_attempts").select("id").eq("quiz_id", quizId).limit(1)),
      ]);
      return { quiz, questions, locked: attempts.length > 0 };
    },
  });
  function reset() {
    setId(null);
    setQuestion("");
    setChoices(["", "", "", ""]);
    setCorrect(-1);
    setExplanation("");
    setCategory("Umum");
    setTopic("");
  }
  async function save() {
    if (!question.trim() || choices.some((choice) => !choice.trim()) || correct < 0) return;
    setBusy(true);
    setMessage("");
    try {
      const payload = {
        quiz_id: quizId,
        question,
        choices,
        correct_index: correct,
        explanation: explanation || null,
        category,
        topic: topic || null,
        sort_order: id
          ? (q.data?.questions.find((x) => x.id === id)?.sort_order ?? 0)
          : (q.data?.questions.length ?? 0),
      };
      await result(
        id
          ? classroom
              .from("class_quiz_questions")
              .update(payload)
              .eq("id", id)
              .eq("quiz_id", quizId)
          : classroom.from("class_quiz_questions").insert(payload),
      );
      reset();
      await qc.invalidateQueries({ queryKey: ["teacher-quiz-editor", quizId] });
      setMessage("Soal tersimpan.");
    } catch (e: any) {
      setMessage(e.message);
    } finally {
      setBusy(false);
    }
  }
  async function publish() {
    setBusy(true);
    setMessage("");
    try {
      await result(
        classroom
          .from("class_quizzes")
          .update({ is_published: true })
          .eq("id", quizId)
          .eq("class_id", classId),
      );
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["teacher-quiz-editor", quizId] }),
        qc.invalidateQueries({ queryKey: ["guru-class-content", classId] }),
        qc.invalidateQueries({ queryKey: ["class-workspace", classId] }),
      ]);
      setMessage("Kuis terbit. Peserta dapat mengerjakan dan nilai akan tersimpan otomatis.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Kuis gagal diterbitkan.");
    } finally {
      setBusy(false);
    }
  }
  async function remove(row: any) {
    if (!window.confirm("Hapus soal ini?")) return;
    setBusy(true);
    setMessage("");
    try {
      await result(
        classroom.from("class_quiz_questions").delete().eq("id", row.id).eq("quiz_id", quizId),
      );
      reset();
      await qc.invalidateQueries({ queryKey: ["teacher-quiz-editor", quizId] });
    } catch (e: any) {
      setMessage(e.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <AppShell title="Soal Kuis" backTo={"/guru-kelas/" + classId + "/konten"}>
      <div className="mx-auto max-w-3xl space-y-4">
        {q.data && (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border bg-primary/5 p-4">
            <div>
              <h1 className="flex items-center gap-2 text-base font-bold">
                <FileQuestion className="size-4 text-primary" />
                {q.data.quiz.title}
              </h1>
              <p className="mt-1 text-xs text-muted-foreground">
                {q.data.questions.length} soal · {q.data.quiz.is_published ? "Terbit" : "Draft"} ·
                Nilai otomatis / 100
              </p>
            </div>
            {!q.data.quiz.is_published && (
              <Button
                disabled={busy || !q.data.questions.length || !!question.trim()}
                onClick={publish}
              >
                Terbitkan kuis
              </Button>
            )}
          </div>
        )}
        {q.isPending && <p>Memuat soal…</p>}
        {q.isError && <p role="alert">{q.error.message}</p>}
        {q.data?.locked && (
          <div className="flex items-start gap-3 rounded-2xl border border-amber-500/25 bg-amber-500/[0.08] p-4 text-sm">
            <LockKeyhole className="mt-0.5 size-5 shrink-0 text-amber-600" />
            <p>
              Kuis sudah dikerjakan peserta. Soal dan kunci dikunci agar nilai tetap akurat. Buat
              kuis baru untuk latihan berikutnya.
            </p>
          </div>
        )}
        {q.isSuccess && !q.data.locked && (
          <Card className="border-border/70 shadow-sm">
            <CardContent className="space-y-5 p-4 sm:p-5">
              <div className="flex items-start gap-3">
                <span className="grid size-10 shrink-0 place-items-center rounded-2xl bg-primary/10 text-primary">
                  {id ? <Pencil className="size-5" /> : <Plus className="size-5" />}
                </span>
                <div>
                  <h1 className="font-black">{id ? "Edit soal" : "Tambah soal"}</h1>
                  <p className="text-xs text-muted-foreground">
                    Peserta akan mendapat nilai otomatis setelah mengirim jawaban.
                  </p>
                </div>
              </div>
              <label className="block space-y-1.5 text-xs font-bold">
                <span className="flex items-center gap-1.5">
                  <CircleHelp className="size-4 text-primary" /> Pertanyaan
                </span>
                <Textarea
                  rows={4}
                  value={question}
                  onChange={(e) => setQuestion(e.target.value)}
                  placeholder="Contoh: Pilih kalimat yang paling tepat…"
                />
              </label>
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <p className="flex items-center gap-1.5 text-xs font-bold">
                    <CheckCircle2 className="size-4 text-primary" /> Pilihan jawaban
                  </p>
                  <span className="text-[10px] text-muted-foreground">Tandai jawaban benar</span>
                </div>
                <div className="grid gap-2">
                  {choices.map((value, index) => (
                    <label
                      key={index}
                      className={
                        "flex items-center gap-3 rounded-xl border p-2.5 transition " +
                        (correct === index
                          ? "border-primary bg-primary/[0.06]"
                          : "border-border/70")
                      }
                    >
                      <input
                        aria-label={"Kunci jawaban pilihan " + (index + 1)}
                        type="radio"
                        name="correct"
                        checked={correct === index}
                        onChange={() => setCorrect(index)}
                        className="size-4 accent-primary"
                      />
                      <span
                        className={
                          "grid size-7 shrink-0 place-items-center rounded-lg text-xs font-black " +
                          (correct === index
                            ? "bg-primary text-primary-foreground"
                            : "bg-muted text-muted-foreground")
                        }
                      >
                        {String.fromCharCode(65 + index)}
                      </span>
                      <Input
                        aria-label={"Pilihan " + (index + 1)}
                        value={value}
                        placeholder={"Tulis pilihan " + String.fromCharCode(65 + index)}
                        onChange={(e) =>
                          setChoices((current) =>
                            current.map((x, j) => (j === index ? e.target.value : x)),
                          )
                        }
                        className="border-0 bg-transparent shadow-none focus-visible:ring-0"
                      />
                    </label>
                  ))}
                </div>
              </div>
              <label className="block space-y-1.5 text-xs font-bold">
                <span className="flex items-center gap-1.5">
                  <Lightbulb className="size-4 text-primary" /> Pembahasan (opsional)
                </span>
                <Textarea
                  value={explanation}
                  onChange={(e) => setExplanation(e.target.value)}
                  placeholder="Jelaskan mengapa jawaban ini benar agar peserta bisa belajar dari hasilnya."
                />
              </label>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="space-y-1.5 text-xs font-bold">
                  <span>Kategori</span>
                  <select
                    className="h-10 w-full rounded border bg-background p-2"
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                  >
                    {categories.map((c) => (
                      <option key={c}>{c}</option>
                    ))}
                  </select>
                </label>
                <label className="space-y-1.5 text-xs font-bold">
                  <span>Topik untuk statistik</span>
                  <Input
                    value={topic}
                    onChange={(e) => setTopic(e.target.value)}
                    placeholder="Contoh: Bentuk て"
                  />
                </label>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  disabled={
                    busy || !question.trim() || correct < 0 || choices.some((x) => !x.trim())
                  }
                  onClick={save}
                >
                  <Save className="size-4" /> {busy ? "Menyimpan…" : "Simpan soal"}
                </Button>
                {id && (
                  <Button variant="outline" onClick={reset}>
                    Batal
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        )}
        {message && (
          <p role="status" className="text-sm">
            {message}
          </p>
        )}
        {q.data?.questions.map((row: any, index: number) => (
          <Card key={row.id} className="border-border/70 shadow-sm">
            <CardContent className="space-y-3 p-4">
              <div className="flex items-start gap-3">
                <span className="grid size-8 shrink-0 place-items-center rounded-xl bg-primary/10 text-sm font-black text-primary">
                  {index + 1}
                </span>
                <div className="min-w-0">
                  <h2 className="text-sm font-bold">{row.question}</h2>
                  <p className="mt-1 text-[10px] font-medium text-primary">
                    {row.category} · {row.topic || "Belum diberi topik"}
                  </p>
                </div>
              </div>
              <div className="grid gap-1.5">
                {row.choices.map((c: string, i: number) => (
                  <p
                    key={i}
                    className={
                      "rounded-lg border px-3 py-2 text-sm " +
                      (i === row.correct_index
                        ? "border-primary/30 bg-primary/[0.06] font-bold text-primary"
                        : "border-border/60 text-muted-foreground")
                    }
                  >
                    <span className="mr-2 font-black">{String.fromCharCode(65 + i)}.</span>
                    {c}
                  </p>
                ))}
              </div>
              {row.explanation && (
                <p className="rounded-lg bg-muted/50 p-3 text-xs text-muted-foreground">
                  Pembahasan: {row.explanation}
                </p>
              )}
              {!q.data.locked && (
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={busy}
                    onClick={() => {
                      setId(row.id);
                      setQuestion(row.question);
                      setChoices(row.choices);
                      setCorrect(row.correct_index);
                      setExplanation(row.explanation || "");
                      setCategory(row.category || "Umum");
                      setTopic(row.topic || "");
                    }}
                  >
                    <Pencil className="size-3.5" />
                    Edit
                  </Button>
                  <Button size="sm" variant="ghost" disabled={busy} onClick={() => remove(row)}>
                    <Trash2 className="size-3.5" />
                    Hapus
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </AppShell>
  );
}
