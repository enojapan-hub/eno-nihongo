import { supabase } from "@/integrations/supabase/client";
import { buildSession, type Content, SESSION_SIZE } from "./session";
import type { KiokuSession } from "./session-types";
import { rankCandidates, selectExercises, toLearned } from "./selector";
import type { KiokuEvent, KiokuItemType, MemoryStateRow } from "./types";

const db = supabase as any;
const arr = (v: unknown) => (Array.isArray(v) ? v.filter(Boolean).join("、") : v ? String(v) : "");
const TABLE: Record<KiokuItemType, { table: string; cols: string; map: (r: any) => Content }> = {
  kanji: {
    table: "kanji",
    cols: "id,character,onyomi,kunyomi,meaning_id,level",
    map: (r) => ({
      id: r.id,
      type: "kanji",
      level: r.level,
      surface: String(r.character ?? ""),
      reading: [arr(r.onyomi), arr(r.kunyomi)].filter(Boolean).join(" / "),
      meaning: String(r.meaning_id ?? ""),
    }),
  },
  vocabulary: {
    table: "vocabulary",
    cols: "id,term,reading,meaning_id,level",
    map: (r) => ({
      id: r.id,
      type: "vocabulary",
      level: r.level,
      surface: String(r.term ?? ""),
      reading: String(r.reading ?? ""),
      meaning: String(r.meaning_id ?? ""),
    }),
  },
  grammar: {
    table: "grammar_points",
    cols: "id,pattern,meaning_id,level",
    map: (r) => ({
      id: r.id,
      type: "grammar",
      level: r.level,
      surface: String(r.pattern ?? ""),
      reading: "",
      meaning: String(r.meaning_id ?? ""),
    }),
  },
};

/**
 * One network phase: learned items (user_item_progress) + memory_state + content of the ranked head
 * + distractor pools. Everything after this runs offline. Never selects material the user has not studied.
 */
export async function prefetchSession(userId: string, now = Date.now()): Promise<KiokuSession> {
  const [prog, st] = await Promise.all([
    db
      .from("user_item_progress")
      .select("item_type,item_id,level,status,due_at,last_reviewed_at")
      .eq("user_id", userId)
      .neq("status", "new")
      .limit(2000),
    db
      .from("memory_state")
      .select(
        "item_type,item_id,aspect,direction,stage,stability,due_at,last_tested_at,lapses,success_count,failure_count,overconfident_wrong,last_error_type",
      )
      .eq("user_id", userId)
      .limit(5000),
  ]);
  if (prog.error) throw prog.error;
  const learned = toLearned(prog.data ?? []);
  const states = (st.error ? [] : (st.data ?? [])) as MemoryStateRow[];
  const learnedIds = new Set(learned.map((l) => `${l.itemType}:${l.itemId}`));
  const sessionId = crypto.randomUUID();
  if (!learned.length)
    return {
      sessionId,
      createdAt: new Date(now).toISOString(),
      exercises: [],
      index: 0,
      results: {},
      finished: true,
    };

  const ranked = selectExercises(rankCandidates(learned, states, now), SESSION_SIZE * 2);
  const ids: Record<KiokuItemType, string[]> = { kanji: [], vocabulary: [], grammar: [] };
  for (const s of ranked) if (!ids[s.itemType].includes(s.itemId)) ids[s.itemType].push(s.itemId);
  const levels: Record<KiokuItemType, Set<string>> = {
    kanji: new Set(),
    vocabulary: new Set(),
    grammar: new Set(),
  };
  for (const s of ranked) levels[s.itemType].add(s.level);

  const content = new Map<string, Content>();
  const pool: Content[] = [];
  await Promise.all(
    (Object.keys(TABLE) as KiokuItemType[]).flatMap((t) => {
      if (!ids[t].length) return [];
      const { table, cols, map } = TABLE[t];
      return [
        db
          .from(table)
          .select(cols)
          .in("id", ids[t])
          .then((r: any) => {
            for (const row of r.data ?? []) content.set(`${t}:${row.id}`, map(row));
          }),
        db
          .from(table)
          .select(cols)
          .in("level", [...levels[t]])
          .eq("is_published", true)
          .limit(300)
          .then((r: any) => {
            for (const row of r.data ?? []) pool.push(map(row));
          }),
      ];
    }),
  );
  return buildSession(ranked, content, pool, learnedIds, sessionId, now);
}

/** Batch persistence path used by the outbox. */
export async function sendEvents(batch: KiokuEvent[]): Promise<void> {
  const { error } = await db.rpc("kioku_record_events", { p_events: batch });
  if (error) throw error;
}
