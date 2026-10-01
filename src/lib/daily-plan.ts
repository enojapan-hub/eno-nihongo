import { supabase } from "@/integrations/supabase/client";
import type { Level } from "@/lib/learn-queries";

export type DailyItem = { id: string; type: "kanji" | "vocabulary" | "grammar"; label: string; meaning: string; reading?: string | null; level: Level };

export async function fetchDailyPlan(level: Level = "N5") {
  const { data: userRes } = await supabase.auth.getUser();
  const userId = userRes.user?.id;
  if (!userId) return { level, items: [] as DailyItem[], completed: 0, target: 5 };
  const start = new Date(); start.setHours(0, 0, 0, 0);
  const [k, v, g, p] = await Promise.all([
    supabase.from("kanji").select("id, character, meaning_id, level, sort_order").eq("level", level).eq("is_published", true).order("sort_order").limit(5),
    supabase.from("vocabulary").select("id, term, reading, meaning_id, level, sort_order").eq("level", level).eq("is_published", true).order("sort_order").limit(5),
    supabase.from("grammar_points").select("id, pattern, meaning_id, level, sort_order").eq("level", level).eq("is_published", true).order("sort_order").limit(5),
    supabase.from("user_item_progress").select("item_id, item_type, last_reviewed_at").eq("user_id", userId).gte("last_reviewed_at", start.toISOString()),
  ]);
  const completed = new Set((p.data ?? []).map((x) => `${x.item_type}:${x.item_id}`));
  const candidates: DailyItem[] = [
    ...(k.data ?? []).map((x) => ({ id: x.id, type: "kanji" as const, label: x.character, meaning: x.meaning_id, level: x.level as Level })),
    ...(v.data ?? []).map((x) => ({ id: x.id, type: "vocabulary" as const, label: x.term, reading: x.reading, meaning: x.meaning_id, level: x.level as Level })),
    ...(g.data ?? []).map((x) => ({ id: x.id, type: "grammar" as const, label: x.pattern, meaning: x.meaning_id, level: x.level as Level })),
  ];
  const items = candidates.slice(0, 5);
  return { level, items, completed: items.filter((x) => completed.has(`${x.type}:${x.id}`)).length, target: 5 };
}
