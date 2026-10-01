import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { BookOpenCheck, CheckCircle2, Clock3, Flame, Languages, ListChecks, RefreshCcw, Target, Type, Zap, ChevronRight, BrainCircuit, CalendarDays, Shuffle, RotateCcw, Play } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { Card, CardContent } from "@/components/ui/card";
import { adaptiveTaskLabels, fetchAdaptivePlan, type AdaptiveTask, type AdaptiveTaskType } from "@/lib/adaptive-plan";
import { analyzeMastery, type MasteryReview } from "@/lib/mastery-analysis";
import { masteryTrainingHref } from "@/lib/mastery-training";
import { supabase } from "@/integrations/supabase/client";
import { fetchMembershipAccess } from "@/lib/membership";
import { fetchLatestSimulation, fetchMastery, fetchTargetMetrics, fetchWeeklyPlan, kindLabel, type MasteryRow } from "@/lib/learning-hub";
import type { Level } from "@/lib/learn-queries";
import { PremiumBadge } from "@/components/membership/PremiumBadge";
import { PremiumUpgradeDialog } from "@/components/membership/PremiumUpgradeDialog";

export const Route=createFileRoute("/_authenticated/target")({head:()=>({meta:[{title:"Target — ENO NIHONGO"}]}),component:TargetPage});
const fallback:Partial<Record<AdaptiveTaskType,string>>={new_kanji:"/kanji",new_vocabulary:"/kotoba",new_grammar:"/bunpo",review:"/hafalan",quiz:"/quiz",reading:"/dokkai",listening:"/listening"};

async function fetchWeakness(level:string){const{data:u}=await supabase.auth.getUser();if(!u.user)return[];const[{data:reviews,error},{data:reading,error:readingError}]=await Promise.all([(supabase as any).from("flashcard_reviews").select("item_type,item_id,rating,direction,aspect,used_hint,response_ms").eq("user_id",u.user.id).eq("level",level).order("created_at",{ascending:false}).limit(500),(supabase as any).from("learning_activity").select("content_id,correct,metadata").eq("user_id",u.user.id).eq("content_type","reading").eq("activity_type","quiz_answered").order("created_at",{ascending:false}).limit(200)]);if(error)throw error;const base=(reviews??[]) as MasteryReview[];if(readingError)return analyzeMastery(base);const dokkai:MasteryReview[]=(reading??[]).filter((r:any)=>String(r.metadata?.level??"")===level).map((r:any)=>({item_type:"reading",item_id:r.content_id,rating:r.correct?2:0,aspect:"context",direction:null,used_hint:false,response_ms:null}));return analyzeMastery([...base,...dokkai])}
function timeLabel(s:number){const m=Math.floor(s/60);return m<60?`${m}m`:`${Math.floor(m/60)}j ${m%60}m`}
function kindFor(t:AdaptiveTaskType){return t==="new_kanji"?"kanji":t==="new_vocabulary"?"vocabulary":t==="new_grammar"?"grammar":t==="reading"?"reading":t==="listening"?"listening":"review"}
function studyHref(task:AdaptiveTask,id:string){if(task.task_type==="review")return task.metadata?.kiokuRecommended?"/kioku":"/hafalan";const ids=(task.suggestions??[]).map(x=>x.id).join(",");return `/study-item?kind=${kindFor(task.task_type)}&id=${encodeURIComponent(id)}&queue=${encodeURIComponent(ids)}`}
function CompactTask({task}:{task:AdaptiveTask;locked?:boolean;onUpgrade?:()=>void}){const done=Math.min(task.completed_count,task.target_count),p=task.target_count?Math.min(100,done/task.target_count*100):0,first=task.suggestions?.[0];const href=first?studyHref(task,first.id):(fallback[task.task_type]||"/belajar");return <a href={href} className="min-h-[112px] rounded-2xl border bg-card p-3 transition hover:border-primary/30 hover:bg-primary/[.025]"><div className="flex items-start justify-between gap-2"><span className="grid size-8 place-items-center rounded-xl bg-primary/10 text-primary"><CheckCircle2 className="size-4"/></span><ChevronRight className="size-4 text-muted-foreground"/></div><p className="mt-2 truncate text-[11px] font-semibold">{adaptiveTaskLabels[task.task_type]}</p><p className="mt-0.5 text-[9px] text-muted-foreground">{done}/{task.target_count} selesai</p><div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-primary" style={{width:`${p}%`}}/></div></a>}

const weeklyRows:Array<{label:string;taskType:string}>=[{label:"Kotoba",taskType:"new_vocabulary"},{label:"Kanji",taskType:"new_kanji"},{label:"Bunpou",taskType:"new_grammar"},{label:"Kuis",taskType:"quiz"}];
const monthYear=(date:string|null|undefined)=>{if(!date)return"";const d=new Date(`${date}T00:00:00+09:00`);return Number.isNaN(d.getTime())?"":new Intl.DateTimeFormat("id-ID",{timeZone:"Asia/Tokyo",month:"long",year:"numeric"}).format(d)};
const pctOf=(a:number,b:number)=>b>0?Math.min(100,Math.round(a/b*100)):0;

function Bar({value}:{value:number}){return <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-primary" style={{width:`${value}%`}}/></div>}
function SectionTitle({children,note}:{children:React.ReactNode;note?:string}){return <div className="mb-2 px-1"><h2 className="text-[13px] font-semibold">{children}</h2>{note&&<p className="mt-0.5 text-[9px] text-muted-foreground">{note}</p>}</div>}

function TargetPage(){
  const[upgradeOpen,setUpgradeOpen]=useState(false);
  const adaptive=useQuery({queryKey:["adaptive-plan"],queryFn:fetchAdaptivePlan,staleTime:30000,refetchInterval:30000});
  const membership=useQuery({queryKey:["membership-access"],queryFn:fetchMembershipAccess,staleTime:30000});
  const metrics=useQuery({queryKey:["target-live-metrics"],queryFn:fetchTargetMetrics,staleTime:15000,refetchInterval:30000});
  const plan=adaptive.data,level=(plan?.targetLevel??"N5") as Level,planActive=Boolean(plan?.active);
  const weakness=useQuery({queryKey:["target-weakness-v2",level],queryFn:()=>fetchWeakness(level),enabled:!!plan,staleTime:30000,refetchInterval:60000});
  const mastery=useQuery({queryKey:["target-mastery",level],queryFn:()=>fetchMastery(level),enabled:!!plan,staleTime:30000});
  const simulation=useQuery({queryKey:["target-simulation",level],queryFn:()=>fetchLatestSimulation(level),enabled:!!plan,staleTime:60000});
  const planId=plan?.planId??undefined;
  const weekly=useQuery({queryKey:["target-weekly",planId,plan?.studyDaysPerWeek,plan?.completed],queryFn:()=>fetchWeeklyPlan(planId,plan?.studyDaysPerWeek??7),enabled:!!planId,staleTime:15000});
  const locked=!membership.isLoading&&!membership.data?.hasPremiumAccess;
  const tasks=plan?.tasks??[];
  const pending=tasks.filter(t=>t.target_count>0&&t.completed_count<t.target_count);
  const nextTask=pending[0];
  const nextHref=nextTask?(nextTask.suggestions?.[0]?studyHref(nextTask,nextTask.suggestions[0].id):(fallback[nextTask.task_type]||"/belajar")):"/belajar";
  const core=(mastery.data??[]).filter(r=>r.kind==="kanji"||r.kind==="vocabulary"||r.kind==="grammar");
  const coreTotal=core.reduce((n,r)=>n+r.total,0),coreMastered=core.reduce((n,r)=>n+r.mastered,0),coreLearned=core.reduce((n,r)=>n+r.learned,0);
  const overdueCount=Math.max(metrics.data?.dueReviewCount??0,tasks.find(t=>t.task_type==="review")?.suggestions?.length??0);
  const weak=weakness.data?.[0];
  const kiokuRecommended=Boolean(tasks.find(t=>t.task_type==="review")?.metadata?.kiokuRecommended);
  const weakHref=weak?.itemType==="reading"?"/dokkai":kiokuRecommended?"/kioku":weak?masteryTrainingHref({itemType:weak.itemType,aspect:weak.aspect}):"/hafalan";
  const slug=level.toLowerCase();
  const quickPractice=[{label:"Kanji",description:"Arti & pemahaman",icon:Type,to:`/quiz/latihan-${slug}-kanji`},{label:"Kotoba",description:"Arti & penggunaan",icon:Languages,to:`/quiz/latihan-${slug}-vocabulary`},{label:"Bunpou",description:"Pola tata bahasa",icon:BookOpenCheck,to:`/quiz/latihan-${slug}-grammar`},{label:"Campuran",description:"Berbagai kategori",icon:Shuffle,to:`/quiz/latihan-${slug}`}];
  const weeklyMap=new Map((weekly.data?.rows??[]).map(r=>[r.taskType,r]));const todayInfo=weekly.data?.days.find(d=>d.isToday);const restDay=Boolean(todayInfo)&&!todayInfo?.active;
  const masteryFor=(kind:MasteryRow["kind"])=>(mastery.data??[]).find(r=>r.kind===kind);

  return <AppShell compact title="Target"><div className="mx-auto max-w-3xl space-y-5 eno-rise">
    <section>
      <div className="mb-1 flex items-center gap-2"><p className="text-[11px] font-semibold uppercase tracking-[.12em] text-emerald-800 dark:text-primary">Target Utama</p>{locked&&<PremiumBadge/>}</div>
      <Card className="rounded-2xl"><CardContent className="p-4">
        {adaptive.isLoading?<div className="h-24 animate-pulse rounded-xl bg-muted/50"/>:planActive?<>
          <div className="flex items-start justify-between gap-3"><div><h1 className="text-[20px] font-bold">JLPT {level}{plan?.targetDate?` · ${monthYear(plan.targetDate)}`:""}</h1><p className="mt-1 flex items-center gap-1.5 text-[11px] font-semibold text-primary"><CalendarDays className="size-3.5"/>{plan?.daysLeft??0} hari lagi</p></div><span className="grid size-10 place-items-center rounded-2xl bg-primary/10 text-primary"><Target className="size-5"/></span></div>
          <div className="mt-4"><div className="flex items-end justify-between"><p className="text-[28px] font-black leading-none">{mastery.isLoading?"…":`${pctOf(coreMastered,coreTotal)}%`}</p><p className="text-[9px] text-muted-foreground">{coreMastered}/{coreTotal} item dikuasai</p></div><div className="mt-2 flex"><Bar value={pctOf(coreMastered,coreTotal)}/></div><p className="mt-1.5 text-[9px] leading-relaxed text-muted-foreground">Penguasaan Kotoba, Kanji, dan Bunpou {level} (status "dikuasai"). Ini bukan prediksi kelulusan; kesiapan JLPT penuh menunggu data retensi, Dokkai, Chōkai, dan simulasi.</p></div>
          {simulation.data&&<p className="mt-3 rounded-xl bg-muted/45 px-3 py-2 text-[10px]">Simulasi terakhir #{String(simulation.data.examNo).padStart(2,"0")}: <b>{simulation.data.total}/180</b> · {simulation.data.passed?"lulus":"belum lulus"}</p>}
          <div className="mt-3 grid grid-cols-3 gap-2 text-center"><Stat icon={<Flame className="size-4"/>} value={metrics.data?.streak??0} label="Streak"/><Stat icon={<Zap className="size-4"/>} value={metrics.data?.xpToday??0} label="XP hari ini"/><Stat icon={<Clock3 className="size-4"/>} value={timeLabel(metrics.data?.activeSecondsToday??0)} label="Waktu"/></div>
        </>:<div className="text-center"><p className="text-[13px] font-bold">Belum ada target belajar aktif</p><p className="mt-1 text-[10px] text-muted-foreground">Atur level JLPT, tanggal ujian, dan waktu belajar agar planner bisa menyusun target harian.</p><a href="/pengaturan" className="mt-3 inline-block rounded-xl bg-primary px-4 py-2 text-[11px] font-bold text-primary-foreground">Atur target</a></div>}
      </CardContent></Card>
    </section>

    {planActive&&<>
    <section><SectionTitle note="Rencana mingguan (Senin–Minggu, WIB) dari planner: beban dibagi ke hari belajar aktif; tugas yang terlewat dibagi ulang ke hari aktif berikutnya, maksimal 1,5× per hari.">Target Minggu Ini</SectionTitle>
      <Card className="rounded-2xl"><CardContent className="space-y-3 p-4">
        <div className="flex items-center justify-between gap-2"><p className="text-[10px] font-semibold">{weekly.data?.studyDays??plan?.studyDaysPerWeek??7} hari belajar / minggu</p><a href="/edit-profil" className="text-[10px] font-semibold text-primary underline-offset-2 hover:underline">Ubah</a></div>
        <div className="grid grid-cols-7 gap-1" aria-label="Hari belajar minggu ini">{(weekly.data?.days??[]).map(d=>{const full=d.active&&d.target>0&&d.done>=d.target;return <div key={d.date} className={`rounded-lg border px-0.5 py-1.5 text-center ${d.isToday?"border-primary ring-1 ring-primary/40":"border-border"} ${d.active?(full?"bg-emerald-700 text-white dark:bg-primary dark:text-primary-foreground":"bg-primary/10"):"bg-muted/40 opacity-60"}`}><p className="text-[9px] font-bold">{d.label}</p><p className="mt-0.5 text-[8px] tabular-nums">{d.active?(d.target>0?`${Math.round(Math.min(100,d.done/d.target*100))}%`:"–"):"istirahat"}</p></div>})}</div>
        <div className="space-y-2.5">{weeklyRows.map(({label,taskType})=>{const r=weeklyMap.get(taskType);return <div key={taskType} className="flex items-center gap-3"><span className="w-16 text-[11px] font-semibold">{label}</span><Bar value={pctOf(r?.done??0,r?.target??0)}/><span className="w-16 text-right text-[10px] tabular-nums text-muted-foreground">{weekly.isLoading?"…":r?`${r.done} / ${r.target}`:"–"}</span></div>})}</div>
        {["Dokkai","Chōkai"].map(l=><div key={l} className="flex items-center gap-3"><span className="w-16 text-[11px] font-semibold text-muted-foreground">{l}</span><span className="flex-1 text-[9px] text-muted-foreground">Belum dijadwalkan oleh planner</span></div>)}
      </CardContent></Card>
    </section>

    <section><SectionTitle>Target Hari Ini</SectionTitle>
      {restDay&&!tasks.length?<Card className="rounded-2xl"><CardContent className="p-4 text-center"><p className="text-[13px] font-bold">Hari istirahat</p><p className="mt-1 text-[10px] text-muted-foreground">Hari ini bukan hari belajar di rencana mingguanmu. Mau belajar ekstra? Buka Materi kapan saja.</p><a href="/belajar" className="mt-3 inline-block rounded-xl border px-4 py-2 text-[11px] font-bold">Buka Materi</a></CardContent></Card>:tasks.length?<Card className="rounded-2xl"><CardContent className="p-4">
        <div className="space-y-2.5">{tasks.map(t=>{const done=Math.min(t.completed_count,t.target_count);const href=t.suggestions?.[0]?studyHref(t,t.suggestions[0].id):(fallback[t.task_type]||"/belajar");return <a key={t.id} href={href} className="flex items-center gap-3"><span className="w-20 shrink-0 text-[11px] font-semibold">{adaptiveTaskLabels[t.task_type]}</span><Bar value={pctOf(done,t.target_count)}/><span className="w-14 text-right text-[10px] tabular-nums text-muted-foreground">{done} / {t.target_count}</span></a>})}</div>
        {nextTask?<a href={nextHref} className="mt-4 block rounded-xl bg-emerald-700 px-4 py-3 text-center text-[12px] font-bold text-white dark:bg-primary dark:text-primary-foreground">Lanjutkan Target Hari Ini<span className="mt-0.5 block text-[9px] font-medium">Berikutnya: {adaptiveTaskLabels[nextTask.task_type]}</span></a>:<div className="mt-4 rounded-xl bg-primary/10 px-4 py-3 text-center text-[12px] font-bold text-primary">Target hari ini selesai 🎉</div>}
      </CardContent></Card>:<Card><CardContent className="p-4 text-[11px] text-muted-foreground">Planner sedang menyiapkan rencana hari ini.</CardContent></Card>}
    </section>

    <section><SectionTitle note="Angka nyata dari progres belajar (status dikuasai / total materi level ini).">Penguasaan</SectionTitle>
      <Card className="rounded-2xl"><CardContent className="space-y-2.5 p-4">
        {mastery.isLoading?<div className="h-24 animate-pulse rounded-xl bg-muted/50"/>:(["vocabulary","kanji","grammar","reading"] as const).map(kind=>{const r=masteryFor(kind);if(!r||r.total===0)return <div key={kind} className="flex items-center gap-3"><span className="w-16 text-[11px] font-semibold text-muted-foreground">{kindLabel[kind]}</span><span className="flex-1 text-[9px] text-muted-foreground">Materi belum tersedia</span></div>;return <div key={kind} className="flex items-center gap-3"><span className="w-16 text-[11px] font-semibold">{kindLabel[kind]}</span><Bar value={pctOf(r.mastered,r.total)}/><span className="w-24 text-right text-[10px] tabular-nums text-muted-foreground">{r.mastered}/{r.total} · {pctOf(r.mastered,r.total)}%</span></div>})}
        <div className="flex items-center gap-3"><span className="w-16 text-[11px] font-semibold text-muted-foreground">Chōkai</span><span className="flex-1 text-[9px] text-muted-foreground">Segera hadir — konten audio sedang disiapkan</span></div>
        {coreLearned>0&&<p className="pt-1 text-[9px] text-muted-foreground">{coreLearned} item Kotoba/Kanji/Bunpou sudah mulai dipelajari.</p>}
      </CardContent></Card>
    </section>

    <section><SectionTitle>Perlu Perhatian</SectionTitle>
      <div className="rounded-2xl border border-amber-200/70 bg-amber-50/80 p-3 text-amber-950 dark:border-amber-500/20 dark:bg-amber-500/[.08] dark:text-foreground"><div className="flex items-start gap-3"><span className="grid size-9 shrink-0 place-items-center rounded-xl bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300"><BrainCircuit className="size-4"/></span><div className="min-w-0 flex-1">
        {weakness.isLoading?<div className="h-12 animate-pulse rounded-lg bg-amber-100/60"/>:weakness.isError?<><p className="text-[12px] font-bold text-foreground">Analisis sementara tidak tersedia</p><p className="mt-1 text-[9px] leading-relaxed text-muted-foreground">Progres belajar tetap tersimpan. Coba muat ulang halaman.</p></>:weak?<>
          <div className="flex items-center justify-between gap-2"><div><p className="text-[9px] font-bold uppercase tracking-wider text-amber-700 dark:text-amber-300">Kelemahan terbesar</p><p className="mt-0.5 text-[12px] font-bold text-foreground">{weak.label}</p></div><span className="rounded-full bg-amber-100 px-2 py-1 text-[9px] font-black text-amber-700 dark:bg-amber-500/15 dark:text-amber-300">{weak.mastery}%</span></div>
          <p className="mt-1 text-[9px] leading-relaxed text-muted-foreground">Dihitung dari {weak.total} jawaban/review belajar pada jenis materi dan aspek ini.</p>
          <div className="mt-2 flex gap-2">{locked?<button type="button" onClick={()=>setUpgradeOpen(true)} className="rounded-xl bg-emerald-700 px-3 py-2 text-[9px] font-bold text-white dark:bg-primary dark:text-primary-foreground">Latih Sekarang</button>:<a href={weakHref} className="rounded-xl bg-emerald-700 px-3 py-2 text-[9px] font-bold text-white dark:bg-primary dark:text-primary-foreground">Latih Sekarang</a>}<a href="/peta-kelemahan" className="rounded-xl border border-border bg-card px-3 py-2 text-[9px] font-bold text-foreground hover:bg-muted">Lihat analisis</a></div>
        </>:<><p className="text-[12px] font-bold text-foreground">Belum ada kelemahan terdeteksi</p><p className="mt-1 text-[9px] leading-relaxed text-muted-foreground">Analisis muncul setelah kamu mengerjakan beberapa review atau soal Dokkai.</p></>}
      </div></div></div>
      <Link to="/target-tertunda" className="mt-2 flex items-center gap-3 rounded-2xl border bg-card p-4 transition hover:border-primary/30 hover:bg-primary/[.025]"><span className="grid size-10 place-items-center rounded-xl bg-primary/10 text-primary"><RefreshCcw className="size-4"/></span><span className="min-w-0 flex-1"><span className="block text-[12px] font-semibold">Belajar Tertunda</span><span className="mt-0.5 block text-[9px] text-muted-foreground">{overdueCount>0?`${overdueCount} materi dari hari sebelumnya perlu diselesaikan`:"Tidak ada materi tertunda"}</span></span>{(metrics.data?.errorReviewCount??0)>0&&<span className="rounded-full bg-destructive/10 px-2 py-1 text-[9px] font-bold text-destructive">+{metrics.data?.errorReviewCount} salah</span>}<ChevronRight className="size-4 shrink-0 text-muted-foreground"/></Link>
    </section>

    <section><SectionTitle note={`Latihan singkat ${level} · 10 soal acak dari bank soal yang tersedia.`}>Latihan Cepat</SectionTitle><Card className="overflow-hidden rounded-[1.7rem] border-primary/10"><CardContent className="p-3"><div className="mb-3 flex items-center justify-between rounded-2xl bg-primary/[.055] px-3 py-2.5"><div><p className="text-[10px] font-black">Pilih latihan</p><p className="mt-0.5 text-[8px] text-muted-foreground">Hasil latihan tersimpan ke progres belajarmu.</p></div><span className="rounded-full bg-primary/10 px-2.5 py-1 text-[9px] font-black text-primary">{level}</span></div><div className="grid grid-cols-2 gap-2">{quickPractice.map(({label,description,icon:Icon,to})=><Link key={label} to={to as any} className="group rounded-2xl border bg-card p-3 transition hover:border-primary/30 hover:bg-primary/[.025] active:scale-[.99]"><div className="flex items-start justify-between"><span className="grid size-9 place-items-center rounded-xl bg-primary/10 text-primary"><Icon className="size-4"/></span><Play className="mt-1 size-3.5 text-muted-foreground transition group-hover:text-primary"/></div><p className="mt-2.5 text-[11px] font-bold">{label}</p><p className="mt-0.5 text-[8px] text-muted-foreground">{description}</p><p className="mt-2 text-[8px] font-semibold text-primary">10 soal</p></Link>)}</div><Link to="/hafalan" className="mt-2 flex items-center gap-3 rounded-2xl border border-amber-500/20 bg-amber-500/[.045] p-3 transition hover:bg-amber-500/[.075]"><span className="grid size-10 shrink-0 place-items-center rounded-xl bg-amber-500/10 text-amber-600"><RotateCcw className="size-4"/></span><span className="min-w-0 flex-1"><span className="block text-[11px] font-bold">Review Kesalahan</span><span className="mt-0.5 block text-[8px] text-muted-foreground">{(metrics.data?.errorReviewCount??0)>0?`${metrics.data?.errorReviewCount} kesalahan siap dipelajari ulang`:"Belum ada kesalahan yang perlu diulang"}</span></span>{(metrics.data?.errorReviewCount??0)>0&&<span className="rounded-full bg-amber-500/15 px-2 py-1 text-[9px] font-black text-amber-700 dark:text-amber-300">{metrics.data?.errorReviewCount}</span>}<ChevronRight className="size-4 shrink-0 text-muted-foreground"/></Link><Link to="/quiz" className="mt-3 flex items-center justify-center gap-1 text-[9px] font-bold text-muted-foreground hover:text-primary"><ListChecks className="size-3"/>Lihat semua kategori latihan<ChevronRight className="size-3"/></Link></CardContent></Card></section>
    </>}
    <PremiumUpgradeDialog open={upgradeOpen} onOpenChange={setUpgradeOpen} feature="Adaptive Planner"/>
  </div></AppShell>
}
function Stat({icon,value,label}:{icon:React.ReactNode;value:React.ReactNode;label:string}){return <div className="rounded-xl bg-muted/45 p-2"><span className="flex justify-center text-primary">{icon}</span><p className="mt-1 text-[12px] font-bold">{value}</p><p className="text-[9px] text-muted-foreground">{label}</p></div>}
