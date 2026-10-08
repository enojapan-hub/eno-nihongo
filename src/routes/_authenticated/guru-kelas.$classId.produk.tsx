import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, FileUp, LockKeyhole, PackagePlus, WalletCards } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/guru-kelas/$classId/produk")({ component: Page });

type Product = { id:string; title:string; description:string|null; price_idr:number|string; file_name:string; status:string; created_at:string };
const rupiah=(v:number|string)=>new Intl.NumberFormat("id-ID",{style:"currency",currency:"IDR",maximumFractionDigits:0}).format(Number(v));

function Page(){
 const {classId}=Route.useParams();
 const access=useQuery({
  queryKey:["class-manage-access",classId],
  queryFn:async()=>{const {data,error}=await supabase.rpc("can_manage_class",{p_class_id:classId});if(error)throw error;return data===true;}
 });
 const products=useQuery({
  queryKey:["teacher-class-digital-products",classId],
  enabled:access.data===true,
  queryFn:async()=>{const {data,error}=await supabase.from("class_digital_products" as never).select("id,title,description,price_idr,file_name,status,created_at").eq("class_id",classId).order("created_at",{ascending:false});if(error)throw error;return(data??[]) as unknown as Product[];}
 });
 if(access.isLoading)return <AppShell title="Produk Digital"><p className="p-4 text-xs">Memeriksa akses…</p></AppShell>;
 if(access.data!==true)return <AppShell title="Produk Digital"><p className="p-4 text-xs text-destructive">Akses guru diperlukan.</p></AppShell>;
 return <AppShell title="Produk Digital" backTo={"/guru-kelas/"+classId as never}>
  <div className="mx-auto max-w-4xl space-y-5 pb-12">
   <header className="flex items-center justify-between gap-3">
    <div className="flex items-center gap-3">
     <Button size="icon" variant="outline" className="rounded-full" asChild><Link to="/guru-kelas/$classId" params={{classId}}><ArrowLeft className="size-4"/></Link></Button>
     <div><h1 className="text-xl font-black">Produk Digital</h1><p className="text-xs text-muted-foreground">Kelola produk tambahan untuk kelas ini.</p></div>
    </div>
    <Button disabled title="Aktif setelah migration dan Storage diterapkan"><PackagePlus className="mr-2 size-4"/>Tambah</Button>
   </header>
   <div className="grid gap-3 sm:grid-cols-3">
    <Card><CardContent className="p-4"><FileUp className="size-5 text-primary"/><p className="mt-2 text-sm font-black">{products.data?.length??0}</p><p className="text-[10px] text-muted-foreground">Produk dibuat</p></CardContent></Card>
    <Card><CardContent className="p-4"><WalletCards className="size-5 text-primary"/><p className="mt-2 text-sm font-black">80%</p><p className="text-[10px] text-muted-foreground">Porsi guru per transaksi</p></CardContent></Card>
    <Card><CardContent className="p-4"><LockKeyhole className="size-5 text-primary"/><p className="mt-2 text-sm font-black">Privat</p><p className="text-[10px] text-muted-foreground">File hanya untuk pembeli</p></CardContent></Card>
   </div>
   <div className="space-y-2">{products.data?.map(p=><Card key={p.id}><CardContent className="flex items-center gap-3 p-4"><span className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary/10"><FileUp className="size-4 text-primary"/></span><div className="min-w-0 flex-1"><p className="truncate text-sm font-black">{p.title}</p><p className="truncate text-[10px] text-muted-foreground">{p.file_name} · {p.status}</p></div><p className="text-xs font-black">{rupiah(p.price_idr)}</p></CardContent></Card>)}</div>
   {!products.isLoading&&products.data?.length===0&&<p className="rounded-2xl border border-dashed p-6 text-center text-xs text-muted-foreground">Belum ada produk. Form upload diaktifkan setelah migration Storage diterapkan.</p>}
  </div>
 </AppShell>;
}
