import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Bell,
  BellRing,
  BookOpen,
  CheckCheck,
  ChevronRight,
  CircleAlert,
  Clock3,
  Gift,
  GraduationCap,
  Info,
  Megaphone,
  ShieldAlert,
  Sparkles,
  Target,
  Trash2,
} from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/notifikasi")({
  component: NotificationsPage,
});

type NotificationRow = {
  id: string;
  title: string;
  body: string;
  kind: string;
  action_url: string | null;
  read_at: string | null;
  created_at: string;
};
async function fetchNotifications(): Promise<NotificationRow[]> {
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return [];
  const { data, error } = await supabase
    .from("user_notifications" as never)
    .select("id,title,body,kind,action_url,read_at,created_at")
    .eq("user_id", auth.user.id)
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as NotificationRow[];
}
function metaFor(kind: string) {
  const k = kind.toLowerCase();
  if (["urgent", "critical", "deadline", "warning"].includes(k))
    return {
      Icon: ShieldAlert,
      label: "Penting",
      tone: "border-red-500/25 bg-red-500/[.06]",
      icon: "bg-red-500/10 text-red-600",
    };
  if (["class", "kelas", "teacher"].includes(k))
    return {
      Icon: GraduationCap,
      label: "Kelas",
      tone: "border-blue-500/20 bg-blue-500/[.04]",
      icon: "bg-blue-500/10 text-blue-600",
    };
  if (["assignment", "task", "quiz"].includes(k))
    return {
      Icon: BookOpen,
      label: "Tugas",
      tone: "border-amber-500/20 bg-amber-500/[.04]",
      icon: "bg-amber-500/10 text-amber-600",
    };
  if (["reward", "premium"].includes(k))
    return {
      Icon: Gift,
      label: "Hadiah",
      tone: "border-violet-500/20 bg-violet-500/[.04]",
      icon: "bg-violet-500/10 text-violet-600",
    };
  if (k === "target")
    return {
      Icon: Target,
      label: "Target",
      tone: "border-emerald-500/20 bg-emerald-500/[.04]",
      icon: "bg-emerald-500/10 text-emerald-600",
    };
  if (["announcement", "system"].includes(k))
    return {
      Icon: Megaphone,
      label: "Sistem",
      tone: "border-primary/20 bg-primary/[.035]",
      icon: "bg-primary/10 text-primary",
    };
  return {
    Icon: Info,
    label: "Info",
    tone: "border-border bg-card",
    icon: "bg-muted text-muted-foreground",
  };
}
function dayGroup(value: string) {
  const d = new Date(value),
    now = new Date(),
    today = new Date(now.getFullYear(), now.getMonth(), now.getDate()),
    target = new Date(d.getFullYear(), d.getMonth(), d.getDate()),
    diff = Math.round((today.getTime() - target.getTime()) / 86400000);
  return diff === 0 ? "Hari ini" : diff === 1 ? "Kemarin" : "Sebelumnya";
}

function NotificationsPage() {
  const [filter, setFilter] = useState<"all" | "unread">("all");
  const qc = useQueryClient();
  const query = useQuery({
    queryKey: ["notifications"],
    queryFn: fetchNotifications,
    staleTime: 10000,
  });
  const refresh = () => qc.invalidateQueries({ queryKey: ["notifications"] });
  const markRead = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("user_notifications" as never)
        .update({ read_at: new Date().toISOString() } as never)
        .eq("id", id);
      if (error) throw new Error(error.message);
    },
    onSuccess: refresh,
  });
  const markAll = useMutation({
    mutationFn: async () => {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) return;
      const { error } = await supabase
        .from("user_notifications" as never)
        .update({ read_at: new Date().toISOString() } as never)
        .eq("user_id", auth.user.id)
        .is("read_at", null);
      if (error) throw new Error(error.message);
    },
    onSuccess: refresh,
  });
  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.rpc(
        "delete_my_notification" as never,
        { p_notification_id: id } as never,
      );
      if (error) throw new Error(error.message);
    },
    onMutate: async (id: string) => {
      await qc.cancelQueries({ queryKey: ["notifications"] });
      const previous = qc.getQueryData<NotificationRow[]>(["notifications"]);
      qc.setQueryData<NotificationRow[]>(["notifications"], (rows) =>
        (rows ?? []).filter((n) => n.id !== id),
      );
      return { previous };
    },
    onError: (_error, _id, context) => {
      if (context?.previous) qc.setQueryData(["notifications"], context.previous);
      toast.error("Pemberitahuan gagal dihapus. Coba lagi.");
    },
    onSettled: refresh,
  });
  const removeRead = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc("delete_my_read_notifications" as never);
      if (error) throw new Error(error.message);
    },
    onError: () => toast.error("Pemberitahuan gagal dihapus. Coba lagi."),
    onSettled: refresh,
  });
  const rows = query.data ?? [],
    unread = rows.filter((n) => !n.read_at).length,
    readCount = rows.length - unread,
    visible = filter === "unread" ? rows.filter((n) => !n.read_at) : rows;
  const groups = ["Hari ini", "Kemarin", "Sebelumnya"]
    .map((label) => ({ label, rows: visible.filter((n) => dayGroup(n.created_at) === label) }))
    .filter((g) => g.rows.length);
  return (
    <AppShell title="Pemberitahuan" backTo="/dashboard" backLabel="Home" compact>
      <div className="mx-auto max-w-xl space-y-4">
        <section className="overflow-hidden rounded-[1.8rem] border border-primary/15 bg-gradient-to-br from-primary/[.12] via-background to-background p-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[9px] font-black uppercase tracking-[.15em] text-primary">
                Pusat Aktivitas
              </p>
              <h1 className="mt-1 text-[21px] font-black">Pemberitahuan</h1>
              <p className="mt-1 text-[10px] text-muted-foreground">
                {unread ? unread + " pemberitahuan belum dibaca" : "Semua sudah dibaca"}
              </p>
            </div>
            <span className="relative grid size-11 place-items-center rounded-2xl bg-primary/10 text-primary">
              <BellRing className="size-5" />
              {unread > 0 && (
                <span className="absolute -right-1 -top-1 grid min-w-5 place-items-center rounded-full bg-destructive px-1 text-[8px] font-black leading-5 text-destructive-foreground">
                  {unread > 9 ? "9+" : unread}
                </span>
              )}
            </span>
          </div>
          <div className="mt-4 flex items-center gap-2">
            <div className="flex flex-1 rounded-xl bg-muted/70 p-1">
              <button
                onClick={() => setFilter("all")}
                className={
                  "flex-1 rounded-lg py-2 text-[9px] font-bold " +
                  (filter === "all"
                    ? "bg-background text-primary shadow-sm"
                    : "text-muted-foreground")
                }
              >
                Semua
              </button>
              <button
                onClick={() => setFilter("unread")}
                className={
                  "flex-1 rounded-lg py-2 text-[9px] font-bold " +
                  (filter === "unread"
                    ? "bg-background text-primary shadow-sm"
                    : "text-muted-foreground")
                }
              >
                Belum Dibaca
              </button>
            </div>
            {unread > 0 && (
              <Button
                variant="outline"
                size="sm"
                className="h-9 rounded-xl px-3 text-[9px]"
                onClick={() => markAll.mutate()}
                disabled={markAll.isPending}
              >
                <CheckCheck className="mr-1 size-3" />
                Baca semua
              </Button>
            )}
          </div>
          {readCount > 0 && (
            <button
              onClick={() => {
                if (window.confirm("Hapus semua pemberitahuan yang sudah dibaca?"))
                  removeRead.mutate();
              }}
              disabled={removeRead.isPending}
              className="mt-3 inline-flex items-center gap-1.5 text-[8px] font-bold text-muted-foreground hover:text-destructive"
            >
              <Trash2 className="size-3" />
              Hapus semua yang sudah dibaca
            </button>
          )}
        </section>
        {query.isLoading ? (
          <Card className="rounded-2xl">
            <CardContent className="py-10 text-center text-[10px] text-muted-foreground">
              Memuat pemberitahuan…
            </CardContent>
          </Card>
        ) : query.isError ? (
          <Card className="rounded-2xl">
            <CardContent className="py-8 text-center text-[10px] text-destructive">
              <CircleAlert className="mx-auto mb-2 size-5" />
              Pemberitahuan gagal dimuat.
            </CardContent>
          </Card>
        ) : groups.length === 0 ? (
          <Card className="rounded-[1.6rem]">
            <CardContent className="py-12 text-center">
              <span className="mx-auto grid size-12 place-items-center rounded-2xl bg-muted">
                <Bell className="size-5 text-muted-foreground" />
              </span>
              <p className="mt-3 text-[11px] font-bold">
                {filter === "unread" ? "Tidak ada yang terlewat" : "Belum ada pemberitahuan"}
              </p>
              <p className="mt-1 text-[9px] text-muted-foreground">
                {filter === "unread"
                  ? "Semua pemberitahuan sudah dibaca."
                  : "Aktivitas penting akan muncul di sini."}
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-5">
            {groups.map((group) => (
              <section key={group.label}>
                <div className="mb-2 flex items-center gap-2 px-1">
                  <Clock3 className="size-3 text-muted-foreground" />
                  <h2 className="text-[10px] font-black text-muted-foreground">{group.label}</h2>
                </div>
                <div className="space-y-2">
                  {group.rows.map((row) => {
                    const m = metaFor(row.kind),
                      Icon = m.Icon;
                    const content = (
                      <>
                        <span
                          className={
                            "grid size-10 shrink-0 place-items-center rounded-xl " + m.icon
                          }
                        >
                          <Icon className="size-4" />
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5">
                            <span className="text-[7px] font-black uppercase tracking-wide text-muted-foreground">
                              {m.label}
                            </span>
                            {!row.read_at && <span className="size-1.5 rounded-full bg-primary" />}
                          </div>
                          <p className="mt-0.5 text-[11px] font-bold leading-4">{row.title}</p>
                          <p className="mt-1 text-[9px] leading-4 text-muted-foreground">
                            {row.body}
                          </p>
                          <p className="mt-1.5 text-[8px] text-muted-foreground">
                            {new Date(row.created_at).toLocaleString("id-ID", {
                              dateStyle: "medium",
                              timeStyle: "short",
                            })}
                          </p>
                        </div>
                        {row.action_url && (
                          <ChevronRight className="mt-3 size-4 shrink-0 text-muted-foreground" />
                        )}
                      </>
                    );
                    const mainClass = "flex min-w-0 flex-1 items-start gap-3 text-left";
                    // Hapus adalah saudara (bukan anak) dari area klik utama: <button>/<a> bersarang
                    // tidak valid dan di Safari/Firefox klik pada tombol dalam diarahkan ke tombol luar.
                    return (
                      <div
                        key={row.id}
                        className={
                          "flex items-start gap-1 rounded-2xl border p-3 transition " +
                          (!row.read_at ? m.tone : "bg-card")
                        }
                      >
                        {row.action_url ? (
                          <Link
                            to={row.action_url as "/dashboard"}
                            className={mainClass}
                            onClick={() => {
                              if (!row.read_at) markRead.mutate(row.id);
                            }}
                          >
                            {content}
                          </Link>
                        ) : (
                          <button
                            type="button"
                            className={mainClass}
                            onClick={() => {
                              if (!row.read_at) markRead.mutate(row.id);
                            }}
                          >
                            {content}
                          </button>
                        )}
                        <button
                          type="button"
                          aria-label="Hapus pemberitahuan"
                          onClick={() => {
                            if (window.confirm("Hapus pemberitahuan ini?")) remove.mutate(row.id);
                          }}
                          disabled={remove.isPending}
                          className="grid size-9 shrink-0 place-items-center rounded-xl text-muted-foreground transition hover:bg-destructive/10 hover:text-destructive disabled:opacity-50"
                        >
                          <Trash2 className="size-3.5" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              </section>
            ))}
          </div>
        )}
        <Card className="rounded-2xl border-primary/10 bg-primary/[.025]">
          <CardContent className="flex gap-3 p-3">
            <Sparkles className="mt-0.5 size-3.5 shrink-0 text-primary" />
            <p className="text-[8px] leading-4 text-muted-foreground">
              Deadline, tugas, kelas, hadiah, dan pengumuman sistem menggunakan penanda berbeda agar
              informasi penting mudah dikenali.
            </p>
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
