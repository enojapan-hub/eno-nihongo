import { createFileRoute, Outlet, useRouterState } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { BookOpenCheck, Brain, Languages, ListChecks, Shuffle, Sparkles, Type } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { fetchTargetLevel } from "@/lib/target-level";

export const Route = createFileRoute("/_authenticated/quiz")({ head: () => ({ meta: [{ title: "Quiz — ENO NIHONGO" }] }), component: QuizRoute });
const skills=[{key:"kanji",label:"Kanji",icon:Type,description:"Arti dan pemahaman kanji."},{key:"vocabulary",label:"Kotoba",icon:Languages,description:"Arti dan penggunaan kosakata."},{key:"grammar",label:"Bunpou",icon:BookOpenCheck,description:"Pola dan penggunaan tata bahasa."},{key:"reading",label:"Dokkai",icon:ListChecks,description:"Pemahaman bacaan."},{key:"listening",label:"Choukai",icon:Brain,description:"Pemahaman audio."}] as const;

function QuizRoute(){
 const pathname=useRouterState({select:s=>s.location.pathname});
 const isQuizRoot=pathname.replace(/\/+$/,"")==="/quiz";
 return isQuizRoot?<QuizPage/>:<Outlet/>;
}

function QuizPage(){
 const target=useQuery({queryKey:["target-level"],queryFn:fetchTargetLevel,retry:1}); const level=target.data??"N5";
 const openPractice=(skill?:(typeof skills)[number]["key"])=>{const suffix=skill?`-${skill}`:"";window.location.assign(`/quiz/latihan-${level.toLowerCase()}${suffix}`)};
 return <AppShell title="Quiz" description="Latihan soal sesuai level JLPT yang dipilih di profil."><div className="mx-auto max-w-3xl space-y-4">
 <Card className="rounded-2xl border-primary/15 bg-primary/[0.045] shadow-none"><CardContent className="p-5"><div className="flex items-start gap-3"><div className="grid size-11 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary"><Sparkles className="size-5"/></div><div><h1 className="text-base font-semibold">Quiz {level}</h1><p className="mt-1 text-xs leading-5 text-muted-foreground">Level mengikuti profil. Ubah target level di Profil untuk mengganti seluruh materi, quiz, dan simulasi.</p></div></div></CardContent></Card>
 {target.isLoading?<p className="py-8 text-center text-xs text-muted-foreground">Memuat level profil…</p>:target.isError?<p className="py-8 text-center text-xs text-destructive">Level profil tidak dapat dimuat.</p>:<><Card className="rounded-2xl border-border/70 shadow-none"><CardContent className="p-4"><div className="flex items-center gap-3"><div className="grid size-11 place-items-center rounded-xl bg-primary/10 text-primary"><Shuffle className="size-5"/></div><div className="min-w-0 flex-1"><h2 className="text-sm font-semibold">Campuran {level}</h2><p className="mt-0.5 text-[11px] text-muted-foreground">10 soal dari kategori yang tersedia dalam Bahasa Indonesia.</p></div></div><Button type="button" className="mt-3 h-9 w-full rounded-xl text-xs" onClick={()=>openPractice()}>Mulai quiz campuran</Button></CardContent></Card>
 <div><div className="mb-2 flex items-center justify-between"><p className="text-[11px] font-semibold text-muted-foreground">Latihan per kategori</p><span className="text-[10px] font-semibold text-primary">{level}</span></div><div className="grid grid-cols-1 gap-3 sm:grid-cols-2">{skills.map(({key,label,icon:Icon,description})=><button key={key} type="button" onClick={()=>openPractice(key)} className="rounded-2xl border bg-card p-4 text-left shadow-[0_1px_3px_rgba(0,0,0,.04)] transition active:scale-[.99]"><div className="flex items-center gap-3"><span className="grid size-10 shrink-0 place-items-center rounded-xl bg-muted text-primary"><Icon className="size-4"/></span><div className="min-w-0"><p className="text-sm font-semibold">{label} {level}</p><p className="mt-0.5 text-[10px] leading-4 text-muted-foreground">{description}</p></div></div></button>)}</div></div></>}
 </div></AppShell>;
}
