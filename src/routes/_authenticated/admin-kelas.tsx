import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { CalendarDays, CheckCircle2, Eye, Image, Users, XCircle } from "lucide-react";
import { useState } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/admin-kelas")({ component: Page });

type ClassStatus = "review" | "published" | "draft" | "rejected" | "pending_review" | string;
type ClassRow = {
  id: string;
  title: string;
  level: string;
  status: ClassStatus;
  price: number | string | null;
  currency: string | null;
  banner_url: string | null;
  description: string | null;
  class_mode: string | null;
  starts_at: string | null;
  ends_at: string | null;
  capacity: number | null;
  created_at: string;
};

const isWaitingForReview = (status: ClassStatus) =>
  status === "review" || status === "pending_review";
const dateTime = (value: string | null) =>
  value
    ? new Intl.DateTimeFormat("id-ID", {
        dateStyle: "medium",
        timeStyle: "short",
        timeZone: "Asia/Tokyo",
      }).format(new Date(value))
    : "Belum ditentukan";

function Page() {
  const qc = useQueryClient();
  const [filter, setFilter] = useState("review");
  const [reviewId, setReviewId] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [msg, setMsg] = useState("");

  const gate = useQuery({
    queryKey: ["admin-class-gate"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_admin_overview");
      if (error) throw error;
      return data;
    },
  });

  const q = useQuery({
    queryKey: ["admin-classes"],
    enabled: gate.isSuccess,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("classes")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as ClassRow[];
    },
  });

  async function updateStatus(id: string, value: "published" | "rejected") {
    setBusyId(id);
    setMsg("");
    const { data, error } = await supabase
      .from("classes")
      .update({ status: value, updated_at: new Date().toISOString() })
      .eq("id", id)
      .select("id")
      .maybeSingle();

    if (error || !data) {
      setMsg(error?.message || "Pengajuan tidak ditemukan atau status tidak berhasil diperbarui.");
      setBusyId(null);
      return;
    }

    setMsg(
      value === "published"
        ? "Pengajuan disetujui dan kelas dipublikasikan."
        : "Pengajuan kelas ditolak.",
    );
    setReviewId(null);
    await qc.invalidateQueries({ queryKey: ["admin-classes"] });
    setBusyId(null);
  }

  if (gate.isLoading) {
    return (
      <AppShell title="Kelas" backTo="/admin">
        <p className="p-4 text-xs">Memeriksa akses…</p>
      </AppShell>
    );
  }

  if (gate.isError) {
    return (
      <AppShell title="Kelas" backTo="/admin">
        <p className="p-4 text-xs text-destructive">Akses Admin diperlukan.</p>
      </AppShell>
    );
  }

  const all = q.data ?? [];
  const shown =
    filter === "all"
      ? all
      : filter === "review"
        ? all.filter((item) => isWaitingForReview(item.status))
        : all.filter((item) => item.status === filter);
  const count = (status: string) =>
    status === "review"
      ? all.filter((item) => isWaitingForReview(item.status)).length
      : all.filter((item) => item.status === status).length;

  return (
    <AppShell title="Kelas" backTo="/admin">
      <div className="space-y-4">
        <div>
          <h1 className="text-xl font-black">Kelola Kelas</h1>
          <p className="text-xs text-muted-foreground">
            Tinjau detail pengajuan guru sebelum menyetujui atau menolaknya.
          </p>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <Card>
            <CardContent className="p-4">
              <Image className="mb-2 size-5 text-primary" />
              <p className="font-bold">Banner Halaman Kelas</p>
              <p className="text-[10px] text-muted-foreground">
                Banner utama, CTA, periode tayang dan urutan.
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <Users className="mb-2 size-5 text-primary" />
              <p className="font-bold">Kelas Guru</p>
              <p className="text-[10px] text-muted-foreground">
                {all.length} kelas · {count("review")} menunggu review.
              </p>
            </CardContent>
          </Card>
        </div>

        <div className="flex gap-2 overflow-x-auto">
          {(
            [
              ["review", "Menunggu Review"],
              ["published", "Published"],
              ["draft", "Draft"],
              ["rejected", "Ditolak"],
              ["all", "Semua"],
            ] as const
          ).map(([id, label]) => (
            <Button
              key={id}
              size="sm"
              variant={filter === id ? "default" : "outline"}
              onClick={() => setFilter(id)}
            >
              {label}
              {id !== "all" ? ` (${count(id)})` : ""}
            </Button>
          ))}
        </div>

        {msg && (
          <p className="rounded-xl bg-muted p-3 text-xs" role="status">
            {msg}
          </p>
        )}
        {q.isError && <p className="text-xs text-destructive">Daftar kelas gagal dimuat.</p>}
        {q.isLoading && (
          <p className="py-6 text-center text-xs text-muted-foreground">Memuat pengajuan kelas…</p>
        )}

        <div className="space-y-2">
          {shown.map((c) => {
            const isOpen = reviewId === c.id;
            const isBusy = busyId === c.id;
            return (
              <Card key={c.id}>
                <CardContent className="space-y-3 p-3">
                  <div className="flex items-center gap-3">
                    {c.banner_url && (
                      <img
                        src={c.banner_url}
                        className="h-14 w-24 rounded-xl object-cover"
                        alt={`Banner ${c.title}`}
                      />
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs font-bold">{c.title}</p>
                      <p className="text-[10px] text-muted-foreground">
                        {c.level} · {c.status} ·{" "}
                        {Number(c.price) > 0 ? `${c.currency || "JPY"} ${c.price}` : "Gratis"}
                      </p>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      aria-expanded={isOpen}
                      onClick={() => setReviewId(isOpen ? null : c.id)}
                    >
                      <Eye className="mr-1 size-3" />
                      {isOpen ? "Tutup Detail" : "Tinjau"}
                    </Button>
                  </div>

                  {isOpen && (
                    <div className="space-y-3 rounded-xl bg-muted/50 p-3 text-xs">
                      {c.banner_url && (
                        <img
                          src={c.banner_url}
                          alt={`Banner kelas ${c.title}`}
                          className="max-h-48 w-full rounded-lg object-cover"
                        />
                      )}
                      <div>
                        <p className="font-bold">Deskripsi kelas</p>
                        <p className="mt-1 whitespace-pre-wrap text-muted-foreground">
                          {c.description || "Tidak ada deskripsi."}
                        </p>
                      </div>
                      <div className="grid gap-2 sm:grid-cols-2">
                        <p>
                          <span className="font-bold">Mode:</span>{" "}
                          {c.class_mode || "Belum ditentukan"}
                        </p>
                        <p>
                          <span className="font-bold">Kapasitas:</span>{" "}
                          {c.capacity ?? "Tidak dibatasi"}
                        </p>
                        <p className="flex items-center gap-1">
                          <CalendarDays className="size-3" />
                          Mulai: {dateTime(c.starts_at)}
                        </p>
                        <p className="flex items-center gap-1">
                          <CalendarDays className="size-3" />
                          Selesai: {dateTime(c.ends_at)}
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-2 border-t pt-3">
                        {c.status !== "published" && (
                          <Button
                            size="sm"
                            disabled={isBusy}
                            onClick={() => updateStatus(c.id, "published")}
                          >
                            <CheckCircle2 className="mr-1 size-3" />
                            {isBusy ? "Menyimpan…" : "Setujui & Publikasikan"}
                          </Button>
                        )}
                        {c.status !== "rejected" && (
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={isBusy}
                            onClick={() => updateStatus(c.id, "rejected")}
                          >
                            <XCircle className="mr-1 size-3" />
                            Tolak Pengajuan
                          </Button>
                        )}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
          {!q.isLoading && !q.isError && shown.length === 0 && (
            <p className="rounded-xl bg-muted p-4 text-xs text-muted-foreground">
              Tidak ada kelas pada status ini.
            </p>
          )}
        </div>
      </div>
    </AppShell>
  );
}
