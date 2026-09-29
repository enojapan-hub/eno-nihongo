import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { GraduationCap, ArrowRight } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";
import { classroom, result, sessionTime } from "@/lib/classroom";
export const Route = createFileRoute("/_authenticated/kelas-saya")({ component: Page });
type MyClass = {
  id: string;
  title: string;
  level: string;
  banner_url: string | null;
  starts_at: string | null;
  status: string;
};
function Page() {
  const [filter, setFilter] = useState("aktif");
  const q = useQuery({
    queryKey: ["my-classes"],
    queryFn: () => result<MyClass[]>(classroom.rpc("get_my_classes")),
  });
  const classes = q.data ?? [];
  const visible = classes.filter((c) =>
    filter === "arsip" ? c.status === "closed" : c.status !== "closed",
  );
  return (
    <AppShell title="Kelas Saya" backTo="/kelas">
      <div className="mx-auto max-w-3xl space-y-4">
        <div>
          <h1 className="text-xl font-black">Kelas Saya</h1>
          <p className="text-sm text-muted-foreground">
            Buka kelas untuk melihat jadwal, materi, tugas, dan nilai Anda.
          </p>
        </div>
        <nav className="flex gap-2" aria-label="Filter kelas">
          {[
            ["aktif", "Aktif"],
            ["arsip", "Arsip"],
          ].map(([id, label]) => (
            <Button
              key={id}
              size="sm"
              variant={filter === id ? "default" : "outline"}
              aria-pressed={filter === id}
              onClick={() => setFilter(id!)}
            >
              {label} (
              {
                classes.filter((c) =>
                  id === "arsip" ? c.status === "closed" : c.status !== "closed",
                ).length
              }
              )
            </Button>
          ))}
        </nav>
        {q.isPending && <p role="status">Memuat kelas…</p>}
        {q.isError && (
          <div role="alert" className="space-y-2">
            <p className="text-sm text-destructive">Daftar kelas gagal dimuat.</p>
            <Button size="sm" variant="outline" onClick={() => void q.refetch()}>
              Coba Lagi
            </Button>
          </div>
        )}
        {q.isSuccess && (
          <div className="grid gap-3 sm:grid-cols-2">
            {visible.map((c) => (
              <Link
                key={c.id}
                to="/kelas/$classId/workspace"
                params={{ classId: c.id }}
                className="flex gap-3 rounded-2xl border bg-card p-3 transition-colors hover:border-primary focus-visible:outline-2 focus-visible:outline-primary"
              >
                {c.banner_url ? (
                  <img
                    src={c.banner_url}
                    alt=""
                    loading="lazy"
                    className="size-16 shrink-0 rounded-xl object-cover"
                  />
                ) : (
                  <span className="grid size-16 shrink-0 place-items-center rounded-xl bg-primary/10">
                    <GraduationCap className="text-primary" />
                  </span>
                )}
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-bold text-primary">
                    {c.level} · {c.status === "closed" ? "Diarsipkan" : "Aktif"}
                  </p>
                  <h2 className="line-clamp-2 text-sm font-bold">{c.title}</h2>
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    {c.status === "closed"
                      ? "Materi dan riwayat nilai tetap dapat dibuka."
                      : c.starts_at
                        ? "Mulai: " + sessionTime(c.starts_at)
                        : "Jadwal menyusul"}
                  </p>
                  <span className="mt-2 inline-flex items-center gap-1 text-xs font-bold text-primary">
                    Buka Ruang Kelas <ArrowRight className="size-3" />
                  </span>
                </div>
              </Link>
            ))}
            {!visible.length && (
              <div className="space-y-3 rounded-xl bg-muted p-4 sm:col-span-2">
                <p className="text-sm">
                  {filter === "arsip"
                    ? "Belum ada kelas yang diarsipkan."
                    : "Anda belum memiliki kelas aktif."}
                </p>
                {filter === "aktif" && (
                  <Button size="sm" asChild>
                    <Link to="/kelas">Cari Kelas</Link>
                  </Button>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </AppShell>
  );
}
