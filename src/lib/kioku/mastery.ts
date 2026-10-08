import { supabase } from "@/integrations/supabase/client";
import type { KiokuItemType } from "./types";

export type MasteryAspect = {
  aspect: string;
  direction: string;
  stage: number;
  dueAt: string;
  label: "Perlu diperkuat" | "Mulai kuat" | "Ingat kuat";
};

export function masteryLabel(stage: number): MasteryAspect["label"] {
  if (stage >= 4) return "Ingat kuat";
  if (stage >= 2) return "Mulai kuat";
  return "Perlu diperkuat";
}

export async function fetchItemMastery(
  userId: string,
  itemType: KiokuItemType,
  itemId: string,
): Promise<MasteryAspect[]> {
  const { data, error } = await supabase
    .from("memory_state")
    .select("aspect,direction,stage,due_at")
    .eq("user_id", userId)
    .eq("item_type", itemType)
    .eq("item_id", itemId)
    .order("aspect");
  if (error) throw error;
  return (data ?? []).map((row) => ({
    aspect: row.aspect,
    direction: row.direction,
    stage: row.stage,
    dueAt: row.due_at,
    label: masteryLabel(row.stage),
  }));
}
