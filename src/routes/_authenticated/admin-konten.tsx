import { createFileRoute,Link } from "@tanstack/react-router";
import { BookOpen,FileQuestion,Languages } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { Card,CardContent } from "@/components/ui/card";
export const Route=createFileRoute("/_authenticated/admin-konten")({component:Page});
const items=[['Materi JLPT','Level → Jenis Materi → Pelajaran → Edit',BookOpen],['Simulasi JLPT','Level → Full/Bagian Ujian → Nomor Ujian → Sesi → Nomor Soal → Edit',FileQuestion],['Terjemahan','Pemeriksaan dan pekerjaan batch terjemahan',Languages]] as const;
function Page(){return <AppShell title="Konten" backTo="/admin"><div className="space-y-3"><h1 className="text-xl font-black">Kelola Konten</h1><p className="text-xs text-muted-foreground">Struktur editor dipisahkan agar bank materi dan simulasi tetap mudah dikelola.</p>{items.map(([t,d,I])=><Card key={t}><CardContent className="flex items-center gap-3 p-4"><I className="size-5 text-primary"/><div><p className="text-sm font-bold">{t}</p><p className="text-[10px] text-muted-foreground">{d}</p></div></CardContent></Card>)}<Link to="/admin-terjemahan" className="inline-block text-xs font-bold text-primary">Buka alat terjemahan →</Link></div></AppShell>}
