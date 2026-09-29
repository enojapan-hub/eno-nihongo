import { useState } from "react";
import { createFileRoute, Link, useNavigate, Outlet, useRouterState } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AppShell } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { classroom, result, localDateTime, isoDate } from "@/lib/classroom";
export const Route = createFileRoute("/_authenticated/guru-kelas/$classId")({
  component: TeacherClassRoute,
});
function TeacherClassRoute() {
  const { classId } = Route.useParams();
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  return pathname.replace(/\/$/, "") === `/guru-kelas/${classId}` ? <Page /> : <Outlet />;
}
function Page() {
  const { classId } = Route.useParams();
  const qc = useQueryClient();
  const nav = useNavigate();
  const [tab, setTab] = useState("ringkasan");
  const q = useQuery({
    queryKey: ["teacher-workspace", classId],
    queryFn: async () => {
      if (!(await result(classroom.rpc("can_manage_class", { p_class_id: classId }))))
        throw new Error("Anda tidak memiliki akses mengelola kelas ini.");
      const [kelas, meeting, participants, assignments, submissions, grades, insights, attempts] =
        await Promise.all([
          result(classroom.from("classes").select("*").eq("id", classId).single()),
          result(
            classroom.from("class_meetings").select("*").eq("class_id", classId).maybeSingle(),
          ),
          result(classroom.rpc("get_teacher_class_participants", { p_class_id: classId })),
          result(classroom.from("class_assignments").select("*").eq("class_id", classId)),
          result(classroom.rpc("get_teacher_class_submissions", { p_class_id: classId })),
          result(classroom.from("class_grades").select("*").eq("class_id", classId)),
          result(classroom.rpc("get_teacher_class_topic_insights", { p_class_id: classId })),
          result(classroom.rpc("get_teacher_class_quiz_attempts", { p_class_id: classId })),
        ]);
      return { kelas, meeting, participants, assignments, submissions, grades, insights, attempts };
    },
  });
  const d = q.data;
  const refresh = () => qc.invalidateQueries({ queryKey: ["teacher-workspace", classId] });
  return (
    <AppShell title="Kelola Kelas" backTo="/guru">
      <div className="mx-auto max-w-3xl space-y-4">
        {q.isPending && <p>Memuat kelas…</p>}
        {q.isError && (
          <p role="alert" className="text-sm text-destructive">
            {q.error.message}
          </p>
        )}
        {d && (
          <>
            <div>
              <p className="text-xs text-primary">
                {d.kelas.level} · {d.kelas.status}
              </p>
              <h1 className="text-xl font-black">{d.kelas.title}</h1>
            </div>
            <nav className="flex flex-wrap gap-2" aria-label="Kelola kelas">
              {[
                ["ringkasan", "Ringkasan"],
                ["peserta", "Peserta & Nilai"],
                ["pengaturan", "Pengaturan Kelas"],
              ].map(([id, label]) => (
                <Button
                  key={id}
                  size="sm"
                  variant={tab === id ? "default" : "outline"}
                  onClick={() => setTab(id!)}
                >
                  {label}
                </Button>
              ))}
              <Button size="sm" variant="outline" asChild>
                <Link to="/guru-kelas/$classId/konten" params={{ classId }}>
                  Materi, Tugas & Jadwal
                </Link>
              </Button>
              <Button size="sm" variant="outline" asChild>
                <Link to="/guru-kelas/$classId/nilai" params={{ classId }}>
                  Nilai Tugas
                </Link>
              </Button>
              <Button size="sm" variant="outline" asChild>
                <Link to="/kelas/$classId/workspace" params={{ classId }}>
                  Pratinjau Konten Terbit
                </Link>
              </Button>
            </nav>
            {tab === "ringkasan" && (
              <>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    [
                      "Peserta aktif",
                      d.participants.filter((p: any) => p.status === "active").length,
                    ],
                    ["Tugas terbit", d.assignments.filter((a: any) => a.is_published).length],
                    [
                      "Perlu dinilai",
                      d.submissions.filter((s: any) => s.current_score == null).length,
                    ],
                  ].map(([label, value]) => (
                    <Card key={label}>
                      <CardContent className="p-3">
                        <p className="text-[10px] text-muted-foreground">{label}</p>
                        <strong className="text-xl">{value}</strong>
                      </CardContent>
                    </Card>
                  ))}
                </div>
                <Card>
                  <CardContent className="space-y-2 p-4">
                    <h2 className="font-bold">Persiapan mengajar</h2>
                    <p className="text-xs text-muted-foreground">
                      Buka Peserta & Nilai untuk melihat tugas yang tertinggal, koreksi guru, dan
                      topik yang perlu diulang. Statistik kuis menggunakan percobaan terbaru setiap
                      kuis.
                    </p>
                    <Button size="sm" onClick={() => setTab("peserta")}>
                      Lihat perkembangan peserta
                    </Button>
                  </CardContent>
                </Card>
              </>
            )}
            {tab === "peserta" && (
              <div className="space-y-3">
                {d.participants.length === 0 && (
                  <p className="rounded-xl bg-muted p-4 text-sm">Belum ada peserta.</p>
                )}
                {d.participants.map((p: any) => {
                  const submitted = d.submissions.filter((s: any) => s.user_id === p.user_id);
                  const published = d.assignments.filter((a: any) => a.is_published);
                  const missing = published.filter(
                    (a: any) => !submitted.some((s: any) => s.assignment_id === a.id),
                  );
                  const scored = submitted.filter((s: any) => s.current_score != null);
                  const average = scored.length
                    ? Math.round(
                        scored.reduce(
                          (n: number, s: any) =>
                            n + (Number(s.current_score) / Number(s.max_score || 100)) * 100,
                          0,
                        ) / scored.length,
                      )
                    : null;
                  const topics = d.insights.filter((i: any) => i.user_id === p.user_id);
                  const attempts = d.attempts.filter((a: any) => a.user_id === p.user_id);
                  return (
                    <details key={p.user_id} className="rounded-xl border p-4">
                      <summary className="cursor-pointer">
                        <strong className="text-sm">{p.display_name}</strong>
                        <p className="mt-1 text-xs text-muted-foreground">
                          Rata-rata tugas: {average == null ? "Belum dinilai" : average + "/100"} ·{" "}
                          {missing.length} belum dikumpulkan · {p.status}
                        </p>
                      </summary>
                      <div className="mt-4 space-y-3 text-xs">
                        <h3 className="font-bold">Nilai tugas dan koreksi</h3>
                        {submitted.map((s: any) => {
                          const grade = d.grades.find(
                            (g: any) =>
                              g.assignment_id === s.assignment_id && g.user_id === p.user_id,
                          );
                          return (
                            <div key={s.id} className="rounded-lg bg-muted p-3">
                              <b>{s.assignment_title}</b>
                              <p>
                                {s.current_score == null
                                  ? "Menunggu penilaian"
                                  : s.current_score + " / " + s.max_score}
                              </p>
                              {s.current_feedback && <p>Koreksi: {s.current_feedback}</p>}
                              {grade?.weakness_note && <p>Perlu dilatih: {grade.weakness_note}</p>}
                            </div>
                          );
                        })}
                        {missing.length > 0 && (
                          <p>Belum dikumpulkan: {missing.map((a: any) => a.title).join(", ")}</p>
                        )}
                        <h3 className="font-bold">Kemampuan per topik</h3>
                        {topics.length === 0 ? (
                          <p className="text-muted-foreground">
                            Belum ada jawaban kuis untuk dianalisis.
                          </p>
                        ) : (
                          topics.map((i: any) => (
                            <div key={i.category + ":" + i.topic} className="space-y-1">
                              <p>
                                {i.category} / {i.topic}: {Number(i.accuracy)}% ({i.correct_count}/
                                {i.total_questions} benar)
                                {Number(i.accuracy) < 70 ? " · Perlu pengulangan" : ""}
                              </p>
                              <progress
                                className="h-2 w-full accent-green-600"
                                max="100"
                                value={Number(i.accuracy)}
                              />
                            </div>
                          ))
                        )}
                        {topics.length > 0 && (
                          <p className="text-muted-foreground">
                            Berdasarkan soal yang sudah dikerjakan; jumlah soal kecil belum cukup
                            untuk menyimpulkan kemampuan keseluruhan.
                          </p>
                        )}
                        <h3 className="font-bold">Riwayat kuis</h3>
                        {attempts.map((a: any) => (
                          <p key={a.attempt_id}>
                            {a.quiz_title} · {a.score}/100 ·{" "}
                            {new Date(a.submitted_at).toLocaleString("id-ID")}
                          </p>
                        ))}
                      </div>
                    </details>
                  );
                })}
              </div>
            )}
            {tab === "pengaturan" && (
              <Settings
                key={d.kelas.updated_at}
                kelas={d.kelas}
                meeting={d.meeting}
                refresh={refresh}
                leave={() => nav({ to: "/guru" })}
              />
            )}
          </>
        )}
      </div>
    </AppShell>
  );
}
function Settings({
  kelas,
  meeting,
  refresh,
  leave,
}: {
  kelas: any;
  meeting: any;
  refresh: () => Promise<any>;
  leave: () => Promise<any>;
}) {
  const [f, setF] = useState({
    title: kelas.title,
    description: kelas.description || "",
    level: kelas.level,
    capacity: String(kelas.capacity || 20),
    price: String(kelas.price || 0),
    meeting_url: meeting?.meeting_url || "",
    meeting_id: meeting?.meeting_id || "",
    passcode: meeting?.passcode || "",
    reveal_from: localDateTime(meeting?.reveal_from),
    reveal_until: localDateTime(meeting?.reveal_until),
  });
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const set = (k: string, v: string) => setF((x) => ({ ...x, [k]: v }));
  async function run(action: string) {
    if (
      action === "delete" &&
      !window.confirm(
        "Hapus draft kelas ini beserta kontennya? Tindakan ini tidak dapat dibatalkan.",
      )
    )
      return;
    if (
      action === "archive" &&
      !window.confirm("Arsipkan kelas? Pendaftaran ditutup dan riwayat peserta tetap tersimpan.")
    )
      return;
    setBusy(true);
    setMessage("");
    try {
      await result(
        classroom.rpc("teacher_manage_class", {
          p_class_id: kelas.id,
          p_action: action,
          p_data: {
            ...f,
            reveal_from: isoDate(f.reveal_from),
            reveal_until: isoDate(f.reveal_until),
          },
        }),
      );
      if (action === "delete") {
        await leave();
        return;
      }
      await refresh();
      setMessage("Perubahan tersimpan.");
    } catch (e: any) {
      setMessage(e.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Card>
      <CardContent className="space-y-4 p-4">
        <h2 className="font-black">Informasi Kelas</h2>
        <Field label="Nama kelas">
          <Input value={f.title} onChange={(e) => set("title", e.target.value)} />
        </Field>
        <Field label="Deskripsi">
          <Textarea value={f.description} onChange={(e) => set("description", e.target.value)} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Level">
            <select
              className="h-10 w-full rounded border bg-background p-2"
              value={f.level}
              onChange={(e) => set("level", e.target.value)}
            >
              {["N5", "N4", "N3", "N2", "N1"].map((l) => (
                <option key={l}>{l}</option>
              ))}
            </select>
          </Field>
          <Field label="Kapasitas">
            <Input
              type="number"
              min="1"
              value={f.capacity}
              onChange={(e) => set("capacity", e.target.value)}
            />
          </Field>
        </div>
        <Field label={"Harga (" + kelas.currency + ")"}>
          <Input
            type="number"
            min="0"
            value={f.price}
            onChange={(e) => set("price", e.target.value)}
          />
        </Field>
        <h2 className="font-black">Google Meet / Zoom</h2>
        <p className="text-xs text-muted-foreground">
          Akses umum kelas. Jadwal sesi dapat memakai link dan kode tersendiri.
        </p>
        <Field label="Link HTTPS">
          <Input
            type="url"
            value={f.meeting_url}
            onChange={(e) => set("meeting_url", e.target.value)}
            placeholder="https://meet.google.com/... atau https://...zoom.us/..."
          />
        </Field>
        <Field label="Meeting ID / Kode room">
          <Input value={f.meeting_id} onChange={(e) => set("meeting_id", e.target.value)} />
        </Field>
        <Field label="Passcode">
          <Input
            type="password"
            autoComplete="new-password"
            value={f.passcode}
            onChange={(e) => set("passcode", e.target.value)}
          />
        </Field>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Akses dibuka (opsional, waktu lokal)">
            <Input
              type="datetime-local"
              value={f.reveal_from}
              onChange={(e) => set("reveal_from", e.target.value)}
            />
          </Field>
          <Field label="Akses ditutup (opsional, waktu lokal)">
            <Input
              type="datetime-local"
              value={f.reveal_until}
              onChange={(e) => set("reveal_until", e.target.value)}
            />
          </Field>
        </div>
        <Button disabled={busy || !f.title.trim()} onClick={() => run("save")}>
          {busy ? "Menyimpan…" : "Simpan Perubahan"}
        </Button>
        <div className="flex flex-wrap gap-2 border-t pt-4">
          {["draft", "rejected"].includes(kelas.status) && (
            <Button disabled={busy} variant="outline" onClick={() => run("review")}>
              Ajukan ke Admin
            </Button>
          )}
          {kelas.status !== "closed" && (
            <Button disabled={busy} variant="outline" onClick={() => run("archive")}>
              Arsipkan Kelas
            </Button>
          )}
          {kelas.status === "draft" && (
            <Button disabled={busy} variant="destructive" onClick={() => run("delete")}>
              Hapus Draft
            </Button>
          )}
        </div>
        <p className="text-xs text-muted-foreground">
          Kelas yang memiliki peserta atau hasil belajar hanya dapat diarsipkan.
        </p>
        {message && (
          <p role="status" className="text-sm">
            {message}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
function Field({ label, children }: { label: string; children: any }) {
  return (
    <label className="block space-y-1">
      <span className="text-xs font-bold">{label}</span>
      {children}
    </label>
  );
}
