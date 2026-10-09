import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Coins, Gift, History, Sparkles } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { supabase } from "@/lib/supabase/client";

export const Route = createFileRoute("/_authenticated/tukar-poin")({
  component: TukarPoinPage,
});

type Redemption = {
  id: string;
  reward_type: string;
  points_spent: number;
  status: string;
  created_at: string;
};

async function loadWallet() {
  const { data: auth, error: authError } = await supabase.auth.getUser();
  if (authError || !auth.user) throw new Error("Silakan masuk untuk melihat poin.");
  const userId = auth.user.id;
  const [stats, activity, history] = await Promise.all([
    supabase.from("user_stats").select("reward_points").eq("user_id", userId).maybeSingle(),
    supabase.from("learning_activity").select("points").eq("user_id", userId),
    supabase.from("point_redemptions").select("id,reward_type,points_spent,status,created_at").eq("user_id", userId).order("created_at", { ascending: false }).limit(20),
  ]);
  if (stats.error || activity.error || history.error) throw new Error("Data poin gagal dimuat.");
  const earned = (activity.data ?? []).reduce((sum, item) => sum + (item.points ?? 0), 0);
  const redemptions = (history.data ?? []) as Redemption[];
  const spent = redemptions.reduce((sum, item) => sum + (item.status === "completed" ? item.points_spent : 0), 0);
  return { balance: stats.data?.reward_points ?? 0, earned, spent, redemptions };
}

function TukarPoinPage() {
  const wallet = useQuery({ queryKey: ["my-reward-wallet"], queryFn: loadWallet });
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const balance = wallet.data?.balance ?? 0;

  async function redeem() {
    if (busy || balance < 1000) return;
    setBusy(true);
    setMessage("");
    try {
      const { data, error } = await (supabase.rpc as unknown as (fn: string, args: { p_points: number }) => Promise<{ data: number | null; error: { message: string } | null }>)("redeem_points_for_premium", { p_points: 1000 });
      if (error) throw error;
      setMessage(data ? `Berhasil! Premium bertambah ${data} hari.` : "Saldo poin tidak mencukupi.");
      await wallet.refetch();
    } catch {
      setMessage("Penukaran belum tersedia atau gagal. Coba lagi nanti.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <AppShell title="Tukar Poin" description="Gunakan poin hasil belajar untuk mendapatkan hadiah. XP tetap khusus level akun.">
      <div className="mx-auto max-w-2xl space-y-4">
        {wallet.isLoading ? <p className="text-sm text-muted-foreground">Memuat saldo poin…</p> : null}
        {wallet.isError ? <p role="alert" className="text-sm text-destructive">Data poin belum dapat dimuat.</p> : null}
        <div className="grid grid-cols-2 gap-3">
          <Card className="border-primary/20 bg-primary/5">
            <CardContent className="p-4">
              <Coins className="mb-2 size-5 text-primary" />
              <p className="text-xs text-muted-foreground">Saldo tersedia</p>
              <p className="text-2xl font-bold">{wallet.data ? balance.toLocaleString("id-ID") : "—"}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <Sparkles className="mb-2 size-5 text-primary" />
              <p className="text-xs text-muted-foreground">Poin belajar terkumpul</p>
              <p className="text-2xl font-bold">{wallet.data ? wallet.data.earned.toLocaleString("id-ID") : "—"}</p>
            </CardContent>
          </Card>
        </div>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Gift className="size-5 text-primary" /> Katalog hadiah</CardTitle>
            <CardDescription>Penukaran tidak mengurangi poin yang telah tercatat untuk peringkat leaderboard.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between gap-3 rounded-xl border p-3">
              <div>
                <p className="font-semibold">Premium 7 hari</p>
                <p className="text-xs text-muted-foreground">1.000 poin</p>
              </div>
              <Button disabled={busy || wallet.isLoading || wallet.isError || balance < 1000} onClick={redeem}>
                {busy ? "Memproses…" : "Tukar"}
              </Button>
            </div>
            {message ? <p role="status" className="mt-3 text-sm">{message}</p> : null}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><History className="size-5 text-primary" /> Riwayat penukaran</CardTitle>
            <CardDescription>Total poin ditukar (20 transaksi terbaru): {wallet.data ? wallet.data.spent.toLocaleString("id-ID") : "—"}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {wallet.data?.redemptions.length === 0 ? <p className="text-sm text-muted-foreground">Belum ada penukaran.</p> : null}
            {wallet.data?.redemptions.map((item) => (
              <div key={item.id} className="flex items-center justify-between gap-3 border-b py-2 text-sm last:border-0">
                <div>
                  <p className="font-medium">{item.reward_type === "premium_7d" ? "Premium 7 hari" : item.reward_type}</p>
                  <p className="text-xs text-muted-foreground">{new Date(item.created_at).toLocaleDateString("id-ID")} · {item.status}</p>
                </div>
                <span className="font-semibold">−{item.points_spent.toLocaleString("id-ID")}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
