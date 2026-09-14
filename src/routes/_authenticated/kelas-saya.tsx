import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { CalendarDays, ExternalLink, GraduationCap } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/kelas-saya")({ component: Page });
function Page(){
 const q=useQuery({queryKey:["my-classes"],queryFn:async()=>{const{data,error}=await(supabase as any).rpc("get_my_classes");if(error)throw error;return data??[]}});
 return <AppShell title="Kelas Saya" backTo="/kelas"><div className="mx-auto max-w-3xl space-y-4"><div><h1 className="text-xl font-black">Kelas Saya</h1><p className="text-xs text-muted-foreground">Kelas yang sudah Anda ikuti.</p></div>{q.isLoading&&<p className="text-xs text-muted-foreground">Memuat kelas…</p>}{q.isError&&<p className="rounded-xl bg-destructive/10 p-3 text-xs text-destructive">Gagal memuat kelas.</p>}<div className="grid gap-3 sm:grid-cols-2">{(q.data??[]).map((c:any)=><Card key={c.id} className="overflow-hidden">{c.banner_url&&<img src={c.banner_url} alt={c.title} className="aspect-video w-full object-cover"/>}<CardContent className="space-y-3 p-4"><div className="flex items-center gap-2"><GraduationCap className="size-4 text-primary"/><span className="text-[10px] font-bold text-primary">{c.level}</span></div><h2 className="font-black">{c.title}</h2><p className="flex items-center gap-1 text-[10px] text-muted-foreground"><CalendarDays className="size-3"/>{c.starts_at?new Date(c.starts_at).toLocaleString("id-ID"):"Jadwal menyusul"}</p><div className="flex flex-wrap gap-2"><Button size="sm" variant="outline" asChild><Link to="/kelas/$classId" params={{classId:c.id}}>Buka Kelas</Link></Button>{c.meeting_url&&<Button size="sm" asChild><a href={c.meeting_url} target="_blank" rel="noreferrer"><ExternalLink className="mr-1 size-3"/>Live</a></Button>}</div></CardContent></Card>)}{!q.isLoading&&(q.data??[]).length===0&&<p className="text-xs text-muted-foreground">Anda belum mengikuti kelas.</p>}</div></div></AppShell>}
