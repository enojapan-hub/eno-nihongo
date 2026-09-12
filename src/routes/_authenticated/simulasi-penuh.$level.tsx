import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, ArrowRight, CheckCircle2, Clock3, RotateCcw } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { jlptSessions, sectionLabels } from "@/lib/jlpt-simulation-config";
import type { Level } from "@/lib/learn-queries";

export const Route = createFileRoute("/_authenticated/simulasi-penuh/$level")({ component: FullSimulationOverview });
type StoredProgress={sessionIndex:number;sectionIndex:number;startedAt:number;completed:string[]};

function FullSimulationOverview() {
  const { level: rawLevel } = Route.useParams();
  const level = rawLevel.toUpperCase() as Level;
  const sessions = jlptSessions[level] ?? [];
  const storageKey=`eno-jlpt-full-${level}`;
  const totalMinutes = sessions.reduce((sum, session) => sum + session.minutes, 0);
  const [progress,setProgress]=useState<StoredProgress|null>(null);
  useEffect(()=>{try{const raw=window.localStorage.getItem(storageKey);if(raw)setProgress(JSON.parse(raw))}catch{setProgress(null)}},[storageKey]);
  const active=useMemo(()=>{if(!progress)return null;const session=sessions[progress.sessionIndex];const section=session?.sections[progress.sectionIndex];return session&&section?{session,section}:null},[progress,sessions]);
  const begin=()=>{const next:StoredProgress={sessionIndex:0,sectionIndex:0,startedAt:Date.now(),completed:[]};window.localStorage.setItem(storageKey,JSON.stringify(next));setProgress(next)};
  const reset=()=>{window.localStorage.removeItem(storageKey);setProgress(null)};

  return <AppShell title={`Simulasi JLPT ${level}`} compact><div className="mx-auto max-w-xl space-y-3">
    <div className="flex items-center justify-between"><Button asChild size="sm" variant="ghost"><Link to="/simulasi"><ArrowLeft className="mr-1 size-4"/>Kembali</Link></Button><span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">本試験モード</span></div>
    <Card className="rounded-2xl"><CardContent className="p-5"><p className="text-xs font-semibold text-primary">日本語能力試験 {level}</p><h1 className="mt-1 text-xl font-bold">Simulasi Penuh</h1><p className="mt-2 text-xs leading-5 text-muted-foreground">Urutan sesi mengikuti struktur ujian. Progres disimpan di perangkat sehingga sesi tidak kembali ke awal jika halaman tertutup.</p><div className="mt-4 flex items-center gap-2 text-sm font-semibold"><Clock3 className="size-4 text-primary"/>Total sesi: {totalMinutes} menit</div></CardContent></Card>
    <div className="space-y-2">{sessions.map((session,i)=>{const done=progress?i<progress.sessionIndex:false;const current=progress?.sessionIndex===i;return <Card key={session.id} className={`rounded-2xl ${current?"border-primary":""}`}><CardContent className="p-4"><div className="flex items-start justify-between gap-3"><div><p className="flex items-center gap-1 text-[10px] font-semibold text-muted-foreground">第 {i+1} セッション {done&&<CheckCircle2 className="size-3 text-primary"/>}</p><h2 className="mt-1 font-jp text-sm font-bold">{session.labelJp}</h2><p className="mt-2 text-[11px] text-muted-foreground">{session.sections.map(s=>sectionLabels[s]).join("・")}</p></div><span className="shrink-0 rounded-lg border px-2 py-1 text-xs font-bold">{session.minutes}分</span></div>{current&&active&&<p className="mt-3 text-[10px] font-semibold text-primary">進行中 · {sectionLabels[active.section]}</p>}</CardContent></Card>})}</div>
    {!progress?<Button className="w-full" onClick={begin}>Mulai simulasi penuh<ArrowRight className="ml-1 size-4"/></Button>:active?<><Button asChild className="w-full"><Link to="/simulasi-bagian/$level/$section" params={{level,section:active.section}}>Lanjutkan {sectionLabels[active.section]}<ArrowRight className="ml-1 size-4"/></Link></Button><Button variant="outline" className="w-full" onClick={reset}><RotateCcw className="mr-1 size-4"/>Mulai ulang simulasi</Button></>:<Card><CardContent className="p-5 text-center"><CheckCircle2 className="mx-auto size-8 text-primary"/><p className="mt-2 font-semibold">Simulasi selesai</p><Button className="mt-4" onClick={reset}>Simulasi baru</Button></CardContent></Card>}
  </div></AppShell>;
}
