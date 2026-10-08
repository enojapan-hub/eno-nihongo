import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { BrainCircuit, ChevronDown, ChevronRight, Clock3 } from "lucide-react";
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

export function ItemMasteryCard({
  itemType,
  itemId,
  learned,
}: {
  itemType: KiokuItemType;
  itemId: string;
  learned: boolean;
}) {
  const [open, setOpen] = useState(false);
  const q = useQuery({
    queryKey: ["item-mastery", itemType, itemId],
    queryFn: async () => {
      const { data } = await getAuthUser();
      if (!data.user) return [] as MasteryAspect[];
      return fetchItemMastery(data.user.id, itemType, itemId);
    },
    enabled: learned,
    staleTime: 30_000,
  });

  if (!learned) return null;

  const rows = [...(q.data ?? [])].sort((a, b) => a.stage - b.stage);
  const weakCount = rows.filter((x) => x.stage < 2).length;
  const summary = q.isLoading
    ? "Memuat…"
    : rows.length === 0
      ? "Belum diuji di Kioku"
      : weakCount > 0
        ? `${weakCount} perlu diperkuat`
        : rows.every((x) => x.stage >= 4)
          ? "Ingat kuat"
          : "Mulai kuat";

  return (
    <section className="mt-3 overflow-hidden rounded-xl border bg-card">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        className="flex min-h-11 w-full items-center gap-2.5 px-3 text-left"
      >
        <span className="grid size-7 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
          <BrainCircuit className="size-3.5" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-[10px] font-bold">Kekuatan Ingatan</span>
          <span className="block truncate text-[8px] text-muted-foreground">{summary}</span>
        </span>
        <ChevronDown
          className={`size-3.5 shrink-0 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open && (
        <div className="border-t">
          {rows.length > 0 ? (
            <div className="divide-y">
              {rows.map((x) => (
                <div key={`${x.aspect}:${x.direction}`} className="flex items-center gap-3 px-3 py-2">
                  <div className="min-w-0 flex-1">
                    <p className="text-[9px] font-bold">
                      {LABEL[x.aspect] ?? x.aspect}
                      <span className="ml-1 font-medium text-muted-foreground">
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
          ) : (
            <p className="px-3 py-2 text-[8px] text-muted-foreground">
              Selesaikan latihan Kioku untuk melihat kekuatan ingatan materi ini.
            </p>
          )}
          <a
            href="/kioku"
            className="flex min-h-9 items-center justify-between border-t px-3 text-[9px] font-bold text-primary"
          >
            {rows.length ? "Latih di Kioku" : "Mulai Kioku"} <ChevronRight className="size-3.5" />
          </a>
        </div>
      )}
    </section>
  );
}
