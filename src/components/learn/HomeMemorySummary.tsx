import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { BrainCircuit, ChevronRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { getAuthUser } from "@/lib/auth-user";
import { memoryReadiness } from "@/lib/kioku/insights";

async function fetchHomeMemory() {
  const { data: auth } = await getAuthUser();
  if (!auth.user) return { strong: 0, growing: 0, weak: 0, due: 0, readiness: memoryReadiness([]) };
  const { data, error } = await supabase
    .from("memory_state")
    .select("stage,due_at")
    .eq("user_id", auth.user.id);
  if (error) throw error;
  const rows = data ?? [];
  const now = Date.now();
  return {
    strong: rows.filter((x) => x.stage >= 4).length,
    growing: rows.filter((x) => x.stage >= 2 && x.stage < 4).length,
    weak: rows.filter((x) => x.stage < 2).length,
    due: rows.filter((x) => new Date(x.due_at).getTime() <= now).length,
    readiness: memoryReadiness(rows, now),
  };
}

export function HomeMemorySummary() {
  const q = useQuery({ queryKey: ["home-memory"], queryFn: fetchHomeMemory, staleTime: 30_000 });
  if (q.isLoading || q.isError || !q.data) return null;
  const x = q.data;
  const estimate = Math.max(1, Math.ceil(Math.min(20, x.due + x.weak) * 0.4));
  return (
    <section className="rounded-2xl border border-primary/20 bg-card p-4">
      <div className="flex items-start gap-3">
        <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
          <BrainCircuit className="size-5" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="text-[13px] font-black">Ingatan hari ini</p>
              <p className="mt-0.5 text-[9px] text-muted-foreground">
                {x.due} jatuh tempo · {x.weak} perlu diperkuat · sekitar {estimate} menit
              </p>
            </div>
            <span className="rounded-full bg-primary/10 px-2 py-1 text-[9px] font-bold text-primary">
              {x.readiness.score}%
            </span>
          </div>
          <div className="mt-3 grid grid-cols-3 gap-1.5 text-center">
            <Mini label="Ingat kuat" value={x.strong} />
            <Mini label="Mulai kuat" value={x.growing} />
            <Mini label="Perlu diperkuat" value={x.weak} />
          </div>
          <Link
            to="/kioku"
            search={{ mode: "daily" }}
            className="mt-3 flex min-h-10 items-center justify-center gap-1 rounded-xl bg-primary px-3 text-[10px] font-bold text-primary-foreground"
          >
            Mulai Review <ChevronRight className="size-3.5" />
          </Link>
        </div>
      </div>
    </section>
  );
}

function Mini({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl bg-muted/35 px-1.5 py-2">
      <p className="text-[14px] font-black">{value}</p>
      <p className="mt-0.5 text-[8px] text-muted-foreground">{label}</p>
    </div>
  );
}
