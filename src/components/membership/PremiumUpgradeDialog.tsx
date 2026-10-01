import { Link } from "@tanstack/react-router";
import { Crown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export function PremiumUpgradeDialog({ open, onOpenChange, feature = "Fitur ini" }: { open: boolean; onOpenChange: (open: boolean) => void; feature?: string }) {
  return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent className="w-[calc(100%-2rem)] max-w-sm rounded-3xl p-5"><DialogHeader className="text-left"><span className="grid size-11 place-items-center rounded-2xl bg-primary text-primary-foreground"><Crown className="size-5" /></span><DialogTitle className="pt-2 text-lg font-black">{feature} adalah fitur Premium</DialogTitle><DialogDescription className="text-xs leading-5">Akun Free tetap bisa belajar dari menu Materi dan Hafalan. Premium membuka rekomendasi latihan yang disusun dari progresmu.</DialogDescription></DialogHeader><DialogFooter className="gap-2 sm:flex-col sm:space-x-0"><Button asChild className="w-full rounded-xl"><Link to="/paket">Lihat Paket Premium</Link></Button><Button type="button" variant="outline" className="w-full rounded-xl" onClick={() => onOpenChange(false)}>Nanti saja</Button></DialogFooter></DialogContent></Dialog>;
}
