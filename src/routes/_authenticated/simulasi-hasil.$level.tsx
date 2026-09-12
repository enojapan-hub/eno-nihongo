import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Award, CheckCircle2, ChevronDown, ChevronUp, CircleHelp, XCircle } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { buildPracticeResult, type FullProgress } from "@/lib/jlpt-simulation-result";
import type { Level } from "@/lib/learn-queries";

export const Route=createFileRoute("/_authenticated/simulasi-hasil/$level")({component:ResultPage});

type ReviewItem={attempt_id?:string;session_index?:number;question_id:string;section:string;mondai_no:number;question_no:number;display_question_no:number|null;question_type:string;instruction_jp:string;prompt_jp:string;choices:string[];selected_index:number|null;correct_index:number;is_correct:boolean;answered:boolean;passage_title:string|null;passage_jp:string|null;transcript_jp:string|null;image_url:string|null;explanation_indonesian:string|null};
type Filter="all"|"wrong"|"unanswered"|"correct";
const sectionName:Record<string,string>={vocabulary:"文字・語彙",grammar:"文法",reading:"読解",listening:"聴解"};

function fallbackExplanation(item:ReviewItem){
 const correct=item.choices[item.correct_index]??"-";
 if(item.section==="reading") return `Jawaban yang tepat adalah 「${correct}」. Cocokkan pilihan ini dengan informasi pada bacaan sumber yang ditampilkan di bawah; pilihan lain tidak sesuai dengan isi atau maksud teks.`;
 if(item.section==="listening") return `Jawaban yang tepat adalah 「${correct}」. Gunakan transkrip/poin audio di bawah untuk mengecek bagian percakapan yang menentukan jawaban.`;
 if(item.question_type==="sentence_composition") return `Pada soal susun kalimat, pilihan 「${correct}」 adalah unsur yang menempati posisi ★ setelah susunan kalimat dibuat benar.`;
 if(item.section==="grammar") return `Jawaban yang tepat adalah 「${correct}」 karena pilihan inilah yang melengkapi pola kalimat pada soal secara benar. Perhatikan hubungan bentuk sebelum dan sesudah bagian kosong.`;
 return `Jawaban yang tepat adalah 「${correct}」. Periksa kembali bentuk, bacaan, atau makna kata pada soal dan bandingkan dengan pilihan yang Anda pilih.`;
}

function ReviewCard({item}:{item:ReviewItem}){
 const[open,setOpen]=useState(!item.is_correct);
 const shown=item.display_question_no??item.question_no;
 return <Card className={`rounded-2xl ${item.is_correct?"border-primary/20":"border-destructive/25"}`}><CardContent className="p-4">
  <button className="flex w-full items-start justify-between gap-3 text-left" onClick={()=>setOpen(v=>!v)}>
   <div className="flex min-w-0 gap-2">{item.is_correct?<CheckCircle2 className="mt-0.5 size-4 shrink-0 text-primary"/>:<XCircle className="mt-0.5 size-4 shrink-0 text-destructive"/>}<div><p className="text-[10px] font-semibold text-muted-foreground">{sectionName[item.section]??item.section} · 問題 {item.mondai_no} · 問 {shown}</p><p className="mt-1 font-jp text-sm font-semibold leading-6">{item.prompt_jp}</p></div></div>{open?<ChevronUp className="size-4 shrink-0"/>:<ChevronDown className="size-4 shrink-0"/>}
  </button>
  {open&&<div className="mt-4 space-y-3 border-t pt-4">
   {item.image_url&&<img src={item.image_url} alt={`Ilustrasi soal ${shown}`} className="mx-auto max-h-72 rounded-xl border object-contain"/>}
   <div className="space-y-2">{item.choices.map((choice,i)=>{const correct=i===item.correct_index;const selected=item.answered&&i===item.selected_index;return <div key={i} className={`flex gap-2 rounded-xl border p-3 text-xs ${correct?"border-primary bg-primary/5":selected?"border-destructive/40 bg-destructive/5":""}`}><span className="font-bold">{i+1}.</span><span className="font-jp flex-1">{choice}</span>{correct&&<span className="text-[10px] font-bold text-primary">BENAR</span>}{selected&&!correct&&<span className="text-[10px] font-bold text-destructive">JAWABANMU</span>}</div>})}</div>
   <div className="grid grid-cols-2 gap-2 text-[11px]"><div className="rounded-xl bg-muted/50 p-3"><p className="text-muted-foreground">Jawaban Anda</p><p className="mt-1 font-semibold">{item.answered?`${(item.selected_index??0)+1}. ${item.choices[item.selected_index??0]??"-"}`:"Tidak dijawab"}</p></div><div className="rounded-xl bg-primary/10 p-3"><p className="text-muted-foreground">Jawaban benar</p><p className="mt-1 font-semibold text-primary">{item.correct_index+1}. {item.choices[item.correct_index]??"-"}</p></div></div>
   <div className="rounded-xl border border-primary/20 bg-primary/5 p-3"><div className="flex items-center gap-2 text-xs font-bold text-primary"><CircleHelp className="size-4"/>Pembahasan</div><p className="mt-2 text-xs leading-6">{item.explanation_indonesian||fallbackExplanation(item)}</p></div>
   {item.passage_jp&&<details className="rounded-xl border p-3"><summary className="cursor-pointer text-xs font-semibold">Tampilkan bacaan sumber</summary>{item.passage_title&&<p className="mt-3 font-jp text-xs font-bold">{item.passage_title}</p>}<p className="mt-2 whitespace-pre-wrap font-jp text-xs leading-7">{item.passage_jp}</p></details>}
   {item.transcript_jp&&<details className="rounded-xl border p-3"><summary className="cursor-pointer text-xs font-semibold">Tampilkan transkrip Chōkai</summary><p className="mt-3 whitespace-pre-wrap font-jp text-xs leading-7">{item.transcript_jp}</p></details>}
  </div>}
 </CardContent></Card>;
}

function ResultPage(){
 const{level:raw}=Route.useParams();const level=raw.toUpperCase() as Level;const storageKey=`eno-jlpt-full-${level}`;
 const[progress,setProgress]=useState<FullProgress|null>(null);const[review,setReview]=useState<ReviewItem[]>([]);const[reviewLoading,setReviewLoading]=useState(true);const[reviewError,setReviewError]=useState<string|null>(null);const[filter,setFilter]=useState<Filter>("all");
 useEffect(()=>{try{const v=localStorage.getItem(storageKey);if(v)setProgress(JSON.parse(v))}catch(error){console.warn("Gagal membaca hasil simulasi dari penyimpanan lokal",error)}},[storageKey]);
 useEffect(()=>{let active=true;(async()=>{try{const fullId=localStorage.getItem(`${storageKey}-server-id`);if(!fullId){if(active)setReviewError("Data pembahasan untuk simulasi ini tidak ditemukan.");return}const{data,error}=await(supabase as any).rpc("get_jlpt_simulation_full_review",{p_full_session_id:fullId});if(error)throw error;if(active)setReview(Array.isArray(data)?data:[])}catch(error){console.error(error);if(active)setReviewError("Pembahasan belum berhasil dimuat.")}finally{if(active)setReviewLoading(false)}})();return()=>{active=false}},[storageKey]);
 const filtered=useMemo(()=>review.filter(x=>filter==="all"?true:filter==="correct"?x.is_correct:filter==="unanswered"?!x.answered:x.answered&&!x.is_correct),[review,filter]);
 if(!progress)return <AppShell title="Hasil Simulasi"><p className="py-10 text-center text-sm">Hasil simulasi tidak ditemukan.</p></AppShell>;
 const r=buildPracticeResult(level,progress);const certId=`ENO-${level}-${new Date(progress.startedAt).toISOString().slice(0,10).replaceAll("-","")}-${progress.startedAt.toString(36).toUpperCase()}`;
 return <AppShell title={`Hasil JLPT ${level}`} compact><div className="mx-auto max-w-2xl space-y-3">
  <Card className="rounded-2xl"><CardContent className="p-6 text-center">{r.passed?<CheckCircle2 className="mx-auto size-10 text-primary"/>:<XCircle className="mx-auto size-10 text-destructive"/>}<p className="mt-3 text-xs font-semibold text-muted-foreground">日本語能力試験 {level} · ENO NIHONGO PRACTICE</p><h1 className="mt-2 text-3xl font-black">{r.total} / 180</h1><p className={`mt-2 text-lg font-bold ${r.passed?"text-primary":"text-destructive"}`}>{r.passed?"合格 · LULUS":"不合格 · BELUM LULUS"}</p><p className="mt-2 text-[10px] text-muted-foreground">Skor ini adalah estimasi latihan ENO NIHONGO, bukan scaled score atau hasil resmi JLPT.</p></CardContent></Card>
  <div className="space-y-2">{r.blocks.map(b=><Card key={b.id}><CardContent className="flex items-center justify-between p-4"><div><p className="font-jp text-xs font-semibold">{b.label}</p><p className="mt-1 text-[10px] text-muted-foreground">Batas bagian latihan: {b.min} poin</p></div><strong className="text-lg">{b.score} / {b.max}</strong></CardContent></Card>)}</div>
  <Card><CardContent className="p-4 text-xs"><div className="flex justify-between"><span>Batas kelulusan total</span><strong>{r.overallPass} / 180</strong></div><div className="mt-2 flex justify-between"><span>Jawaban benar mentah</span><strong>{r.rawCorrect} / {r.rawQuestions}</strong></div></CardContent></Card>
  {r.passed&&<Card className="overflow-hidden rounded-2xl border-2 border-primary/30"><CardContent className="p-6 text-center"><Award className="mx-auto size-10 text-primary"/><p className="mt-2 text-[10px] font-bold tracking-[.25em] text-primary">ENO NIHONGO</p><h2 className="mt-3 text-xl font-bold">Certificate of Achievement</h2><p className="mt-3 text-xs">JLPT {level} Full Simulation</p><p className="mt-1 text-2xl font-black">{r.total} / 180</p><p className="mt-3 text-[10px] text-muted-foreground">Practice Certificate · bukan sertifikat JLPT resmi</p><div className="mt-4 rounded-lg bg-muted/50 p-2 font-mono text-[10px]">Verification ID: {certId}</div><p className="mt-2 text-[10px] text-muted-foreground">Tanggal: {new Date(progress.completedAt??progress.startedAt).toLocaleDateString("id-ID")}</p></CardContent></Card>}
  <div className="pt-3"><div className="flex items-end justify-between gap-3"><div><p className="text-[10px] font-bold uppercase tracking-widest text-primary">Review</p><h2 className="mt-1 text-lg font-black">Pembahasan Soal</h2><p className="mt-1 text-xs text-muted-foreground">Kunci jawaban hanya dibuka setelah simulasi selesai.</p></div><span className="text-xs font-semibold">{review.length} soal</span></div>
   <div className="mt-3 flex gap-2 overflow-x-auto pb-1">{([['all','Semua'],['wrong','Salah'],['unanswered','Kosong'],['correct','Benar']] as [Filter,string][]).map(([id,label])=><Button key={id} size="sm" variant={filter===id?"default":"outline"} onClick={()=>setFilter(id)}>{label}</Button>)}</div>
  </div>
  {reviewLoading?<Card><CardContent className="p-6 text-center text-xs text-muted-foreground">Memuat pembahasan…</CardContent></Card>:reviewError?<Card><CardContent className="p-6 text-center text-xs text-destructive">{reviewError}</CardContent></Card>:filtered.length===0?<Card><CardContent className="p-6 text-center text-xs text-muted-foreground">Tidak ada soal pada filter ini.</CardContent></Card>:<div className="space-y-3">{filtered.map(item=><ReviewCard key={`${item.attempt_id??''}:${item.question_id}`} item={item}/>)}</div>}
  <Button asChild variant="outline" className="w-full"><Link to="/simulasi">Kembali ke Simulasi</Link></Button>
 </div></AppShell>;
}
