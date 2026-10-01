import { createFileRoute, Link, Outlet, useRouterState } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { ArrowRight, BookOpen, ChevronLeft, GraduationCap, Search, Sparkles, Users } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/kelas")({ component: KelasRoute });

function KelasRoute() {
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  return pathname.replace(/\/$/, "") === "/kelas" ? <KelasPage /> : <Outlet />;
}

function KelasPage() {
  const rate = useQuery({
    queryKey: ["jpy-idr-rate"],
    queryFn: async () => {
      const response = await fetch("https://api.frankfurter.dev/v2/rate/jpy/idr");
      if (!response.ok) throw new Error("Kurs rupiah belum tersedia");
      const result = await response.json();
      return Number(result.rate);
    },
    staleTime: 24 * 60 * 60 * 1000,
  });

  const classes = useQuery({
    queryKey: ["published-classes"],
    queryFn: async () => {
      const [{ data, error }, { data: counts, error: countError }] = await Promise.all([
        (supabase as any).rpc("get_public_classes"),
        (supabase as any).rpc("get_public_class_enrollment_counts"),
      ]);
      if (error) throw error;
      if (countError) throw countError;
      const byClass = new Map(
        (counts ?? []).map((row: any) => [row.class_id, Number(row.participant_count)] as const),
      );
      return (data ?? []).map((row: any) => ({
        ...row,
        participant_count: byClass.get(row.id) ?? 0,
      }));
    },
  });

  const [search, setSearch] = useState("");
  const visibleClasses = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return classes.data ?? [];
    return (classes.data ?? []).filter((c: any) =>
      [c.title, c.level, c.description].some((value) =>
        String(value ?? "").toLowerCase().includes(q),
      ),
    );
  }, [classes.data, search]);

  return (
    <AppShell title="Kelas" focus>
      <div className="-mx-3 -mt-3 min-h-[100dvh] bg-muted/20">
        <header className="sticky top-0 z-20 border-b bg-background/95 px-4 py-3 backdrop-blur">
          <div className="mx-auto flex max-w-5xl items-center justify-between">
            <Link to="/dashboard" aria-label="Kembali ke beranda" className="grid size-10 place-items-center rounded-full border bg-background hover:bg-muted">
              <ChevronLeft className="size-5" />
            </Link>
            <div className="text-center">
              <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-primary">ENO NIHONGO</p>
              <h1 className="text-lg font-black">Kelas</h1>
            </div>
            <Button size="sm" variant="outline" asChild className="h-10 rounded-full px-3 text-xs font-bold">
              <Link to="/kelas-saya"><GraduationCap className="mr-1.5 size-4" />Kelas Saya</Link>
            </Button>
          </div>
        </header>

        <main className="mx-auto max-w-5xl space-y-5 px-4 py-5 pb-10">
          <section className="overflow-hidden rounded-3xl border bg-gradient-to-br from-primary/15 via-background to-background p-5 shadow-sm sm:p-7">
            <div className="max-w-2xl">
              <div className="mb-3 inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1 text-[11px] font-bold text-primary">
                <Sparkles className="size-3.5" /> Belajar bersama guru
              </div>
              <h2 className="text-2xl font-black tracking-tight sm:text-3xl">Temukan kelas yang sesuai target JLPT Anda</h2>
              <p className="mt-2 max-w-xl text-sm leading-6 text-muted-foreground">Belajar lebih terarah melalui materi, tugas, kuis, jadwal, dan pendampingan guru dalam satu ruang kelas.</p>
            </div>
            <div className="relative mt-5">
              <Search className="absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <input value={search} onChange={(e)=>setSearch(e.target.value)} placeholder="Cari kelas atau level JLPT" className="h-12 w-full rounded-2xl border bg-background pl-10 pr-4 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/15" />
            </div>
          </section>

          <section aria-labelledby="available-courses">
            <div className="mb-3 flex items-end justify-between gap-3">
              <div>
                <h2 id="available-courses" className="text-lg font-black">Kelas tersedia</h2>
                <p className="text-xs text-muted-foreground">{classes.isLoading ? "Memuat kelas…" : `${visibleClasses.length} kelas dapat dipilih`}</p>
              </div>
              <BookOpen className="size-5 text-primary" />
            </div>

            {classes.isError && <div className="rounded-2xl border bg-card p-5 text-sm text-destructive">Kelas gagal dimuat. Silakan coba lagi.</div>}
            <div className="grid gap-3 sm:grid-cols-2">
              {visibleClasses.map((c: any) => (
                <Link key={c.id} to="/kelas/$classId" params={{ classId: c.id }} aria-label={`Lihat detail kelas ${c.title}`} className="group overflow-hidden rounded-2xl border bg-card shadow-sm transition hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">
                  <article>
                    <div className="relative aspect-[16/7] overflow-hidden bg-primary/10">
                      {c.banner_url ? <img src={c.banner_url} alt="" loading="lazy" className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.02]" /> : <div className="grid h-full place-items-center"><GraduationCap className="size-9 text-primary" /></div>}
                      <span className="absolute left-3 top-3 rounded-full bg-background/90 px-2.5 py-1 text-[10px] font-black shadow-sm backdrop-blur">JLPT {c.level}</span>
                    </div>
                    <div className="p-4">
                      <h3 className="line-clamp-2 min-h-10 text-[15px] font-black leading-5">{c.title}</h3>
                      <p className="mt-1 line-clamp-2 min-h-8 text-xs leading-4 text-muted-foreground">{c.description || "Belajar terarah bersama guru ENO NIHONGO."}</p>
                      <div className="mt-4 flex items-end justify-between gap-3 border-t pt-3">
                        <div>
                          <p className="flex items-center gap-1.5 text-[10px] text-muted-foreground"><Users className="size-3" />{c.participant_count} peserta</p>
                          <strong className="mt-1 block text-base font-black text-primary">{formatPrice(c, rate.data)}</strong>
                        </div>
                        <span className="inline-flex items-center gap-1 text-xs font-bold text-primary">Lihat kelas <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5" /></span>
                      </div>
                    </div>
                  </article>
                </Link>
              ))}
            </div>

            {!classes.isLoading && !visibleClasses.length && (
              <div className="rounded-2xl border border-dashed bg-card p-8 text-center">
                <GraduationCap className="mx-auto size-8 text-muted-foreground" />
                <p className="mt-3 text-sm font-bold">{search ? "Kelas tidak ditemukan" : "Belum ada kelas yang dipublikasikan"}</p>
                <p className="mt-1 text-xs text-muted-foreground">{search ? "Coba kata kunci atau level JLPT lain." : "Kelas baru akan tampil di sini setelah dipublikasikan."}</p>
              </div>
            )}
          </section>
        </main>
      </div>
    </AppShell>
  );
}

function formatPrice(c: any, rate?: number) {
  if (Number(c.price) <= 0) return "Gratis";
  if (c.currency === "JPY")
    return rate
      ? "≈ " +
          new Intl.NumberFormat("id-ID", {
            style: "currency",
            currency: "IDR",
            maximumFractionDigits: 0,
          }).format(Number(c.price) * rate)
      : "Kurs belum tersedia";
  if (c.currency === "IDR")
    return new Intl.NumberFormat("id-ID", {
      style: "currency",
      currency: "IDR",
      maximumFractionDigits: 0,
    }).format(Number(c.price));
  return c.currency + " " + Number(c.price).toLocaleString("id-ID");
}
