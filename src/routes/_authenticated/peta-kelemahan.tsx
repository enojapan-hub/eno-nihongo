import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, BrainCircuit, Gauge, Target } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { fetchTargetLevel } from "@/lib/target-level";
import { analyzeMastery, type MasteryReview } from "@/lib/mastery-analysis";
import { masteryTrainingHref } from "@/lib/mastery-training";
import { supabase } from "@/integrations/supabase/client";
import type { Level } from "@/lib/learn-queries";
import { fetchMembership } from "@/lib/membership";
import { PremiumBadge } from "@/components/membership/PremiumBadge";

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
  const target=useQuery({queryKey:['target-level'],queryFn:fetchTargetLevel});
  const level=target.data as Level|undefined;
  const reviews=useQuery({queryKey:['weakness-map',level],queryFn:()=>fetchReviews(level!),enabled:!!level});
  const membership=useQuery({queryKey:['membership'],queryFn:fetchMembership,staleTime:30_000});
  if(!level)return <AppShell compact title="Peta Kelemahan"><p className="p-6 text-center text-xs text-muted-foreground">Memuat level profil…</p></AppShell>;

  const rows=reviews.data??[];
  const stats=analyzeMastery(rows);
  const overall=stats.length?Math.round(stats.reduce((sum,x)=>sum+x.mastery*x.total,0)/Math.max(1,stats.reduce((sum,x)=>sum+x.total,0))):0;
  const recall=recallScore(rows);
  const recallLabel=recall>=85?'Sangat kuat':recall>=70?'Kuat':recall>=50?'Berkembang':'Perlu diperkuat';

  return <AppShell compact title="Peta Kelemahan"><div className="mx-auto w-full max-w-md space-y-3 pb-4">
    <a href="/target" className="inline-flex items-center gap-1.5 rounded-xl border bg-card px-3 py-2 text-[10px] font-bold"><ArrowLeft className="size-4"/> Kembali ke Target</a>
    <section className="rounded-3xl border bg-gradient-to-b from-emerald-50 to-card p-4 dark:from-emerald-950/30"><div className="flex items-center gap-3"><span className="grid size-11 place-items-center rounded-2xl bg-primary/10"><Target className="size-6 text-primary"/></span><div className="flex-1"><p className="text-[9px] font-bold uppercase tracking-widest text-primary">ENO Weakness Map</p><h1 className="text-[18px] font-bold">Peta Kelemahan</h1><p className="text-[9px] text-muted-foreground">Mastery dipisahkan berdasarkan materi dan aspek yang benar-benar diuji.</p></div><span className="text-[22px] font-black text-primary">{overall}%</span></div></section>
    {rows.length>0&&<section className="rounded-3xl border bg-card p-4"><div className="flex items-center gap-3"><span className="grid size-10 place-items-center rounded-2xl bg-primary/10"><Gauge className="size-5 text-primary"/></span><div className="flex-1"><div className="flex items-center gap-2"><p className="text-[9px] font-bold uppercase tracking-wider text-primary">ENO Recall Score</p>{membership.data?.plan==='free'&&<PremiumBadge />}</div><p className="text-[11px] font-bold">Kualitas ingatan · {recallLabel}</p><p className="mt-0.5 text-[8px] leading-4 text-muted-foreground">Menggabungkan recall benar, tanpa hint, kecepatan, recall balik, dan konsistensi lintas hari.</p></div><span className="text-[24px] font-black">{recall}</span></div><div className="mt-3 h-2 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-primary transition-all" style={{width:`${recall}%`}}/></div></section>}
    {reviews.isLoading?<p className="py-8 text-center text-[10px] text-muted-foreground">Menganalisis riwayat hafalan…</p>:!rows.length?<section className="rounded-2xl border bg-card p-5 text-center"><BrainCircuit className="mx-auto size-7 text-muted-foreground"/><p className="mt-2 text-[11px] font-bold">Belum cukup data</p><p className="mt-1 text-[9px] text-muted-foreground">Selesaikan beberapa kartu di Mode Hafalan agar ENO dapat memetakan kelemahanmu.</p></section>:<div className="space-y-2">{stats.map((x,i)=><section key={x.key} className="rounded-2xl border bg-card p-3"><div className="flex items-center justify-between gap-3"><div className="min-w-0"><div className="flex items-center gap-2"><p className="truncate text-[11px] font-bold">{x.label}</p>{membership.data?.plan==='free'&&<PremiumBadge />}</div><p className="text-[8px] text-muted-foreground">{x.total} review · {i===0?'Prioritas utama':'Mastery per aspek'}</p></div><span className={`shrink-0 rounded-full px-2 py-1 text-[9px] font-black ${x.mastery<50?'bg-rose-100 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300':x.mastery<75?'bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300':'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300'}`}>{x.mastery}%</span></div><div className="mt-2 h-2 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-primary transition-all" style={{width:`${x.mastery}%`}}/></div>{i===0&&<a href={masteryTrainingHref(x)} className="mt-3 block rounded-xl bg-primary py-2.5 text-center text-[9px] font-bold text-primary-foreground">Latih {x.label}</a>}</section>)}</div>}
    <a href="/hafalan" className="block rounded-2xl border bg-card py-3 text-center text-[10px] font-bold">Buka Mode Hafalan</a>
  </div></AppShell>;
}
