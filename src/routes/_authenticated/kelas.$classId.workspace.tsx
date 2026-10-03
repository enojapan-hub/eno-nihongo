import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  Award,
  BookOpenText,
  CalendarDays,
  ClipboardList,
  Clock3,
  GraduationCap,
  LayoutDashboard,
  ListChecks,
  Megaphone,
  PlayCircle,
  Sparkles,
  Video,
} from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { classroom, result, secureUrl, sessionTime } from "@/lib/classroom";
export const Route = createFileRoute("/_authenticated/kelas/$classId/workspace")({
  validateSearch: (search: Record<string, unknown>): { preview?: "guru" } =>
    search["preview"] === "guru" ? { preview: "guru" } : {},
  component: Page,
});
function Page() {
  const { classId } = Route.useParams();
  const { preview } = Route.useSearch();
  const teacherPreview = preview === "guru";
  const [tab, setTab] = useState("beranda");
  const [taskFilter, setTaskFilter] = useState("semua");
  const q = useQuery({
    queryKey: ["class-workspace", classId],
    queryFn: async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Login diperlukan.");
      const canManage = await result(classroom.rpc("can_manage_class", { p_class_id: classId }));
      if (
        teacherPreview
          ? !canManage
          : !(await result(classroom.rpc("is_class_member", { p_class_id: classId })))
      )
        throw new Error(
          teacherPreview ? "Akses guru diperlukan." : "Anda belum terdaftar di kelas ini.",
        );
      const [
        materials,
        assignments,
        quizzes,
        schedule,
        announcements,
        grades,
        meeting,
        myClasses,
        managedClass,
        classEnds,
      ] = await Promise.all([
        result(
          classroom
            .from("class_materials")
            .select("*")
            .eq("class_id", classId)
            .eq("is_published", true)
            .order("sort_order"),
        ),
        result(
          classroom
            .from("class_assignments")
            .select("*")
            .eq("class_id", classId)
            .eq("is_published", true)
            .order("due_at"),
        ),
        result(
          classroom
            .from("class_quizzes")
            .select("*")
            .eq("class_id", classId)
            .eq("is_published", true)
            .order("due_at"),
        ),
        result(
          classroom.from("class_schedule").select("*").eq("class_id", classId).order("starts_at"),
        ),
        result(
          classroom
            .from("class_announcements")
            .select("*")
            .eq("class_id", classId)
            .eq("is_published", true)
            .order("created_at", { ascending: false }),
        ),
        result(
          classroom.from("class_grades").select("*").eq("class_id", classId).eq("user_id", user.id),
        ),
        result(classroom.from("class_meetings").select("*").eq("class_id", classId).maybeSingle()),
        teacherPreview ? Promise.resolve([]) : result(classroom.rpc("get_my_classes")),
        teacherPreview
          ? result(classroom.from("classes").select("*").eq("id", classId).single())
          : Promise.resolve(null),
        teacherPreview
          ? Promise.resolve(null)
          : result(classroom.from("classes").select("ends_at").eq("id", classId).maybeSingle()),
      ]);
      const submissions = teacherPreview
        ? []
        : assignments.length
          ? await result(
              classroom
                .from("class_assignment_submissions")
                .select("assignment_id,submitted_at")
                .eq("user_id", user.id)
                .in(
                  "assignment_id",
                  assignments.map((a: any) => a.id),
                ),
            )
          : [];
      const [attempts, topics] = await Promise.all([
        !teacherPreview && quizzes.length
          ? result(
              classroom
                .from("class_quiz_attempts")
                .select("id,quiz_id,score,submitted_at")
                .eq("user_id", user.id)
                .in(
                  "quiz_id",
                  quizzes.map((q: any) => q.id),
                )
                .order("submitted_at", { ascending: false }),
            )
          : Promise.resolve([]),
        teacherPreview
          ? Promise.resolve([])
          : result(classroom.rpc("get_my_class_topic_insights", { p_class_id: classId })),
      ]);
      return {
        // get_my_classes tidak mengembalikan ends_at, jadi diambil terpisah dari tabel classes.
        kelas: teacherPreview
          ? managedClass
          : (() => {
              const mine = myClasses.find((c) => c.id === classId);
              return mine ? { ...mine, ends_at: classEnds?.ends_at ?? null } : null;
            })(),
        attempts,
        topics,
        materials,
        assignments,
        quizzes,
        schedule,
        announcements,
        grades,
        meeting,
        submissions,
      };
    },
    refetchInterval: 60_000,
  });
  const d = q.data;
  const next = d?.schedule.find(
    (s: any) => new Date(s.ends_at || s.starts_at).getTime() > Date.now(),
  );
  const completedAssignments = d?.submissions.length ?? 0;
  const completedQuizzes = d?.attempts.length ?? 0;
  const totalActivities = (d?.assignments.length ?? 0) + (d?.quizzes.length ?? 0);
  // Materi belum memiliki tabel/status "sudah dibaca", jadi tidak dipalsukan sebagai progres selesai.
  const progressPercent = totalActivities
    ? Math.round(((completedAssignments + completedQuizzes) / totalActivities) * 100)
    : 0;
  const outstanding = d?.assignments.filter(
    (a: any) => !d.submissions.some((s: any) => s.assignment_id === a.id),
  );
  const pendingQuizzes =
    d?.quizzes.filter((k: any) => !d.attempts.some((a: any) => a.quiz_id === k.id)) ?? [];
  const nextAction = [
    ...(outstanding ?? []).map((a: any) => ({
      type: "tugas",
      id: a.id,
      title: a.title,
      due_at: a.due_at,
    })),
    ...pendingQuizzes.map((k: any) => ({
      type: "kuis",
      id: k.id,
      title: k.title,
      due_at: k.due_at,
    })),
  ].sort(
    (a: any, b: any) =>
      (a.due_at ? new Date(a.due_at).getTime() : Infinity) -
      (b.due_at ? new Date(b.due_at).getTime() : Infinity),
  )[0];
  const deadlineLabel = (value?: string | null) => {
    if (!value) return "Tanpa tenggat";
    const due = new Date(value);
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const target = new Date(due.getFullYear(), due.getMonth(), due.getDate()).getTime();
    const days = Math.round((target - start) / 86400000);
    if (due.getTime() < now.getTime()) return "Terlambat";
    if (days === 0) return "Hari ini";
    if (days === 1) return "Besok";
    return sessionTime(value);
  };
  const taskStatus = (a: any) =>
    d?.grades.some((g: any) => g.assignment_id === a.id)
      ? "dinilai"
      : d?.submissions.some((s: any) => s.assignment_id === a.id)
        ? "menunggu"
        : a.due_at && new Date(a.due_at).getTime() < Date.now() && !a.allow_late
          ? "lewat"
          : "belum";
  const statusLabel: Record<string, string> = {
    dinilai: "Sudah dinilai",
    menunggu: "Menunggu penilaian",
    lewat: "Batas waktu berakhir",
    belum: "Belum dikumpulkan",
  };
  const workspaceTabs = [
    { id: "beranda", label: "Beranda", icon: LayoutDashboard },
    { id: "materi", label: "Materi", icon: BookOpenText },
    { id: "tugas", label: "Tugas & Kuis", icon: ClipboardList },
    { id: "jadwal", label: "Jadwal", icon: CalendarDays },
    { id: "pengumuman", label: "Pengumuman", icon: Megaphone },
    { id: "nilai", label: "Nilai", icon: Award },
  ] as const;
  const task = (a: any) => (
    <Card key={a.id} className="overflow-hidden border-border/70 shadow-sm">
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          <span className="grid size-10 shrink-0 place-items-center rounded-2xl bg-primary/10 text-primary">
            <ClipboardList className="size-5" />
          </span>
          <div className="min-w-0 flex-1 space-y-1">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="font-bold leading-tight">{a.title}</h2>
              <span className="rounded-full bg-muted px-2 py-1 text-[10px] font-semibold">
                {statusLabel[taskStatus(a)]}
              </span>
            </div>
            <p className="text-xs font-medium text-primary">
              {a.category}
              {a.topic ? " · " + a.topic : ""}
            </p>
            {a.description && (
              <p className="whitespace-pre-wrap text-sm text-muted-foreground">{a.description}</p>
            )}
            {a.due_at && (
              <p
                className={
                  "flex items-center gap-1 text-xs " +
                  (deadlineLabel(a.due_at) === "Terlambat"
                    ? "font-bold text-destructive"
                    : "text-muted-foreground")
                }
              >
                <Clock3 className="size-3.5" /> Batas {deadlineLabel(a.due_at)}
              </p>
            )}
          </div>
        </div>
        {teacherPreview ? (
          <Button className="mt-4 w-full sm:w-auto" size="sm" disabled>
            Pratinjau · pengumpulan dinonaktifkan
          </Button>
        ) : (
          <Button className="mt-4 w-full sm:w-auto" size="sm" asChild>
            <Link to="/kelas/$classId/tugas/$assignmentId" params={{ classId, assignmentId: a.id }}>
              Buka Tugas
            </Link>
          </Button>
        )}
      </CardContent>
    </Card>
  );
  const notice = (a: any) => (
    <Card key={a.id} className="border-amber-500/20 bg-amber-500/[0.06] shadow-sm">
      <CardContent className="flex gap-3 p-4">
        <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-amber-500/15 text-amber-600">
          <Megaphone className="size-4" />
        </span>
        <div className="min-w-0 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="font-bold">{a.title}</h2>
            <span className="text-[10px] text-muted-foreground">
              {new Date(a.created_at).toLocaleDateString("id-ID", {
                day: "numeric",
                month: "short",
              })}
            </span>
          </div>
          <p className="whitespace-pre-wrap text-sm text-muted-foreground">{a.body}</p>
        </div>
      </CardContent>
    </Card>
  );
  return (
    <AppShell
      title={teacherPreview ? "Pratinjau Siswa" : "Ruang Kelas"}
      backTo={teacherPreview ? "/guru-kelas/" + classId : "/kelas-saya"}
    >
      <div className="mx-auto max-w-4xl space-y-5">
        {teacherPreview && (
          <div className="rounded-2xl border border-amber-500/30 bg-amber-500/[0.08] p-3 text-xs">
            <b>Mode pratinjau guru.</b> Anda melihat tampilan ruang kelas peserta tanpa menjadi
            peserta. Aksi pengumpulan tugas dan kuis dinonaktifkan.
          </div>
        )}
        {d?.kelas && (
          <header className="relative overflow-hidden rounded-3xl border border-primary/20 bg-gradient-to-br from-primary/[0.16] via-card to-card p-5 shadow-sm sm:p-6">
            <div className="absolute -right-8 -top-10 size-32 rounded-full bg-primary/10 blur-2xl" />
            <div className="relative flex items-start justify-between gap-4">
              <div className="space-y-2">
                <div className="flex flex-wrap items-center gap-2 text-xs font-semibold text-primary">
                  <span className="rounded-full bg-primary/10 px-2.5 py-1">{d.kelas.level}</span>
                  <span className="rounded-full bg-background/70 px-2.5 py-1">
                    {d.kelas.status === "closed" ? "Diarsipkan" : "Kelas aktif"}
                  </span>
                </div>
                <h1 className="max-w-2xl text-2xl font-black tracking-tight sm:text-3xl">
                  {d.kelas.title}
                </h1>
                <p className="max-w-xl text-sm text-muted-foreground">
                  Semua materi, tugas, jadwal, dan pengumuman kelas ada di satu tempat.
                </p>
              </div>
              <span className="hidden size-12 shrink-0 place-items-center rounded-2xl bg-primary/10 text-primary sm:grid">
                <GraduationCap className="size-6" />
              </span>
            </div>
            {d.kelas.status === "closed" && (
              <div className="relative mt-4 rounded-2xl border border-amber-500/20 bg-amber-500/[0.07] p-3">
                <p className="text-xs font-bold text-amber-700">Kelas telah selesai</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Materi, riwayat tugas, nilai, dan hasil kuis tetap dapat Anda buka sebagai arsip
                  belajar.
                </p>
              </div>
            )}
          </header>
        )}
        <nav className="grid grid-cols-3 gap-2 sm:grid-cols-6" aria-label="Bagian ruang kelas">
          {workspaceTabs.map((item) => {
            const Icon = item.icon;
            const active = tab === item.id;
            return (
              <button
                type="button"
                key={item.id}
                aria-pressed={active}
                onClick={() => setTab(item.id)}
                className={
                  "group flex min-h-[4.6rem] flex-col items-center justify-center gap-1.5 rounded-2xl border px-2 py-2 text-center text-[11px] font-semibold transition " +
                  (active
                    ? "border-primary bg-primary text-primary-foreground shadow-sm"
                    : "border-border/70 bg-card text-muted-foreground hover:border-primary/40 hover:bg-primary/[0.05] hover:text-foreground")
                }
              >
                <Icon className={"size-[18px] " + (active ? "" : "text-primary")} />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>
        {q.isPending && <p>Memuat kelas…</p>}
        {q.isError && (
          <p role="alert" className="text-sm text-destructive">
            {q.error.message}
          </p>
        )}
        {d && (
          <>
            {tab === "beranda" && (
              <>
                {!teacherPreview && (
                  <Card className="border-primary/20">
                    <CardContent className="space-y-2 p-4">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="text-xs text-muted-foreground">Progress kelas</p>
                          <b>{progressPercent}% selesai</b>
                        </div>
                        <span className="text-xs font-bold">
                          {completedAssignments + completedQuizzes}/{totalActivities} aktivitas
                        </span>
                      </div>
                      <progress
                        className="h-2 w-full accent-green-600"
                        max="100"
                        value={progressPercent}
                      />
                      {d.kelas?.ends_at && (
                        <p className="text-xs text-muted-foreground">
                          Kelas berakhir {sessionTime(d.kelas.ends_at)}
                        </p>
                      )}
                    </CardContent>
                  </Card>
                )}
                {!teacherPreview && nextAction && (
                  <Card className="border-primary/25 bg-primary/[0.05] shadow-sm">
                    <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <p className="text-[11px] font-bold uppercase tracking-wide text-primary">
                          Kerjakan berikutnya
                        </p>
                        <h2 className="mt-1 font-black">{nextAction.title}</h2>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {nextAction.type === "tugas" ? "Tugas" : "Kuis"} ·{" "}
                          {deadlineLabel(nextAction.due_at)}
                        </p>
                      </div>
                      <Button size="sm" asChild>
                        {nextAction.type === "tugas" ? (
                          <Link
                            to="/kelas/$classId/tugas/$assignmentId"
                            params={{ classId, assignmentId: nextAction.id }}
                          >
                            Kerjakan Sekarang
                          </Link>
                        ) : (
                          <Link
                            to="/kelas/$classId/quiz/$quizId"
                            params={{ classId, quizId: nextAction.id }}
                          >
                            Mulai Kuis
                          </Link>
                        )}
                      </Button>
                    </CardContent>
                  </Card>
                )}
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {(
                    [
                      [BookOpenText, "Materi", d.materials.length],
                      [ClipboardList, "Tugas", d.assignments.length],
                      [ListChecks, "Kuis", d.quizzes.length],
                      [CalendarDays, "Sesi", d.schedule.length],
                    ] as const
                  ).map(([Icon, label, value]) => (
                    <Card key={label as string} className="border-border/70 shadow-sm">
                      <CardContent className="flex items-center gap-2.5 p-3">
                        <span className="grid size-8 place-items-center rounded-xl bg-primary/10 text-primary">
                          <Icon className="size-4" />
                        </span>
                        <div>
                          <p className="text-[10px] text-muted-foreground">{label as string}</p>
                          <strong className="text-lg">{value as number}</strong>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
                <div className="flex items-center gap-2 pt-1">
                  <Sparkles className="size-4 text-primary" />
                  <h1 className="text-xl font-black">Kegiatan kelas</h1>
                </div>
                {next ? (
                  <Card className="overflow-hidden border-primary/20 bg-gradient-to-r from-primary/[0.08] to-card shadow-sm">
                    <CardContent className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between">
                      <div className="flex items-start gap-3">
                        <span className="grid size-10 shrink-0 place-items-center rounded-2xl bg-primary text-primary-foreground">
                          <Video className="size-5" />
                        </span>
                        <div>
                          <p className="text-xs font-semibold text-primary">
                            {new Date(next.starts_at).getTime() <= Date.now()
                              ? "Sedang berlangsung"
                              : "Sesi berikutnya"}
                          </p>
                          <h2 className="font-bold">{next.title}</h2>
                          <p className="text-xs text-muted-foreground">
                            {sessionTime(next.starts_at, next.ends_at)}
                          </p>
                        </div>
                      </div>
                      <Live meeting={next.meeting_url ? next : d.meeting} />
                    </CardContent>
                  </Card>
                ) : (
                  <Live meeting={d.meeting} />
                )}
                <div className="flex items-center justify-between gap-3 pt-1">
                  <h2 className="font-bold">Tugas belum selesai</h2>
                  <span className="rounded-full bg-muted px-2 py-1 text-xs font-semibold">
                    {outstanding?.length ?? 0}
                  </span>
                </div>
                {outstanding?.slice(0, 3).map(task)}
                {(outstanding?.length ?? 0) > 3 && (
                  <Button variant="outline" size="sm" onClick={() => setTab("tugas")}>
                    Lihat Semua Tugas
                  </Button>
                )}
                {!outstanding?.length && (
                  <p className="text-sm text-muted-foreground">
                    Tidak ada tugas yang perlu dikumpulkan.
                  </p>
                )}
                <div className="flex items-center gap-2 pt-1">
                  <Megaphone className="size-4 text-amber-600" />
                  <h2 className="font-bold">Pengumuman terbaru</h2>
                </div>
                {d.announcements.slice(0, 2).map(notice)}
                {!d.announcements.length && (
                  <p className="text-sm text-muted-foreground">Belum ada pengumuman.</p>
                )}
              </>
            )}
            {tab === "materi" && (
              <>
                {d.materials.map((m: any) => (
                  <Card key={m.id}>
                    <CardContent className="space-y-2 p-4">
                      <h2 className="font-bold">{m.title}</h2>
                      <p className="whitespace-pre-wrap text-sm">{m.description}</p>
                      {secureUrl(m.content_url) && (
                        <a
                          className="text-sm font-bold text-primary underline"
                          target="_blank"
                          rel="noreferrer"
                          href={secureUrl(m.content_url)!}
                        >
                          Buka Materi
                        </a>
                      )}
                    </CardContent>
                  </Card>
                ))}
                {!d.materials.length && <Empty />}
              </>
            )}
            {tab === "tugas" && (
              <>
                <div className="flex flex-wrap gap-2" aria-label="Filter tugas">
                  {[
                    ["semua", "Semua"],
                    ["belum", "Belum dikumpulkan"],
                    ["menunggu", "Menunggu nilai"],
                    ["dinilai", "Sudah dinilai"],
                    ["lewat", "Lewat tenggat"],
                  ].map(([id, label]) => (
                    <Button
                      key={id}
                      size="sm"
                      variant={taskFilter === id ? "default" : "outline"}
                      aria-pressed={taskFilter === id}
                      onClick={() => setTaskFilter(id!)}
                    >
                      {label} (
                      {
                        d.assignments.filter((a: any) => id === "semua" || taskStatus(a) === id)
                          .length
                      }
                      )
                    </Button>
                  ))}
                </div>
                {d.assignments
                  .filter((a: any) => taskFilter === "semua" || taskStatus(a) === taskFilter)
                  .map(task)}
                {!!d.assignments.length &&
                  !d.assignments.some(
                    (a: any) => taskFilter === "semua" || taskStatus(a) === taskFilter,
                  ) && (
                    <p className="text-sm text-muted-foreground">
                      Tidak ada tugas pada status ini.
                    </p>
                  )}
                {!d.assignments.length && <Empty />}
              </>
            )}
            {tab === "tugas" && (
              <>
                <div className="mt-2 flex items-center gap-2">
                  <ListChecks className="size-4 text-primary" />
                  <h2 className="font-bold">Kuis</h2>
                  <span className="rounded-full bg-muted px-2 py-0.5 text-xs">
                    {d.quizzes.length}
                  </span>
                </div>
                {d.quizzes.map((k: any) => (
                  <Card key={k.id}>
                    <CardContent className="space-y-2 p-4">
                      <h2 className="font-bold">{k.title}</h2>
                      <p className="text-sm">{k.description}</p>
                      {k.due_at && (
                        <p
                          className={
                            "text-xs " +
                            (deadlineLabel(k.due_at) === "Terlambat"
                              ? "font-bold text-destructive"
                              : "")
                          }
                        >
                          Batas: {deadlineLabel(k.due_at)}
                        </p>
                      )}
                      <p className="text-xs font-bold">
                        {d.attempts.some((a: any) => a.quiz_id === k.id)
                          ? "Sudah dikerjakan"
                          : k.due_at && new Date(k.due_at).getTime() < Date.now()
                            ? "Batas waktu berakhir"
                            : "Belum dikerjakan"}
                      </p>
                      {teacherPreview ? (
                        <Button size="sm" disabled>
                          Pratinjau · pengerjaan dinonaktifkan
                        </Button>
                      ) : (
                        <Button size="sm" asChild>
                          <Link
                            to="/kelas/$classId/quiz/$quizId"
                            params={{ classId, quizId: k.id }}
                          >
                            Buka Kuis
                          </Link>
                        </Button>
                      )}
                    </CardContent>
                  </Card>
                ))}
                {!d.quizzes.length && (
                  <p className="text-sm text-muted-foreground">Belum ada kuis.</p>
                )}
              </>
            )}
            {tab === "jadwal" && (
              <>
                {d.schedule.map((s: any) => (
                  <Card key={s.id}>
                    <CardContent className="space-y-2 p-4">
                      <h2 className="font-bold">{s.title}</h2>
                      <p className="text-xs">{sessionTime(s.starts_at, s.ends_at)}</p>
                      {s.location_label && <p className="text-sm">{s.location_label}</p>}
                      <Live meeting={s.meeting_url ? s : d.meeting} />
                    </CardContent>
                  </Card>
                ))}
                {!d.schedule.length && <Empty />}
              </>
            )}
            {tab === "pengumuman" && (
              <>
                {d.announcements.map(notice)}
                {!d.announcements.length && <Empty />}
              </>
            )}
            {tab === "nilai" && (
              <>
                {d.grades.map((g: any) => {
                  const a = d.assignments.find((x: any) => x.id === g.assignment_id);
                  return (
                    <Card key={g.id}>
                      <CardContent className="space-y-2 p-4">
                        <h2 className="font-bold">
                          {a?.title || "Tugas"}: {g.score} / {a?.max_score ?? 100}
                        </h2>
                        <p className="whitespace-pre-wrap text-sm">{g.feedback}</p>
                        {g.weakness_note && (
                          <p className="text-sm">Perlu dilatih: {g.weakness_note}</p>
                        )}
                      </CardContent>
                    </Card>
                  );
                })}
                {!d.grades.length && <p className="text-sm">Belum ada tugas yang dinilai guru.</p>}
                <h2 className="font-bold">Nilai Kuis</h2>
                {d.attempts.map((a: any) => (
                  <Link
                    key={a.id}
                    to="/kelas/$classId/quiz/$quizId"
                    params={{ classId, quizId: a.quiz_id }}
                    search={{ attempt: a.id }}
                    className="block rounded-xl border p-3 text-sm hover:border-primary"
                  >
                    <strong>
                      {d.quizzes.find((q: any) => q.id === a.quiz_id)?.title}: {a.score}/100
                    </strong>
                    <p className="text-xs text-muted-foreground">{sessionTime(a.submitted_at)}</p>
                    <span className="text-xs text-primary">Lihat Pembahasan</span>
                  </Link>
                ))}
                {!d.attempts.length && (
                  <p className="text-sm text-muted-foreground">Belum ada kuis yang dikerjakan.</p>
                )}
                <h2 className="font-bold">Latihan per Topik</h2>
                {d.topics.map((t: any) => (
                  <div key={t.category + ":" + t.topic} className="space-y-1">
                    <p className="text-xs">
                      {t.category} / {t.topic}: {t.accuracy}% ({t.correct_count}/{t.total_questions}{" "}
                      benar){Number(t.accuracy) < 70 ? " · Perlu pengulangan" : ""}
                    </p>
                    <progress
                      className="h-2 w-full accent-green-600"
                      max="100"
                      value={Number(t.accuracy)}
                    />
                  </div>
                ))}
                {!d.topics.length && (
                  <p className="text-sm text-muted-foreground">
                    Statistik muncul setelah Anda mengerjakan kuis.
                  </p>
                )}
              </>
            )}
          </>
        )}
      </div>
    </AppShell>
  );
}
function Empty() {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-dashed border-border/80 bg-muted/40 p-5 text-sm text-muted-foreground">
      <span className="grid size-9 place-items-center rounded-xl bg-background text-primary">
        <BookOpenText className="size-4" />
      </span>
      Belum ada konten pada bagian ini.
    </div>
  );
}
function Live({ meeting }: { meeting: any }) {
  const [message, setMessage] = useState("");
  const url = secureUrl(meeting?.meeting_url);
  if (!url)
    return (
      <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <Video className="size-3.5" /> Akses sesi live belum tersedia.
      </p>
    );
  async function copy(value: string) {
    try {
      await navigator.clipboard.writeText(value);
      setMessage("Tersalin.");
    } catch {
      setMessage("Salin kode yang ditampilkan secara manual.");
    }
  }
  return (
    <div className="space-y-2">
      <Button size="sm" className="w-full sm:w-auto" asChild>
        <a href={url} target="_blank" rel="noreferrer">
          <PlayCircle className="size-4" />
          Masuk Kelas Live
        </a>
      </Button>
      {meeting.meeting_id && (
        <p className="text-xs">
          Meeting ID: {meeting.meeting_id}{" "}
          <button className="text-primary underline" onClick={() => copy(meeting.meeting_id)}>
            Salin
          </button>
        </p>
      )}
      {meeting.passcode && (
        <p className="text-xs">
          Passcode: {meeting.passcode}{" "}
          <button className="text-primary underline" onClick={() => copy(meeting.passcode)}>
            Salin
          </button>
        </p>
      )}
      {message && (
        <p role="status" className="text-xs">
          {message}
        </p>
      )}
    </div>
  );
}
