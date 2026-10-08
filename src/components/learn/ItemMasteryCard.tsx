import { useQuery } from "@tanstack/react-query";
import { BrainCircuit, Clock3, Dumbbell } from "lucide-react";
import { getAuthUser } from "@/lib/auth-user";
import { fetchItemMastery, type MasteryAspect } from "@/lib/kioku/mastery";
import type { KiokuItemType } from "@/lib/kioku/types";
import { masteryTrainingHref } from "@/lib/mastery-training";

const LABEL: Record<string, string> = {
  meaning: "Arti",
  reading: "Bacaan",
  usage: "Penggunaan",
  function_context: "Fungsi & konteks",
};

function dueLabel(value: string) {
  const d = new Date(value);
  const now = new Date();
  if (d.getTime() <= now.getTime()) return "Review sekarang";
  return new Intl.DateTimeFormat("id-ID", { day: "numeric", month: "short" }).format(d);
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
  const weak = [...q.data].sort((a, b) => a.stage - b.stage)[0];
  const trainingAspect =
    weak?.aspect === "function_context" ? "context" : (weak?.aspect ?? "meaning");
  return (
    <section className="rounded-2xl border bg-card p-3">
      <div className="flex items-center gap-2">
        <span className="grid size-8 place-items-center rounded-xl bg-primary/10 text-primary">
          <BrainCircuit className="size-4" />
        </span>
        <div>
          <p className="text-[11px] font-bold">Kekuatan ingatan</p>
          <p className="text-[8px] text-muted-foreground">Diukur dari hasil Kioku, bukan tombol Dipelajari.</p>
        </div>
      </div>
      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        {q.data.map((x) => (
          <div key={`${x.aspect}:${x.direction}`} className="rounded-xl bg-muted/40 px-3 py-2">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[9px] font-semibold">{LABEL[x.aspect] ?? x.aspect}</span>
              <span className="text-[8px] font-bold text-primary">{x.label}</span>
            </div>
            <p className="mt-1 flex items-center gap-1 text-[8px] text-muted-foreground">
              <Clock3 className="size-3" /> {dueLabel(x.dueAt)}
            </p>
          </div>
        ))}
      </div>
      {weak && weak.stage < 4 && (
        <a
          href={masteryTrainingHref({ itemType, aspect: trainingAspect })}
          className="mt-3 flex min-h-9 items-center justify-center gap-1.5 rounded-xl border border-primary/20 bg-primary/[.05] px-3 text-[9px] font-bold text-primary"
        >
          <Dumbbell className="size-3.5" /> Latih aspek terlemah di Flashcard
        </a>
      )}
    </section>
  );
}
