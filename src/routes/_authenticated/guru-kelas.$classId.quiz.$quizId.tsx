import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
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
  const [correct, setCorrect] = useState(0);
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
      await result(
        classroom
          .from("class_quizzes")
          .select("id")
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
      return { questions, locked: attempts.length > 0 };
    },
  });
  function reset() {
    setId(null);
    setQuestion("");
    setChoices(["", "", "", ""]);
    setCorrect(0);
    setExplanation("");
    setCategory("Umum");
    setTopic("");
  }
  async function save() {
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
          ? (q.data?.questions.find((x: any) => x.id === id)?.sort_order ?? 0)
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
        {q.isPending && <p>Memuat soal…</p>}
        {q.isError && <p role="alert">{q.error.message}</p>}
        {q.data?.locked && (
          <p className="rounded-xl bg-muted p-4 text-sm">
            Kuis sudah dikerjakan peserta. Soal dan kunci dikunci agar nilai tetap akurat. Buat kuis
            baru untuk latihan berikutnya.
          </p>
        )}
        {q.isSuccess && !q.data.locked && (
          <Card>
            <CardContent className="space-y-3 p-4">
              <h1 className="font-black">{id ? "Edit Soal" : "Tambah Soal"}</h1>
              <label className="block text-xs font-bold">
                Pertanyaan
                <Textarea value={question} onChange={(e) => setQuestion(e.target.value)} />
              </label>
              {choices.map((value, index) => (
                <label key={index} className="flex items-center gap-2">
                  <input
                    aria-label={"Kunci jawaban pilihan " + (index + 1)}
                    type="radio"
                    name="correct"
                    checked={correct === index}
                    onChange={() => setCorrect(index)}
                  />
                  <Input
                    aria-label={"Pilihan " + (index + 1)}
                    value={value}
                    onChange={(e) =>
                      setChoices((current) =>
                        current.map((x, j) => (j === index ? e.target.value : x)),
                      )
                    }
                  />
                </label>
              ))}
              <p className="text-xs text-muted-foreground">
                Pilih bulatan di samping jawaban yang benar.
              </p>
              <label className="block text-xs font-bold">
                Pembahasan
                <Textarea value={explanation} onChange={(e) => setExplanation(e.target.value)} />
              </label>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="text-xs font-bold">
                  Kategori
                  <select
                    className="mt-1 h-10 w-full rounded border bg-background p-2"
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                  >
                    {categories.map((c) => (
                      <option key={c}>{c}</option>
                    ))}
                  </select>
                </label>
                <label className="text-xs font-bold">
                  Topik
                  <Input
                    value={topic}
                    onChange={(e) => setTopic(e.target.value)}
                    placeholder="Contoh: Bentuk て"
                  />
                </label>
              </div>
              <div className="flex gap-2">
                <Button
                  disabled={busy || !question.trim() || choices.some((x) => !x.trim())}
                  onClick={save}
                >
                  {busy ? "Menyimpan…" : "Simpan Soal"}
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
          <Card key={row.id}>
            <CardContent className="space-y-2 p-4">
              <h2 className="text-sm font-bold">
                {index + 1}. {row.question}
              </h2>
              <p className="text-xs text-primary">
                {row.category} / {row.topic || "Belum diberi topik"}
              </p>
              {row.choices.map((c: string, i: number) => (
                <p
                  key={i}
                  className={"text-sm " + (i === row.correct_index ? "font-bold text-primary" : "")}
                >
                  {i + 1}. {c}
                </p>
              ))}
              {row.explanation && <p className="text-xs">{row.explanation}</p>}
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
                    Edit
                  </Button>
                  <Button size="sm" variant="ghost" disabled={busy} onClick={() => remove(row)}>
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
