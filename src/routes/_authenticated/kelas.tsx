import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, CalendarDays, GraduationCap, Users } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/kelas")({ component: KelasPage });

function KelasPage() {
  const banners = useQuery({
    queryKey: ["class-banners"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("class_banners")
        .select("*")
        .eq("is_active", true)
        .order("sort_order");
      if (error) throw error;
      return data ?? [];
    },
  });

  const classes = useQuery({
    queryKey: ["published-classes"],
    queryFn: async () => {
      const { data, error } = await (supabase as any).rpc("get_public_classes");
      if (error) throw error;
      return data ?? [];
    },
  });

  return (
    <AppShell title="Kelas" description="Belajar bersama guru ENO NIHONGO.">
      <div className="space-y-5">
        <div className="flex justify-end">
          <Button size="sm" variant="outline" asChild>
            <Link to="/kelas-saya">
              <GraduationCap className="mr-1 size-4" />
              Kelas Saya
            </Link>
          </Button>
        </div>

        {(banners.data ?? []).map((banner: any) => (
          <div key={banner.id} className="relative min-h-40 overflow-hidden rounded-3xl bg-muted">
            <img
              src={banner.image_url}
              alt={banner.title || "Banner kelas"}
              className="absolute inset-0 h-full w-full object-cover"
            />
            <div className="relative flex min-h-40 flex-col justify-end bg-gradient-to-t from-black/75 to-transparent p-5 text-white">
              <h2 className="text-xl font-black">{banner.title}</h2>
              {banner.subtitle && <p className="mt-1 text-xs opacity-90">{banner.subtitle}</p>}
              {banner.cta_url && (
                <a href={banner.cta_url} className="mt-3 w-fit rounded-xl bg-white px-3 py-2 text-xs font-bold text-black">
                  {banner.cta_label || "Lihat kelas"}
                </a>
              )}
            </div>
          </div>
        ))}

        <div>
          <h2 className="mb-3 flex items-center gap-2 text-base font-black">
            <GraduationCap className="size-5" />
            Kelas tersedia
          </h2>

          <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
            {(classes.data ?? []).map((c: any) => (
              <Link
                key={c.id}
                to="/kelas/$classId"
                params={{ classId: c.id }}
                aria-label={`Lihat detail kelas ${c.title}`}
                className="block h-full rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
              >
                <Card className="h-full overflow-hidden transition-colors hover:border-primary/50">
                  <div className="flex min-h-28 sm:block">
                    {c.banner_url && (
                      <img
                        src={c.banner_url}
                        alt=""
                        className="h-28 w-24 shrink-0 object-cover sm:aspect-[16/7] sm:h-auto sm:w-full"
                      />
                    )}

                    <CardContent className="flex min-w-0 flex-1 flex-col justify-between gap-2 p-3 sm:p-4">
                      <div className="min-w-0">
                        <div className="mb-1 flex items-center gap-2">
                          <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[9px] font-bold text-primary">
                            {c.level}
                          </span>
                          <span className="truncate text-[9px] text-muted-foreground">{c.class_mode}</span>
                        </div>
                        <h3 className="line-clamp-1 text-sm font-black sm:text-base">{c.title}</h3>
                        {c.description && (
                          <p className="mt-0.5 line-clamp-1 text-[10px] text-muted-foreground sm:text-xs">
                            {c.description}
                          </p>
                        )}

                        <div className="mt-1.5 flex flex-wrap gap-x-3 text-[9px] text-muted-foreground">
                          {c.starts_at && (
                            <span className="flex items-center gap-1">
                              <CalendarDays className="size-3 shrink-0" />
                              {new Date(c.starts_at).toLocaleDateString("id-ID")}
                            </span>
                          )}
                          {c.capacity && (
                            <span className="flex items-center gap-1">
                              <Users className="size-3 shrink-0" />
                              {c.capacity} siswa
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center justify-between gap-2">
                        <strong className="text-xs sm:text-sm">
                          {Number(c.price) > 0
                            ? `${c.currency} ${Number(c.price).toLocaleString("id-ID")}`
                            : "Gratis"}
                        </strong>
                        <span className="flex shrink-0 items-center gap-1 text-[10px] font-bold text-primary sm:text-xs">
                          Lihat detail <ArrowRight className="size-3" />
                        </span>
                      </div>
                    </CardContent>
                  </div>
                </Card>
              </Link>
            ))}

            {!classes.isLoading && (classes.data ?? []).length === 0 && (
              <p className="text-xs text-muted-foreground">Belum ada kelas yang dipublikasikan.</p>
            )}
          </div>
        </div>
      </div>
    </AppShell>
  );
}
