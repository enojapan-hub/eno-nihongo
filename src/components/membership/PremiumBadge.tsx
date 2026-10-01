import { Gem } from "lucide-react";

export function PremiumBadge({ className = "" }: { className?: string }) {
  return <span className={`inline-flex items-center gap-1 rounded-full border border-amber-300/80 bg-gradient-to-r from-amber-100 to-yellow-50 px-2 py-1 text-[9px] font-black tracking-wide text-amber-800 shadow-sm dark:border-amber-500/30 dark:from-amber-500/20 dark:to-yellow-500/10 dark:text-amber-200 ${className}`}><Gem className="size-3 fill-amber-400 text-amber-600 dark:fill-amber-300 dark:text-amber-200" /> PREMIUM</span>;
}
