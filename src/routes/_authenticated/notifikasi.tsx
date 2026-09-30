import { createFileRoute, Link } from "@tanstack/react-router";\nimport { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Bell, BellRing, BookOpen, CheckCheck, ChevronRight, CircleAlert, Clock3, Gift, GraduationCap, Info, Megaphone, ShieldAlert, Sparkles, Target, Trash2 } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/notifikasi")({ component: NotificationsPage });

type NotificationRow = {
  id: string;
  title: string;
  body: string;
  kind: string;
  action_url: string | null;
  read_at: string | null;
  created_at: string;
};

async function fetchNotifications(): Promise<NotificationRow[]> {
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return [];
  const { data, error } = await supabase
    .from("user_notifications" as never)
    .select("id,title,body,kind,action_url,read_at,created_at")
    .eq("user_id", auth.user.id)
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as NotificationRow[];
}

function iconFor(kind: string) {
  if (kind === "reward") return Gift;
  if (kind === "target") return Target;
  return Info;
}

function NotificationsPage() {
  const qc = useQueryClient();
  const query = useQuery({ queryKey: ["notifications"], queryFn: fetchNotifications, staleTime: 10_000 });
  const markRead = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("user_notifications" as never).update({ read_at: new Date().toISOString() } as never).eq("id", id);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["notifications"] }),
  });
  const markAll = useMutation({
    mutationFn: async () => {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) return;
      const { error } = await supabase.from("user_notifications" as never).update({ read_at: new Date().toISOString() } as never).eq("user_id", auth.user.id).is("read_at", null);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["notifications"] }),
  });

  const rows = query.data ?? [];
  const unread = rows.filter(n => !n.read_at).length;

  return <AppShell title="Pemberitahuan" backTo="/dashboard" backLabel="Home" compact>
    <div className="mx-auto max-w-xl space-y-4">
      <section className="overflow-hidden rounded-[1.8rem] border border-primary/15 bg-gradient-to-br from-primary/[.12] via-background to-background p-5">
        <div className="flex items-start justify-between gap-3"><div><p className="text-[9px] font-black uppercase tracking-[.15em] text-primary">Pusat Aktivitas</p><h1 className="mt-1 text-[21px] font-black">Pemberitahuan</h1><p className="mt-1 text-[10px] text-muted-foreground">{unread?unread+" pemberitahuan belum dibaca":"Semua sudah dibaca"}</p></div><span className="relative grid size-11 place-items-center rounded-2xl bg-primary/10 text-primary"><BellRing className="size-5"/>{unread>0&&<span className="absolute -right-1 -top-1 grid min-w-5 place-items-center rounded-full bg-destructive px-1 text-[8px] font-black leading-5 text-destructive-foreground">{unread>9?"9+":unread}</span>}</span></div>
        <div className="mt-4 flex items-center gap-2"><div className="flex flex-1 rounded-xl bg-muted/70 p-1"><button onClick={()=>setFilter("all")} className={"flex-1 rounded-lg py-2 text-[9px] font-bold "+(filter==="all"?"bg-background text-primary shadow-sm":"text-muted-foreground")}>Semua</button><button onClick={()=>setFilter("unread")} className={"flex-1 rounded-lg py-2 text-[9px] font-bold "+(filter==="unread"?"bg-background text-primary shadow-sm":"text-muted-foreground")}>Belum Dibaca</button></div>{unread>0&&<Button variant="outline" size="sm" className="h-9 rounded-xl px-3 text-[9px]" onClick={()=>markAll.mutate()} disabled={markAll.isPending}><CheckCheck className="mr-1 size-3"/>Baca semua</Button>}</div>
      </section>
      {query.isLoading?<Card className="rounded-2xl"><CardContent className="py-10 text-center text-[10px] text-muted-foreground">Memuat pemberitahuan…</CardContent></Card>:query.isError?<Card className="rounded-2xl"><CardContent className="py-8 text-center text-[10px] text-destructive"><CircleAlert className="mx-auto mb-2 size-5"/>Pemberitahuan gagal dimuat.</CardContent></Card>:groups.length===0?<Card className="rounded-[1.6rem]"><CardContent className="py-12 text-center"><span className="mx-auto grid size-12 place-items-center rounded-2xl bg-muted"><Bell className="size-5 text-muted-foreground"/></span><p className="mt-3 text-[11px] font-bold">{filter==="unread"?"Tidak ada yang terlewat":"Belum ada pemberitahuan"}</p><p className="mt-1 text-[9px] text-muted-foreground">{filter==="unread"?"Semua pemberitahuan sudah dibaca.":"Aktivitas penting akan muncul di sini."}</p></CardContent></Card>:<div className="space-y-5">{groups.map(group=><section key={group.label}><div className="mb-2 flex items-center gap-2 px-1"><Clock3 className="size-3 text-muted-foreground"/><h2 className="text-[10px] font-black text-muted-foreground">{group.label}</h2></div><div className="space-y-2">{group.rows.map(row=>{const m=metaFor(row.kind),Icon=m.Icon;const box=<div className={"group flex items-start gap-3 rounded-2xl border p-3 transition "+(!row.read_at?m.tone:"bg-card")}><span className={"grid size-10 shrink-0 place-items-center rounded-xl "+m.icon}><Icon className="size-4"/></span><div className="min-w-0 flex-1"><div className="flex items-center gap-1.5"><span className="text-[7px] font-black uppercase tracking-wide text-muted-foreground">{m.label}</span>{!row.read_at&&<span className="size-1.5 rounded-full bg-primary"/>}</div><p className="mt-0.5 text-[11px] font-bold leading-4">{row.title}</p><p className="mt-1 text-[9px] leading-4 text-muted-foreground">{row.body}</p><p className="mt-1.5 text-[8px] text-muted-foreground">{new Date(row.created_at).toLocaleString("id-ID",{dateStyle:"medium",timeStyle:"short"})}</p></div>{row.action_url&&<ChevronRight className="mt-3 size-4 shrink-0 text-muted-foreground"/>}<button type="button" aria-label="Hapus pemberitahuan" onClick={e=>{e.preventDefault();e.stopPropagation();if(window.confirm("Hapus pemberitahuan ini?"))remove.mutate(row.id)}} disabled={remove.isPending} className="grid size-8 shrink-0 place-items-center rounded-xl text-muted-foreground transition hover:bg-destructive/10 hover:text-destructive"><Trash2 className="size-3.5"/></button></div>;return row.action_url?<Link key={row.id} to={row.action_url as "/dashboard"} onClick={()=>{if(!row.read_at)markRead.mutate(row.id)}}>{box}</Link>:<button key={row.id} type="button" className="w-full text-left" onClick={()=>{if(!row.read_at)markRead.mutate(row.id)}}>{box}</button>})}</div></section>)}</div>}
      <Card className="rounded-2xl border-primary/10 bg-primary/[.025]"><CardContent className="flex gap-3 p-3"><Sparkles className="mt-0.5 size-3.5 shrink-0 text-primary"/><p className="text-[8px] leading-4 text-muted-foreground">Pemberitahuan penting seperti deadline, tugas, kelas, hadiah, dan informasi sistem ditampilkan dengan ikon serta penanda yang berbeda.</p></CardContent></Card>
    </div>
  </AppShell>;
