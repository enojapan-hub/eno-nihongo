import { useState } from "react";
import { createFileRoute, Link, Outlet, useRouterState } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowRight,
  BookOpenText,
  ChevronLeft,
  Clock3,
  ExternalLink,
  Headphones,
  UserPlus,
  UsersRound,
} from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
export const Route = createFileRoute("/_authenticated/kelas/$classId")({ component: ClassRoute });
function ClassRoute() {
  const { classId } = Route.useParams();
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  return pathname.replace(/\/$/, "") === `/kelas/${classId}` ? <Detail /> : <Outlet />;
}
function Detail() {
  const { classId } = Route.useParams();
  const queryClient = useQueryClient();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const classQuery = useQuery({
    queryKey: ["class", classId],
    queryFn: async () => {
      const { data, error } = await (supabase as any).rpc("get_public_class", {
        p_class_id: classId,
      });
      if (error) throw error;
      return data?.[0] ?? null;
    },
  });
  const countQuery = useQuery({
    queryKey: ["class-count", classId],
    queryFn: async () => {
      const { data, error } = await (supabase as any).rpc("get_public_class_enrollment_counts");
      if (error) throw error;
      return Number(
        (data ?? []).find((row: any) => row.class_id === classId)?.participant_count ?? 0,
      );
    },
  });
  const rateQuery = useQuery({
    queryKey: ["jpy-idr-rate"],
    queryFn: async () => {
      const response = await fetch("https://api.frankfurter.dev/v2/rate/jpy/idr");
      if (!response.ok) throw new Error("Kurs belum tersedia");
      const result = await response.json();
      return Number(result.rate);
    },
    staleTime: 24 * 60 * 60 * 1000,
  });
  const accessQuery = useQuery({
    queryKey: ["class-access", classId],
    queryFn: async () => {
      const { data, error } = await (supabase as any).rpc("get_class_member_access", {
        p_class_id: classId,
      });
      if (error) throw error;
      return data?.[0] ?? { enrolled: false, meeting_url: null };
    },
  });
  async function enroll() {
    setBusy(true);
    setMessage("");
    const { error } = await (supabase as any).rpc("enroll_in_class", { p_class_id: classId });
    if (error) setMessage(error.message);
    else {
      setMessage("Berhasil bergabung ke kelas.");
      await queryClient.invalidateQueries({ queryKey: ["class-access", classId] });
    }
    setBusy(false);
  }
  const c: any = classQuery.data;
  if (classQuery.isLoading)
    return (
      <AppShell title="Kelas" backTo="/kelas">
        <p>Memuat kelas…</p>
      </AppShell>
    );
  if (!c)
    return (
      <AppShell title="Kelas" backTo="/kelas">
        <p>Kelas tidak ditemukan atau belum dipublikasikan.</p>
      </AppShell>
    );
  const member = Boolean(accessQuery.data?.enrolled);
  const meetingUrl = accessQuery.data?.meeting_url;
  const duration =
    c.starts_at && c.ends_at
      ? Math.max(
          0,
          Math.round((new Date(c.ends_at).getTime() - new Date(c.starts_at).getTime()) / 60000),
        )
      : null;
  const durationLabel = duration ? `${duration} menit` : "Jadwal sesi akan diinformasikan guru";
  return (
    <AppShell title="Kursus" focus>
      <div className="-mx-3 -mt-3 min-h-[100dvh] bg-[#f7f8f7] text-[#394247] dark:bg-background dark:text-foreground">
        <header className="relative flex h-20 items-center justify-center border-b border-black/5 bg-white px-4 dark:border-border dark:bg-background">
          <Link
            to="/kelas"
            aria-label="Kembali ke daftar kursus"
            className="absolute left-4 rounded-full p-2 hover:bg-black/5 focus-visible:outline-2 focus-visible:outline-primary dark:hover:bg-white/10"
          >
            <ChevronLeft className="size-8 stroke-[2.5]" />
          </Link>
          <h1 className="text-[25px] font-black tracking-tight">Kursus</h1>
        </header>
        <div className="space-y-7 px-4 py-6 pb-32">
          {c.banner_url && (
            <img
              src={c.banner_url}
              alt={c.title}
              className="aspect-[1.5] w-full rounded-[28px] object-cover shadow-[0_5px_18px_rgba(56,74,72,0.08)]"
            />
          )}
          <div>
            <p className="text-sm font-bold text-[#48bdb2]">JLPT {c.level}</p>
            <h2 className="mt-1 text-[27px] font-black leading-tight">{c.title}</h2>
            <p className="mt-3 text-sm leading-6 text-[#697578] dark:text-muted-foreground">
              {c.description || "Belajar terarah bersama guru ENO NIHONGO."}
            </p>
            <div className="mt-5 flex flex-wrap items-end gap-x-4 gap-y-1">
              <p className="flex items-center gap-2 text-sm text-[#697578] dark:text-muted-foreground">
                <UsersRound className="size-5" />
                {countQuery.data ?? 0} peserta
              </p>
              <strong className="text-[25px] font-black text-[#48bdb2]">
                {formatPrice(c, rateQuery.data)}
              </strong>
            </div>
          </div>
          <section aria-labelledby="course-for">
            <h2 id="course-for" className="text-[23px] font-black">
              Kursus ini untuk
            </h2>
            <div className="mt-4 space-y-1 rounded-[25px] bg-white p-5 shadow-[0_4px_16px_rgba(56,74,72,0.07)] dark:bg-card">
              <Feature
                icon={UsersRound}
                color="orange"
                text={`Mode pembelajaran: ${c.class_mode || "Kelas online bersama guru"}`}
              />
              <Feature icon={Clock3} color="pink" text={`Durasi sesi: ${durationLabel}`} />
              <Feature
                icon={BookOpenText}
                color="violet"
                text="Paket kursus: Jadwal pertemuan tersedia di ruang kelas."
              />
            </div>
          </section>
          <section aria-labelledby="course-list">
            <h2 id="course-list" className="text-[23px] font-black">
              Daftar kursus
            </h2>
            <div className="mt-3 rounded-2xl bg-white p-4 text-sm text-[#697578] shadow-sm dark:bg-card dark:text-muted-foreground">
              Setelah mendaftar, Anda dapat melihat jadwal lengkap, materi, tugas, kuis, dan nilai
              di ruang kelas.
            </div>
          </section>
          {member ? (
            <Card>
              <CardContent className="p-4">
                <p className="text-xs font-black">Anda sudah terdaftar</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button asChild>
                    <Link to="/kelas/$classId/workspace" params={{ classId }}>
                      Masuk Ruang Kelas
                    </Link>
                  </Button>
                  {meetingUrl && (
                    <Button variant="outline" asChild>
                      <a href={meetingUrl} target="_blank" rel="noreferrer">
                        <ExternalLink className="mr-2 size-4" />
                        Kelas Live
                      </a>
                    </Button>
                  )}
                </div>
                {!meetingUrl && (
                  <p className="mt-2 text-xs text-muted-foreground">
                    Link live belum tersedia atau belum memasuki waktu akses.
                  </p>
                )}
              </CardContent>
            </Card>
          ) : Number(c.price) > 0 ? (
            <p className="rounded-xl bg-muted p-3 text-xs">
              Pendaftaran kelas berbayar akan dibuka setelah sistem pembayaran aktif.
            </p>
          ) : (
            <Button disabled={busy} onClick={enroll}>
              <UserPlus className="mr-2 size-4" />
              {busy ? "Mendaftarkan…" : "Gabung Kelas Gratis"}
            </Button>
          )}
          {message && <p className="text-xs text-muted-foreground">{message}</p>}
        </div>
        <div className="fixed inset-x-0 bottom-0 z-30 border-t border-black/5 bg-[#f7f8f7]/95 px-4 py-3 backdrop-blur dark:border-border dark:bg-background/95">
          <div className="mx-auto flex max-w-2xl gap-3">
            <Button
              type="button"
              variant="outline"
              size="lg"
              className="size-14 shrink-0 rounded-full"
              aria-label="Hubungi admin"
              onClick={() => setMessage("Hubungi admin untuk informasi pendaftaran.")}
            >
              <Headphones className="size-6" />
            </Button>
            {member ? (
              <Button size="lg" className="flex-1 rounded-full" asChild>
                <Link to="/kelas/$classId/workspace" params={{ classId }}>
                  Masuk Ruang Kelas <ArrowRight className="ml-2 size-5" />
                </Link>
              </Button>
            ) : (
              <Button
                size="lg"
                className="flex-1 rounded-full bg-[#48bdb2] text-white hover:bg-[#3da99f]"
                disabled={busy}
                onClick={enroll}
              >
                {busy ? "Mendaftarkan…" : Number(c.price) > 0 ? "Daftar" : "Gabung Gratis"}
                <ArrowRight className="ml-2 size-5" />
              </Button>
            )}
          </div>
        </div>
      </div>
    </AppShell>
  );
}

function Feature({
  icon: Icon,
  color,
  text,
}: {
  icon: any;
  color: "orange" | "pink" | "violet";
  text: string;
}) {
  const colors = { orange: "bg-orange-400", pink: "bg-fuchsia-500", violet: "bg-violet-500" };
  return (
    <div className="flex items-center gap-5 py-2">
      <span
        className={`grid size-16 shrink-0 place-items-center rounded-2xl ${colors[color]} text-white`}
      >
        <Icon className="size-8" />
      </span>
      <p className="text-[18px] leading-7 text-[#697578] dark:text-foreground">{text}</p>
    </div>
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
