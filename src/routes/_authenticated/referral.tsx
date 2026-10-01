import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Gift, Copy, Check, Sparkles } from "lucide-react";
import { useState } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { getMyAccount } from "@/lib/profile.functions";
import { supabase } from "@/lib/supabase/client";

type RpcResult = { data: number | null; error: { message: string } | null };
function callRpc(fn: string, args: Record<string, unknown>): Promise<RpcResult> {
  return (supabase.rpc as unknown as (name: string, params: Record<string, unknown>) => Promise<RpcResult>)(fn, args);
}

export const Route = createFileRoute("/_authenticated/referral")({
  head: () => ({ meta: [{ title: "Gratis & Referral — ENO JAPAN" }] }),
  component: ReferralPage,
});

function ReferralPage() {
  const fetchAccount = useServerFn(getMyAccount);
  const { data, refetch } = useQuery({ queryKey: ["my-account"], queryFn: () => fetchAccount() });
  const [copied, setCopied] = useState(false);
  const [code, setCode] = useState("");
  const [message, setMessage] = useState("");
  const profile = data?.profile;
  const points = (profile as any)?.referral_points ?? 0;
  const plan = (profile as any)?.plan ?? "free";
  const premiumUntil = (profile as any)?.premium_until;
  const referralCode = profile?.referral_code ?? "";
  const shareUrl = `${window.location.origin}/auth?ref=${referralCode}`;

  async function copyLink() {
    await navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  }

  async function redeem() {
    setMessage("");
    const { data: days, error } = await callRpc("redeem_referral_points", { p_points: 1000 });
    if (error) setMessage(error.message);
    else if (!days) setMessage("Poin belum cukup. Kumpulkan 1.000 poin terlebih dahulu.");
    else { setMessage(`Berhasil! Premium +${days} hari.`); await refetch(); }
  }

  async function claimReferral() {
    setMessage("");
    const { data: awarded, error } = await callRpc("award_referral_signup", { p_code: code });
    if (error) setMessage(error.message);
    else if (!awarded) setMessage("Kode referral tidak valid atau sudah digunakan.");
    else { setMessage(`Referral berhasil. Poin yang diberikan: +${awarded}.`); setCode(""); await refetch(); }
  }

  return (
    <AppShell title="Gratis & Referral" description="Belajar gratis tetap tersedia. Ajak teman dan kumpulkan poin untuk mendapatkan Premium.">
      <div className="grid gap-4 md:grid-cols-2">
        <Card className="overflow-hidden border-primary/20 bg-gradient-to-br from-primary/10 via-background to-background">
          <CardHeader><div className="flex items-center justify-between"><div><CardTitle className="flex items-center gap-2"><Gift className="size-5 text-primary" />Paket kamu</CardTitle><CardDescription>Gunakan ENO JAPAN tanpa dipaksa berlangganan.</CardDescription></div><Badge>{plan === "free" ? "FREE" : plan.toUpperCase()}</Badge></div></CardHeader>
          <CardContent className="space-y-3"><div className="rounded-xl border bg-background/70 p-4"><p className="text-sm font-medium">Free</p><p className="mt-1 text-xs text-muted-foreground">Materi inti N5–N1, target harian, progres, dan latihan dasar tetap dapat dipakai.</p></div><div className="rounded-xl border border-primary/20 bg-primary/5 p-4"><p className="flex items-center gap-2 text-sm font-medium"><Sparkles className="size-4 text-primary" />Premium dari poin</p><p className="mt-1 text-xs text-muted-foreground">1.000 poin referral dapat ditukar menjadi 7 hari Premium.</p></div>{premiumUntil ? <p className="text-xs text-muted-foreground">Premium aktif sampai {new Date(premiumUntil).toLocaleDateString("id-ID")}.</p> : null}</CardContent>
        </Card>

        <Card><CardHeader><CardTitle>Poin kamu</CardTitle><CardDescription>Poin berasal dari referral yang berhasil.</CardDescription></CardHeader><CardContent><div className="text-4xl font-bold tracking-tight">{points.toLocaleString("id-ID")}</div><div className="mt-4 h-2 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-primary transition-all duration-500" style={{ width: `${Math.min(100, (points / 1000) * 100)}%` }} /></div><p className="mt-2 text-xs text-muted-foreground">{Math.min(points,1000).toLocaleString("id-ID")} / 1.000 poin</p><Button className="mt-4 w-full" onClick={redeem} disabled={points < 1000}><Sparkles className="mr-2 size-4" />Tukar 1.000 poin → 7 hari Premium</Button></CardContent></Card>

        <Card className="md:col-span-2"><CardHeader><CardTitle>Ajak teman</CardTitle><CardDescription>Bagikan link referral pribadi kamu. Teman yang mendaftar dapat memasukkan kode referral ini.</CardDescription></CardHeader><CardContent className="space-y-4"><div className="flex flex-col gap-2 sm:flex-row"><div className="flex-1 rounded-lg border bg-muted/30 px-3 py-2 text-sm font-mono break-all">{shareUrl}</div><Button variant="outline" onClick={copyLink}>{copied ? <Check className="mr-2 size-4" /> : <Copy className="mr-2 size-4" />}{copied ? "Tersalin" : "Salin link"}</Button></div><div className="flex flex-col gap-2 sm:flex-row"><input value={code} onChange={(e) => setCode(e.target.value)} placeholder="Masukkan kode referral teman" className="flex-1 rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/30" /><Button onClick={claimReferral} disabled={!code.trim()}>Klaim referral</Button></div>{message ? <p className="text-sm text-muted-foreground">{message}</p> : null}<p className="text-xs text-muted-foreground">Kode referral kamu: <span className="font-semibold text-foreground">{referralCode}</span></p></CardContent></Card>
      </div>
    </AppShell>
  );
}
