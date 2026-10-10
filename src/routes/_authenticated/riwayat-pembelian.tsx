import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Gift, Receipt } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { formatRupiah } from "@/lib/public-plans";
import { grantTitle, orderStatusInfo, orderTitle } from "@/lib/purchase-history";

export const Route = createFileRoute("/_authenticated/riwayat-pembelian")({
  component: RiwayatPembelianPage,
});

const TONE_CLASS = {
  ok: "bg-primary/10 text-primary",
  wait: "bg-amber-500/10 text-amber-500",
  bad: "bg-destructive/10 text-destructive",
  neutral: "bg-muted text-muted-foreground",
} as const;

// Hanya membaca baris milik pengguna sendiri (RLS payment_orders_select_own / reward_grants_own_select).
async function loadHistory() {
  const { data: auth, error: authError } = await supabase.auth.getUser();
  if (authError || !auth.user) throw new Error("Silakan masuk untuk melihat riwayat.");
  const userId = auth.user.id;
  const [orders, grants] = await Promise.all([
    supabase
      .from("payment_orders")
      .select("id,product_type,plan,duration_days,amount_idr,status,merchant_order_id,created_at,paid_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(50),
    supabase
      .from("reward_grants")
      .select("id,reward_kind,premium_days,points_spent,created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(50),
  ]);
  if (orders.error || grants.error) throw new Error("Riwayat gagal dimuat.");
  return { orders: orders.data ?? [], grants: grants.data ?? [] };
}

const fmtDate = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" }) : "—");

function RiwayatPembelianPage() {
  const history = useQuery({ queryKey: ["my-purchase-history"], queryFn: loadHistory });

  return (
    <AppShell title="Riwayat Pembelian" description="Pesanan dan hadiah Premium yang tercatat di akunmu.">
      <div className="mx-auto max-w-2xl space-y-4">
        {history.isLoading ? <p className="text-sm text-muted-foreground">Memuat riwayat…</p> : null}
        {history.isError ? (
          <div role="alert" className="space-y-2">
            <p className="text-sm text-destructive">Riwayat belum dapat dimuat.</p>
            <Button variant="outline" size="sm" onClick={() => history.refetch()}>Coba lagi</Button>
          </div>
        ) : null}

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Receipt className="size-5 text-primary" /> Pesanan</CardTitle>
            <CardDescription>Maksimal 50 pesanan terbaru. Status mengikuti catatan sistem pembayaran.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {history.data && history.data.orders.length === 0 ? <p className="text-sm text-muted-foreground">Belum ada pesanan.</p> : null}
            {history.data?.orders.map((o) => {
              const info = orderStatusInfo(o.status);
              return (
                <div key={o.id} className="flex items-start justify-between gap-3 border-b py-3 text-sm last:border-0">
                  <div className="min-w-0">
                    <p className="font-medium">{orderTitle(o.product_type, o.plan, o.duration_days)}</p>
                    <p className="text-xs text-muted-foreground">
                      {fmtDate(o.created_at)}
                      {o.paid_at ? ` · dibayar ${fmtDate(o.paid_at)}` : ""}
                    </p>
                    <p className="truncate text-[11px] text-muted-foreground">No. {o.merchant_order_id}</p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="font-semibold">{formatRupiah(Number(o.amount_idr))}</p>
                    <span className={`mt-1 inline-block rounded-full px-2 py-0.5 text-[11px] font-medium ${TONE_CLASS[info.tone]}`}>{info.label}</span>
                  </div>
                </div>
              );
            })}
            {history.data?.orders.some((o) => o.status === "pending") ? (
              <p className="pt-2 text-xs text-muted-foreground">
                Pesanan yang menunggu belum dapat dibatalkan atau diulang dari halaman ini. Hubungi Pusat Bantuan bila perlu.
              </p>
            ) : null}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Gift className="size-5 text-primary" /> Hadiah Premium</CardTitle>
            <CardDescription>Premium dari referral dan penukaran poin.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {history.data && history.data.grants.length === 0 ? <p className="text-sm text-muted-foreground">Belum ada hadiah.</p> : null}
            {history.data?.grants.map((g) => (
              <div key={g.id} className="flex items-center justify-between gap-3 border-b py-2 text-sm last:border-0">
                <div>
                  <p className="font-medium">{grantTitle(g.reward_kind, g.premium_days)}</p>
                  <p className="text-xs text-muted-foreground">{fmtDate(g.created_at)}</p>
                </div>
                {g.points_spent > 0 ? <span className="font-semibold">−{g.points_spent.toLocaleString("id-ID")} poin</span> : null}
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
