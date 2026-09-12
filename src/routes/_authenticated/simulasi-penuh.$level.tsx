import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, ArrowRight, Clock3 } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { jlptSessions, sectionLabels } from "@/lib/jlpt-simulation-config";
import type { Level } from "@/lib/learn-queries";

export const Route = createFileRoute("/_authenticated/simulasi-penuh/$level")({ component: FullSimulationOverview });

function FullSimulationOverview() {
  const { level: rawLevel } = Route.useParams();
  const level = rawLevel.toUpperCase() as Level;
  const sessions = jlptSessions[level] ?? [];
  const totalMinutes = sessions.reduce((sum, session) => sum + session.minutes, 0);

  return (
    <AppShell title={`Simulasi JLPT ${level}`} compact>
      <div className="mx-auto max-w-xl space-y-3">
        <div className="flex items-center justify-between">
          <Button asChild size="sm" variant="ghost"><Link to="/simulasi"><ArrowLeft className="mr-1 size-4" />Kembali</Link></Button>
          <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">本試験モード</span>
        </div>
        <Card className="rounded-2xl"><CardContent className="p-5">
          <p className="text-xs font-semibold text-primary">日本語能力試験 {level}</p>
          <h1 className="mt-1 text-xl font-bold">Simulasi Penuh</h1>
          <p className="mt-2 text-xs leading-5 text-muted-foreground">Semua bagian dijalankan mengikuti urutan sesi ujian. Jawaban tidak dinilai sampai sesi selesai.</p>
          <div className="mt-4 flex items-center gap-2 text-sm font-semibold"><Clock3 className="size-4 text-primary" />Total sesi: {totalMinutes} menit</div>
        </CardContent></Card>
        <div className="space-y-2">{sessions.map((session, i) => (
          <Card key={session.id} className="rounded-2xl"><CardContent className="p-4">
            <div className="flex items-start justify-between gap-3"><div><p className="text-[10px] font-semibold text-muted-foreground">第 {i + 1} セッション</p><h2 className="mt-1 font-jp text-sm font-bold">{session.labelJp}</h2><p className="mt-2 text-[11px] text-muted-foreground">{session.sections.map(s => sectionLabels[s]).join("・")}</p></div><span className="shrink-0 rounded-lg border px-2 py-1 text-xs font-bold">{session.minutes}分</span></div>
          </CardContent></Card>
        ))}</div>
        <Card className="rounded-2xl border-dashed"><CardContent className="p-4 text-xs leading-5 text-muted-foreground">Sesi berikutnya tidak dimulai otomatis sebelum sesi aktif diselesaikan. Timer akan direset sesuai durasi setiap sesi, sementara jawaban tetap tersimpan sampai seluruh simulasi selesai.</CardContent></Card>
        {sessions[0] && <Button asChild className="w-full"><Link to="/simulasi-bagian/$level/$section" params={{ level, section: sessions[0].sections[0] }}>Mulai sesi pertama<ArrowRight className="ml-1 size-4" /></Link></Button>}
      </div>
    </AppShell>
  );
}
