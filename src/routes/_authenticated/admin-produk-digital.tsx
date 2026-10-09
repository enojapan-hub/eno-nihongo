import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { FileUp, PackagePlus, Save } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";

export const Route=createFileRoute("/_authenticated/admin-produk-digital")({component:Page});
type Product={id:string;title:string;category:string;description:string|null;price_idr:number|string;file_name:string;status:string;related_class_id:string|null};
function Page(){
 const qc=useQueryClient();
 const [title,setTitle]=useState(""),[category,setCategory]=useState("E-book"),[description,setDescription]=useState(""),[price,setPrice]=useState(""),[relatedClass,setRelatedClass]=useState(""),[file,setFile]=useState<File|null>(null),[message,setMessage]=useState("");
 const products=useQuery({queryKey:["admin-digital-products"],queryFn:async()=>{const {data,error}=await supabase.from("digital_products" as never).select("id,title,category,description,price_idr,file_name,status,related_class_id").order("created_at",{ascending:false});if(error)throw error;return(data??[]) as unknown as Product[]},retry:false});
 const classes=useQuery({queryKey:["admin-digital-product-classes"],queryFn:async()=>{const {data,error}=await supabase.from("classes").select("id,title").order("created_at",{ascending:false});if(error)throw error;return data??[]},retry:false});
 const save=useMutation({mutationFn:async()=>{
   if(!title.trim()||!file)throw new Error("Judul dan file produk wajib diisi.");
   const amount=Math.round(Number(price)); if(!Number.isFinite(amount)||amount<0)throw new Error("Harga tidak valid.");
   if(!["application/pdf","application/zip"].includes(file.type))throw new Error("File produk harus PDF atau ZIP.");
   const path=`products/${crypto.randomUUID()}/${file.name.replace(/[^a-zA-Z0-9._-]/g,"_")}`;
   const uploaded=await supabase.storage.from("digital-products").upload(path,file,{upsert:false}); if(uploaded.error)throw uploaded.error;
   const {error}=await supabase.from("digital_products" as never).insert({title:title.trim(),category:category.trim()||"E-book",description:description.trim()||null,price_idr:amount,file_path:path,file_name:file.name,file_size_bytes:file.size,mime_type:file.type,related_class_id:relatedClass||null,status:"draft"} as never);
   if(error){await supabase.storage.from("digital-products").remove([path]);throw error;}
 },onSuccess:async()=>{setTitle("");setDescription("");setPrice("");setRelatedClass("");setFile(null);setMessage("Produk tersimpan sebagai Draft.");await qc.invalidateQueries({queryKey:["admin-digital-products"]})},onError:(e)=>setMessage(e instanceof Error?e.message:"Produk gagal disimpan.")});
 return <AppShell title="Produk Digital" compact><div className="mx-auto max-w-5xl space-y-5 pb-12">
  <div className="space-y-2"><div className="flex flex-wrap items-center gap-2"><h1 className="text-xl font-black">Produk Digital</h1><span className="rounded-full border border-primary/30 bg-primary/10 px-2.5 py-1 text-[11px] font-bold text-primary">Segera Hadir</span></div><p className="text-xs text-muted-foreground">Produk digital sedang dipersiapkan. Pembelian dan pengiriman produk belum tersedia. Admin dapat menyiapkan produk sebagai Draft.</p></div>
  <div className="grid gap-5 lg:grid-cols-[1fr_1.2fr]">
   <section className="space-y-3 rounded-2xl border bg-card p-4">
    <h2 className="flex items-center gap-2 font-black"><PackagePlus className="size-4 text-primary"/>Tambah produk</h2>
    <Input value={title} onChange={e=>setTitle(e.target.value)} placeholder="Judul produk"/>
    <div className="grid grid-cols-2 gap-2"><Input value={category} onChange={e=>setCategory(e.target.value)} placeholder="Kategori"/><Input inputMode="numeric" value={price} onChange={e=>setPrice(e.target.value.replace(/\D/g,""))} placeholder="Harga Rupiah"/></div>
    <Textarea value={description} onChange={e=>setDescription(e.target.value)} placeholder="Deskripsi singkat"/>
    <select value={relatedClass} onChange={e=>setRelatedClass(e.target.value)} className="h-10 w-full rounded-md border bg-background px-3 text-sm"><option value="">Tanpa kelas terkait</option>{classes.data?.map(c=><option key={c.id} value={c.id}>{c.title}</option>)}</select>
    <label className="flex cursor-pointer items-center gap-2 rounded-xl border border-dashed p-3 text-xs"><FileUp className="size-4 text-primary"/><span className="truncate">{file?.name||"Pilih PDF atau ZIP"}</span><input className="hidden" type="file" accept=".pdf,.zip,application/pdf,application/zip" onChange={e=>setFile(e.target.files?.[0]??null)}/></label>
    <Button className="w-full" disabled={save.isPending} onClick={()=>save.mutate()}><Save className="mr-2 size-4"/>{save.isPending?"Menyimpan…":"Simpan Draft"}</Button>
    {message&&<p className="text-[11px] text-muted-foreground">{message}</p>}
   </section>
   <section className="space-y-2"><h2 className="font-black">Daftar produk</h2>{products.data?.map(p=><div key={p.id} className="flex items-center gap-3 rounded-2xl border bg-card p-4"><span className="grid size-10 place-items-center rounded-xl bg-primary/10"><FileUp className="size-4 text-primary"/></span><div className="min-w-0 flex-1"><b className="block truncate text-sm">{p.title}</b><p className="truncate text-[10px] text-muted-foreground">{p.category} · {p.file_name} · {p.status}</p></div><b className="text-xs">{new Intl.NumberFormat("id-ID",{style:"currency",currency:"IDR",maximumFractionDigits:0}).format(Number(p.price_idr))}</b></div>)}{!products.isLoading&&!products.data?.length&&<p className="rounded-2xl border border-dashed p-6 text-center text-xs text-muted-foreground">Belum ada produk.</p>}</section>
  </div>
 </div></AppShell>
}
