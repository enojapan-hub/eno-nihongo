import { supabase } from "@/integrations/supabase/client";
import type { Level } from "@/lib/learn-queries";

export async function markContentMastered(input: { itemType: "reading" | "listening"; itemId: string; level: Level; durationSeconds?: number }) {
  const { data: auth } = await supabase.auth.getUser();
  const userId = auth.user?.id;
  if (!userId) throw new Error("Sesi tidak ditemukan.");
  const { data: existing, error: readError } = await supabase.from("user_item_progress").select("id,status,repetitions").eq("user_id", userId).eq("item_type", input.itemType).eq("item_id", input.itemId).maybeSingle();
  if (readError) throw readError;
  if (existing?.status === "mastered") return;
  const due = new Date(); due.setDate(due.getDate() + 7);
  if (existing) {
    const { error } = await supabase.from("user_item_progress").update({ status: "mastered", repetitions: Math.max(1, Number(existing.repetitions ?? 0) + 1), last_reviewed_at: new Date().toISOString(), due_at: due.toISOString() }).eq("id", existing.id);
    if (error) throw error;
  } else {
    const { error } = await supabase.from("user_item_progress").insert({ user_id: userId, item_type: input.itemType, item_id: input.itemId, level: input.level, status: "mastered", repetitions: 1, last_reviewed_at: new Date().toISOString(), due_at: due.toISOString() });
    if (error) throw error;
  }
  await supabase.rpc("record_learning_activity", {
    p_activity_type: "lesson_completed",
    p_content_type: input.itemType,
    p_content_id: input.itemId,
    p_points: 0,
    p_xp: 5,
    p_correct: null,
    p_duration_seconds: Math.max(0, input.durationSeconds ?? 60),
    p_metadata: { level: input.level },
  });
}
