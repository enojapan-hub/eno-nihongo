import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  BookOpen,
  Crown,
  Languages,
  ShieldCheck,
  Users,
  type LucideIcon,
} from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";

type AdminOverview = {
  users?: number;
  premium_users?: number;
  lifetime_users?: number;
  free_users?: number;
  kanji?: number;
  vocabulary?: number;
  grammar?: number;
  reading?: number;
  listening?: number;
};

type AdminOverviewClient = {
  rpc: (
    fn: "get_admin_overview",
  ) => Promise<{ data: AdminOverview | null; error: { message?: string } | null }>;
};

export const Route = createFileRoute("/_authenticated/admin")({
  component: AdminPage,
});

async function fetchOverview() {
  const { data, error } = await (
    supabase as unknown as AdminOverviewClient
  ).rpc("get_admin_overview");
  if (error) throw error;
  return data ?? {};
}

function AdminPage() {
  const q = useQuery({
    queryKey: ["admin-overview"],
    queryFn: fetchOverview,
    retry: false,
  });

  if (q.isLoading)
    return (
      <AppShell title="Admin">
        <p className="py-10 text-center text-xs text-muted-foreground">
          Memuat panel admin…
        </p>
      </AppShell>
    );

  if (q.error)
    return (
      <AppShell title="Admin">
        <div className="mx-auto max-w-md rounded-2xl border border-destructive/20 bg-destructive/5 p-5 text-center">
          <ShieldCheck className="mx-auto size-6 text-destructive" />
          <p className="mt-2 text-sm font-semibold">Akses admin diperlukan</p>
          <p className="mt-1 text-[10px] text-muted-foreground">
            Panel ini hanya dapat dibuka oleh akun admin/owner.
          </p>
        </div>
      </AppShell>
    );

  const d = q.data ?? {};
  return (
    <AppShell title="Admin Panel" compact>
      <div className="mx-auto max-w-3xl space-y-4">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[.14em] text-primary">
            ENO NIHONGO
          </p>
          <h1 className="text-xl font-bold">Admin Panel</h1>
          <p className="mt-1 text-[10px] text-muted-foreground">
            Ringkasan pengguna, membership, konten, terjemahan, dan operasi
            aplikasi.
          </p>
        </div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <Stat icon={Users} label="Pengguna" value={d.users} />
          <Stat icon={Crown} label="Premium" value={d.premium_users} />
          <Stat icon={Crown} label="Lifetime" value={d.lifetime_users} />
          <Stat icon={Users} label="Free" value={d.free_users} />
        </div>
        <Card className="rounded-2xl">
          <CardContent className="grid grid-cols-2 gap-2 p-4 sm:grid-cols-5">
            <Mini label="Kanji" value={d.kanji} />
            <Mini label="Kotoba" value={d.vocabulary} />
            <Mini label="Bunpō" value={d.grammar} />
            <Mini label="Dokkai" value={d.reading} />
            <Mini label="Chōkai" value={d.listening} />
          </CardContent>
        </Card>
        <div className="grid gap-2 sm:grid-cols-2">
          <Button asChild variant="outline" className="h-12 justify-start rounded-xl">
            <Link to="/admin-terjemahan">
              <Languages className="mr-2 size-4" />
              Panel Terjemahan
            </Link>
          </Button>
          <Button variant="outline" className="h-12 justify-start rounded-xl" disabled>
            <BookOpen className="mr-2 size-4" />
            Manajemen Konten — berikutnya
          </Button>
        </div>
        <Card className="rounded-2xl border-primary/20 bg-primary/[.04]">
          <CardContent className="p-4 text-[10px] leading-5 text-muted-foreground">
            Tahap panel admin berikutnya: kelola pengguna & membership, jadwal
            ENO Monthly Exam, notifikasi global, laporan masalah, konten per
            level, audit reward XP/Poin, dan riwayat perubahan admin.
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}

function Stat({
  icon: Icon,
  label,
  value,
}: {
  icon: LucideIcon;
  label: string;
  value?: number;
}) {
  return (
    <div className="rounded-2xl border bg-card p-3 text-center">
      <Icon className="mx-auto size-4 text-primary" />
      <p className="mt-1 text-base font-bold">
        {Number(value ?? 0).toLocaleString("id-ID")}
      </p>
      <p className="text-[8px] text-muted-foreground">{label}</p>
    </div>
  );
}

function Mini({ label, value }: { label: string; value?: number }) {
  return (
    <div className="rounded-xl bg-muted/40 p-3 text-center">
      <p className="text-[13px] font-bold">
        {Number(value ?? 0).toLocaleString("id-ID")}
      </p>
      <p className="text-[8px] text-muted-foreground">{label}</p>
    </div>
  );
}
