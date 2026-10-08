import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Gift, Copy, Check, Sparkles, Instagram, Share2, Users } from "lucide-react";
import { useState } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { getMyAccount } from "@/lib/profile.functions";
import { supabase } from "@/lib/supabase/client";

type RpcResult<T> = { data: T | null; error: { message: string } | null };
function callRpc<T = number>(fn: string, args: Record<string, unknown>): Promise<RpcResult<T>> {
  return (supabase.rpc as unknown as (name: string, params: Record<string, unknown>) => Promise<RpcResult<T>>)(fn, args);
}

export const Route = createFileRoute("/_authenticated/referral")({
  head: () => ({ meta: [{ title: "Gratis & Referral — ENO JAPAN" }] }),
  component: ReferralPage,
});

function ReferralPage() {
  const fetchAccount = useServerFn(getMyAccount);
  const { data, refetch } = useQuery({ queryKey: ["my-account"], queryFn: () => fetchAccount() });
  const rewards = useQuery({ queryKey: ["reward-balance"], queryFn: async () => { const { data: user } = await supabase.auth.getUser(); if (!user.user) return { points: 0, claims: [] as string[] }; const [{ data: stats }, claims] = await Promise.all([supabase.from("user_stats").select("reward_points").eq("user_id", user.user.id).maybeSingle(), callRpc<string[]>("get_social_reward_claims", {})]); return { points: stats?.reward_points ?? 0, claims: claims.data ?? [] }; } });
  const [copied, setCopied] = useState(false);
  const [code, setCode] = useState("");
  const [message, setMessage] = useState("");
  const profile = data?.profile;
  const points = rewards.data?.points ?? 0;
  const plan = profile?.plan ?? "free";
  const premiumUntil = profile?.premium_until;
  const referralCode = profile?.referral_code ?? "";
  const shareUrl = `${window.location.origin}/auth?ref=${referralCode}`;

  async function copyLink() {
    await navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  }

  async function redeem() {
    setMessage("");
    const { data: days, error } = await callRpc("redeem_points_for_premium", { p_points: 1000 });
    if (error) setMessage(error.message);
    else if (!days) setMessage("Poin belum cukup. Kumpulkan 1.000 poin terlebih dahulu.");
    else {
      setMessage(`Berhasil! Premium +${days} hari.`);
      await Promise.all([refetch(), rewards.refetch()]);
    }
  }

  async function claimReferral() {
    setMessage("");
    const { data: awarded, error } = await callRpc("award_referral_signup", { p_code: code });
    if (error) setMessage(error.message);
    else if (!awarded) setMessage("Kode referral tidak valid atau sudah digunakan.");
    else {
      setMessage("Kode referral tersimpan. Premium 30 hari diberikan kepada pengundang setelah kamu mulai belajar.");
      setCode("");
      await refetch();
    }
  }

  async function claimSocial(mission: "instagram_follow" | "tiktok_follow" | "share") {
    setMessage("");
    const { data: awarded, error } = await callRpc("claim_social_reward", { p_mission: mission });
    if (error) setMessage(error.message);
    else if (!awarded) setMessage("Hadiah misi ini sudah pernah diklaim.");
    else { setMessage(`Berhasil mendapat +${awarded} Poin.`); await rewards.refetch(); }
  }

  async function shareEno() {
    const url = window.location.origin;
    if (navigator.share) await navigator.share({ title: "ENO NIHONGO", text: "Belajar bahasa Jepang dari N5 sampai N1 di ENO NIHONGO.", url });
    else await navigator.clipboard.writeText(url);
    await claimSocial("share");
  }

  return (
    <AppShell
      title="Gratis & Referral"
      description="Kumpulkan Poin dari belajar dan misi ENO, tukarkan dengan Premium, atau ajak teman untuk mendapat Premium 30 hari."
    >
      <div className="grid gap-4 md:grid-cols-2">
        <Card className="overflow-hidden border-primary/20 bg-gradient-to-br from-primary/10 via-background to-background">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Gift className="size-5 text-primary" />
                  Paket kamu
                </CardTitle>
                <CardDescription>Gunakan ENO JAPAN tanpa dipaksa berlangganan.</CardDescription>
              </div>
              <Badge>{plan === "free" ? "FREE" : plan.toUpperCase()}</Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="rounded-xl border bg-background/70 p-4">
              <p className="text-sm font-medium">Free</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Materi inti N5–N1, target harian, progres, dan latihan dasar tetap dapat dipakai.
              </p>
            </div>
            <div className="rounded-xl border border-primary/20 bg-primary/5 p-4">
              <p className="flex items-center gap-2 text-sm font-medium">
                <Sparkles className="size-4 text-primary" />
                Premium dari poin
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                1.000 Poin dapat ditukar menjadi 7 hari Premium. XP tetap khusus untuk progres level akun.
              </p>
            </div>
            {premiumUntil ? (
              <p className="text-xs text-muted-foreground">
                Premium aktif sampai {new Date(premiumUntil).toLocaleDateString("id-ID")}.
              </p>
            ) : null}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Poin kamu</CardTitle>
            <CardDescription>Saldo Poin untuk hadiah. Menukar Poin tidak mengurangi catatan peringkat yang sudah diperoleh.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-4xl font-bold tracking-tight">
              {points.toLocaleString("id-ID")}
            </div>
            <div className="mt-4 h-2 overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-primary transition-all duration-500"
                style={{ width: `${Math.min(100, (points / 1000) * 100)}%` }}
              />
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              {Math.min(points, 1000).toLocaleString("id-ID")} / 1.000 poin
            </p>
            <Button className="mt-4 w-full" onClick={redeem} disabled={points < 1000}>
              <Sparkles className="mr-2 size-4" />
              Tukar 1.000 poin → 7 hari Premium
            </Button>
          </CardContent>
        </Card>

        <Card className="md:col-span-2">
          <CardHeader><CardTitle>Misi ENO</CardTitle><CardDescription>Dukung akun resmi ENO NIHONGO. Setiap hadiah hanya dapat diklaim satu kali.</CardDescription></CardHeader>
          <CardContent className="grid gap-2 sm:grid-cols-3">
            <a href="https://www.instagram.com/enonihongo/" target="_blank" rel="noreferrer" className="rounded-xl border p-3"><div className="flex items-center gap-2 text-sm font-semibold"><Instagram className="size-4" /> Follow Instagram</div><p className="mt-1 text-xs text-muted-foreground">Hadiah +100 Poin</p><Button className="mt-3 w-full" variant="outline" disabled={rewards.data?.claims.includes("instagram_follow")} onClick={(e) => { e.preventDefault(); window.open("https://www.instagram.com/enonihongo/","_blank","noopener,noreferrer"); void claimSocial("instagram_follow"); }}>{rewards.data?.claims.includes("instagram_follow") ? "Sudah diklaim" : "Buka & Klaim"}</Button></a>
            <a href="https://www.tiktok.com/@enonihongo.id" target="_blank" rel="noreferrer" className="rounded-xl border p-3"><div className="flex items-center gap-2 text-sm font-semibold"><Sparkles className="size-4" /> Follow TikTok</div><p className="mt-1 text-xs text-muted-foreground">Hadiah +100 Poin</p><Button className="mt-3 w-full" variant="outline" disabled={rewards.data?.claims.includes("tiktok_follow")} onClick={(e) => { e.preventDefault(); window.open("https://www.tiktok.com/@enonihongo.id","_blank","noopener,noreferrer"); void claimSocial("tiktok_follow"); }}>{rewards.data?.claims.includes("tiktok_follow") ? "Sudah diklaim" : "Buka & Klaim"}</Button></a>
            <div className="rounded-xl border p-3"><div className="flex items-center gap-2 text-sm font-semibold"><Share2 className="size-4" /> Bagikan ENO</div><p className="mt-1 text-xs text-muted-foreground">Hadiah +50 Poin</p><Button className="mt-3 w-full" variant="outline" disabled={rewards.data?.claims.includes("share")} onClick={() => void shareEno()}>{rewards.data?.claims.includes("share") ? "Sudah diklaim" : "Bagikan & Klaim"}</Button></div>
          </CardContent>
        </Card>

        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Users className="size-5 text-primary" /> Ajak teman · Premium 30 hari</CardTitle>
            <CardDescription>
              Bagikan link referral pribadi kamu. Setelah teman memakai kode dan mulai belajar, kamu mendapat Premium 30 hari. Premium ditambahkan ke masa aktif yang masih tersisa.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-col gap-2 sm:flex-row">
              <div className="flex-1 rounded-lg border bg-muted/30 px-3 py-2 text-sm font-mono break-all">
                {shareUrl}
              </div>
              <Button variant="outline" onClick={copyLink}>
                {copied ? <Check className="mr-2 size-4" /> : <Copy className="mr-2 size-4" />}
                {copied ? "Tersalin" : "Salin link"}
              </Button>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row">
              <input
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="Masukkan kode referral teman"
                className="flex-1 rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/30"
              />
              <Button onClick={claimReferral} disabled={!code.trim()}>
                Klaim referral
              </Button>
            </div>
            {message ? <p className="text-sm text-muted-foreground">{message}</p> : null}
            <p className="text-xs text-muted-foreground">
              Kode referral kamu:{" "}
              <span className="font-semibold text-foreground">{referralCode}</span>
            </p>
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
