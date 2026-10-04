import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AppShell } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { getAuthUser } from "@/lib/auth-user";
import { classroom, result, openClassAttachment, errorMessage } from "@/lib/classroom";
import type { Tables } from "@/integrations/supabase/types";
export const Route = createFileRoute("/_authenticated/kelas/$classId/tugas/$assignmentId")({
  component: Page,
});
function Page() {
  const { classId, assignmentId } = Route.useParams();
  const qc = useQueryClient();
  const [notice, setNotice] = useState("");
  const q = useQuery({
    queryKey: ["student-assignment", classId, assignmentId],
    queryFn: async () => {
      const {
        data: { user },
      } = await getAuthUser();
      if (!user) throw new Error("Login diperlukan.");
      const [assignment, submission, grade] = await Promise.all([
        result(
          classroom
            .from("class_assignments")
            .select("*")
            .eq("class_id", classId)
            .eq("id", assignmentId)
            .eq("is_published", true)
            .single(),
        ),
        result(
          classroom
            .from("class_assignment_submissions")
            .select("*")
            .eq("assignment_id", assignmentId)
            .eq("user_id", user.id)
            .maybeSingle(),
        ),
        result(
          classroom
            .from("class_grades")
            .select("*")
            .eq("assignment_id", assignmentId)
            .eq("user_id", user.id)
            .maybeSingle(),
        ),
      ]);
      return { assignment, submission, grade, userId: user.id };
    },
  });
  return (
    <AppShell title="Tugas Kelas" backTo={"/kelas/" + classId + "/workspace"}>
      <div className="mx-auto max-w-2xl space-y-4">
        {q.isPending && <p>Memuat tugas…</p>}
        {q.isError && (
          <p role="alert" className="text-destructive">
            {q.error.message}
          </p>
        )}
        {notice && (
          <p role="status" className="rounded-xl bg-primary/10 p-3 text-sm">
            {notice}
          </p>
        )}
        {q.data && (
          <Editor
            key={assignmentId + ":" + (q.data.submission?.submitted_at || "new")}
            {...q.data}
            refresh={async () => {
              setNotice("Tugas berhasil dikumpulkan. Guru dapat melihat jawaban Anda.");
              await Promise.all([
                qc.invalidateQueries({ queryKey: ["student-assignment", classId, assignmentId] }),
                qc.invalidateQueries({ queryKey: ["class-workspace", classId] }),
              ]);
            }}
          />
        )}
      </div>
    </AppShell>
  );
}
function Editor({
  assignment: a,
  submission,
  grade,
  userId,
  refresh,
}: {
  assignment: Tables<"class_assignments">;
  submission: Tables<"class_assignment_submissions"> | null;
  grade: Tables<"class_grades"> | null;
  userId: string;
  refresh: () => Promise<unknown>;
}) {
  const [text, setText] = useState(submission?.answer_text || "");
  const [attachment, setAttachment] = useState(submission?.attachment_url || "");
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState("");
  const [loaded, setLoaded] = useState(false);
  const [draftAvailable, setDraftAvailable] = useState(true);
  const draftKey = "class-task:" + userId + ":" + a.id;
  const late = a.due_at && new Date(a.due_at).getTime() < Date.now();
  const locked = !!grade || (late && !a.allow_late);
  useEffect(() => {
    try {
      const draft = JSON.parse(localStorage.getItem(draftKey) || "null");
      if (draft && !grade) {
        setText(draft.text || "");
        setAttachment(draft.attachment || "");
      }
    } catch {
      setDraftAvailable(false);
    }
    setLoaded(true);
  }, [draftKey, grade]);
  useEffect(() => {
    if (loaded && !locked) {
      try {
        localStorage.setItem(draftKey, JSON.stringify({ text, attachment }));
      } catch {
        setDraftAvailable(false);
      }
    }
  }, [text, attachment, loaded, locked, draftKey]);
  async function upload(file?: File) {
    if (!file || locked) return;
    setUploading(true);
    setMessage("");
    try {
      const extensions: Record<string, string> = {
        "image/jpeg": "jpg",
        "image/png": "png",
        "image/webp": "webp",
        "application/pdf": "pdf",
        "audio/mpeg": "mp3",
        "audio/mp4": "m4a",
        "audio/wav": "wav",
        "audio/webm": "webm",
      };
      const ext = extensions[file.type];
      if (!ext || file.size > 10 * 1024 * 1024)
        throw new Error("Gunakan foto, PDF, atau audio yang didukung, maksimal 10 MB.");
      const path = a.class_id + "/" + userId + "/" + crypto.randomUUID() + "." + ext;
      await result(
        supabase.storage.from("class-submissions").upload(path, file, { upsert: false }),
      );
      setAttachment(path);
    } catch (e) {
      setMessage(errorMessage(e));
    } finally {
      setUploading(false);
    }
  }
  async function submit() {
    setBusy(true);
    setMessage("");
    try {
      await result(
        classroom.from("class_assignment_submissions").upsert(
          {
            assignment_id: a.id,
            user_id: userId,
            answer_text: text,
            attachment_url: attachment || null,
            status: "submitted",
          },
          { onConflict: "assignment_id,user_id" },
        ),
      );
      try {
        localStorage.removeItem(draftKey);
      } catch {
        setDraftAvailable(false);
      }
      await refresh();
    } catch (e) {
      setMessage(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }
  const valid =
    a.submission_type === "upload"
      ? !!attachment
      : a.submission_type === "text"
        ? !!text.trim()
        : !!(text.trim() || attachment);
  return (
    <>
      <Card>
        <CardContent className="space-y-2 p-4">
          <h1 className="font-black">{a.title}</h1>
          <p className="text-xs text-primary">
            {a.category}
            {a.topic ? " · " + a.topic : ""}
          </p>
          <p className="whitespace-pre-wrap text-sm">{a.description}</p>
          <p className="text-xs">Nilai maksimal: {a.max_score}</p>
          {a.due_at && (
            <p className="text-xs">
              Batas: {new Date(a.due_at).toLocaleString("id-ID")}
              {a.allow_late ? " · Terlambat diperbolehkan" : ""}
            </p>
          )}
          <p className="text-xs font-bold">
            {grade
              ? "Sudah dinilai"
              : submission
                ? "Sudah dikumpulkan — menunggu penilaian"
                : "Belum dikumpulkan"}
          </p>
        </CardContent>
      </Card>
      {a.submission_type !== "upload" && (
        <label className="block text-sm font-bold">
          Jawaban
          <textarea
            disabled={locked || busy}
            className="mt-1 min-h-48 w-full rounded-xl border bg-background p-3 text-sm font-normal"
            value={text}
            onChange={(e) => setText(e.target.value)}
          />
        </label>
      )}
      {a.submission_type !== "text" && (
        <div className="space-y-2">
          <label className="block text-sm font-bold">
            Lampiran (foto/PDF/audio, maksimal 10 MB)
            <input
              className="mt-2 block w-full text-xs"
              type="file"
              accept="image/jpeg,image/png,image/webp,application/pdf,audio/mpeg,audio/mp4,audio/wav,audio/webm"
              disabled={locked || uploading || busy}
              onChange={(e) => upload(e.target.files?.[0])}
            />
          </label>
          {uploading && <p className="text-xs">Mengunggah…</p>}
        </div>
      )}
      {attachment && (
        <Button
          variant="outline"
          size="sm"
          onClick={() => openClassAttachment(attachment).catch((e) => setMessage(e.message))}
        >
          Lihat Lampiran
        </Button>
      )}
      {!locked && (
        <>
          <p className="text-xs text-muted-foreground">
            {draftAvailable
              ? "Draft jawaban disimpan pada perangkat ini. Tekan Kumpulkan agar guru dapat menilainya."
              : "Penyimpanan draft perangkat tidak tersedia. Kumpulkan jawaban sebelum menutup halaman."}
          </p>
          <Button disabled={busy || uploading || !valid} onClick={submit}>
            {busy ? "Mengirim…" : submission ? "Perbarui Pengumpulan" : "Kumpulkan Tugas"}
          </Button>
        </>
      )}
      {locked && !grade && <p className="text-sm">Batas pengumpulan sudah berakhir.</p>}
      {grade && (
        <Card>
          <CardContent className="space-y-2 p-4">
            <h2 className="font-black">
              Nilai: {grade.score} / {a.max_score}
            </h2>
            <p className="whitespace-pre-wrap text-sm">
              {grade.feedback || "Belum ada komentar guru."}
            </p>
            {grade.weakness_note && <p className="text-sm">Perlu dilatih: {grade.weakness_note}</p>}
          </CardContent>
        </Card>
      )}
      {message && (
        <p role="status" className="text-sm">
          {message}
        </p>
      )}
    </>
  );
}
