import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { AppShell } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { classroom, result, secureUrl, sessionTime } from "@/lib/classroom";
export const Route = createFileRoute("/_authenticated/kelas/$classId/workspace")({
  component: Page,
});
function Page() {
  const { classId } = Route.useParams();
  const [tab, setTab] = useState("beranda");
  const [taskFilter, setTaskFilter] = useState("semua");
  const q = useQuery({
    queryKey: ["class-workspace", classId],
    queryFn: async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user || !(await result(classroom.rpc("is_class_member", { p_class_id: classId }))))
        throw new Error("Anda belum terdaftar di kelas ini.");
      const [materials, assignments, quizzes, schedule, announcements, grades, meeting, myClasses] =
        await Promise.all([
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
            classroom
              .from("class_grades")
              .select("*")
              .eq("class_id", classId)
              .eq("user_id", user.id),
          ),
          result(
            classroom.from("class_meetings").select("*").eq("class_id", classId).maybeSingle(),
          ),
          result(classroom.rpc("get_my_classes")),
        ]);
      const submissions = assignments.length
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
        quizzes.length
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
        result(classroom.rpc("get_my_class_topic_insights", { p_class_id: classId })),
      ]);
      return {
        kelas: myClasses.find((c: any) => c.id === classId),
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
  const outstanding = d?.assignments.filter(
    (a: any) => !d.submissions.some((s: any) => s.assignment_id === a.id),
  );
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
  const task = (a: any) => (
    <Card key={a.id}>
      <CardContent className="space-y-2 p-4">
        <h2 className="font-bold">{a.title}</h2>
        <p className="text-xs text-primary">
          {a.category}
          {a.topic ? " / " + a.topic : ""}
        </p>
        <p className="whitespace-pre-wrap text-sm">{a.description}</p>
        {a.due_at && <p className="text-xs">Batas: {sessionTime(a.due_at)}</p>}
        <p className="text-xs font-bold">{statusLabel[taskStatus(a)]}</p>
        <Button size="sm" asChild>
          <Link to="/kelas/$classId/tugas/$assignmentId" params={{ classId, assignmentId: a.id }}>
            Buka Tugas
          </Link>
        </Button>
      </CardContent>
    </Card>
  );
  const notice = (a: any) => (
    <Card key={a.id}>
      <CardContent className="space-y-2 p-4">
        <h2 className="font-bold">{a.title}</h2>
        <p className="whitespace-pre-wrap text-sm">{a.body}</p>
        <p className="text-xs text-muted-foreground">
          {new Date(a.created_at).toLocaleString("id-ID")}
        </p>
      </CardContent>
    </Card>
  );
  return (
    <AppShell title="Ruang Kelas" backTo="/kelas-saya">
      <div className="mx-auto max-w-3xl space-y-4">
        {d?.kelas && (
          <header>
            <h1 className="text-xl font-black">{d.kelas.title}</h1>
            <p className="text-xs text-primary">
              {d.kelas.level}
              {d.kelas.status === "closed"
                ? " · Kelas diarsipkan — materi dan hasil belajar tetap tersedia"
                : ""}
            </p>
          </header>
        )}
        <nav className="flex gap-2 overflow-x-auto" aria-label="Bagian ruang kelas">
          {[
            ["beranda", "Beranda"],
            ["materi", "Materi"],
            ["tugas", "Tugas"],
            ["kuis", "Kuis"],
            ["jadwal", "Jadwal"],
            ["pengumuman", "Pengumuman"],
            ["nilai", "Nilai"],
          ].map(([id, label]) => (
            <Button
              size="sm"
              key={id}
              variant={tab === id ? "default" : "outline"}
              aria-pressed={tab === id}
              onClick={() => setTab(id!)}
            >
              {label}
            </Button>
          ))}
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
                <h1 className="text-xl font-black">Kegiatan Kelas</h1>
                {next ? (
                  <Card>
                    <CardContent className="space-y-2 p-4">
                      <h2 className="font-bold">
                        {new Date(next.starts_at).getTime() <= Date.now()
                          ? "Sesi berlangsung"
                          : "Sesi berikutnya"}
                        : {next.title}
                      </h2>
                      <p className="text-xs">{sessionTime(next.starts_at, next.ends_at)}</p>
                      <Live meeting={next.meeting_url ? next : d.meeting} />
                    </CardContent>
                  </Card>
                ) : (
                  <Live meeting={d.meeting} />
                )}
                <h2 className="font-bold">Tugas belum selesai ({outstanding?.length ?? 0})</h2>
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
                <h2 className="font-bold">Pengumuman terbaru</h2>
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
            {tab === "kuis" && (
              <>
                {d.quizzes.map((k: any) => (
                  <Card key={k.id}>
                    <CardContent className="space-y-2 p-4">
                      <h2 className="font-bold">{k.title}</h2>
                      <p className="text-sm">{k.description}</p>
                      {k.due_at && <p className="text-xs">Batas: {sessionTime(k.due_at)}</p>}
                      <p className="text-xs font-bold">
                        {d.attempts.some((a: any) => a.quiz_id === k.id)
                          ? "Sudah dikerjakan"
                          : k.due_at && new Date(k.due_at).getTime() < Date.now()
                            ? "Batas waktu berakhir"
                            : "Belum dikerjakan"}
                      </p>
                      <Button size="sm" asChild>
                        <Link to="/kelas/$classId/quiz/$quizId" params={{ classId, quizId: k.id }}>
                          Buka Kuis
                        </Link>
                      </Button>
                    </CardContent>
                  </Card>
                ))}
                {!d.quizzes.length && <Empty />}
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
  return <p className="rounded-xl bg-muted p-4 text-sm">Belum ada konten pada bagian ini.</p>;
}
function Live({ meeting }: { meeting: any }) {
  const [message, setMessage] = useState("");
  const url = secureUrl(meeting?.meeting_url);
  if (!url) return <p className="text-xs text-muted-foreground">Akses sesi live belum tersedia.</p>;
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
      <Button size="sm" asChild>
        <a href={url} target="_blank" rel="noreferrer">
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
