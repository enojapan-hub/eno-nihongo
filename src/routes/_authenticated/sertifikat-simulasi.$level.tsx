import { useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Award, ArrowLeft, Loader2, ShieldCheck } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { buildPracticeResult, type FullProgress } from "@/lib/jlpt-simulation-result";
import type { Level } from "@/lib/learn-queries";

export const Route = createFileRoute("/_authenticated/sertifikat-simulasi/$level")({ component: Certificate });

function Certificate() {
  const { level: raw } = Route.useParams();
  const level = raw.toUpperCase() as Level;
  const [progress, setProgress] = useState<FullProgress | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    try {
      const value = window.localStorage.getItem(`eno-jlpt-full-${level}`);
      setProgress(value ? (JSON.parse(value) as FullProgress) : null);
    } catch {
      setProgress(null);
    } finally {
      setLoaded(true);
    }
  }, [level]);

  if (!loaded) {
    return (
      <AppShell title="Sertifikat">
        <div className="mx-auto flex max-w-lg items-center justify-center py-16 text-sm text-muted-foreground">
          <Loader2 className="mr-2 size-4 animate-spin" /> Memuat sertifikat...
        </div>
      </AppShell>
    );
  }

  const result = progress?.results ? buildPracticeResult(level, progress) : null;
  if (!progress || !result?.passed) {
    return (
      <AppShell title="Sertifikat">
        <div className="mx-auto max-w-lg">
          <Card><CardContent className="p-6 text-center">
            <p className="font-semibold">Sertifikat belum tersedia.</p>
            <p className="mt-2 text-xs text-muted-foreground">Selesaikan dan lulus Simulasi Penuh terlebih dahulu.</p>
            <Button asChild className="mt-4"><Link to="/simulasi-penuh/$level" params={{ level }}>Kembali</Link></Button>
          </CardContent></Card>
        </div>
      </AppShell>
    );
  }

  const date = new Date(progress.startedAt).toLocaleDateString("id-ID", { day: "2-digit", month: "long", year: "numeric" });
  const verification = `ENO-${level}-${progress.startedAt.toString(36).toUpperCase()}`;

  return (
    <AppShell title="Sertifikat Simulasi" compact>
      <div className="mx-auto max-w-2xl space-y-3">
        <Button asChild variant="ghost" size="sm"><Link to="/simulasi-penuh/$level" params={{ level }}><ArrowLeft className="mr-1 size-4" />Hasil</Link></Button>
        <div className="rounded-[28px] border-4 border-double border-primary/40 bg-card p-3 shadow-sm">
          <div className="rounded-[22px] border border-primary/20 p-7 text-center sm:p-10">
            <Award className="mx-auto size-12 text-primary" />
            <p className="mt-4 text-xs font-bold tracking-[.25em] text-primary">ENO NIHONGO</p>
            <h1 className="mt-3 text-2xl font-black tracking-wide">CERTIFICATE OF ACHIEVEMENT</h1>
            <p className="mt-2 font-jp text-sm font-semibold">日本語能力 模擬試験 合格証明書</p>
            <div className="mx-auto my-6 h-px max-w-sm bg-border" />
            <p className="text-xs text-muted-foreground">Diberikan atas keberhasilan menyelesaikan</p>
            <p className="mt-2 text-lg font-bold">Simulasi Penuh JLPT {level}</p>
            <div className="mx-auto mt-6 grid max-w-md grid-cols-2 gap-3 text-left">
              <div className="rounded-xl bg-muted/50 p-3"><p className="text-[10px] text-muted-foreground">LEVEL</p><p className="mt-1 text-lg font-black">{level}</p></div>
              <div className="rounded-xl bg-muted/50 p-3"><p className="text-[10px] text-muted-foreground">SKOR SIMULASI</p><p className="mt-1 text-lg font-black">{result.total} / 180</p></div>
              <div className="rounded-xl bg-muted/50 p-3"><p className="text-[10px] text-muted-foreground">HASIL</p><p className="mt-1 font-jp text-base font-black text-primary">合格 · LULUS</p></div>
              <div className="rounded-xl bg-muted/50 p-3"><p className="text-[10px] text-muted-foreground">TANGGAL</p><p className="mt-1 text-xs font-bold">{date}</p></div>
            </div>
            <div className="mt-7 flex items-center justify-center gap-2 text-[10px] text-muted-foreground"><ShieldCheck className="size-4 text-primary" />Verification ID: <span className="font-mono font-semibold">{verification}</span></div>
            <p className="mt-5 text-[10px] leading-5 text-muted-foreground">Sertifikat digital ini diterbitkan oleh ENO NIHONGO untuk pencapaian dalam simulasi belajar. Bukan sertifikat resmi JLPT dan tidak diterbitkan atau disahkan oleh penyelenggara JLPT.</p>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
