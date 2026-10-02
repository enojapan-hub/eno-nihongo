import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { GraduationCap, ArrowRight, BookOpenText, CalendarDays, Layers3 } from "lucide-react";
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
      <div className="mx-auto max-w-4xl space-y-5">
        <section className="overflow-hidden rounded-3xl border bg-gradient-to-br from-primary/15 via-card to-card p-5 shadow-sm sm:p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-primary">
                Ruang belajar
              </p>
              <h1 className="mt-1 text-2xl font-black">Kelas Saya</h1>
              <p className="mt-2 max-w-xl text-sm leading-6 text-muted-foreground">
                Lanjutkan kelas, periksa jadwal, tugas, kuis, dan hasil belajar Anda dari satu
                tempat.
              </p>
            </div>
            <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-primary/10 text-primary">
              <GraduationCap className="size-5" />
            </span>
          </div>
          <div className="mt-5 grid grid-cols-3 gap-2">
            <Summary
              icon={Layers3}
              label="Aktif"
              value={classes.filter((c) => c.status !== "closed").length}
            />
            <Summary
              icon={BookOpenText}
              label="Arsip"
              value={classes.filter((c) => c.status === "closed").length}
            />
            <Summary icon={CalendarDays} label="Total" value={classes.length} />
          </div>
        </section>
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
                className="group overflow-hidden rounded-2xl border bg-card shadow-sm transition hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md focus-visible:outline-2 focus-visible:outline-primary"
              >
                <div className="flex gap-3 p-3">
                  {c.banner_url ? (
                    <img
                      src={c.banner_url}
                      alt=""
                      loading="lazy"
                      className="h-24 w-28 shrink-0 rounded-xl object-cover"
                    />
                  ) : (
                    <span className="grid h-24 w-28 shrink-0 place-items-center rounded-xl bg-primary/10">
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
                        ? "Kelas selesai · materi, tugas, kuis, dan nilai tetap tersedia."
                        : c.starts_at
                          ? "Mulai: " + sessionTime(c.starts_at)
                          : "Jadwal menyusul"}
                    </p>
                    <span className="mt-2 inline-flex items-center gap-1 text-xs font-bold text-primary">
                      {c.status === "closed" ? "Lihat Arsip Kelas" : "Lanjutkan Kelas"}{" "}
                      <ArrowRight className="size-3" />
                    </span>
                  </div>
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

function Summary({ icon: Icon, label, value }: { icon: any; label: string; value: number }) {
  return (
    <div className="rounded-2xl border bg-background/70 p-3">
      <Icon className="size-4 text-primary" />
      <p className="mt-2 text-[10px] text-muted-foreground">{label}</p>
      <p className="text-lg font-black">{value}</p>
    </div>
  );
}
