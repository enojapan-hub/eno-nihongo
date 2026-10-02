import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import {
  Banknote,
  BadgeDollarSign,
  BarChart3,
  CalendarDays,
  Clock3,
  CreditCard,
  Download,
  GraduationCap,
  Landmark,
  LockKeyhole,
  ReceiptText,
  RefreshCcw,
  Search,
  WalletCards,
} from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { Card, CardContent } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
export const Route = createFileRoute("/_authenticated/admin-keuangan")({ component: Page });
const rp = (n: any) => "Rp" + Number(n || 0).toLocaleString("id-ID");
const paid = (s: string) => ["paid", "success", "completed"].includes(s);
function Page() {
  const [period, setPeriod] = useState("all");
  const q = useQuery({
    queryKey: ["admin-finance"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_admin_finance_overview");
      if (error) throw error;
      return data || {};
    },
    retry: false,
  });
  const d: any = q.data || {};
  const cutoff =
    period === "today"
      ? Date.now() - 86400000
      : period === "7d"
        ? Date.now() - 604800000
        : period === "month"
          ? new Date(new Date().getFullYear(), new Date().getMonth(), 1).getTime()
          : 0;
  const paidRows = (d.recent_paid || []).filter(
    (x: any) => !cutoff || new Date(x.paid_at).getTime() >= cutoff,
  );
  const pendingRows = (d.recent_orders || []).filter(
    (x: any) => x.status === "pending" && (!cutoff || new Date(x.created_at).getTime() >= cutoff),
  );
  const items = [
    ["Pendapatan Kotor", rp(d.gross_revenue), Banknote],
    ["Pendapatan Bersih", rp(d.gross_revenue), BadgeDollarSign],
    ["Komisi Guru", "Rp0", WalletCards],
    ["Saldo Tertahan", rp(d.pending_amount), Clock3],
  ] as const;
  const sources = [
    ["Premium", d.subscription_revenue || 0, CreditCard],
    ["Lifetime", d.lifetime_revenue || 0, Landmark],
    ["Kelas Guru", d.class_revenue || 0, GraduationCap],
    ["ENO Exam", d.exam_revenue || 0, ReceiptText],
  ] as const;
  return (
    <AppShell title="Keuangan" backTo="/admin">
      <div className="mx-auto max-w-5xl space-y-5 pb-10">
        <section className="rounded-[2rem] bg-gradient-to-br from-primary to-emerald-800 p-5 text-primary-foreground shadow-lg">
          <div className="flex items-start justify-between">
            <div>
              <p className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest">
                <Landmark className="size-4" />
                Finance Center
              </p>
              <h1 className="mt-2 text-2xl font-black">Keuangan ENO NIHONGO</h1>
              <p className="mt-1 text-xs text-white/75">
                Ringkasan arus dana, komisi guru dan pencairan.
              </p>
            </div>
            <BarChart3 className="size-8 opacity-80" />
          </div>
        </section>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {items.map(([a, b, I]) => (
            <Card key={a}>
              <CardContent className="p-3">
                <I className="size-4 text-primary" />
                <p className="mt-2 text-lg font-black">{b}</p>
                <p className="text-[10px] text-muted-foreground">{a}</p>
              </CardContent>
            </Card>
          ))}
        </div>
        <Card className="border-amber-500/20 bg-amber-500/[.05]">
          <CardContent className="flex gap-3 p-4">
            <LockKeyhole className="size-5 shrink-0 text-amber-600" />
            <div className="text-xs">
              <b>Modul pembayaran belum aktif</b>
              <p className="mt-1 text-muted-foreground">
                Dashboard membaca data order yang sudah ada. Komisi, pencairan dan refund tetap
                belum diaktifkan.
              </p>
            </div>
          </CardContent>
        </Card>
        <section>
          <div className="mb-3 flex gap-1 overflow-x-auto">
            {(
              [
                [`all`, `Semua`],
                [`today`, `Hari ini`],
                [`7d`, `7 hari`],
                [`month`, `Bulan ini`],
              ] as const
            ).map(([v, l]) => (
              <button
                key={v}
                onClick={() => setPeriod(v)}
                className={
                  "whitespace-nowrap rounded-full px-3 py-1.5 text-[10px] font-bold " +
                  (period === v
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground")
                }
              >
                <CalendarDays className="mr-1 inline size-3" />
                {l}
              </button>
            ))}
          </div>
          <div className="mb-2 flex items-center justify-between">
            <h2 className="flex items-center gap-2 text-sm font-black">
              <BarChart3 className="size-4 text-primary" />
              Sumber Pendapatan
            </h2>
            <span className="text-[10px] text-muted-foreground">
              {period === "all" ? "Semua waktu" : "Periode dipilih"}
            </span>
          </div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {sources.map(([n, v, I]) => (
              <Card key={n}>
                <CardContent className="p-3">
                  <I className="size-4 text-primary" />
                  <p className="mt-2 font-black">{rp(v)}</p>
                  <p className="text-[10px] text-muted-foreground">{n}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>
        <section>
          <h2 className="mb-2 flex items-center gap-2 text-sm font-black">
            <ReceiptText className="size-4 text-primary" />
            Transaksi Terbaru
          </h2>
          <Card>
            <CardContent className="p-0">
              {q.isError ? (
                <p className="p-4 text-xs text-destructive">Data keuangan tidak dapat dimuat.</p>
              ) : paidRows.length === 0 ? (
                <p className="p-4 text-xs text-muted-foreground">Belum ada transaksi.</p>
              ) : (
                paidRows.map((x: any) => (
                  <div
                    key={x.merchant_order_id}
                    className="flex items-center gap-3 border-b p-3 last:border-0"
                  >
                    <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
                      <CreditCard className="size-4" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs font-black">{x.product_type || "Transaksi"}</p>
                      <p className="truncate text-[10px] text-muted-foreground">
                        {x.merchant_order_id}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs font-black">{rp(x.amount_idr)}</p>
                      <p
                        className={
                          "text-[10px] font-bold " +
                          (paid(x.status) ? "text-primary" : "text-amber-600")
                        }
                      >
                        {x.status}
                      </p>
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </section>
        <section>
          <h2 className="mb-2 flex items-center gap-2 text-sm font-black">
            <Clock3 className="size-4 text-amber-600" />
            Order Pending{" "}
            <span className="rounded-full bg-amber-500/10 px-2 py-0.5 text-[10px] text-amber-700">
              {pendingRows.length}
            </span>
          </h2>
          <Card>
            <CardContent className="p-0">
              {pendingRows.length === 0 ? (
                <p className="p-4 text-xs text-muted-foreground">
                  Tidak ada order pending pada periode ini.
                </p>
              ) : (
                pendingRows.map((x: any) => (
                  <div
                    key={x.merchant_order_id}
                    className="flex items-center gap-3 border-b p-3 last:border-0"
                  >
                    <Clock3 className="size-4 shrink-0 text-amber-600" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs font-black">{x.plan || x.product_type}</p>
                      <p className="truncate text-[10px] text-muted-foreground">
                        {x.merchant_order_id}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs font-black">{rp(x.amount_idr)}</p>
                      <p className="text-[10px] font-bold text-amber-600">pending</p>
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </section>
        <div className="grid gap-2 sm:grid-cols-2">
          {[
            [WalletCards, "Komisi & Saldo Guru", "Pembagian omzet kelas dan saldo guru."],
            [CreditCard, "Penarikan Guru", "Pending, diproses, selesai dan ditolak."],
            [RefreshCcw, "Refund & Gagal", "Refund, pembayaran gagal dan pembatalan."],
            [Search, "Rekonsiliasi", "Order dan pembayaran yang perlu diperiksa."],
            [Download, "Laporan Keuangan", "Ringkasan dan export laporan bulanan."],
          ].map(([I, t, s]: any) => (
            <Card key={t}>
              <CardContent className="p-4">
                <span className="grid size-9 place-items-center rounded-xl bg-primary/10 text-primary">
                  <I className="size-4" />
                </span>
                <h3 className="mt-3 text-sm font-black">{t}</h3>
                <p className="mt-1 text-xs text-muted-foreground">{s}</p>
                <p className="mt-3 text-[10px] font-bold text-primary">Belum diaktifkan</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </AppShell>
  );
}
