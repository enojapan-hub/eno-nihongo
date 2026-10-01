import { Link } from "@tanstack/react-router";
import { Crown, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";

export function UpgradeCard({ title = "Lanjutkan dengan Premium", description = "Buka fitur yang membantu kamu belajar lebih terarah dan memahami kelemahanmu." }: { title?: string; description?: string }) {
  return <section className="rounded-2xl border border-primary/25 bg-primary/[0.045] p-4"><div className="flex items-start gap-3"><span className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary text-primary-foreground"><Crown className="size-5" /></span><div className="min-w-0"><p className="flex items-center gap-1 text-[10px] font-black tracking-wide text-primary"><Sparkles className="size-3" /> PREMIUM</p><h2 className="mt-1 text-[13px] font-bold">{title}</h2><p className="mt-1 text-[10px] leading-4 text-muted-foreground">{description}</p></div></div><Button asChild className="mt-3 h-9 w-full rounded-xl text-[11px]"><Link to="/paket">Lihat Paket Premium</Link></Button></section>;
}
