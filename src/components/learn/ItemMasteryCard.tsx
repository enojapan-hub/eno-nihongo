import { useQuery } from "@tanstack/react-query";
import { BrainCircuit, ChevronRight, Clock3 } from "lucide-react";
import { getAuthUser } from "@/lib/auth-user";
import { fetchItemMastery, type MasteryAspect } from "@/lib/kioku/mastery";
import type { KiokuItemType } from "@/lib/kioku/types";

const LABEL: Record<string, string> = {
  meaning: "Arti",
  reading: "Bacaan",
  usage: "Penggunaan",
  function_context: "Fungsi & konteks",
};

function dueLabel(value: string) {
  const d = new Date(value);
  if (d.getTime() <= Date.now()) return "Latihan sekarang";
  return new Intl.DateTimeFormat("id-ID", { day: "numeric", month: "short" }).format(d);
}

function directionLabel(direction: string) {
  if (direction === "reverse") return "ID → JP";
  if (direction === "context") return "Konteks";
  return "JP → ID";
}

export function ItemMasteryCard({ itemType, itemId }: { itemType: KiokuItemType; itemId: string }) {
  const q = useQuery({
    queryKey: ["item-mastery", itemType, itemId],
    queryFn: async () => {
      const { data } = await getAuthUser();
      if (!data.user) return [] as MasteryAspect[];
      return fetchItemMastery(data.user.id, itemType, itemId);
    },
    staleTime: 30_000,
  });
  if (q.isLoading || !q.data?.length) return null;

  const rows = [...q.data].sort((a, b) => a.stage - b.stage);

  return (
    <section className="mt-4 overflow-hidden rounded-2xl border bg-card">
      <div className="flex items-center gap-2.5 border-b bg-primary/[.04] px-3.5 py-3">
        <span className="grid size-8 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
          <BrainCircuit className="size-4" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-black">Kekuatan Ingatan</p>
          <p className="text-[8px] leading-relaxed text-muted-foreground">
            Hasil latihan Kioku untuk materi ini.
          </p>
        </div>
        <span className="rounded-full bg-primary/10 px-2 py-1 text-[8px] font-bold text-primary">
          Kioku
        </span>
      </div>
      <div className="divide-y">
        {rows.map((x) => (
          <div key={`${x.aspect}:${x.direction}`} className="flex items-center gap-3 px-3.5 py-2.5">
            <div className="min-w-0 flex-1">
              <p className="text-[9px] font-bold">
                {LABEL[x.aspect] ?? x.aspect}
                <span className="ml-1.5 font-medium text-muted-foreground">
                  · {directionLabel(x.direction)}
                </span>
              </p>
              <p className="mt-0.5 flex items-center gap-1 text-[8px] text-muted-foreground">
                <Clock3 className="size-3" /> {dueLabel(x.dueAt)}
              </p>
            </div>
            <span className="shrink-0 text-[8px] font-bold text-primary">{x.label}</span>
          </div>
        ))}
      </div>
      <a
        href="/kioku"
        className="flex min-h-10 items-center justify-between border-t px-3.5 text-[9px] font-bold text-primary"
      >
        Latih ingatan di Kioku <ChevronRight className="size-3.5" />
      </a>
    </section>
  );
}
