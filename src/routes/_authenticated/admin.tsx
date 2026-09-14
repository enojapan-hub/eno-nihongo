import { createFileRoute,Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { BarChart3,BookOpen,Boxes,CloudCog,Crown,DollarSign,FileQuestion,FileUp,GraduationCap,Image,LayoutDashboard,Megaphone,Settings,ShieldCheck,ShoppingBag,Users,ClipboardCheck,MessageSquareWarning } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { Card,CardContent } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
export const Route=createFileRoute("/_authenticated/admin")({component:AdminPage});
const menus=[
 ["Dashboard",LayoutDashboard,"Ringkasan pengguna, konten, kelas dan sistem"],
 ["Materi",BookOpen,"Kanji, Kosakata, Bunpou, Dokkai dan Choukai"],
 ["Simulasi JLPT",FileQuestion,"Level, paket ujian, sesi dan bank soal"],
 ["Kelas",GraduationCap,"Kelas guru, banner, review dan peserta"],
 ["Review Konten",ClipboardCheck,"Draft dan konten yang menunggu pemeriksaan"],
 ["Pengguna",Users,"Akun, role, paket dan status pengguna"],
 ["Langganan",ShoppingBag,"Free, Premium, Lifetime dan voucher"],
 ["Keuangan",DollarSign,"Pemasukan, transaksi dan refund"],
 ["Media",Image,"Gambar, audio, banner dan file"],
 ["Laporan",MessageSquareWarning,"Kesalahan konten, bug dan laporan pengguna"],
 ["Pengumuman",Megaphone,"Informasi, notifikasi dan maintenance"],
 ["Analitik",BarChart3,"Aktivitas belajar, retention dan performa"],
 ["Import / Export",FileUp,"Pekerjaan batch dan ekspor data"],
 ["Sistem & Backup",CloudCog,"Kesehatan sistem, backup dan pemulihan"],
 ["Pengaturan",Settings,"Role, permission, audit log dan keamanan"],
] as const;
function AdminPage(){const overview=useQuery({queryKey:["admin-overview"],queryFn:async()=>{const{data,error}=await(supabase as any).rpc("get_admin_overview");if(error)throw error;return data as any},retry:false});if(overview.isLoading)return <AppShell title="Admin"><p className="py-12 text-center">Memeriksa akses…</p></AppShell>;if(overview.isError)return <AppShell title="Admin"><div className="py-12 text-center"><ShieldCheck className="mx-auto size-10"/><p className="mt-2 font-bold">Akses admin diperlukan</p></div></AppShell>;return <AppShell title="Admin" compact><div className="mx-auto max-w-5xl space-y-5 pb-10"><div className="rounded-3xl bg-primary p-5 text-primary-foreground"><div className="flex items-center gap-2 text-xs font-bold"><Crown className="size-4"/>OWNER / ADMIN</div><h1 className="mt-2 text-2xl font-black">Panel Admin</h1><p className="mt-1 text-xs opacity-80">Pusat pengelolaan ENO NIHONGO.</p></div><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{menus.map(([label,Icon,desc])=><Card key={label} className="transition hover:border-primary/40"><CardContent className="p-4"><div className="mb-3 flex size-10 items-center justify-center rounded-2xl bg-primary/10 text-primary"><Icon className="size-5"/></div><h2 className="text-sm font-black">{label}</h2><p className="mt-1 min-h-8 text-[10px] leading-4 text-muted-foreground">{desc}</p>{label==="Materi"||label==="Simulasi JLPT"?<Link to="/admin-konten" className="mt-3 inline-block text-xs font-bold text-primary">Kelola →</Link>:label==="Kelas"?<Link to="/admin-kelas" className="mt-3 inline-block text-xs font-bold text-primary">Kelola →</Link>:label==="Import / Export"?<Link to="/admin-terjemahan" className="mt-3 inline-block text-xs font-bold text-primary">Buka alat →</Link>:<span className="mt-3 inline-block text-[10px] text-muted-foreground">Modul disiapkan</span>}</CardContent></Card>)}</div></div></AppShell>}
