import { useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, Download, Loader2, Share2, ShieldCheck } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { buildPracticeResult, type FullProgress } from "@/lib/jlpt-simulation-result";
import type { Level } from "@/lib/learn-queries";

export const Route = createFileRoute("/_authenticated/sertifikat-simulasi/$level")({ component: Certificate });

function Certificate() {
  const { level: raw } = Route.useParams();
  const level = raw.toUpperCase() as Level;
  const [progress, setProgress] = useState<FullProgress | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [name, setName] = useState("Peserta ENO NIHONGO");

  useEffect(() => {
    try {
      const value = window.localStorage.getItem(`eno-jlpt-full-${level}`);
      setProgress(value ? (JSON.parse(value) as FullProgress) : null);
    } catch { setProgress(null); }
    void supabase.auth.getUser().then(({ data }) => {
      const meta = data.user?.user_metadata as Record<string, unknown> | undefined;
      const candidate = String(meta?.full_name ?? meta?.name ?? data.user?.email?.split("@")[0] ?? "").trim();
      if (candidate) setName(candidate);
    }).finally(() => setLoaded(true));
  }, [level]);

  if (!loaded) return <AppShell title="Sertifikat"><div className="mx-auto flex max-w-lg items-center justify-center py-16 text-sm text-muted-foreground"><Loader2 className="mr-2 size-4 animate-spin" /> Memuat sertifikat...</div></AppShell>;

  const result = progress?.results ? buildPracticeResult(level, progress) : null;
  if (!progress || !result?.passed) return <AppShell title="Sertifikat"><div className="mx-auto max-w-lg"><Card><CardContent className="p-6 text-center"><p className="font-semibold">Sertifikat belum tersedia.</p><p className="mt-2 text-xs text-muted-foreground">Selesaikan dan lulus Simulasi Penuh terlebih dahulu.</p><Button asChild className="mt-4"><Link to="/simulasi-penuh/$level" params={{ level }}>Kembali</Link></Button></CardContent></Card></div></AppShell>;

  const date = new Date(progress.completedAt ?? progress.startedAt).toLocaleDateString("id-ID", { day: "2-digit", month: "long", year: "numeric" });
  const verification = `ENO-${level}-${progress.startedAt.toString(36).toUpperCase()}`;
  const share = async () => {
    const data = { title: `Sertifikat Simulasi JLPT ${level} · ENO NIHONGO`, text: `${name} lulus Simulasi Penuh JLPT ${level} ENO NIHONGO dengan skor ${result.total}/180${result.cefr ? ` · CEFR ${result.cefr}` : ""}.`, url: window.location.href };
    if (navigator.share) {
      try {
        await navigator.share(data);
      } catch {
        // The native share sheet can be dismissed by the user; no action is required.
      }
    } else {
      await navigator.clipboard?.writeText(`${data.text} ${data.url}`);
    }
  };

  return <AppShell title="Sertifikat Simulasi" compact><div className="mx-auto max-w-5xl space-y-3">
    <div className="flex flex-wrap items-center justify-between gap-2 print:hidden"><Button asChild variant="ghost" size="sm"><Link to="/simulasi-penuh/$level" params={{ level }}><ArrowLeft className="mr-1 size-4" />Hasil</Link></Button><div className="flex gap-2"><Button variant="outline" size="sm" onClick={() => void share()}><Share2 className="mr-1 size-4" />Bagikan</Button><Button size="sm" onClick={() => window.print()}><Download className="mr-1 size-4" />Simpan PDF</Button></div></div>

    <div id="eno-certificate" className="relative aspect-[1.414/1] min-h-[520px] overflow-hidden rounded-[28px] border bg-[#fbfaf5] text-[#173c2d] shadow-xl print:aspect-[1.414/1] print:min-h-0 print:rounded-none print:border-0 print:shadow-none">
      <div className="absolute inset-3 rounded-[22px] border-[3px] border-double border-[#2f6b50]/60" />
      <div className="absolute inset-6 rounded-[18px] border border-[#c8a85b]/60" />
      <div className="absolute -left-20 -top-20 size-64 rounded-full border-[36px] border-[#2f6b50]/5" /><div className="absolute -bottom-24 -right-20 size-72 rounded-full border-[42px] border-[#c8a85b]/10" />
      <div className="absolute right-12 top-12 font-jp text-7xl font-black text-[#2f6b50]/[.035] sm:text-9xl">合格</div>

      <div className="relative z-10 flex h-full flex-col items-center px-8 py-10 text-center sm:px-16 sm:py-12">
        <img src="/enonihongo-logo-light.png" alt="ENO NIHONGO" className="h-16 w-auto object-contain sm:h-20" />
        <p className="mt-2 text-[9px] font-bold tracking-[.42em] text-[#2f6b50] sm:text-[11px]">ENO NIHONGO · 日本語学習</p>
        <h1 className="mt-5 text-xl font-black tracking-[.16em] text-[#183a2c] sm:text-3xl">CERTIFICATE OF ACHIEVEMENT</h1>
        <p className="mt-2 font-jp text-xs font-semibold tracking-[.18em] text-[#8a6b28] sm:text-sm">日本語能力 模擬試験 合格証明書</p>
        <div className="my-5 flex w-full max-w-xl items-center gap-3"><span className="h-px flex-1 bg-[#c8a85b]/50"/><span className="font-jp text-[#c8a85b]">◆</span><span className="h-px flex-1 bg-[#c8a85b]/50"/></div>

        <p className="text-[10px] uppercase tracking-[.18em] text-[#5e7168]">Diberikan kepada</p>
        <p className="mt-2 max-w-2xl border-b border-[#c8a85b]/50 px-8 pb-2 text-2xl font-black tracking-wide text-[#173c2d] sm:text-4xl">{name}</p>
        <p className="mt-4 max-w-xl text-[11px] leading-5 text-[#5e7168] sm:text-xs">atas keberhasilan menyelesaikan dan memenuhi standar kelulusan <b>Simulasi Penuh JLPT {level}</b> ENO NIHONGO.</p>

        <div className="mt-5 grid w-full max-w-2xl grid-cols-4 divide-x divide-[#c8a85b]/40 rounded-2xl border border-[#c8a85b]/50 bg-white/60 py-3">
          <div><p className="text-[8px] font-bold tracking-wider text-[#7a877f]">LEVEL</p><p className="mt-1 text-lg font-black">{level}</p></div>
          <div><p className="text-[8px] font-bold tracking-wider text-[#7a877f]">SKOR</p><p className="mt-1 text-lg font-black">{result.total}<span className="text-[10px] font-semibold"> / 180</span></p></div>
          <div><p className="text-[8px] font-bold tracking-wider text-[#7a877f]">HASIL</p><p className="mt-1 font-jp text-sm font-black">合格 · LULUS</p></div>
          <div><p className="text-[8px] font-bold tracking-wider text-[#7a877f]">CEFR</p><p className="mt-1 text-lg font-black">{result.cefr ?? "—"}</p></div>
        </div>

        <div className="mt-auto flex w-full max-w-2xl items-end justify-between gap-4 pt-5 text-left">
          <div><p className="text-[8px] font-bold tracking-wider text-[#7a877f]">TANGGAL</p><p className="mt-1 text-[10px] font-bold sm:text-xs">{date}</p><div className="mt-3 flex items-center gap-1.5 text-[8px] text-[#68766f] sm:text-[9px]"><ShieldCheck className="size-3 text-[#2f6b50]"/>Verification ID: <span className="font-mono font-semibold">{verification}</span></div></div>
          <div className="grid size-20 place-items-center rounded-full border-2 border-[#2f6b50]/50 bg-[#2f6b50]/5 text-center font-jp text-[10px] font-black leading-4 text-[#2f6b50] sm:size-24"><span>ENO<br/>NIHONGO<br/><b className="text-lg">認定</b></span></div>
        </div>
        <p className="mt-3 max-w-3xl text-[7px] leading-3 text-[#849087] sm:text-[8px]">Sertifikat digital ini diterbitkan ENO NIHONGO sebagai bukti pencapaian simulasi belajar. Skor dan CEFR bersifat referensi simulasi. Bukan sertifikat resmi JLPT atau CEFR dan tidak diterbitkan maupun disahkan oleh penyelenggara JLPT.</p>
      </div>
    </div>

    <p className="text-center text-[10px] text-muted-foreground print:hidden">Gunakan “Simpan PDF” untuk membuka dialog cetak perangkat lalu pilih Save as PDF. Tombol Bagikan memakai fitur berbagi bawaan perangkat.</p>
    <style>{`@media print{body *{visibility:hidden!important}#eno-certificate,#eno-certificate *{visibility:visible!important}#eno-certificate{position:fixed!important;inset:0!important;width:100vw!important;height:100vh!important;margin:0!important}@page{size:A4 landscape;margin:0}}`}</style>
  </div></AppShell>;
}
