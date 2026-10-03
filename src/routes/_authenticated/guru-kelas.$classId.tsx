import { useState, type ReactNode } from "react";
import { createFileRoute, Link, useNavigate, Outlet, useRouterState } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Archive,
  BarChart3,
  BookOpenText,
  ClipboardCheck,
  ClipboardList,
  GraduationCap,
  LayoutDashboard,
  Megaphone,
  Settings2,
  Sparkles,
  UsersRound,
  Video,
} from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import type { Database, Tables } from "@/integrations/supabase/types";
import { classroom, result, localDateTime, isoDate, errorMessage } from "@/lib/classroom";
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
      <div className="mx-auto max-w-4xl space-y-5">
        {q.isPending && <p>Memuat kelas…</p>}
        {q.isError && (
          <p role="alert" className="text-sm text-destructive">
            {q.error.message}
          </p>
        )}
        {d && (
          <>
            <header className="relative overflow-hidden rounded-3xl border border-primary/20 bg-gradient-to-br from-primary/[0.16] via-card to-card p-5 shadow-sm sm:p-6">
              <div className="absolute -right-8 -top-10 size-36 rounded-full bg-primary/10 blur-2xl" />
              <div className="relative flex items-start justify-between gap-4">
                <div className="space-y-2">
                  <div className="flex flex-wrap items-center gap-2 text-xs font-semibold text-primary">
                    <span className="rounded-full bg-primary/10 px-2.5 py-1">{d.kelas.level}</span>
                    <span className="rounded-full bg-background/75 px-2.5 py-1 capitalize">
                      {d.kelas.status}
                    </span>
                  </div>
                  <h1 className="text-2xl font-black tracking-tight sm:text-3xl">
                    {d.kelas.title}
                  </h1>
                  <p className="max-w-2xl text-sm text-muted-foreground">
                    Kelola perjalanan belajar peserta, publikasikan aktivitas, dan siapkan sesi
                    berikutnya.
                  </p>
                  {d.kelas.starts_at && (
                    <p className="text-xs text-muted-foreground">
                      Jadwal kelas: {new Date(d.kelas.starts_at).toLocaleString("id-ID")}
                      {d.kelas.ends_at
                        ? " – " + new Date(d.kelas.ends_at).toLocaleString("id-ID")
                        : ""}
                    </p>
                  )}
                </div>
                <span className="hidden size-12 shrink-0 place-items-center rounded-2xl bg-primary/10 text-primary sm:grid">
                  <GraduationCap className="size-6" />
                </span>
              </div>
            </header>
            <nav className="grid grid-cols-3 gap-2 sm:grid-cols-6" aria-label="Kelola kelas">
              {[
                { id: "ringkasan", label: "Ringkasan", icon: LayoutDashboard },
                { id: "peserta", label: "Peserta", icon: UsersRound },
                { id: "pengaturan", label: "Pengaturan", icon: Settings2 },
              ].map((item) => {
                const Icon = item.icon;
                const active = tab === item.id;
                return (
                  <button
                    type="button"
                    key={item.id}
                    aria-pressed={active}
                    onClick={() => setTab(item.id)}
                    className={
                      "flex min-h-[4.5rem] flex-col items-center justify-center gap-1.5 rounded-2xl border px-2 py-2 text-center text-[11px] font-semibold transition " +
                      (active
                        ? "border-primary bg-primary text-primary-foreground shadow-sm"
                        : "border-border/70 bg-card text-muted-foreground hover:border-primary/40 hover:bg-primary/[0.05] hover:text-foreground")
                    }
                  >
                    <Icon className={"size-[18px] " + (active ? "" : "text-primary")} />
                    {item.label}
                  </button>
                );
              })}
              <Button
                className="h-auto min-h-[4.5rem] flex-col gap-1.5 rounded-2xl px-2 text-[11px]"
                variant="outline"
                asChild
              >
                <Link to="/guru-kelas/$classId/konten" params={{ classId }}>
                  <BookOpenText className="size-[18px] text-primary" />
                  Konten & tugas
                </Link>
              </Button>
              <Button
                className="h-auto min-h-[4.5rem] flex-col gap-1.5 rounded-2xl px-2 text-[11px]"
                variant="outline"
                asChild
              >
                <Link to="/guru-kelas/$classId/nilai" params={{ classId }}>
                  <ClipboardCheck className="size-[18px] text-primary" />
                  Nilai tugas
                </Link>
              </Button>
              <Button
                type="button"
                className="h-auto min-h-[4.5rem] flex-col gap-1.5 rounded-2xl px-2 text-[11px]"
                variant={tab === "peserta" ? "default" : "outline"}
                onClick={() => setTab("peserta")}
              >
                <BarChart3 className="size-[18px]" />
                Statistik peserta
              </Button>
            </nav>
            {tab === "ringkasan" && (
              <>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {(
                    [
                      [
                        UsersRound,
                        "Peserta aktif",
                        d.participants.filter((p) => p.status === "active").length,
                        "bg-sky-500/10 text-sky-600",
                      ],
                      [
                        ClipboardList,
                        "Tugas terbit",
                        d.assignments.filter((a) => a.is_published).length,
                        "bg-violet-500/10 text-violet-600",
                      ],
                      [
                        ClipboardCheck,
                        "Perlu dinilai",
                        d.submissions.filter((s) => s.current_score == null).length,
                        "bg-amber-500/10 text-amber-600",
                      ],
                      [
                        BarChart3,
                        "Topik dianalisis",
                        d.insights.length,
                        "bg-primary/10 text-primary",
                      ],
                    ] as const
                  ).map(([Icon, label, value, tone]) => (
                    <Card key={label as string} className="border-border/70 shadow-sm">
                      <CardContent className="flex items-center gap-2.5 p-3">
                        <span
                          className={
                            "grid size-9 place-items-center rounded-xl " + (tone as string)
                          }
                        >
                          <Icon className="size-4" />
                        </span>
                        <div>
                          <p className="text-[10px] text-muted-foreground">{label as string}</p>
                          <strong className="text-xl">{value as number}</strong>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
                <Card className="overflow-hidden border-primary/20 bg-gradient-to-r from-primary/[0.08] to-card shadow-sm">
                  <CardContent className="p-5">
                    <div className="flex items-start gap-3">
                      <span className="grid size-10 shrink-0 place-items-center rounded-2xl bg-primary text-primary-foreground">
                        <Sparkles className="size-5" />
                      </span>
                      <div className="space-y-2">
                        <h2 className="font-black">Persiapan mengajar</h2>
                        <p className="text-xs text-muted-foreground">
                          Buka Peserta & Nilai untuk melihat tugas yang tertinggal, koreksi guru,
                          dan topik yang perlu diulang. Kuis hanya dapat dikumpulkan satu kali oleh
                          setiap peserta.
                        </p>
                        <div className="flex flex-wrap gap-2">
                          <Button size="sm" onClick={() => setTab("peserta")}>
                            <BarChart3 className="size-4" /> Lihat perkembangan peserta
                          </Button>
                          <Button size="sm" variant="outline" asChild>
                            <Link
                              to="/guru-kelas/$classId/konten"
                              params={{ classId }}
                              search={{ tab: "pengumuman" }}
                            >
                              <Megaphone className="size-4" /> Buat pengumuman
                            </Link>
                          </Button>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </>
            )}
            {tab === "peserta" && (
              <div className="space-y-3">
                {d.participants.length === 0 && (
                  <div className="flex items-center gap-3 rounded-2xl border border-dashed bg-muted/40 p-5 text-sm text-muted-foreground">
                    <UsersRound className="size-5 text-primary" /> Belum ada peserta.
                  </div>
                )}
                {d.participants.map((p) => {
                  const submitted = d.submissions.filter((s) => s.user_id === p.user_id);
                  const published = d.assignments.filter((a) => a.is_published);
                  const missing = published.filter(
                    (a) => !submitted.some((s) => s.assignment_id === a.id),
                  );
                  const scored = submitted.filter((s) => s.current_score != null);
                  const average = scored.length
                    ? Math.round(
                        scored.reduce(
                          (n: number, s) =>
                            n + (Number(s.current_score) / Number(s.max_score || 100)) * 100,
                          0,
                        ) / scored.length,
                      )
                    : null;
                  const topics = d.insights.filter((i) => i.user_id === p.user_id);
                  const attempts = d.attempts.filter((a) => a.user_id === p.user_id);
                  const quizAverage = attempts.length
                    ? Math.round(
                        attempts.reduce((n: number, a) => n + Number(a.score), 0) / attempts.length,
                      )
                    : null;
                  const needsAttention =
                    missing.length > 0 ||
                    (average != null && average < 70) ||
                    (quizAverage != null && quizAverage < 70);
                  return (
                    <details
                      key={p.user_id}
                      className="group rounded-2xl border border-border/70 bg-card p-4 shadow-sm"
                    >
                      <summary className="cursor-pointer list-none">
                        <div className="flex items-start gap-3">
                          <span className="grid size-10 shrink-0 place-items-center rounded-2xl bg-primary/10 text-primary">
                            <UsersRound className="size-5" />
                          </span>
                          <div className="min-w-0 flex-1">
                            <strong className="text-sm">{p.display_name}</strong>
                            <div className="mt-2 flex flex-wrap gap-2 text-[10px] font-semibold">
                              <span className="rounded-full bg-primary/10 px-2 py-1 text-primary">
                                {p.status}
                              </span>
                              <span className="rounded-full bg-muted px-2 py-1">
                                {missing.length} belum dikumpulkan
                              </span>
                              {needsAttention && (
                                <span className="rounded-full bg-amber-500/10 px-2 py-1 text-amber-700">
                                  Perlu perhatian
                                </span>
                              )}
                            </div>
                          </div>
                          <span className="rounded-full bg-muted px-2 py-1 text-xs font-bold">
                            {average == null ? "—" : average}
                          </span>
                        </div>
                        <p className="mt-1 text-xs text-muted-foreground">
                          Rata-rata tugas {average == null ? "belum dinilai" : average + "/100"}
                        </p>
                      </summary>
                      <div className="mt-4 space-y-4 border-t pt-4 text-xs">
                        <h3 className="flex items-center gap-2 font-bold">
                          <ClipboardCheck className="size-4 text-primary" /> Nilai tugas dan koreksi
                        </h3>
                        {submitted.map((s) => {
                          const grade = d.grades.find(
                            (g) => g.assignment_id === s.assignment_id && g.user_id === p.user_id,
                          );
                          return (
                            <div key={s.id} className="rounded-xl border bg-muted/40 p-3">
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
                          <p>Belum dikumpulkan: {missing.map((a) => a.title).join(", ")}</p>
                        )}
                        <h3 className="flex items-center gap-2 font-bold">
                          <BarChart3 className="size-4 text-primary" /> Kemampuan per topik
                        </h3>
                        {topics.length === 0 ? (
                          <p className="text-muted-foreground">
                            Belum ada jawaban kuis untuk dianalisis.
                          </p>
                        ) : (
                          topics.map((i) => (
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
                        <h3 className="flex items-center gap-2 font-bold">
                          <ClipboardList className="size-4 text-primary" /> Riwayat kuis
                        </h3>
                        {attempts.length === 0 ? (
                          <p className="text-muted-foreground">Belum ada kuis yang dikumpulkan.</p>
                        ) : (
                          attempts.map((a) => <TeacherQuizAttempt key={a.attempt_id} attempt={a} />)
                        )}
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
type QuizAttemptRow =
  Database["public"]["Functions"]["get_teacher_class_quiz_attempts"]["Returns"][number];
type QuizReviewRow = Omit<
  Database["public"]["Functions"]["get_class_quiz_review"]["Returns"][number],
  "choices"
> & { choices: string[] | null };
function TeacherQuizAttempt({ attempt }: { attempt: QuizAttemptRow }) {
  const review = useQuery({
    queryKey: ["teacher-quiz-review", attempt.attempt_id],
    queryFn: () =>
      result<QuizReviewRow[]>(
        classroom.rpc("get_class_quiz_review", { p_attempt_id: attempt.attempt_id }),
      ),
    staleTime: Infinity,
  });
  const wrong = review.data?.filter((row) => !row.is_correct) ?? [];
  return (
    <details className="rounded-xl border bg-muted/30 p-3">
      <summary className="cursor-pointer list-none">
        <div className="flex items-center justify-between gap-3">
          <div>
            <b>{attempt.quiz_title}</b>
            <p className="text-[10px] text-muted-foreground">
              {new Date(attempt.submitted_at).toLocaleString("id-ID")} · satu kali pengerjaan
            </p>
          </div>
          <span className="shrink-0 rounded-full bg-primary/10 px-2.5 py-1 font-black text-primary">
            {attempt.score}/100
          </span>
        </div>
        <p className="mt-1 text-[11px]">
          {attempt.correct_count}/{attempt.total_questions} benar
          {review.data ? ` · ${wrong.length} salah` : ""}
        </p>
      </summary>
      <div className="mt-3 space-y-2 border-t pt-3">
        {review.isPending && <p className="text-muted-foreground">Memuat detail jawaban…</p>}
        {review.isError && <p className="text-destructive">Detail jawaban gagal dimuat.</p>}
        {review.data?.map((row, index: number) => {
          const selected = Number(row.selected_index);
          const correct = Number(row.correct_index);
          return (
            <div
              key={row.question_id}
              className={
                "rounded-lg border p-2.5 " +
                (row.is_correct
                  ? "border-primary/20"
                  : "border-destructive/25 bg-destructive/[0.04]")
              }
            >
              <p className="font-bold">
                {index + 1}. {row.question}
              </p>
              <p className={row.is_correct ? "text-primary" : "text-destructive"}>
                {row.is_correct ? "Benar" : "Salah"} · Jawaban peserta:{" "}
                {selected >= 0 ? (row.choices?.[selected] ?? "Tidak valid") : "Tidak dijawab"}
              </p>
              {!row.is_correct && <p>Jawaban benar: {row.choices?.[correct] ?? "—"}</p>}
            </div>
          );
        })}
      </div>
    </details>
  );
}
function Settings({
  kelas,
  meeting,
  refresh,
  leave,
}: {
  kelas: Tables<"classes">;
  meeting: Tables<"class_meetings"> | null;
  refresh: () => Promise<unknown>;
  leave: () => Promise<unknown>;
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
    } catch (e) {
      setMessage(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <Card className="border-border/70 shadow-sm">
      <CardContent className="space-y-4 p-4">
        <div className="flex items-start gap-3">
          <span className="grid size-10 place-items-center rounded-2xl bg-primary/10 text-primary">
            <Settings2 className="size-5" />
          </span>
          <div>
            <h2 className="font-black">Informasi kelas</h2>
            <p className="text-xs text-muted-foreground">
              Perbarui detail yang terlihat peserta dan akses kelas live.
            </p>
          </div>
        </div>
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
        <h2 className="flex items-center gap-2 border-t pt-4 font-black">
          <Video className="size-4 text-primary" /> Google Meet / Zoom
        </h2>
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
              <Archive className="size-4" />
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
function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block space-y-1">
      <span className="text-xs font-bold">{label}</span>
      {children}
    </label>
  );
}
