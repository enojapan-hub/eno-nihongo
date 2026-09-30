import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  Activity,
  ArrowUpRight,
  BarChart3,
  BookOpen,
  CheckCircle2,
  ChevronRight,
  ClipboardCheck,
  CloudCog,
  Crown,
  DollarSign,
  FileQuestion,
  FileUp,
  GraduationCap,
  Image,
  LayoutDashboard,
  Megaphone,
  MessageSquareWarning,
  Settings,
  ShieldCheck,
  ShoppingBag,
  Sparkles,
  Trophy,
  Users,
} from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { Card, CardContent } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/admin")({ component: Page });

const sections = [
  {
    title: "Kelola Platform",
    items: [
      ["Materi", BookOpen, "Kanji, Kosakata, Bunpou, Dokkai dan Chōkai", "/admin-konten"],
      ["Simulasi JLPT", FileQuestion, "Paket ujian, sesi dan bank soal", "/admin-konten"],
      ["ENO Exam", Trophy, "Ujian bulanan Premium dan ranking", "/admin-eno-exam"],
      ["Kelas Guru", GraduationCap, "Review kelas, peserta dan aktivitas", "/admin-kelas"],
    ],
  },
  {
    title: "Pengguna & Bisnis",
    items: [
      ["Pengguna", Users, "Akun, role, paket dan status", "/admin-pengguna"],
      ["Langganan", ShoppingBag, "Free, Premium dan Lifetime", "/admin-langganan"],
      ["Keuangan", DollarSign, "Dashboard finansial dan komisi guru", "/admin-keuangan"],
      ["Analitik", BarChart3, "Aktivitas dan performa platform", "/admin-analitik"],
    ],
  },
  {
    title: "Operasional",
    items: [
      ["Kontrol Operasional", ClipboardCheck, "Review, laporan dan pengumuman", "/admin-operasional"],
      ["Media Manager", Image, "Upload, preview dan safe-delete media", "/admin-media"],
      ["Import / Export", FileUp, "Import aman, validasi dan ekspor data", "/admin-import-export"],
      ["Sistem & Audit", CloudCog, "Kesehatan sistem dan audit log", "/admin-sistem"],
      ["Role & Permission", Settings, "Role dinamis, permission dan anggota", "/admin-role-permission"],
      ["Pengaturan Platform", Settings, "Konfigurasi global aplikasi", "/admin-pengaturan"],
    ],
  },
] as const;

function formatNumber(value: unknown) {
  return Number(value || 0).toLocaleString("id-ID");
}

function Page() {
  const actions = useQuery({queryKey:["admin-action-queue"],queryFn:async()=>{const {data,error}=await (supabase as any).rpc("get_admin_action_queue");if(error)throw error;return (data||[]) as any[]},retry:false});
  const q = useQuery({
    queryKey: ["admin-overview"],
    queryFn: async () => {
      const { data, error } = await (supabase as any).rpc("get_admin_overview");
      if (error) throw error;
      return data as any;
    },
    retry: false,
  });

  if (q.isLoading)
    return (
      <AppShell title="Admin">
        <div className="grid min-h-[55vh] place-items-center">
          <div className="text-center">
            <ShieldCheck className="mx-auto size-9 animate-pulse text-primary" />
            <p className="mt-3 text-xs font-bold">Memeriksa akses admin…</p>
          </div>
        </div>
      </AppShell>
    );

  if (q.isError)
    return (
      <AppShell title="Admin">
        <div className="grid min-h-[55vh] place-items-center text-center">
          <div>
            <ShieldCheck className="mx-auto size-10 text-muted-foreground" />
            <p className="mt-3 font-bold">Akses admin diperlukan</p>
          </div>
        </div>
      </AppShell>
    );

  const o = q.data || {};
  const contentTotal =
    Number(o.kanji || 0) +
    Number(o.vocabulary || 0) +
    Number(o.grammar || 0) +
    Number(o.reading || 0) +
    Number(o.listening || 0);

  const metrics = [
    ["Total Pengguna", o.users, Users, `${formatNumber(o.premium_users)} Premium · ${formatNumber(o.lifetime_users)} Lifetime`],
    ["Konten Aktif", contentTotal, BookOpen, "Materi terpublikasi"],
    ["Kelas", o.classes, GraduationCap, `${formatNumber(o.classes_published)} aktif`],
    ["Aktivitas Kuis", o.quiz_attempts, Activity, "Total pengerjaan kelas"],
  ] as const;

  return (
    <AppShell title="Admin" compact>
      <div className="mx-auto max-w-6xl space-y-6 pb-12">
        <section className="relative overflow-hidden rounded-[2rem] border border-primary/20 bg-gradient-to-br from-primary via-primary to-emerald-800 p-6 text-primary-foreground shadow-xl shadow-primary/10 sm:p-8">
          <div className="absolute -right-16 -top-20 size-56 rounded-full bg-white/10 blur-3xl" />
          <div className="absolute -bottom-24 left-1/3 size-52 rounded-full bg-black/10 blur-3xl" />
          <div className="relative">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <div className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1 text-[10px] font-black tracking-[0.18em] backdrop-blur">
                  <Crown className="size-3.5" /> OWNER CONTROL CENTER
                </div>
                <h1 className="mt-4 text-3xl font-black tracking-tight sm:text-4xl">ENO NIHONGO</h1>
                <p className="mt-1 text-sm font-semibold text-white/75">Administration & Operations</p>
              </div>
              <div className="flex items-center gap-2 rounded-2xl border border-white/15 bg-black/10 px-3 py-2 text-xs backdrop-blur">
                <span className="size-2 rounded-full bg-emerald-300" />
                Sistem aktif
              </div>
            </div>
            <div className="mt-8 flex flex-wrap gap-2">
              <Link
                to="/admin-analitik"
                className="inline-flex items-center gap-2 rounded-xl bg-white px-4 py-2.5 text-xs font-black text-primary shadow-sm transition hover:bg-white/90"
              >
                <BarChart3 className="size-4" /> Lihat Analitik
              </Link>
              <Link
                to="/admin-sistem"
                className="inline-flex items-center gap-2 rounded-xl border border-white/20 bg-white/10 px-4 py-2.5 text-xs font-bold backdrop-blur transition hover:bg-white/15"
              >
                <ShieldCheck className="size-4" /> Sistem & Audit
              </Link>
            </div>
          </div>
        </section>

        {Number(o.classes_review || 0) > 0 && (
          <Link
            to="/admin-kelas"
            className="flex items-center gap-3 rounded-2xl border border-amber-500/25 bg-amber-500/[0.08] p-4 transition hover:bg-amber-500/[0.12]"
          >
            <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-amber-500/15 text-amber-600">
              <ClipboardCheck className="size-5" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-black">Perlu tindakan</p>
              <p className="text-xs text-muted-foreground">
                {formatNumber(o.classes_review)} pengajuan kelas menunggu review.
              </p>
            </div>
            <ChevronRight className="size-5 text-muted-foreground" />
          </Link>
        )}

        {actions.isSuccess && actions.data.some((x:any)=>Number(x.count)>0) && <section><div className="mb-3"><p className="text-[10px] font-black uppercase tracking-[0.18em] text-primary">Action Queue</p><h2 className="text-lg font-black">Perlu tindakan</h2></div><div className="grid gap-2 sm:grid-cols-2">{actions.data.filter((x:any)=>Number(x.count)>0).map((x:any)=><Link key={x.key} to={x.href as any} className="flex items-center gap-3 rounded-2xl border p-3 transition hover:border-primary/30"><span className={x.severity==="critical"?"grid size-9 place-items-center rounded-xl bg-destructive/10 font-black text-destructive":"grid size-9 place-items-center rounded-xl bg-amber-500/10 font-black text-amber-700"}>{x.count}</span><div className="flex-1"><p className="text-xs font-black">{x.label}</p><p className="text-[10px] text-muted-foreground">Buka untuk ditangani</p></div><ChevronRight className="size-4 text-muted-foreground"/></Link>)}</div></section>}

        <section>
          <div className="mb-3 flex items-end justify-between">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-primary">Overview</p>
              <h2 className="text-lg font-black">Kondisi platform</h2>
            </div>
            <span className="hidden items-center gap-1 text-[10px] text-muted-foreground sm:flex">
              <CheckCircle2 className="size-3.5 text-primary" /> Data aktual
            </span>
          </div>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {metrics.map(([label, value, Icon, detail]) => (
              <Card key={label} className="overflow-hidden border-border/60 shadow-sm">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-2">
                    <span className="grid size-9 place-items-center rounded-xl bg-primary/10 text-primary">
                      <Icon className="size-4" />
                    </span>
                    <ArrowUpRight className="size-3.5 text-muted-foreground/50" />
                  </div>
                  <p className="mt-4 text-2xl font-black tracking-tight">{formatNumber(value)}</p>
                  <p className="text-xs font-bold">{label}</p>
                  <p className="mt-1 truncate text-[10px] text-muted-foreground">{detail}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>

        {sections.map((section) => (
          <section key={section.title}>
            <div className="mb-3 flex items-center gap-2">
              <Sparkles className="size-4 text-primary" />
              <h2 className="text-sm font-black">{section.title}</h2>
            </div>
            <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
              {section.items.map(([label, Icon, desc, to]) => {
                const body = (
                  <Card className="group h-full border-border/60 shadow-sm transition duration-200 hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-md">
                    <CardContent className="flex h-full min-h-[104px] flex-col p-2.5 sm:min-h-[150px] sm:p-4">
                      <div className="flex items-start justify-between">
                        <span className="grid size-7 place-items-center rounded-lg bg-primary/10 text-primary transition group-hover:bg-primary group-hover:text-primary-foreground sm:size-10 sm:rounded-2xl">
                          <Icon className="size-4 sm:size-5" />
                        </span>
                        {to ? (
                          <ArrowUpRight className="size-4 text-muted-foreground/40 transition group-hover:text-primary" />
                        ) : (
                          <span className="rounded-full bg-muted px-2 py-1 text-[9px] font-bold text-muted-foreground">
                            Terkunci
                          </span>
                        )}
                      </div>
                      <h3 className="mt-2 text-sm font-black sm:mt-4">{label}</h3>
                      <p className="mt-0.5 line-clamp-1 flex-1 text-[10px] leading-relaxed text-muted-foreground">{desc}</p>
                      <p className="mt-1.5 text-[10px] font-bold text-primary sm:mt-4">
                        {to ? "Kelola →" : "Menunggu Duitku"}
                      </p>
                    </CardContent>
                  </Card>
                );
                return to ? (
                  <Link key={label} to={to as any} className="block">
                    {body}
                  </Link>
                ) : (
                  <div key={label}>{body}</div>
                );
              })}
            </div>
          </section>
        ))}

        <div className="rounded-2xl border border-dashed bg-muted/20 p-4 text-center text-[10px] text-muted-foreground">
          Modul pembayaran dan keuangan tetap dinonaktifkan sampai integrasi Duitku disetujui.
        </div>
      </div>
    </AppShell>
  );
}
