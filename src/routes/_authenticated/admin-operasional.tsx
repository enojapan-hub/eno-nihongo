import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import {
  CheckCircle2,
  FileWarning,
  Image,
  MessageSquareWarning,
  ShieldCheck,
  Sparkles,
  Search,
  Megaphone,
  Clock3,
} from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AdminSocialReports } from "@/components/social/AdminSocialReports";
import { supabase } from "@/integrations/supabase/client";
export const Route = createFileRoute("/_authenticated/admin-operasional")({
  validateSearch: (s: Record<string, unknown>) => ({
    tab: ["review", "laporan", "pengumuman", "media"].includes(String(s["tab"]))
      ? (String(s["tab"]) as "review" | "laporan" | "pengumuman" | "media")
      : "review",
  }),
  component: Page,
});
interface OpsStats {
  reports_open?: number;
  media?: number;
}
interface ReviewSummary {
  pending?: number;
  approved?: number;
  needs_fix?: number;
  reports_open?: number;
}
// Baris gabungan dari content_reports, admin_announcements, dan media_library.
interface OpsRow {
  id: string;
  title?: string | null;
  subject?: string | null;
  description?: string | null;
  body?: string | null;
  status?: string | null;
  audience?: string | null;
  category?: string | null;
  priority?: string | null;
  media_type?: string | null;
  url?: string | null;
}
function Page() {
  const qc = useQueryClient(),
    navigate = useNavigate({ from: "/admin-operasional" }),
    search = Route.useSearch(),
    tab = search.tab,
    [title, setTitle] = useState(""),
    [body, setBody] = useState(""),
    [searchText, setSearchText] = useState(""),
    [statusFilter, setStatusFilter] = useState("all"),
    [audience, setAudience] = useState("all");
  const stats = useQuery({
    queryKey: ["ops-stats"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_operations_console");
      if (error) throw error;
      return data as unknown as OpsStats;
    },
    retry: false,
  });
  const reviews = useQuery({
    queryKey: ["content-review-summary"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_content_review_summary");
      if (error) throw error;
      return data as unknown as ReviewSummary;
    },
    retry: false,
  });
  const list = useQuery({
    queryKey: ["ops-list", tab],
    enabled: stats.isSuccess && tab !== "review",
    queryFn: async () => {
      if (tab === "laporan") {
        // content_reports tidak punya hak klien: moderator membaca lewat RPC (izin + batas di server).
        const { data, error } = await supabase.rpc(
          "admin_list_reports" as never,
          { p_limit: 100 } as never,
        );
        if (error) throw error;
        return (Array.isArray(data) ? data : []) as unknown as OpsRow[];
      }
      const table = tab === "pengumuman" ? "admin_announcements" : "media_library";
      const { data, error } = await supabase
        .from(table)
        .select("*")
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return (data || []) as unknown as OpsRow[];
    },
  });
  const filtered = useMemo(
    () =>
      (list.data || []).filter((x) => {
        // Laporan chat ditangani di antrean moderasi sosial (izin + audit di server), bukan di daftar umum.
        if (tab === "laporan" && x.category === "chat") return false;
        const q = searchText.toLowerCase();
        if (
          q &&
          !String(x.title || x.subject || "")
            .toLowerCase()
            .includes(q) &&
          !String(x.description || x.body || "")
            .toLowerCase()
            .includes(q)
        )
          return false;
        if (statusFilter !== "all" && x.status !== statusFilter) return false;
        return true;
      }),
    [list.data, searchText, statusFilter, tab],
  );
  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["ops-list"] });
    qc.invalidateQueries({ queryKey: ["ops-stats"] });
  };
  async function add() {
    if (!title.trim() || !body.trim()) return;
    const { error } = await supabase
      .from("admin_announcements")
      .insert({ title: title.trim(), body: body.trim(), status: "draft", audience });
    if (error) return alert(error.message);
    await supabase.rpc("admin_log_event", {
      p_action: "create_announcement",
      p_entity_type: "announcement",
      p_metadata: { title: title.trim(), audience },
    });
    setTitle("");
    setBody("");
    setAudience("all");
    refresh();
  }
  async function publish(id: string) {
    const { error } = await supabase.rpc("publish_admin_announcement", { p_id: id });
    if (error) return alert(error.message);
    refresh();
  }
  async function del(id: string) {
    if (!confirm("Hapus pengumuman ini?")) return;
    const { error } = await supabase.rpc("delete_admin_announcement", { p_id: id });
    if (error) return alert(error.message);
    refresh();
  }
  async function report(id: string, status: string) {
    const resolution_note =
      status === "resolved" ? prompt("Catatan penyelesaian (opsional):") || null : null;
    const { error } = await supabase.rpc(
      "admin_update_report" as never,
      { p_id: id, p_status: status, p_note: resolution_note } as never,
    );
    if (error) return alert(error.message);
    refresh();
  }
  if (stats.isLoading)
    return (
      <AppShell title="Operasional" backTo="/admin">
        <p className="p-4 text-xs">Memeriksa akses…</p>
      </AppShell>
    );
  if (stats.isError)
    return (
      <AppShell title="Operasional" backTo="/admin">
        <p className="p-4 text-xs text-destructive">Akses staf konten diperlukan.</p>
      </AppShell>
    );
  const s: OpsStats = stats.data || {};
  return (
    <AppShell title="Operasional" backTo="/admin">
      <div className="mx-auto w-full max-w-5xl space-y-4 pb-8">
        <section className="overflow-hidden rounded-[2rem] bg-gradient-to-br from-primary to-emerald-800 p-5 text-primary-foreground shadow-lg">
          <p className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest">
            <Sparkles className="size-4" />
            Operations Center
          </p>
          <h1 className="mt-2 text-2xl font-black">Kontrol Operasional</h1>
          <p className="mt-1 text-xs text-white/75">
            Review kualitas konten, laporan, pengumuman, dan media dalam satu tempat.
          </p>
        </section>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {(
            [
              ["Perlu Review", reviews.data?.pending, ShieldCheck],
              ["Perlu Perbaikan", reviews.data?.needs_fix, FileWarning],
              ["Laporan Aktif", reviews.data?.reports_open ?? s.reports_open, MessageSquareWarning],
              ["Media", s.media, Image],
            ] as const
          ).map(([a, b, I]) => (
            <Card key={a} className="overflow-hidden">
              <CardContent className="p-3">
                <div className="flex items-center justify-between">
                  <p className="text-[10px] font-bold text-muted-foreground">{a}</p>
                  <I className="size-4 text-primary" />
                </div>
                <p className="mt-2 text-2xl font-black">{String(b || 0)}</p>
              </CardContent>
            </Card>
          ))}
        </div>
        <div className="grid grid-cols-4 gap-1 rounded-2xl bg-muted/60 p-1">
          {(
            [
              ["review", "Review", ShieldCheck],
              ["laporan", "Laporan", MessageSquareWarning],
              ["pengumuman", "Pengumuman", Megaphone],
              ["media", "Media", Image],
            ] as const
          ).map(([id, l, I]) => (
            <button
              key={id}
              onClick={() => navigate({ search: { tab: id }, replace: true })}
              className={`flex min-w-0 flex-col items-center gap-1 rounded-xl px-1 py-2 text-[9px] font-bold transition sm:flex-row sm:justify-center sm:text-xs ${tab === id ? "bg-background text-primary shadow-sm" : "text-muted-foreground"}`}
            >
              <I className="size-4" />
              <span className="truncate">{l}</span>
            </button>
          ))}
        </div>
        {tab === "review" ? (
          <Card className="overflow-hidden">
            <CardContent className="p-5">
              <div className="flex items-start gap-3">
                <div className="rounded-2xl bg-primary/10 p-3">
                  <ShieldCheck className="size-6 text-primary" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-black">Review Konten</p>
                  <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                    Periksa kualitas materi berdasarkan status review, bukan status Draft/Published.
                  </p>
                </div>
              </div>
              <div className="mt-4 grid grid-cols-3 gap-2">
                {[
                  ["Menunggu", reviews.data?.pending],
                  ["Perbaiki", reviews.data?.needs_fix],
                  ["Disetujui", reviews.data?.approved],
                ].map(([a, b]) => (
                  <div key={a} className="rounded-2xl bg-muted/60 p-3 text-center">
                    <p className="text-lg font-black">{String(b || 0)}</p>
                    <p className="text-[9px] text-muted-foreground">{a}</p>
                  </div>
                ))}
              </div>
              <Button asChild className="mt-4 w-full rounded-xl">
                <Link to="/admin-konten">
                  <CheckCircle2 className="mr-2 size-4" />
                  Review Konten
                </Link>
              </Button>
            </CardContent>
          </Card>
        ) : tab === "pengumuman" ? (
          <>
            <Card>
              <CardContent className="space-y-2 p-4">
                <div className="flex items-center gap-2">
                  <Megaphone className="size-4 text-primary" />
                  <p className="text-sm font-black">Buat Pengumuman</p>
                </div>
                <Input
                  placeholder="Judul"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                />
                <textarea
                  className="min-h-24 w-full rounded-md border bg-background p-2 text-sm"
                  placeholder="Isi pengumuman"
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                />
                <div className="flex items-center gap-2">
                  <select
                    className="flex-1 rounded-md border bg-background p-2 text-xs"
                    value={audience}
                    onChange={(e) => setAudience(e.target.value)}
                  >
                    <option value="all">Semua pengguna</option>
                    <option value="premium">Premium</option>
                    <option value="teacher">Guru</option>
                  </select>
                  <Button size="sm" onClick={add}>
                    Simpan Draft
                  </Button>
                </div>
              </CardContent>
            </Card>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-2.5 size-4 text-muted-foreground" />
                <Input
                  className="pl-9"
                  placeholder="Cari pengumuman…"
                  value={searchText}
                  onChange={(e) => setSearchText(e.target.value)}
                />
              </div>
              <select
                className="rounded-md border bg-background px-2 text-xs"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
              >
                <option value="all">Semua</option>
                <option value="draft">Draft</option>
                <option value="published">Published</option>
              </select>
            </div>
            {filtered.map((x) => (
              <Card key={x.id}>
                <CardContent className="p-3">
                  <p className="text-xs font-bold">{x.title}</p>
                  <p className="my-1 text-[10px] text-muted-foreground">
                    {x.status} ·{" "}
                    {x.audience === "premium"
                      ? "Premium"
                      : x.audience === "teacher"
                        ? "Guru"
                        : "Semua pengguna"}
                  </p>
                  <p className="text-xs">{x.body}</p>
                  <div className="mt-2 flex gap-2">
                    {x.status !== "published" && (
                      <Button size="sm" onClick={() => publish(x.id)}>
                        Publish & Kirim
                      </Button>
                    )}
                    <Button size="sm" variant="outline" onClick={() => del(x.id)}>
                      Hapus
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </>
        ) : tab === "laporan" ? (
          <div className="space-y-2">
            <AdminSocialReports />
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-2.5 size-4 text-muted-foreground" />
                <Input
                  className="pl-9"
                  placeholder="Cari laporan…"
                  value={searchText}
                  onChange={(e) => setSearchText(e.target.value)}
                />
              </div>
              <select
                className="rounded-md border bg-background px-2 text-xs"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
              >
                <option value="all">Semua</option>
                <option value="open">Baru</option>
                <option value="reviewing">Diproses</option>
                <option value="resolved">Selesai</option>
              </select>
            </div>
            {tab === "laporan" && list.isError && (
              <p className="text-xs text-destructive" role="alert">
                Gagal memuat laporan.
              </p>
            )}
            {tab === "laporan" && list.isSuccess && filtered.length === 0 && (
              <p className="text-xs text-muted-foreground" role="status">
                Belum ada laporan.
              </p>
            )}
            {filtered.map((x) => (
              <Card key={x.id}>
                <CardContent className="p-3">
                  <p className="text-xs font-bold">{x.subject}</p>
                  <div className="my-1 flex items-center gap-2 text-[10px] text-muted-foreground">
                    <span>
                      {x.category} · {x.status}
                    </span>
                    <span
                      className={`rounded-full px-2 py-0.5 font-bold ${x.priority === "critical" ? "bg-destructive/10 text-destructive" : x.priority === "high" ? "bg-amber-500/10 text-amber-700" : "bg-muted"}`}
                    >
                      {x.priority || "normal"}
                    </span>
                  </div>
                  <p className="text-xs">{x.description}</p>
                  <div className="mt-2 flex gap-2">
                    {x.status !== "reviewing" && x.status !== "resolved" && (
                      <Button size="sm" variant="outline" onClick={() => report(x.id, "reviewing")}>
                        Tangani
                      </Button>
                    )}
                    {x.status !== "resolved" && (
                      <Button size="sm" onClick={() => report(x.id, "resolved")}>
                        Selesaikan
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <div className="space-y-2">
            <div className="relative">
              <Search className="absolute left-3 top-2.5 size-4 text-muted-foreground" />
              <Input
                className="pl-9"
                placeholder="Cari media…"
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
              />
            </div>
            {filtered.map((x) => (
              <Card key={x.id}>
                <CardContent className="p-3">
                  <p className="text-xs font-bold">{x.title}</p>
                  <p className="text-[10px] text-muted-foreground">{x.media_type}</p>
                  <a
                    className="text-[10px] text-primary"
                    href={x.url ?? undefined}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Buka media
                  </a>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </AppShell>
  );
}
