import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import {
  BookOpen,
  CheckCircle2,
  FileQuestion,
  Languages,
  Plus,
  Pencil,
  ShieldCheck,
  TriangleAlert,
} from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ContentEditor } from "@/components/admin/ContentEditor";
import { supabase } from "@/integrations/supabase/client";
export const Route = createFileRoute("/_authenticated/admin-konten")({ component: Page });
type Kind = "kanji" | "vocabulary" | "grammar" | "reading" | "listening" | "questions";
const materialKinds: [Kind, string][] = [
  ["kanji", "Kanji"],
  ["vocabulary", "Kosakata"],
  ["grammar", "Bunpou"],
  ["reading", "Dokkai"],
  ["listening", "Chōkai"],
];
function Page() {
  const qc = useQueryClient();
  const [mode, setMode] = useState<"menu" | "materi" | "simulasi">("menu");
  const [level, setLevel] = useState("N5");
  const [kind, setKind] = useState<Kind>("kanji");
  const [lesson, setLesson] = useState<number | null>(null);
  const [testType, setTestType] = useState("full");
  const [exam, setExam] = useState<number | null>(null);
  const [session, setSession] = useState<number | null>(null);
  const [edit, setEdit] = useState<string | null | undefined>(undefined);
  const gate = useQuery({
    queryKey: ["content-staff-gate"],
    queryFn: async () => {
      const { data, error } = await (supabase as any).rpc("get_content_staff_access");
      if (error) throw error;
      return data as any;
    },
    retry: false,
  });
  const back = gate.data?.role === "editor" ? "/editor" : "/admin";
  const reviewSummary = useQuery({
    queryKey: ["content-review-summary"],
    enabled: gate.isSuccess,
    queryFn: async () => {
      const { data, error } = await (supabase as any).rpc("get_content_review_summary");
      if (error) throw error;
      return data as any;
    },
  });
  const rows = useQuery({
    queryKey: ["admin-content", kind, level],
    enabled: gate.isSuccess && mode !== "menu",
    queryFn: async () => {
      const { data, error } = await (supabase as any).rpc("get_admin_console_data", {
        p_section: kind,
        p_level: level,
      });
      if (error) throw error;
      return data ?? [];
    },
  });
  const data: any[] = useMemo(() => (Array.isArray(rows.data) ? rows.data : []), [rows.data]);
  const lessons = useMemo(
    () => [...new Set(data.map((x) => Number(x.lesson_number || 1)))].sort((a, b) => a - b),
    [data],
  );
  const exams = useMemo(
    () =>
      [
        ...new Set(
          data
            .filter((x) => (x.test_type || "full") === testType)
            .map((x) => Number(x.exam_no || 1)),
        ),
      ].sort((a, b) => a - b),
    [data, testType],
  );
  const sessions = useMemo(
    () =>
      [
        ...new Set(
          data
            .filter((x) => (x.test_type || "full") === testType && Number(x.exam_no || 1) === exam)
            .map((x) => Number(x.session_no || 1)),
        ),
      ].sort((a, b) => a - b),
    [data, testType, exam],
  );
  const shown =
    mode === "materi"
      ? data.filter((x) => Number(x.lesson_number || 1) === lesson)
      : data.filter(
          (x) =>
            (x.test_type || "full") === testType &&
            Number(x.exam_no || 1) === exam &&
            Number(x.session_no || 1) === session,
        );
  const reviews = useQuery({
    queryKey: ["content-reviews", kind, shown.map((x) => x.id).join(",")],
    enabled: shown.length > 0,
    queryFn: async () => {
      const { data, error } = await (supabase as any).rpc("get_content_review_statuses", {
        p_type: kind,
        p_ids: shown.map((x) => x.id),
      });
      if (error) throw error;
      return Object.fromEntries((data || []).map((x: any) => [x.content_id, x]));
    },
  });
  async function review(id: string, status: string) {
    const note = status === "needs_fix" ? prompt("Catatan perbaikan:") || null : null;
    const { error } = await (supabase as any).rpc("set_content_review_status", {
      p_type: kind,
      p_id: id,
      p_status: status,
      p_severity: status === "needs_fix" ? "major" : null,
      p_note: note,
    });
    if (error) return alert(error.message);
    qc.invalidateQueries({ queryKey: ["content-reviews"] });
    qc.invalidateQueries({ queryKey: ["content-review-summary"] });
  }
  function refresh() {
    qc.invalidateQueries({ queryKey: ["admin-content", kind, level] });
  }
  if (gate.isLoading)
    return (
      <AppShell title="Konten" backTo="/">
        <p className="p-4 text-xs">Memeriksa akses…</p>
      </AppShell>
    );
  if (gate.isError)
    return (
      <AppShell title="Konten" backTo="/">
        <p className="p-4 text-xs text-destructive">Akses Editor/Admin diperlukan.</p>
      </AppShell>
    );
  if (mode === "menu")
    return (
      <AppShell title="Konten" backTo={back}>
        <div className="space-y-3">
          <h1 className="text-xl font-black">Kelola Konten</h1>
          <p className="text-xs text-muted-foreground">
            Mode {gate.data?.role === "editor" ? "Editor" : "Admin"} · perubahan tersimpan ke CMS
            yang sama.
          </p>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {[
              [`Menunggu`, reviewSummary.data?.pending || 0],
              [`Perlu Perbaikan`, reviewSummary.data?.needs_fix || 0],
              [`Disetujui`, reviewSummary.data?.approved || 0],
              [`Laporan Aktif`, reviewSummary.data?.reports_open || 0],
            ].map(([a, b]) => (
              <Card key={a}>
                <CardContent className="p-3">
                  <p className="text-lg font-black">{b}</p>
                  <p className="text-[10px] text-muted-foreground">{a}</p>
                </CardContent>
              </Card>
            ))}
          </div>
          <Card
            className="cursor-pointer"
            onClick={() => {
              setMode("materi");
              setKind("kanji");
            }}
          >
            <CardContent className="flex items-center gap-3 p-4">
              <BookOpen className="size-5 text-primary" />
              <div>
                <p className="text-sm font-bold">Materi JLPT</p>
                <p className="text-[10px] text-muted-foreground">
                  Level → Jenis Materi → Pelajaran → Edit
                </p>
              </div>
            </CardContent>
          </Card>
          <Card
            className="cursor-pointer"
            onClick={() => {
              setMode("simulasi");
              setKind("questions");
            }}
          >
            <CardContent className="flex items-center gap-3 p-4">
              <FileQuestion className="size-5 text-primary" />
              <div>
                <p className="text-sm font-bold">Simulasi JLPT</p>
                <p className="text-[10px] text-muted-foreground">
                  Level → Full/Bagian → Ujian → Sesi → Soal → Edit
                </p>
              </div>
            </CardContent>
          </Card>
          <Link
            to="/admin-terjemahan"
            className="flex items-center gap-2 text-xs font-bold text-primary"
          >
            <Languages className="size-4" />
            Buka alat terjemahan →
          </Link>
        </div>
      </AppShell>
    );
  return (
    <AppShell title={mode === "materi" ? "Materi JLPT" : "Simulasi JLPT"} backTo="/admin-konten">
      <div className="space-y-4">
        <div className="flex gap-2 overflow-x-auto">
          {["N5", "N4", "N3", "N2", "N1"].map((x) => (
            <Button
              key={x}
              size="sm"
              variant={level === x ? "default" : "outline"}
              onClick={() => {
                setLevel(x);
                setLesson(null);
                setExam(null);
                setSession(null);
              }}
            >
              {x}
            </Button>
          ))}
        </div>
        {mode === "materi" ? (
          <>
            <div className="flex gap-2 overflow-x-auto">
              {materialKinds.map(([id, label]) => (
                <Button
                  key={id}
                  size="sm"
                  variant={kind === id ? "default" : "outline"}
                  onClick={() => {
                    setKind(id);
                    setLesson(null);
                  }}
                >
                  {label}
                </Button>
              ))}
            </div>
            <div>
              <p className="mb-2 text-xs font-bold">Pilih Pelajaran</p>
              <div className="flex flex-wrap gap-2">
                {lessons.map((n) => (
                  <Button
                    key={n}
                    size="sm"
                    variant={lesson === n ? "default" : "outline"}
                    onClick={() => setLesson(n)}
                  >
                    Pelajaran {n}
                  </Button>
                ))}
              </div>
            </div>
          </>
        ) : (
          <>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant={testType === "full" ? "default" : "outline"}
                onClick={() => {
                  setTestType("full");
                  setExam(null);
                  setSession(null);
                }}
              >
                Full Test
              </Button>
              <Button
                size="sm"
                variant={testType === "bagian" ? "default" : "outline"}
                onClick={() => {
                  setTestType("bagian");
                  setExam(null);
                  setSession(null);
                }}
              >
                Bagian Ujian
              </Button>
            </div>
            <div>
              <p className="mb-2 text-xs font-bold">Nomor Ujian</p>
              <div className="flex flex-wrap gap-2">
                {exams.map((n) => (
                  <Button
                    key={n}
                    size="sm"
                    variant={exam === n ? "default" : "outline"}
                    onClick={() => {
                      setExam(n);
                      setSession(null);
                    }}
                  >
                    Ujian {String(n).padStart(2, "0")}
                  </Button>
                ))}
              </div>
            </div>
            {exam != null && (
              <div>
                <p className="mb-2 text-xs font-bold">Sesi</p>
                <div className="flex flex-wrap gap-2">
                  {sessions.map((n) => (
                    <Button
                      key={n}
                      size="sm"
                      variant={session === n ? "default" : "outline"}
                      onClick={() => setSession(n)}
                    >
                      Sesi {n}
                    </Button>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
        <div className="flex items-center justify-between">
          <p className="text-xs font-bold">{shown.length} item</p>
          <Button size="sm" onClick={() => setEdit(null)}>
            <Plus className="mr-1 size-3" />
            Tambah
          </Button>
        </div>
        <div className="space-y-2">
          {shown.map((r) => (
            <Card key={r.id}>
              <CardContent className="flex items-center justify-between gap-3 p-3">
                <div className="min-w-0">
                  <p className="truncate text-xs font-bold">
                    {mode === "simulasi"
                      ? `Soal ${r.display_question_no || r.question_no}`
                      : r.character || r.term || r.pattern || r.title}
                  </p>
                  <p className="text-[10px] text-muted-foreground">
                    {mode === "simulasi"
                      ? `${r.section || ""} · Mondai ${r.mondai_no || "-"} · ${r.is_published ? "Published" : "Draft"}`
                      : `Pelajaran ${r.lesson_number || 1} · ${r.is_published ? "Published" : "Draft"}`}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  {reviews.data?.[r.id]?.status === "approved" ? (
                    <span className="hidden text-[9px] font-bold text-primary sm:flex">
                      <CheckCircle2 className="mr-1 size-3" />
                      Disetujui
                    </span>
                  ) : reviews.data?.[r.id]?.status === "needs_fix" ? (
                    <span className="hidden text-[9px] font-bold text-destructive sm:flex">
                      <TriangleAlert className="mr-1 size-3" />
                      Perbaiki
                    </span>
                  ) : null}
                  <Button
                    size="sm"
                    variant="outline"
                    title="Setujui"
                    onClick={() => review(String(r.id), "approved")}
                  >
                    <ShieldCheck className="size-3" />
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    title="Perlu perbaikan"
                    onClick={() => review(String(r.id), "needs_fix")}
                  >
                    <TriangleAlert className="size-3" />
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    title="Edit"
                    onClick={() => setEdit(String(r.id))}
                  >
                    <Pencil className="size-3" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
          {!rows.isLoading &&
            ((mode === "materi" && lesson != null) || (mode === "simulasi" && session != null)) &&
            shown.length === 0 && (
              <p className="rounded-xl bg-muted p-4 text-xs text-muted-foreground">
                Belum ada item pada bagian ini.
              </p>
            )}
        </div>
        {edit !== undefined && (
          <ContentEditor
            kind={kind}
            id={edit}
            onClose={() => setEdit(undefined)}
            onSaved={refresh}
          />
        )}
      </div>
    </AppShell>
  );
}
