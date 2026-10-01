import { useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  BookOpenText,
  CalendarDays,
  CheckCircle2,
  ClipboardList,
  Copy,
  Eye,
  FileQuestion,
  Megaphone,
  Pencil,
  Plus,
  Send,
  Trash2,
} from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import {
  classroom,
  result,
  categories,
  localDateTime,
  isoDate,
  sessionTime,
  secureUrl,
} from "@/lib/classroom";
export const Route = createFileRoute("/_authenticated/guru-kelas/$classId/konten")({
  validateSearch: (search: Record<string, unknown>): { tab?: Tab } => {
    const value = search["tab"];
    return typeof value === "string" && Object.hasOwn(tables, value) ? { tab: value as Tab } : {};
  },
  component: Page,
});
type Tab = "materi" | "tugas" | "quiz" | "jadwal" | "pengumuman";
const tables = {
  materi: "class_materials",
  tugas: "class_assignments",
  quiz: "class_quizzes",
  jadwal: "class_schedule",
  pengumuman: "class_announcements",
};
const contentTabs = [
  { id: "materi", label: "Materi", helper: "Bagikan bahan belajar", icon: BookOpenText },
  { id: "tugas", label: "Tugas", helper: "Kumpulkan pekerjaan", icon: ClipboardList },
  { id: "quiz", label: "Kuis otomatis", helper: "Nilai langsung masuk", icon: FileQuestion },
  { id: "jadwal", label: "Jadwal", helper: "Atur sesi live", icon: CalendarDays },
  { id: "pengumuman", label: "Pengumuman", helper: "Kirim ke peserta", icon: Megaphone },
] as const;
const initial = {
  title: "",
  text: "",
  url: "",
  date: "",
  end: "",
  category: "Umum",
  topic: "",
  max_score: "100",
  duration_minutes: "30",
  submission_type: "text",
  allow_late: false,
  is_published: false,
  meeting_id: "",
  passcode: "",
};
function Page() {
  const { classId } = Route.useParams();
  const search = Route.useSearch();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [tab, setTab] = useState<Tab>(search.tab ?? "materi");
  const [id, setId] = useState<string | null>(null);
  const [f, setF] = useState({ ...initial });
  const [preview, setPreview] = useState(false);
  const [message, setMessage] = useState("");
  const [quizQuestion, setQuizQuestion] = useState("");
  const [quizChoices, setQuizChoices] = useState(["", "", "", ""]);
  const [quizCorrect, setQuizCorrect] = useState(-1);
  const [quizExplanation, setQuizExplanation] = useState("");
  const set = (key: string, value: any) => setF((x) => ({ ...x, [key]: value }));
  const access = useQuery({
    queryKey: ["class-manage-access", classId],
    queryFn: () => result(classroom.rpc("can_manage_class", { p_class_id: classId })),
  });
  const q = useQuery({
    queryKey: ["guru-class-content", classId, tab],
    enabled: access.data === true,
    queryFn: () =>
      result(
        classroom
          .from(tables[tab])
          .select("*")
          .eq("class_id", classId)
          .order(tab === "jadwal" ? "starts_at" : "created_at", { ascending: tab === "jadwal" }),
      ),
  });
  const reset = () => {
    setId(null);
    setF({ ...initial });
    setPreview(false);
    setMessage("");
    setQuizQuestion("");
    setQuizChoices(["", "", "", ""]);
    setQuizCorrect(-1);
    setQuizExplanation("");
  };
  const refresh = async () => {
    await qc.invalidateQueries({ queryKey: ["guru-class-content", classId] });
    await qc.invalidateQueries({ queryKey: ["teacher-workspace", classId] });
    await qc.invalidateQueries({ queryKey: ["class-workspace", classId] });
  };
  const save = useMutation({
    mutationFn: async () => {
      if (!f.title.trim()) throw new Error("Judul wajib diisi.");
      if (f.url && !secureUrl(f.url)) throw new Error("Gunakan tautan HTTPS yang valid.");
      if (
        tab === "quiz" &&
        f.duration_minutes &&
        (Number(f.duration_minutes) < 1 || Number(f.duration_minutes) > 480)
      )
        throw new Error("Durasi kuis harus 1–480 menit.");
      if (tab === "quiz" && !id) {
        if (!quizQuestion.trim()) throw new Error("Pertanyaan pertama wajib diisi.");
        if (quizChoices.some((choice) => !choice.trim()))
          throw new Error("Isi semua pilihan jawaban.");
        if (quizCorrect < 0) throw new Error("Tandai satu pilihan sebagai jawaban benar.");
      }
      const row: any = { class_id: classId, title: f.title.trim() };
      if (tab === "materi")
        Object.assign(row, {
          description: f.text,
          content_url: f.url || null,
          is_published: f.is_published,
        });
      if (tab === "tugas")
        Object.assign(row, {
          description: f.text,
          due_at: isoDate(f.date),
          category: f.category,
          topic: f.topic || null,
          max_score: Number(f.max_score),
          submission_type: f.submission_type,
          allow_late: f.allow_late,
          is_published: f.is_published,
        });
      if (tab === "quiz")
        Object.assign(row, {
          description: f.text,
          due_at: isoDate(f.date),
          duration_minutes: f.duration_minutes ? Number(f.duration_minutes) : null,
          is_published: id ? f.is_published : false,
        });
      if (tab === "pengumuman") {
        if (!f.text.trim()) throw new Error("Isi pengumuman wajib diisi.");
        Object.assign(row, { body: f.text, is_published: f.is_published });
      }
      if (tab === "jadwal") {
        if (!f.date || !f.end || new Date(f.end) <= new Date(f.date))
          throw new Error("Isi waktu mulai dan selesai yang valid.");
        Object.assign(row, {
          starts_at: isoDate(f.date),
          ends_at: isoDate(f.end),
          location_label: f.text || null,
          meeting_url: f.url || null,
          meeting_id: f.meeting_id || null,
          passcode: f.passcode || null,
        });
      }
      if (tab === "quiz" && !id) {
        return (await result(
          classroom.rpc("teacher_create_class_quiz_with_questions", {
            p_class_id: classId,
            p_data: {
              title: f.title.trim(),
              description: f.text,
              due_at: isoDate(f.date),
              duration_minutes: f.duration_minutes ? Number(f.duration_minutes) : null,
              is_published: false,
            },
            p_questions: [
              {
                question: quizQuestion.trim(),
                choices: quizChoices.map((choice) => choice.trim()),
                correct_index: quizCorrect,
                explanation: quizExplanation,
                category: f.category,
                topic: f.topic,
              },
            ],
          }),
        )) as string;
      }
      await result(
        id
          ? classroom.from(tables[tab]).update(row).eq("id", id).eq("class_id", classId)
          : classroom.from(tables[tab]).insert(row),
      );
    },
    onSuccess: async (createdQuizId) => {
      reset();
      await refresh();
      if (createdQuizId) {
        await navigate({
          to: "/guru-kelas/$classId/quiz/$quizId",
          params: { classId, quizId: createdQuizId },
        });
        return;
      }
      setMessage(
        tab === "quiz"
          ? "Kuis tersimpan. Isi soal terlebih dahulu, lalu terbitkan."
          : "Perubahan tersimpan.",
      );
    },
  });
  const remove = useMutation({
    mutationFn: async (row: any) => {
      await result(classroom.from(tables[tab]).delete().eq("id", row.id).eq("class_id", classId));
    },
    onSuccess: async () => {
      reset();
      await refresh();
    },
  });
  function edit(row: any, duplicate = false) {
    save.reset();
    remove.reset();
    setMessage("");
    setPreview(false);
    setId(duplicate ? null : row.id);
    setF({
      ...initial,
      title: (duplicate ? "Salinan — " : "") + row.title,
      text: row.description || row.body || row.location_label || "",
      url: row.content_url || row.meeting_url || "",
      date: localDateTime(row.due_at || row.starts_at),
      end: localDateTime(row.ends_at),
      category: row.category || "Umum",
      topic: row.topic || "",
      max_score: String(row.max_score ?? 100),
      duration_minutes: String(row.duration_minutes ?? 30),
      submission_type: row.submission_type || "text",
      allow_late: !!row.allow_late,
      is_published: duplicate ? false : !!row.is_published,
      meeting_id: row.meeting_id || "",
      passcode: row.passcode || "",
    });
  }
  const busy = save.isPending || remove.isPending;
  return (
    <AppShell title="Materi & Aktivitas Kelas" backTo={"/guru-kelas/" + classId}>
      <div className="mx-auto max-w-4xl space-y-5">
        {access.isPending && <p>Memeriksa akses…</p>}
        {(access.isError || access.data === false) && (
          <p role="alert">Anda tidak memiliki akses mengelola kelas ini.</p>
        )}
        {access.data === true && (
          <>
            <nav className="grid grid-cols-2 gap-2 sm:grid-cols-5" aria-label="Aktivitas kelas">
              {contentTabs.map((item) => {
                const Icon = item.icon;
                const active = tab === item.id;
                return (
                  <button
                    type="button"
                    key={item.id}
                    disabled={busy}
                    aria-pressed={active}
                    onClick={() => {
                      setTab(item.id);
                      reset();
                      save.reset();
                      remove.reset();
                    }}
                    className={
                      "flex min-h-[4.8rem] items-center gap-3 rounded-2xl border px-3 py-3 text-left transition sm:flex-col sm:items-center sm:justify-center sm:gap-1.5 sm:text-center " +
                      (active
                        ? "border-primary bg-primary text-primary-foreground shadow-sm"
                        : "border-border/70 bg-card hover:border-primary/40 hover:bg-primary/[0.05]")
                    }
                  >
                    <Icon className={"size-5 shrink-0 " + (active ? "" : "text-primary")} />
                    <span>
                      <span className="block text-xs font-bold">{item.label}</span>
                      <span
                        className={
                          "mt-0.5 block text-[10px] " +
                          (active ? "text-primary-foreground/75" : "text-muted-foreground")
                        }
                      >
                        {item.helper}
                      </span>
                    </span>
                  </button>
                );
              })}
            </nav>
            <Card className="border-border/70 shadow-sm">
              <CardContent className="space-y-4 p-4 sm:p-5">
                <div className="flex items-start gap-3">
                  <span className="grid size-10 shrink-0 place-items-center rounded-2xl bg-primary/10 text-primary">
                    {tab === "materi" && <BookOpenText className="size-5" />}
                    {tab === "tugas" && <ClipboardList className="size-5" />}
                    {tab === "quiz" && <FileQuestion className="size-5" />}
                    {tab === "jadwal" && <CalendarDays className="size-5" />}
                    {tab === "pengumuman" && <Megaphone className="size-5" />}
                  </span>
                  <div>
                    <h1 className="font-black">
                      {id ? "Edit" : "Buat"} {tab === "quiz" ? "kuis" : tab}
                    </h1>
                    <p className="text-xs text-muted-foreground">
                      {tab === "quiz"
                        ? "Buat soal pilihan ganda, tandai jawaban benar, lalu nilai peserta otomatis."
                        : tab === "pengumuman"
                          ? "Peserta aktif akan menerima notifikasi saat Anda menerbitkannya."
                          : "Isi bagian penting saja; Anda bisa menyempurnakannya kapan saja."}
                    </p>
                  </div>
                </div>
                <Field label="Judul">
                  <Input value={f.title} onChange={(e) => set("title", e.target.value)} />
                </Field>
                <Field label={tab === "jadwal" ? "Lokasi / keterangan" : "Instruksi / isi"}>
                  <Textarea rows={4} value={f.text} onChange={(e) => set("text", e.target.value)} />
                </Field>
                {(tab === "materi" || tab === "jadwal") && (
                  <Field
                    label={
                      tab === "materi"
                        ? "Tautan materi (HTTPS, opsional)"
                        : "Link Meet / Zoom sesi ini (opsional)"
                    }
                  >
                    <Input type="url" value={f.url} onChange={(e) => set("url", e.target.value)} />
                  </Field>
                )}
                {tab === "tugas" && !id && (
                  <div className="flex flex-col gap-3 rounded-2xl border border-primary/20 bg-primary/[0.06] p-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex items-start gap-3">
                      <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
                        <CheckCircle2 className="size-4" />
                      </span>
                      <div>
                        <p className="text-sm font-bold">Ingin nilai langsung masuk?</p>
                        <p className="text-xs text-muted-foreground">
                          Gunakan Kuis otomatis untuk pilihan ganda dengan kunci jawaban dan skor
                          instan.
                        </p>
                      </div>
                    </div>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setTab("quiz");
                        reset();
                      }}
                    >
                      <FileQuestion className="size-4" /> Buat kuis otomatis
                    </Button>
                  </div>
                )}
                {tab === "tugas" && (
                  <>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <Field label="Jenis jawaban">
                        <select
                          className="h-10 w-full rounded border bg-background p-2 text-sm"
                          value={f.submission_type}
                          onChange={(e) => set("submission_type", e.target.value)}
                        >
                          <option value="text">Jawaban tertulis</option>
                          <option value="upload">Unggah foto / PDF / audio</option>
                          <option value="mixed">Teks dan/atau unggahan</option>
                        </select>
                      </Field>
                      <Field label="Nilai maksimal">
                        <Input
                          type="number"
                          min="1"
                          value={f.max_score}
                          onChange={(e) => set("max_score", e.target.value)}
                        />
                      </Field>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <Field label="Kategori">
                        <select
                          className="h-10 w-full rounded border bg-background p-2 text-sm"
                          value={f.category}
                          onChange={(e) => set("category", e.target.value)}
                        >
                          {categories.map((c) => (
                            <option key={c}>{c}</option>
                          ))}
                        </select>
                      </Field>
                      <Field label="Topik">
                        <Input
                          value={f.topic}
                          onChange={(e) => set("topic", e.target.value)}
                          placeholder="Contoh: Partikel は dan が"
                        />
                      </Field>
                    </div>
                    <label className="flex items-center gap-2 text-xs">
                      <input
                        type="checkbox"
                        checked={f.allow_late}
                        onChange={(e) => set("allow_late", e.target.checked)}
                      />
                      Izinkan pengumpulan setelah tenggat
                    </label>
                  </>
                )}
                {tab === "quiz" && !id && (
                  <div className="space-y-4 rounded-2xl border border-primary/20 bg-primary/[0.04] p-4">
                    <div>
                      <p className="text-sm font-bold">Soal 1 · Pilihan ganda</p>
                      <p className="text-xs text-muted-foreground">
                        Isi pertanyaan, pilihan jawaban, lalu tandai kunci yang benar. Nilai peserta dikoreksi otomatis.
                      </p>
                    </div>
                    <Field label="Pertanyaan">
                      <Textarea
                        rows={3}
                        value={quizQuestion}
                        onChange={(e) => setQuizQuestion(e.target.value)}
                        placeholder="Contoh: Pilih kalimat yang paling tepat…"
                      />
                    </Field>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-bold">Pilihan jawaban</span>
                        <span className="text-[10px] text-muted-foreground">Pilih satu kunci benar</span>
                      </div>
                      {quizChoices.map((choice, index) => (
                        <label
                          key={index}
                          className={
                            "flex items-center gap-2 rounded-xl border p-2 " +
                            (quizCorrect === index ? "border-primary bg-primary/[0.06]" : "border-border/70")
                          }
                        >
                          <input
                            type="radio"
                            name="quiz-correct"
                            checked={quizCorrect === index}
                            onChange={() => setQuizCorrect(index)}
                            aria-label={"Kunci jawaban " + String.fromCharCode(65 + index)}
                            className="size-4 accent-primary"
                          />
                          <span className="w-5 text-center text-xs font-black">
                            {String.fromCharCode(65 + index)}
                          </span>
                          <Input
                            value={choice}
                            onChange={(e) =>
                              setQuizChoices((current) =>
                                current.map((value, i) => (i === index ? e.target.value : value)),
                              )
                            }
                            placeholder={"Pilihan " + String.fromCharCode(65 + index)}
                            className="border-0 bg-transparent shadow-none focus-visible:ring-0"
                          />
                        </label>
                      ))}
                    </div>
                    <Field label="Pembahasan (opsional)">
                      <Textarea
                        rows={2}
                        value={quizExplanation}
                        onChange={(e) => setQuizExplanation(e.target.value)}
                        placeholder="Jelaskan alasan jawaban benar."
                      />
                    </Field>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <Field label="Kategori soal">
                        <select
                          className="h-10 w-full rounded border bg-background p-2 text-sm"
                          value={f.category}
                          onChange={(e) => set("category", e.target.value)}
                        >
                          {categories.map((category) => (
                            <option key={category}>{category}</option>
                          ))}
                        </select>
                      </Field>
                      <Field label="Topik">
                        <Input
                          value={f.topic}
                          onChange={(e) => set("topic", e.target.value)}
                          placeholder="Contoh: Bentuk て"
                        />
                      </Field>
                    </div>
                  </div>
                )}
                {(tab === "tugas" || tab === "quiz") && (
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Field label="Batas pengumpulan (waktu lokal, opsional)">
                      <Input
                        type="datetime-local"
                        value={f.date}
                        onChange={(e) => set("date", e.target.value)}
                      />
                    </Field>
                    {tab === "quiz" && (
                      <Field label="Durasi target (menit)">
                        <Input
                          type="number"
                          min="1"
                          max="480"
                          value={f.duration_minutes}
                          onChange={(e) => set("duration_minutes", e.target.value)}
                        />
                        <span className="block text-[10px] font-normal text-muted-foreground">
                          Ditampilkan ke peserta sebagai estimasi pengerjaan.
                        </span>
                      </Field>
                    )}
                  </div>
                )}
                {tab === "jadwal" && (
                  <>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <Field label="Mulai (waktu lokal perangkat)">
                        <Input
                          type="datetime-local"
                          value={f.date}
                          onChange={(e) => set("date", e.target.value)}
                        />
                      </Field>
                      <Field label="Selesai (waktu lokal perangkat)">
                        <Input
                          type="datetime-local"
                          value={f.end}
                          onChange={(e) => set("end", e.target.value)}
                        />
                      </Field>
                    </div>
                    {f.date && f.end && (
                      <p className="text-xs text-muted-foreground">{sessionTime(f.date, f.end)}</p>
                    )}
                    <Field label="Meeting ID / kode room sesi">
                      <Input
                        value={f.meeting_id}
                        onChange={(e) => set("meeting_id", e.target.value)}
                      />
                    </Field>
                    <Field label="Passcode sesi">
                      <Input
                        type="password"
                        autoComplete="new-password"
                        value={f.passcode}
                        onChange={(e) => set("passcode", e.target.value)}
                      />
                    </Field>
                    <p className="text-xs text-muted-foreground">
                      Kosongkan akses sesi untuk memakai link umum kelas. Perubahan jadwal mengirim
                      notifikasi kepada peserta aktif.
                    </p>
                  </>
                )}
                {tab !== "jadwal" && !(tab === "quiz" && !id) && (
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={f.is_published}
                      onChange={(e) => set("is_published", e.target.checked)}
                    />
                    Terbitkan untuk peserta
                  </label>
                )}
                {tab === "quiz" && !id && (
                  <p className="text-xs text-muted-foreground">
                    Kuis dan soal pertama disimpan sebagai draft. Setelah itu Anda bisa langsung menambah soal berikutnya.
                  </p>
                )}
                {tab === "pengumuman" && f.is_published && (
                  <p className="text-xs text-muted-foreground">
                    Pengumuman muncul di ruang kelas dan notifikasi setiap peserta aktif.
                  </p>
                )}
                <div className="flex flex-wrap gap-2">
                  <Button disabled={busy || !f.title.trim()} onClick={() => save.mutate()}>
                    {tab === "pengumuman" ? (
                      <Send className="size-4" />
                    ) : (
                      <Plus className="size-4" />
                    )}
                    {save.isPending
                      ? "Menyimpan…"
                      : tab === "jadwal"
                        ? "Simpan Jadwal"
                        : f.is_published
                          ? "Simpan & Terbitkan"
                          : "Simpan Draft"}
                  </Button>
                  <Button variant="outline" onClick={() => setPreview(!preview)}>
                    <Eye className="size-4" />
                    Pratinjau
                  </Button>
                  {id && (
                    <Button variant="outline" disabled={busy} onClick={reset}>
                      Batal
                    </Button>
                  )}
                </div>
                {preview && (
                  <div className="rounded-xl border bg-muted p-4">
                    <h2 className="font-bold">{f.title || "Judul"}</h2>
                    <p className="mt-2 whitespace-pre-wrap text-sm">{f.text}</p>
                    {f.url && secureUrl(f.url) && (
                      <a
                        className="text-sm text-primary underline"
                        href={secureUrl(f.url)!}
                        target="_blank"
                        rel="noreferrer"
                      >
                        Buka tautan
                      </a>
                    )}
                  </div>
                )}
                {(save.isError || remove.isError) && (
                  <p role="alert" className="text-sm text-destructive">
                    {save.error?.message || remove.error?.message}
                  </p>
                )}
                {message && (
                  <p role="status" className="text-sm">
                    {message}
                  </p>
                )}
              </CardContent>
            </Card>
            {q.isPending && <p>Memuat…</p>}
            {q.isError && (
              <p role="alert" className="text-sm text-destructive">
                {q.error.message}
              </p>
            )}
            {(q.data ?? []).map((row: any) => (
              <Card key={row.id}>
                <CardContent className="space-y-2 p-4">
                  <div className="flex items-start justify-between gap-2">
                    <h2 className="text-sm font-bold">{row.title}</h2>
                    {tab !== "jadwal" && (
                      <span className="text-xs text-muted-foreground">
                        {row.is_published ? "Terbit" : "Draft"}
                      </span>
                    )}
                  </div>
                  <p className="whitespace-pre-wrap text-xs text-muted-foreground">
                    {row.description || row.body || row.location_label}
                  </p>
                  {row.starts_at && (
                    <p className="text-xs">{sessionTime(row.starts_at, row.ends_at)}</p>
                  )}
                  {row.due_at && (
                    <p className="text-xs">Batas: {new Date(row.due_at).toLocaleString("id-ID")}</p>
                  )}
                  <div className="flex flex-wrap gap-2">
                    <Button size="sm" variant="outline" disabled={busy} onClick={() => edit(row)}>
                      <Pencil className="size-3.5" />
                      Edit
                    </Button>
                    {(tab === "materi" || tab === "tugas") && (
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={busy}
                        onClick={() => edit(row, true)}
                      >
                        <Copy className="size-3.5" /> Duplikat
                      </Button>
                    )}
                    {tab === "quiz" && (
                      <Button size="sm" asChild>
                        <Link
                          to="/guru-kelas/$classId/quiz/$quizId"
                          params={{ classId, quizId: row.id }}
                        >
                          <FileQuestion className="size-3.5" /> Kelola Soal
                        </Link>
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={busy}
                      onClick={() => {
                        if (window.confirm("Hapus " + row.title + "?")) remove.mutate(row);
                      }}
                    >
                      <Trash2 className="size-3.5" /> Hapus
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
            {q.isSuccess && q.data?.length === 0 && (
              <p className="text-xs text-muted-foreground">Belum ada {tab}.</p>
            )}
          </>
        )}
      </div>
    </AppShell>
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
