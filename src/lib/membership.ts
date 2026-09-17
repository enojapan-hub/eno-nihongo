import { supabase } from "@/integrations/supabase/client";
import { fetchMembershipAccess } from "@/lib/membership";
import { PremiumBadge } from "@/components/membership/PremiumBadge";
import { PremiumUpgradeDialog } from "@/components/membership/PremiumUpgradeDialog";

export const Route=createFileRoute("/_authenticated/target")({head:()=>({meta:[{title:"Target — ENO NIHONGO"}]}),component:TargetPage});
const fallback:Partial<Record<AdaptiveTaskType,string>>={new_kanji:"/kanji",new_vocabulary:"/kotoba",new_grammar:"/bunpo",review:"/hafalan",quiz:"/quiz",reading:"/dokkai",listening:"/listening"};
type Metrics={streak:number;xpToday:number;activeSecondsToday:number;dueReviewCount:number;errorReviewCount:number};

async function fetchMetrics():Promise<Metrics>{const{data,error}=await(supabase as any).rpc("get_target_page_metrics");if(error)throw error;return{streak:Number(data?.streak??0),xpToday:Number(data?.xpToday??0),activeSecondsToday:Number(data?.activeSecondsToday??0),dueReviewCount:Number(data?.dueReviewCount??0),errorReviewCount:Number(data?.errorReviewCount??0)}}
async function fetchWeakness(level:string){const{data:u}=await supabase.auth.getUser();if(!u.user)return[];const{data,error}=await(supabase as any).from("flashcard_reviews").select("item_type,item_id,rating,direction,aspect,used_hint,response_ms").eq("user_id",u.user.id).eq("level",level).order("created_at",{ascending:false}).limit(500);if(error)throw error;return analyzeMastery((data??[]) as MasteryReview[])}
function timeLabel(s:number){const m=Math.floor(s/60);return m<60?`${m}m`:`${Math.floor(m/60)}j ${m%60}m`}
function kindFor(t:AdaptiveTaskType){return t==="new_kanji"?"kanji":t==="new_vocabulary"?"vocabulary":t==="new_grammar"?"grammar":t==="reading"?"reading":t==="listening"?"listening":"review"}
function studyHref(task:AdaptiveTask,id:string){if(task.task_type==="review")return "/hafalan";const ids=(task.suggestions??[]).map(x=>x.id).join(",");return `/study-item?kind=${kindFor(task.task_type)}&id=${encodeURIComponent(id)}&queue=${encodeURIComponent(ids)}`}
function CompactTask({task,locked,onUpgrade}:{task:AdaptiveTask;locked:boolean;onUpgrade:()=>void}){const done=Math.min(task.completed_count,task.target_count),p=task.target_count?Math.min(100,done/task.target_count*100):0,first=task.suggestions?.[0];const href=first?studyHref(task,first.id):(fallback[task.task_type]||"/belajar");const body=<><div className="flex items-start justify-between gap-2"><span className="grid size-8 place-items-center rounded-xl bg-primary/10 text-primary"><CheckCircle2 className="size-4"/></span>{locked?<PremiumBadge />:<ChevronRight className="size-4 text-muted-foreground"/>}</div><p className="mt-2 truncate text-[11px] font-semibold">{adaptiveTaskLabels[task.task_type]}</p><p className="mt-0.5 text-[9px] text-muted-foreground">{done}/{task.target_count} selesai</p><div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-primary" style={{width:`${p}%`}}/></div></>;return locked?<button type="button" onClick={onUpgrade} className="min-h-[112px] rounded-2xl border bg-card p-3 text-left transition hover:border-primary/30 hover:bg-primary/[.025]">{body}</button>:<a href={href} className="min-h-[112px] rounded-2xl border bg-card p-3 transition hover:border-primary/30 hover:bg-primary/[.025]">{body}</a>}

function TargetPage(){const[upgradeOpen,setUpgradeOpen]=useState(false);const adaptive=useQuery({queryKey:["adaptive-plan"],queryFn:fetchAdaptivePlan,staleTime:30000,refetchInterval:30000});const membership=useQuery({queryKey:["membership-access"],queryFn:fetchMembershipAccess,staleTime:30000});const metrics=useQuery({queryKey:["target-live-metrics"],queryFn:fetchMetrics,staleTime:15000,refetchInterval:30000});const level=adaptive.data?.targetLevel??"N5";const weakness=useQuery({queryKey:["target-weakness-v2",level],queryFn:()=>fetchWeakness(level),enabled:!!adaptive.data,staleTime:30000,refetchInterval:60000});const locked=!membership.isLoading&&!membership.data?.hasPremiumAccess;const tasks=adaptive.data?.tasks??[],todayTasks=tasks.filter(t=>t.task_type!=="review"),completed=todayTasks.reduce((n,t)=>n+Math.min(t.completed_count,t.target_count),0),target=todayTasks.reduce((n,t)=>n+t.target_count,0),percent=target?Math.min(100,completed/target*100):0,allDone=target>0&&completed>=target,slug=level.toLowerCase(),overdueCount=Math.max(metrics.data?.dueReviewCount??0,tasks.find(t=>t.task_type==="review")?.suggestions?.length??0),weak=weakness.data?.[0],weakHref=weak?masteryTrainingHref({itemType:weak.itemType,aspect:weak.aspect}):"/hafalan";const quizzes=[{label:"Quiz Kanji",icon:Type,to:`/quiz/latihan-${slug}-kanji`},{label:"Quiz Kosakata",icon:Languages,to:`/quiz/latihan-${slug}-vocabulary`},{label:"Quiz Bunpou",icon:BookOpenCheck,to:`/quiz/latihan-${slug}-grammar`},{label:"Mixed Quiz",icon:ListChecks,to:`/quiz/latihan-${slug}`},{label:`Review Kesalahan${metrics.data?.errorReviewCount?` (${metrics.data.errorReviewCount})`:""}`,icon:RefreshCcw,to:"/hafalan"}];return <AppShell compact title="Target"><div className="mx-auto max-w-3xl space-y-4 eno-rise"><section><div className="mb-3 flex items-start justify-between gap-3"><div><div className="flex items-center gap-2"><p className="text-[11px] font-semibold uppercase tracking-[.12em] text-primary">Adaptive Study Planner</p>{locked&&<PremiumBadge />}</div><h1 className="mt-1 text-[20px] font-bold">Target hari ini</h1>{adaptive.data?.active&&<p className="mt-1 text-[10px] font-medium text-primary">{level} · {adaptive.data.daysLeft??0} hari menuju target</p>}</div><span className={allDone?"grid size-10 place-items-center rounded-2xl bg-primary text-primary-foreground":"grid size-10 place-items-center rounded-2xl bg-primary/10 text-primary"}><Target className="size-5"/></span></div><Card className="rounded-2xl"><CardContent className="p-4"><div className="grid grid-cols-4 gap-2 text-center"><Stat icon={<Flame className="size-4"/>} value={metrics.data?.streak??0} label="Streak"/><Stat icon={<Zap className="size-4"/>} value={metrics.data?.xpToday??0} label="XP"/><Stat icon={<Clock3 className="size-4"/>} value={timeLabel(metrics.data?.activeSecondsToday??0)} label="Waktu"/><Stat icon={<CheckCircle2 className="size-4"/>} value={`${Math.round(percent)}%`} label="Selesai"/></div><div className="mt-3 h-2 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-primary" style={{width:`${percent}%`}}/></div></CardContent></Card></section>{weak&&<section className="rounded-2xl border border-amber-200/70 bg-amber-50/80 p-3 text-amber-950 dark:border-amber-500/20 dark:bg-amber-500/[.08] dark:text-foreground"><div className="flex items-start gap-3"><span className="grid size-9 shrink-0 place-items-center rounded-xl bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300"><BrainCircuit className="size-4"/></span><div className="min-w-0 flex-1"><div className="flex items-center justify-between gap-2"><div><p className="text-[9px] font-bold uppercase tracking-wider text-amber-700 dark:text-amber-300">Analisis Adaptive Planner</p><p className="mt-0.5 text-[12px] font-bold text-foreground">Prioritas: {weak.label}</p></div><span className="rounded-full bg-amber-100 px-2 py-1 text-[9px] font-black text-amber-700 dark:bg-amber-500/15 dark:text-amber-300">{weak.mastery}%</span></div><p className="mt-1 text-[9px] leading-relaxed text-muted-foreground">Dihitung dari {weak.total} review pada jenis materi dan aspek ini. Latihan berikut diarahkan langsung ke kelemahan tersebut.</p><div className="mt-2 flex gap-2">{locked?<button type="button" onClick={()=>setUpgradeOpen(true)} className="rounded-xl bg-primary px-3 py-2 text-[9px] font-bold text-primary-foreground">Latih Sekarang</button>:<a href={weakHref} className="rounded-xl bg-primary px-3 py-2 text-[9px] font-bold text-primary-foreground">Latih Sekarang</a>}<a href="/peta-kelemahan" className="rounded-xl border border-border bg-card px-3 py-2 text-[9px] font-bold text-foreground hover:bg-muted">Lihat analisis</a></div></div></div></section>}<section><div className="mb-2 flex items-center justify-between px-1"><h2 className="text-[13px] font-semibold">Rencana Belajar Hari Ini</h2><Sparkles className="size-4 text-primary"/></div><div className="grid grid-cols-2 gap-2">{todayTasks.length?todayTasks.map(t=><CompactTask key={t.id} task={t} locked={locked} onUpgrade={()=>setUpgradeOpen(true)}/>):<Card className="col-span-2"><CardContent className="p-4 text-[11px] text-muted-foreground">Planner sedang menyiapkan rencana hari ini.</CardContent></Card>}</div></section><Link to="/target-tertunda" className="flex items-center gap-3 rounded-2xl border bg-card p-4 transition hover:border-primary/30 hover:bg-primary/[.025]"><span className="grid size-10 place-items-center rounded-xl bg-primary/10 text-primary"><RefreshCcw className="size-4"/></span><span className="min-w-0 flex-1"><span className="block text-[12px] font-semibold">Belajar Tertunda</span><span className="mt-0.5 block text-[9px] text-muted-foreground">{overdueCount>0?`${overdueCount} materi dari hari sebelumnya perlu diselesaikan`:"Tidak ada materi tertunda"}</span></span>{(metrics.data?.errorReviewCount??0)>0&&<span className="rounded-full bg-destructive/10 px-2 py-1 text-[9px] font-bold text-destructive">+{metrics.data.errorReviewCount} salah</span>}<ChevronRight className="size-4 shrink-0 text-muted-foreground"/></Link><section><h2 className="mb-2 px-1 text-[13px] font-semibold">Quick Quiz</h2><div className="grid grid-cols-2 gap-2 sm:grid-cols-3">{quizzes.map(({label,icon:Icon,to})=><Link key={label} to={to as any} className="rounded-2xl border bg-card p-3"><Icon className="size-4 text-primary"/><p className="mt-2 text-[11px] font-semibold">{label}</p></Link>)}</div></section><PremiumUpgradeDialog open={upgradeOpen} onOpenChange={setUpgradeOpen} feature="Adaptive Planner" /></div></AppShell>}
function Stat({icon,value,label}:{icon:React.ReactNode;value:React.ReactNode;label:string}){return <div className="rounded-xl bg-muted/45 p-2"><span className="flex justify-center text-primary">{icon}</span><p className="mt-1 text-[12px] font-bold">{value}</p><p className="text-[9px] text-muted-foreground">{label}</p></div>}
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { ArrowLeft, BrainCircuit, Gauge, Target } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { fetchTargetLevel } from "@/lib/target-level";
import { analyzeMastery, type MasteryReview } from "@/lib/mastery-analysis";
import { masteryTrainingHref } from "@/lib/mastery-training";
import { supabase } from "@/integrations/supabase/client";
import type { Level } from "@/lib/learn-queries";
import { fetchMembershipAccess } from "@/lib/membership";
import { PremiumBadge } from "@/components/membership/PremiumBadge";
import { PremiumUpgradeDialog } from "@/components/membership/PremiumUpgradeDialog";

export const Route=createFileRoute("/_authenticated/peta-kelemahan")({head:()=>({meta:[{title:"Peta Kelemahan — ENO NIHONGO"}]}),component:WeaknessMapPage});

type Review=MasteryReview&{created_at:string|null};

async function fetchReviews(level:Level){
  const{data:u}=await supabase.auth.getUser();
  if(!u.user)return[];
  const{data,error}=await (supabase as any).from('flashcard_reviews').select('item_type,item_id,rating,direction,aspect,used_hint,response_ms,created_at').eq('user_id',u.user.id).eq('level',level).order('created_at',{ascending:false}).limit(500);
  if(error)throw error;
  return(data??[]) as Review[];
}

function recallScore(rows:Review[]){
  if(!rows.length)return 0;
  const good=rows.filter(x=>x.rating>=2).length/rows.length;
  const noHint=rows.filter(x=>!x.used_hint).length/rows.length;
  const fast=rows.filter(x=>Number(x.response_ms??999999)<=8000).length/rows.length;
  const reverseRows=rows.filter(x=>x.direction==='reverse'||x.direction==='confusion');
  const reverse=reverseRows.length?reverseRows.filter(x=>x.rating>=2).length/reverseRows.length:good;
  const days=new Set(rows.filter(x=>x.created_at).map(x=>String(x.created_at).slice(0,10))).size;
  const consistency=Math.min(1,days/5);
  return Math.round(Math.max(0,Math.min(1,good*.4+noHint*.2+fast*.15+reverse*.15+consistency*.1))*100);
}

function WeaknessMapPage(){
  const[upgradeOpen,setUpgradeOpen]=useState(false);
  const target=useQuery({queryKey:['target-level'],queryFn:fetchTargetLevel});
  const level=target.data as Level|undefined;
  const reviews=useQuery({queryKey:['weakness-map',level],queryFn:()=>fetchReviews(level!),enabled:!!level});
  const membership=useQuery({queryKey:['membership-access'],queryFn:fetchMembershipAccess,staleTime:30_000});
  if(!level)return <AppShell compact title="Peta Kelemahan"><p className="p-6 text-center text-xs text-muted-foreground">Memuat level profil…</p></AppShell>;

  const rows=reviews.data??[];
  const stats=analyzeMastery(rows);
  const overall=stats.length?Math.round(stats.reduce((sum,x)=>sum+x.mastery*x.total,0)/Math.max(1,stats.reduce((sum,x)=>sum+x.total,0))):0;
  const recall=recallScore(rows);
  const recallLabel=recall>=85?'Sangat kuat':recall>=70?'Kuat':recall>=50?'Berkembang':'Perlu diperkuat';
  const locked=!membership.isLoading&&!membership.data?.hasPremiumAccess;

  return <AppShell compact title="Peta Kelemahan"><div className="mx-auto w-full max-w-md space-y-3 pb-4">
    <a href="/target" className="inline-flex items-center gap-1.5 rounded-xl border bg-card px-3 py-2 text-[10px] font-bold"><ArrowLeft className="size-4"/> Kembali ke Target</a>
    <section className="rounded-3xl border bg-gradient-to-b from-emerald-50 to-card p-4 dark:from-emerald-950/30"><div className="flex items-center gap-3"><span className="grid size-11 place-items-center rounded-2xl bg-primary/10"><Target className="size-6 text-primary"/></span><div className="flex-1"><p className="text-[9px] font-bold uppercase tracking-widest text-primary">ENO Weakness Map</p><h1 className="text-[18px] font-bold">Peta Kelemahan</h1><p className="text-[9px] text-muted-foreground">Mastery dipisahkan berdasarkan materi dan aspek yang benar-benar diuji.</p></div><span className="text-[22px] font-black text-primary">{overall}%</span></div></section>
    {rows.length>0&&<section className="rounded-3xl border bg-card p-4"><div className="flex items-center gap-3"><span className="grid size-10 place-items-center rounded-2xl bg-primary/10"><Gauge className="size-5 text-primary"/></span><div className="flex-1"><div className="flex items-center gap-2"><p className="text-[9px] font-bold uppercase tracking-wider text-primary">ENO Recall Score</p>{locked&&<PremiumBadge />}</div><p className="text-[11px] font-bold">Kualitas ingatan · {recallLabel}</p><p className="mt-0.5 text-[8px] leading-4 text-muted-foreground">Menggabungkan recall benar, tanpa hint, kecepatan, recall balik, dan konsistensi lintas hari.</p></div><span className="text-[24px] font-black">{recall}</span></div><div className="mt-3 h-2 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-primary transition-all" style={{width:`${recall}%`}}/></div></section>}
    {reviews.isLoading?<p className="py-8 text-center text-[10px] text-muted-foreground">Menganalisis riwayat hafalan…</p>:!rows.length?<section className="rounded-2xl border bg-card p-5 text-center"><BrainCircuit className="mx-auto size-7 text-muted-foreground"/><p className="mt-2 text-[11px] font-bold">Belum cukup data</p><p className="mt-1 text-[9px] text-muted-foreground">Selesaikan beberapa kartu di Mode Hafalan agar ENO dapat memetakan kelemahanmu.</p></section>:<div className="space-y-2">{stats.map((x,i)=><section key={x.key} className="rounded-2xl border bg-card p-3"><div className="flex items-center justify-between gap-3"><div className="min-w-0"><div className="flex items-center gap-2"><p className="truncate text-[11px] font-bold">{x.label}</p>{locked&&<PremiumBadge />}</div><p className="text-[8px] text-muted-foreground">{x.total} review · {i===0?'Prioritas utama':'Mastery per aspek'}</p></div><span className={`shrink-0 rounded-full px-2 py-1 text-[9px] font-black ${x.mastery<50?'bg-rose-100 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300':x.mastery<75?'bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300':'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300'}`}>{x.mastery}%</span></div><div className="mt-2 h-2 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-primary transition-all" style={{width:`${x.mastery}%`}}/></div>{i===0&&(locked?<button type="button" onClick={()=>setUpgradeOpen(true)} className="mt-3 block w-full rounded-xl bg-primary py-2.5 text-center text-[9px] font-bold text-primary-foreground">Latih {x.label}</button>:<a href={masteryTrainingHref(x)} className="mt-3 block rounded-xl bg-primary py-2.5 text-center text-[9px] font-bold text-primary-foreground">Latih {x.label}</a>)}</section>)}</div>}
    <a href="/hafalan" className="block rounded-2xl border bg-card py-3 text-center text-[10px] font-bold">Buka Mode Hafalan</a><PremiumUpgradeDialog open={upgradeOpen} onOpenChange={setUpgradeOpen} feature="Latihan berdasarkan Peta Kelemahan" />
  </div></AppShell>;
}
import { supabase } from "@/integrations/supabase/client";

export type MembershipPlan = "free" | "premium" | "lifetime";
export type Membership = { plan: MembershipPlan; premiumUntil: string | null; monthlyExam: boolean };
export type MembershipAccess = Membership & { hasPremiumAccess: boolean };
export type FullSimulationAccess = { allowed: boolean; plan: MembershipPlan; usedThisMonth: number; monthlyLimit: number | null; monthlyExam: boolean };

export async function fetchMembership(): Promise<Membership> {
  const { data, error } = await (supabase as any).rpc("get_my_membership");
  if (error) throw error;
  const plan = (data?.plan ?? "free") as MembershipPlan;
  return { plan, premiumUntil: data?.premium_until ?? null, monthlyExam: plan !== "free" };
}

export async function fetchMembershipAccess(): Promise<MembershipAccess> {
  const membership = await fetchMembership();
  const { data: userData } = await supabase.auth.getUser();
  const userId = userData.user?.id;
  if (!userId) return { ...membership, hasPremiumAccess: false };
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", userId).maybeSingle();
  const privileged = profile?.role === "owner" || profile?.role === "admin";
  return { ...membership, hasPremiumAccess: privileged || membership.plan !== "free" };
}

export async function fetchFullSimulationAccess(): Promise<FullSimulationAccess> {
  const { data, error } = await (supabase as any).rpc("can_start_full_simulation");
  if (error) throw error;
  return {
    allowed: !!data?.allowed,
    plan: (data?.plan ?? "free") as MembershipPlan,
    usedThisMonth: Number(data?.used_this_month ?? 0),
    monthlyLimit: data?.monthly_limit == null ? null : Number(data.monthly_limit),
    monthlyExam: !!data?.monthly_exam,
  };
}
