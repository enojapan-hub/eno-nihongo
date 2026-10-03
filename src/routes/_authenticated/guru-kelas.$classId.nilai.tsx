import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AppShell } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import type { Database } from "@/integrations/supabase/types";
import { classroom, result, openClassAttachment, errorMessage } from "@/lib/classroom";
export const Route = createFileRoute("/_authenticated/guru-kelas/$classId/nilai")({
  component: Page,
});
function Page() {
  const { classId } = Route.useParams();
  const qc = useQueryClient();
  const [filter, setFilter] = useState("pending");
  const q = useQuery({
    queryKey: ["class-submissions", classId],
    queryFn: async () => {
      const [submissions, grades] = await Promise.all([
        result(classroom.rpc("get_teacher_class_submissions", { p_class_id: classId })),
        result(classroom.from("class_grades").select("*").eq("class_id", classId)),
      ]);
      return submissions.map((s) => ({
        ...s,
        weakness:
          grades.find((g) => g.assignment_id === s.assignment_id && g.user_id === s.user_id)
            ?.weakness_note || "",
      }));
    },
  });
  return (
    <AppShell title="Nilai Tugas" backTo={"/guru-kelas/" + classId}>
      <div className="mx-auto max-w-3xl space-y-3">
        <h1 className="text-xl font-black">Nilai & Koreksi Tugas</h1>
        <div className="flex gap-2">
          {[
            ["pending", "Perlu dinilai"],
            ["all", "Semua"],
          ].map(([id, label]) => (
            <Button
              key={id}
              size="sm"
              variant={filter === id ? "default" : "outline"}
              onClick={() => setFilter(id!)}
            >
              {label}
            </Button>
          ))}
        </div>
        {q.isPending && <p>Memuat jawaban…</p>}
        {q.isError && (
          <p role="alert" className="text-sm text-destructive">
            {q.error.message}
          </p>
        )}
        {(q.data ?? [])
          .filter((s) => filter === "all" || s.current_score == null)
          .map((s) => (
            <Grade
              key={s.id + ":" + s.current_score + ":" + s.weakness}
              s={s}
              done={async () => {
                await qc.invalidateQueries({ queryKey: ["class-submissions", classId] });
                await qc.invalidateQueries({ queryKey: ["teacher-workspace", classId] });
              }}
            />
          ))}
        {q.isSuccess &&
          !(q.data ?? []).some((s) => filter === "all" || s.current_score == null) && (
            <p className="rounded-xl bg-muted p-4 text-sm">Tidak ada tugas pada daftar ini.</p>
          )}
      </div>
    </AppShell>
  );
}
type GradeArgs = Database["public"]["Functions"]["teacher_grade_assignment"]["Args"];
type Submission =
  Database["public"]["Functions"]["get_teacher_class_submissions"]["Returns"][number] & {
    weakness: string;
  };
function Grade({ s, done }: { s: Submission; done: () => Promise<void> }) {
  const [score, setScore] = useState(s.current_score == null ? "" : String(s.current_score));
  const [feedback, setFeedback] = useState(s.current_feedback || "");
  const [weakness, setWeakness] = useState(s.weakness);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  async function save() {
    setBusy(true);
    setMessage("");
    try {
      if (
        score === "" ||
        !Number.isFinite(Number(score)) ||
        Number(score) < 0 ||
        Number(score) > Number(s.max_score ?? 100)
      )
        throw new Error("Isi nilai antara 0 dan " + (s.max_score ?? 100) + ".");
      // Fungsi database menerima NULL untuk umpan balik/kelemahan kosong; tipe generated menyebutnya string.
      const args = {
        p_submission_id: s.id,
        p_score: Number(score),
        p_feedback: feedback || null,
        p_weakness: weakness || null,
      } as unknown as GradeArgs;
      await result(classroom.rpc("teacher_grade_assignment", args));
      await done();
      setMessage("Nilai dan koreksi tersimpan.");
    } catch (e) {
      setMessage(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <Card>
      <CardContent className="space-y-3 p-4">
        <div>
          <h2 className="font-bold">{s.display_name}</h2>
          <p className="text-xs">
            {s.assignment_title} · {new Date(s.submitted_at).toLocaleString("id-ID")}
          </p>
        </div>
        <p className="whitespace-pre-wrap rounded-xl bg-muted p-3 text-sm">
          {s.answer_text || "Jawaban berupa lampiran."}
        </p>
        {s.attachment_url && (
          <Button
            size="sm"
            variant="outline"
            onClick={() =>
              openClassAttachment(s.attachment_url).catch((e) => setMessage(e.message))
            }
          >
            Buka Lampiran
          </Button>
        )}
        <label className="block text-xs font-bold">
          Nilai / {s.max_score ?? 100}
          <Input
            type="number"
            min="0"
            max={s.max_score ?? 100}
            value={score}
            onChange={(e) => setScore(e.target.value)}
          />
        </label>
        <label className="block text-xs font-bold">
          Koreksi dan pembahasan
          <Textarea value={feedback} onChange={(e) => setFeedback(e.target.value)} />
        </label>
        <label className="block text-xs font-bold">
          Bagian yang perlu dilatih
          <Textarea
            value={weakness}
            onChange={(e) => setWeakness(e.target.value)}
            placeholder="Contoh: masih tertukar partikel は dan が"
          />
        </label>
        <Button disabled={busy || score === ""} onClick={save}>
          {busy ? "Menyimpan…" : "Simpan Nilai"}
        </Button>
        {message && (
          <p role="status" className="text-sm">
            {message}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
