import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Check, Copy, Users } from "lucide-react";
import { useState } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { getMyAccount } from "@/lib/profile.functions";
import { supabase } from "@/lib/supabase/client";

export const Route = createFileRoute("/_authenticated/referral")({
  head: () => ({ meta: [{ title: "Ajak Teman — ENO NIHONGO" }] }),
  component: ReferralPage,
});

function ReferralPage() {
  const fetchAccount = useServerFn(getMyAccount);
  const { data } = useQuery({ queryKey: ["my-account"], queryFn: () => fetchAccount() });
  const [copied, setCopied] = useState(false);
  const [code, setCode] = useState("");
  const [message, setMessage] = useState("");
  const referralCode = data?.profile?.referral_code ?? "";
  const origin = typeof window === "undefined" ? "https://www.enonihongo.com" : window.location.origin;
  const shareUrl = referralCode ? `${origin}/auth?ref=${encodeURIComponent(referralCode)}` : "";

  async function copyLink() {
    if (!shareUrl) return;
    await navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  }

  async function claimReferral() {
    setMessage("");
    const { data: awarded, error } = await (supabase.rpc as unknown as (
      fn: string,
      args: { p_code: string },
    ) => Promise<{ data: number | null; error: { message: string } | null }>)(
      "award_referral_signup",
      { p_code: code.trim() },
    );
    if (error) setMessage(error.message);
    else if (!awarded) setMessage("Kode referral tidak valid atau sudah digunakan.");
    else {
      setMessage("Kode referral tersimpan. Pengundang mendapat Premium setelah kamu mulai belajar.");
      setCode("");
    }
  }

  return (
    <AppShell title="Ajak Teman" description="Undang teman baru dan dapatkan Premium 30 hari setelah mereka mulai belajar.">
      <div className="mx-auto max-w-2xl">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="size-5 text-primary" />
              Ajak Teman · Premium 30 hari
            </CardTitle>
            <CardDescription>
              Bagikan tautan undangan pribadi. Hadiah diberikan setelah teman baru menyelesaikan aktivitas belajar yang memenuhi syarat.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-lg border bg-muted/30 p-3">
              <p className="text-xs text-muted-foreground">Kode referral kamu</p>
              <p className="mt-1 break-all font-mono text-lg font-semibold">{referralCode || "Memuat…"}</p>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row">
              <div className="min-w-0 flex-1 break-all rounded-lg border bg-muted/30 px-3 py-2 text-sm">{shareUrl}</div>
              <Button variant="outline" onClick={copyLink} disabled={!shareUrl}>
                {copied ? <Check className="mr-2 size-4" /> : <Copy className="mr-2 size-4" />}
                {copied ? "Tersalin" : "Salin tautan"}
              </Button>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row">
              <input
                value={code}
                onChange={(event) => setCode(event.target.value)}
                placeholder="Kode referral teman (untuk pengguna baru)"
                className="min-w-0 flex-1 rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/30"
              />
              <Button onClick={claimReferral} disabled={!code.trim()}>Gunakan kode</Button>
            </div>
            {message ? <p role="status" className="text-sm text-muted-foreground">{message}</p> : null}
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
