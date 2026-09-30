import { createFileRoute, Link, Outlet, useRouterState } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, ChevronLeft, GraduationCap, Users } from "lucide-react";
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

  return (
    <AppShell title="Kursus" focus>
      <div className="-mx-3 -mt-3 min-h-[100dvh] bg-[#f7f8f7] text-[#394247] dark:bg-background dark:text-foreground">
        <header className="relative flex h-16 items-center justify-center border-b border-black/5 bg-white px-4 dark:border-border dark:bg-background">
          <Link
            to="/dashboard"
            aria-label="Kembali ke beranda"
            className="absolute left-3 rounded-full p-2 hover:bg-black/5 focus-visible:outline-2 focus-visible:outline-primary dark:hover:bg-white/10"
          >
            <ChevronLeft className="size-6 stroke-[2.5]" />
          </Link>
          <h1 className="text-[22px] font-black tracking-tight">Kursus</h1>
          <Button
            size="sm"
            variant="ghost"
            asChild
            className="absolute right-2 text-[11px] font-bold text-primary"
          >
            <Link to="/kelas-saya">
              <GraduationCap className="mr-1 size-3.5" />
              Kelas Saya
            </Link>
          </Button>
        </header>
        <div className="space-y-5 px-4 py-5">
          <section aria-labelledby="available-courses">
            <h2 id="available-courses" className="mb-3 text-[16px] font-black">
              Kursus tersedia
            </h2>
            <div className="space-y-3">
              {(classes.data ?? []).map((c: any) => (
                <Link
                  key={c.id}
                  to="/kelas/$classId"
                  params={{ classId: c.id }}
                  aria-label={`Lihat detail kelas ${c.title}`}
                  className="group block rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
                >
                  <article className="flex h-[128px] overflow-hidden rounded-[18px] bg-white shadow-[0_3px_12px_rgba(56,74,72,0.08)] transition-transform group-hover:-translate-y-0.5 dark:bg-card">
                    {c.banner_url ? (
                      <img
                        src={c.banner_url}
                        alt=""
                        loading="lazy"
                        className="h-full w-[42%] shrink-0 object-cover"
                      />
                    ) : (
                      <div className="grid h-full w-[42%] shrink-0 place-items-center bg-primary/10">
                        <GraduationCap className="size-7 text-primary" />
                      </div>
                    )}
                    <div className="flex min-w-0 flex-1 flex-col justify-between p-3">
                      <div>
                        <h3 className="line-clamp-2 text-[14px] font-black leading-[1.15]">
                          {c.title}
                        </h3>
                        <p className="mt-1.5 text-[12px] text-[#697578] dark:text-muted-foreground">
                          JLPT {c.level}
                        </p>
                      </div>
                      <div className="mt-1 flex items-end justify-between gap-1">
                        <div>
                          <p className="flex items-center gap-1 text-[9px] text-[#7b8586] dark:text-muted-foreground">
                            <Users className="size-2.5 shrink-0" />
                            {c.participant_count} peserta
                          </p>
                          <strong className="mt-1 block whitespace-nowrap text-[14px] font-black leading-none text-[#48bdb2]">
                            {formatPrice(c, rate.data)}
                          </strong>
                        </div>
                        <span className="flex shrink-0 items-center gap-0.5 whitespace-nowrap text-[11px] font-black text-[#48bdb2]">
                          Detail <ArrowRight className="size-3" />
                        </span>
                      </div>
                    </div>
                  </article>
                </Link>
              ))}

              {!classes.isLoading && (classes.data ?? []).length === 0 && (
                <p className="text-xs text-muted-foreground">
                  Belum ada kelas yang dipublikasikan.
                </p>
              )}
            </div>
          </section>
        </div>
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
