import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { BarChart3, Check, ChevronRight, Crown, Gem, GraduationCap, Headphones, Infinity as InfinityIcon, LockKeyhole, Mail, MapPin, Phone, ShieldCheck, Sparkles, Trophy } from "lucide-react";
import { PUBLIC_PLANS, formatRupiah } from "@/lib/public-plans";
import { supabase } from "@/integrations/supabase/client";

const ORIGIN="https://www.enonihongo.com";
const benefits=[{icon:GraduationCap,title:"Latihan Premium",text:"Latihan belajar lebih lengkap"},{icon:BarChart3,title:"Progres Belajar",text:"Pantau perkembanganmu"},{icon:Trophy,title:"ENO Exam",text:"Ujian eksklusif bulanan"},{icon:Sparkles,title:"Fitur Premium",text:"Pengalaman belajar penuh"}];

export const Route=createFileRoute("/paket")({head:()=>({meta:[{title:"Paket Premium ENO NIHONGO"},{name:"description",content:"Pilih paket Premium ENO NIHONGO: bulanan, tahunan, atau lifetime."}],links:[{rel:"canonical",href:`${ORIGIN}/paket`}]}),component:PaketPage});

function PaketPage(){
 const[backTo,setBackTo]=useState("/");
 useEffect(()=>{void supabase.auth.getSession().then(({data})=>{if(data.session)setBackTo("/dashboard")})},[]);
 return <main className="min-h-screen overflow-hidden bg-[#f5faf7] text-[#10251b] dark:bg-background dark:text-foreground">
  <div className="relative mx-auto max-w-5xl px-4 pb-10 pt-6 sm:px-6 sm:pt-10">
   <div aria-hidden className="pointer-events-none absolute -right-24 -top-24 size-72 rounded-full bg-emerald-200/25 blur-3xl"/>
   <a href={backTo} className="relative inline-flex items-center gap-1 text-sm font-bold text-[#23804d]">← {backTo==="/dashboard"?"Kembali ke Dashboard":"ENO NIHONGO"}</a>
   <section className="relative mt-8 text-center">
    <span className="inline-flex items-center gap-2 rounded-full border border-amber-300 bg-amber-50/90 px-4 py-1.5 text-[11px] font-black text-amber-800 dark:border-amber-500/35 dark:bg-amber-500/15 dark:text-amber-200"><Gem className="size-4 fill-amber-400"/>PREMIUM ENO NIHONGO</span>
    <h1 className="mx-auto mt-4 max-w-2xl text-4xl font-black leading-[1.05] tracking-tight sm:text-5xl">Belajar lebih fokus.<br/><span className="text-[#23804d]">Tumbuh lebih jauh.</span></h1>
    <p className="mx-auto mt-4 max-w-xl text-sm leading-6 text-slate-600 dark:text-muted-foreground">Materi dasar tetap dapat dinikmati gratis. Premium memberi akses belajar yang lebih lengkap untuk mendukung target JLPT-mu.</p>
   </section>
   <section className="relative mx-auto mt-7 grid max-w-3xl grid-cols-2 gap-2 sm:grid-cols-4">{benefits.map(({icon:Icon,title,text})=><div key={title} className="rounded-2xl border border-emerald-900/[.07] bg-white/80 p-3 text-center shadow-sm dark:bg-card"><span className="mx-auto grid size-9 place-items-center rounded-xl bg-emerald-100 text-[#23804d] dark:bg-primary/10 dark:text-primary"><Icon className="size-4.5"/></span><p className="mt-2 text-[11px] font-black">{title}</p><p className="mt-1 text-[9px] leading-4 text-slate-500 dark:text-muted-foreground">{text}</p></div>)}</section>
   <section className="relative mt-9 grid items-stretch gap-4 md:grid-cols-3">
    {PUBLIC_PLANS.map(plan=><article key={plan.code} className={`relative flex flex-col rounded-[1.75rem] border bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-lg dark:bg-card ${plan.featured?"border-[#23804d] ring-1 ring-[#23804d]/10 md:-translate-y-2":"border-slate-200 dark:border-border"}`}>
     {plan.featured&&<span className="absolute -top-3 left-5 inline-flex items-center gap-1.5 rounded-full bg-[#23804d] px-3 py-1.5 text-[10px] font-black text-white shadow-sm"><Crown className="size-3.5"/>PILIHAN TERBAIK</span>}
     <div className={plan.featured?"mt-2":""}><div className="flex items-start justify-between gap-2"><h2 className="text-lg font-black">{plan.name}</h2>{plan.code==="lifetime"&&<InfinityIcon className="size-5 text-[#23804d]"/>}</div><p className="mt-4 text-3xl font-black tracking-tight text-[#23804d]">{formatRupiah(plan.price)}</p><p className="mt-1 text-xs font-medium text-slate-500 dark:text-muted-foreground">{plan.billing}</p></div>
     <p className="mt-4 min-h-10 text-xs leading-5 text-slate-600 dark:text-muted-foreground">{plan.description}</p>
     <div className="my-4 h-px bg-slate-100 dark:bg-border"/>
     <ul className="space-y-2.5 text-[11px] text-slate-700 dark:text-foreground">{["Latihan Premium dan progres akun","ENO Exam Bulanan","Akses fitur Premium"].map(x=><li key={x} className="flex items-center gap-2"><span className="grid size-5 shrink-0 place-items-center rounded-full bg-emerald-50 text-[#23804d] dark:bg-primary/10 dark:text-primary"><Check className="size-3.5"/></span>{x}</li>)}</ul>
     <a href={`/auth?paket=${plan.code}`} className={`mt-6 flex h-11 items-center justify-center gap-1 rounded-xl px-4 text-sm font-black transition active:scale-[.99] ${plan.featured?"bg-[#23804d] text-white shadow-md shadow-emerald-900/10":"border border-[#23804d] text-[#23804d] hover:bg-emerald-50 dark:hover:bg-primary/10"}`}>Pilih Paket<ChevronRight className="size-4"/></a>
    </article>)}
   </section>
   <section className="relative mt-8 grid grid-cols-3 gap-2 rounded-2xl border border-emerald-900/[.07] bg-white/70 p-3 dark:bg-card">
    {[{icon:ShieldCheck,title:"Pembayaran aman",sub:"Melalui mitra pembayaran"},{icon:LockKeyhole,title:"Akun terlindungi",sub:"Akses terkait akunmu"},{icon:Headphones,title:"Butuh bantuan?",sub:"Tim ENO siap membantu"}].map(({icon:Icon,title,sub})=><div key={title} className="flex flex-col items-center p-2 text-center"><Icon className="size-5 text-[#23804d]"/><b className="mt-2 text-[10px]">{title}</b><span className="mt-0.5 text-[8px] leading-3 text-slate-500 dark:text-muted-foreground">{sub}</span></div>)}
   </section>
   <section className="relative mt-4 rounded-2xl border border-slate-200 bg-white p-5 dark:bg-card dark:border-border"><h2 className="text-sm font-black">Butuh bantuan sebelum membeli?</h2><p className="mt-1 text-[10px] text-slate-500 dark:text-muted-foreground">Hubungi layanan pelanggan ENO NIHONGO.</p><div className="mt-4 grid gap-3 text-[10px] sm:grid-cols-3"><a href="mailto:enoinjapan@gmail.com" className="flex gap-2"><Mail className="size-4 shrink-0 text-[#23804d]"/><span><b>Email</b><br/>enoinjapan@gmail.com</span></a><a href="tel:082215155915" className="flex gap-2"><Phone className="size-4 shrink-0 text-[#23804d]"/><span><b>Telepon</b><br/>082215155915</span></a><div className="flex gap-2"><MapPin className="size-4 shrink-0 text-[#23804d]"/><span><b>Alamat operasional</b><br/>Bandung, Indonesia</span></div></div></section>
   <p className="mt-5 text-center text-[9px] leading-4 text-slate-500">Pembelian memerlukan akun Google agar akses Premium dapat dikaitkan dengan akunmu. Pembayaran diproses melalui mitra pembayaran yang tersedia saat checkout.</p>
  </div>
 </main>
}