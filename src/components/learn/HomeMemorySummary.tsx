import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { BrainCircuit, ChevronRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { getAuthUser } from "@/lib/auth-user";

async function fetchHomeMemory() {
  const { data: auth } = await getAuthUser();
  if (!auth.user) return { due: 0 };
  const { data, error } = await supabase
    .from("memory_state")
    .select("due_at")
    .eq("user_id", auth.user.id);
  if (error) throw error;
  const now = Date.now();
  return { due: (data ?? []).filter((x) => new Date(x.due_at).getTime() <= now).length };
}

export function HomeMemorySummary() {
  const q = useQuery({ queryKey: ["home-memory"], queryFn: fetchHomeMemory, staleTime: 30_000 });
  if (q.isLoading || q.isError || !q.data) return null;
  const due = q.data.due;
  const estimate = due > 0 ? Math.max(1, Math.ceil(Math.min(20, due) * 0.4)) : 0;
  return (
    <section className="rounded-2xl border border-primary/20 bg-card p-4">
      <div className="flex items-center gap-3">
        <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
          <BrainCircuit className="size-5" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[13px] font-black">Review Kioku Hari Ini</p>
          <p className="mt-0.5 text-[9px] text-muted-foreground">
            {due > 0
              ? `${due} materi perlu ditinjau · sekitar ${estimate} menit`
              : "Tidak ada review yang jatuh tempo"}
          </p>
        </div>
        <Link
          to="/kioku"
          search={{ mode: "daily" }}
          className="flex min-h-10 shrink-0 items-center gap-1 rounded-xl bg-primary px-3 text-[10px] font-bold text-primary-foreground"
        >
          {due > 0 ? "Mulai" : "Buka"} <ChevronRight className="size-3.5" />
        </Link>
      </div>
    </section>
  );
}
