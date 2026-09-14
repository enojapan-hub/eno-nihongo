import { createFileRoute,Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { CalendarDays,GraduationCap,Users } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { Card,CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";

export const Route=createFileRoute("/_authenticated/kelas")({component:KelasPage});
function KelasPage(){
 const banners=useQuery({queryKey:["class-banners"],queryFn:async()=>{const{data,error}=await(supabase as any).from("class_banners").select("*").eq("is_active",true).order("sort_order");if(error)throw error;return data??[]}});
 const classes=useQuery({queryKey:["published-classes"],queryFn:async()=>{const{data,error}=await(supabase as any).from("classes").select("*").eq("status","published").order("starts_at",{ascending:true});if(error)throw error;return data??[]}});
 return <AppShell title="Kelas" description="Belajar bersama guru ENO NIHONGO."><div className="space-y-5">
  {(banners.data??[]).map((b:any)=><div key={b.id} className="relative min-h-40 overflow-hidden rounded-3xl bg-muted"><img src={b.image_url} alt={b.title||"Banner kelas"} className="absolute inset-0 h-full w-full object-cover"/><div className="relative flex min-h-40 flex-col justify-end bg-gradient-to-t from-black/75 to-transparent p-5 text-white"><h2 className="text-xl font-black">{b.title}</h2>{b.subtitle&&<p className="mt-1 text-xs opacity-90">{b.subtitle}</p>}{b.cta_url&&<a href={b.cta_url} className="mt-3 w-fit rounded-xl bg-white px-3 py-2 text-xs font-bold text-black">{b.cta_label||"Lihat kelas"}</a>}</div></div>)}
  <div><h2 className="mb-3 flex items-center gap-2 text-base font-black"><GraduationCap className="size-5"/>Kelas tersedia</h2><div className="grid gap-3 sm:grid-cols-2">{(classes.data??[]).map((c:any)=><Card key={c.id} className="overflow-hidden">{c.banner_url&&<img src={c.banner_url} alt={c.title} className="aspect-video w-full object-cover"/>}<CardContent className="p-4"><div className="mb-2 flex items-center gap-2"><span className="rounded-full bg-primary/10 px-2 py-1 text-[10px] font-bold text-primary">{c.level}</span><span className="text-[10px] text-muted-foreground">{c.class_mode}</span></div><h3 className="font-black">{c.title}</h3><p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{c.description}</p><div className="mt-3 flex gap-3 text-[10px] text-muted-foreground">{c.starts_at&&<span className="flex items-center gap-1"><CalendarDays className="size-3"/>{new Date(c.starts_at).toLocaleDateString("id-ID")}</span>}{c.capacity&&<span className="flex items-center gap-1"><Users className="size-3"/>{c.capacity} siswa</span>}</div><div className="mt-3 flex items-center justify-between"><strong className="text-sm">{Number(c.price)>0?`${c.currency} ${Number(c.price).toLocaleString("id-ID")}`:"Gratis"}</strong><Button size="sm" asChild><Link to="/kelas/$classId" params={{classId:c.id}}>Lihat Kelas</Link></Button></div></CardContent></Card>)}{!classes.isLoading&&(classes.data??[]).length===0&&<p className="text-xs text-muted-foreground">Belum ada kelas yang dipublikasikan.</p>}</div></div>
 </div></AppShell>
}
