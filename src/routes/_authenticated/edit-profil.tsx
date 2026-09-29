import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { CalendarDays, Camera, Save, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { getMyAccount, updateMyAccount } from "@/lib/profile.functions";
import { COUNTRIES } from "@/lib/countries";
import { supabase } from "@/integrations/supabase/client";

export const Route=createFileRoute("/_authenticated/edit-profil")({component:EditProfilePage});
const LEVELS=["N5","N4","N3","N2","N1"] as const;
const TARGET_MONTHS=[2,3,4,6,9,12] as const;
function plusMonths(months:number){const d=new Date();d.setMonth(d.getMonth()+months);return d.toISOString().slice(0,10)}
function formatDate(date:string){return new Intl.DateTimeFormat("id-ID",{day:"numeric",month:"long",year:"numeric",timeZone:"Asia/Tokyo"}).format(new Date(`${date}T00:00:00+09:00`))}

function EditProfilePage(){
 const navigate=useNavigate();
 const qc=useQueryClient();
 const account=useQuery({queryKey:["my-account-edit"],queryFn:()=>getMyAccount()});
 const[data,setData]=useState({display_name:"",target_level:"N5",ui_language:"id",country:"Indonesia",target_months:3,study_days:5});
 const[saving,setSaving]=useState(false);
 useEffect(()=>{if(account.data?.profile)setData(v=>({...v,display_name:account.data.profile.display_name??"",target_level:account.data.profile.target_level??"N5",ui_language:account.data.profile.ui_language??"id",country:account.data.profile.country??"Indonesia"}))},[account.data]);
 useEffect(()=>{void (async()=>{const{data:auth}=await supabase.auth.getUser();if(!auth.user)return;const{data:plan}=await (supabase as any).from("study_plans").select("study_days_per_week").eq("user_id",auth.user.id).eq("status","active").order("created_at",{ascending:false}).limit(1).maybeSingle();const days=Number(plan?.study_days_per_week);if(days>=1&&days<=7)setData(v=>({...v,study_days:days}))})()},[]);
 useEffect(()=>{void supabase.auth.getUser().then(({data:auth})=>{const months=Number(auth.user?.user_metadata?.study_target_months);if(TARGET_MONTHS.includes(months as any))setData(v=>({...v,target_months:months}))})},[]);
 const targetDate=plusMonths(data.target_months);
 const save=async()=>{
  if(data.display_name.trim().length<2)return toast.error("Nama minimal 2 karakter.");
  const s=account.data?.settings;if(!s)return;
  setSaving(true);
  try{
   await updateMyAccount({data:{display_name:data.display_name.trim(),target_level:data.target_level as any,ui_language:data.ui_language as any,country:data.country,daily_kanji_target:s.daily_kanji_target??5,daily_vocab_target:s.daily_vocab_target??10,daily_grammar_target:s.daily_grammar_target??5,furigana_enabled:s.furigana_enabled??true,daily_reminder:s.daily_reminder??false}} as any);
   const client=supabase as any;
   const{error:planError}=await client.rpc("create_or_replace_study_plan",{p_target_level:data.target_level,p_target_date:targetDate,p_daily_minutes:45,p_study_days:data.study_days});
   if(planError)throw new Error(`Rencana belajar gagal dibuat: ${planError.message}`);
   const{error:taskError}=await client.rpc("generate_weekly_study_plan",{});if(taskError)throw new Error(`Target harian gagal dibuat: ${taskError.message}`);
   await client.rpc("sync_daily_study_task_progress",{});
   const{error:metaError}=await supabase.auth.updateUser({data:{display_name:data.display_name.trim(),target_level:data.target_level,country:data.country,study_target_months:data.target_months,study_target_date:targetDate}});if(metaError)throw metaError;
   await Promise.all([qc.invalidateQueries({queryKey:["adaptive-plan"]}),qc.invalidateQueries({queryKey:["target-level"]}),qc.invalidateQueries({queryKey:["my-account-profile"]}),qc.invalidateQueries({queryKey:["my-account-edit"]})]);
   toast.success(`Adaptive Study Planner aktif: ${data.target_level} · ${data.target_months} bulan.`);
   await navigate({to:"/profil"});
  }catch(e){toast.error(e instanceof Error?e.message:"Gagal menyimpan profil.")}finally{setSaving(false)}
 };
 return <AppShell title="Edit Profil" backTo="/profil" compact><div className="mx-auto max-w-md space-y-3"><Card className="rounded-2xl"><CardContent className="space-y-4 p-4">
  <div className="flex items-center gap-3"><div className="grid size-14 place-items-center overflow-hidden rounded-full border bg-muted">{account.data?.profile?.avatar_url?<img src={account.data.profile.avatar_url} alt="Foto profil" className="size-full object-cover"/>:<Camera className="size-5 text-muted-foreground"/>}</div><div><p className="text-[12px] font-semibold">Foto profil</p><Button asChild variant="outline" size="sm" className="mt-1 h-8 text-[10px]"><Link to="/profil-foto">Ganti foto</Link></Button></div></div>
  <label className="block text-[11px] font-semibold">Nama<Input className="mt-1" value={data.display_name} onChange={e=>setData(v=>({...v,display_name:e.target.value}))}/></label>
  <label className="block text-[11px] font-semibold">Target level JLPT<select className="mt-1 h-10 w-full rounded-xl border bg-background px-3 text-[12px]" value={data.target_level} onChange={e=>setData(v=>({...v,target_level:e.target.value}))}>{LEVELS.map(x=><option key={x}>{x}</option>)}</select></label>
  <label className="block text-[11px] font-semibold">Target berapa bulan<select className="mt-1 h-10 w-full rounded-xl border bg-background px-3 text-[12px]" value={data.target_months} onChange={e=>setData(v=>({...v,target_months:Number(e.target.value)}))}>{TARGET_MONTHS.map(x=><option key={x} value={x}>{x} bulan</option>)}</select></label>
  <label className="block text-[11px] font-semibold">Hari belajar per minggu<select className="mt-1 h-10 w-full rounded-xl border bg-background px-3 text-[12px]" value={data.study_days} onChange={e=>setData(v=>({...v,study_days:Number(e.target.value)}))}>{[1,2,3,4,5,6,7].map(x=><option key={x} value={x}>{x} hari / minggu</option>)}</select></label>
  <div className="rounded-2xl border border-primary/15 bg-primary/[0.06] p-3"><div className="flex items-start gap-2"><Sparkles className="mt-0.5 size-4 shrink-0 text-primary"/><div><p className="text-[11px] font-bold text-primary">Adaptive Study Planner</p><p className="mt-1 text-[10px] leading-5 text-muted-foreground">Rencana mingguan akan disusun untuk menyelesaikan {data.target_level} dalam {data.target_months} bulan dengan {data.study_days} hari belajar per minggu. Progres yang sudah selesai tetap dipertahankan.</p><p className="mt-1.5 flex items-center gap-1 text-[10px] font-semibold"><CalendarDays className="size-3.5"/>Perkiraan target: {formatDate(targetDate)}</p></div></div></div>
  <label className="block text-[11px] font-semibold">Bahasa aplikasi<select className="mt-1 h-10 w-full rounded-xl border bg-background px-3 text-[12px]" value={data.ui_language} onChange={e=>setData(v=>({...v,ui_language:e.target.value}))}><option value="id">Bahasa Indonesia</option><option value="en">English</option><option value="ja">日本語</option></select></label>
  <label className="block text-[11px] font-semibold">Negara<select className="mt-1 h-10 w-full rounded-xl border bg-background px-3 text-[12px]" value={data.country} onChange={e=>setData(v=>({...v,country:e.target.value}))}>{COUNTRIES.map(x=><option key={x}>{x}</option>)}</select></label>
  <Button className="w-full rounded-xl" disabled={saving} onClick={()=>void save()}><Save className="mr-2 size-4"/>{saving?"Menyusun ulang rencana…":"Simpan & Aktifkan Planner"}</Button>
 </CardContent></Card></div></AppShell>;
}
