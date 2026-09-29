import { buildSignals, partnerFor, toReviewEvents, type Signals } from "./signals";
import { supabase } from "@/integrations/supabase/client";
import { buildSession, type Content, SESSION_SIZE } from "./session";
import type { KiokuSession } from "./session-types";
import { rankCandidates, selectExercises, toLearned } from "./selector";
import type { KiokuEvent, KiokuItemType, MemoryStateRow } from "./types";

const db = supabase as any;
const arr = (v: unknown) => (Array.isArray(v) ? v.filter(Boolean).join("、") : v ? String(v) : "");
const exList = (v: unknown): Array<{ ja: string; id: string }> =>
  Array.isArray(v)
    ? v
        .filter((e: any) => e && typeof e.ja === "string")
        .map((e: any) => ({ ja: String(e.ja), id: String(e.id ?? "") }))
    : [];
const wrongList = (v: unknown): Array<{ wrong: string; correct: string; reason: string }> =>
  Array.isArray(v)
    ? v
        .filter((e: any) => e && typeof e.wrong === "string" && typeof e.correct === "string")
        .map((e: any) => ({
          wrong: String(e.wrong),
          correct: String(e.correct),
          reason: String(e.reason_id ?? e.reason ?? ""),
        }))
    : [];

const TABLE: Record<
  KiokuItemType,
  { table: string; cols: string; extra?: string; map: (r: any) => Content }
> = {
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
    extra: ",examples",
    map: (r) => ({
      id: r.id,
      type: "vocabulary",
      level: r.level,
      surface: String(r.term ?? ""),
      reading: String(r.reading ?? ""),
      meaning: String(r.meaning_id ?? ""),
      examples: exList(r.examples),
    }),
  },
  grammar: {
    table: "grammar_points",
    cols: "id,pattern,meaning_id,level",
    extra: ",examples,wrong_examples",
    map: (r) => ({
      id: r.id,
      type: "grammar",
      level: r.level,
      surface: String(r.pattern ?? ""),
      reading: "",
      meaning: String(r.meaning_id ?? ""),
      examples: exList(r.examples),
      wrong: wrongList(r.wrong_examples),
    }),
  },
};

async function fetchRelations(sig: Signals): Promise<Signals["relations"]> {
  const kanji = new Set<string>();
  const vocab = new Set<string>();
  for (const k of sig.unresolved.keys()) {
    const [t, id] = k.split(":");
    if (t === "kanji" && id) kanji.add(id);
    if (t === "vocabulary" && id) vocab.add(id);
  }
  const out: Signals["relations"] = [];
  const run = async (
    ids: Set<string>,
    table: string,
    a: string,
    b: string,
    type: KiokuItemType,
  ) => {
    const list = [...ids].slice(0, 40);
    if (!list.length) return;
    const inList = `(${list.join(",")})`;
    const r = await db
      .from(table)
      .select(`${a},${b}`)
      .or(`${a}.in.${inList},${b}.in.${inList}`)
      .limit(200);
    for (const row of r.data ?? []) out.push({ type, a: row[a], b: row[b] });
  };
  await Promise.all([
    run(kanji, "kanji_relations", "kanji_id", "related_kanji_id", "kanji").catch(() => undefined),
    run(
      vocab,
      "vocabulary_relations",
      "source_vocabulary_id",
      "target_vocabulary_id",
      "vocabulary",
    ).catch(() => undefined),
  ]);
  return out;
}

/**
 * One network phase: learned items (user_item_progress) + memory_state + content of the ranked head
 * + distractor pools. Everything after this runs offline. Never selects material the user has not studied.
 */
export async function prefetchSession(userId: string, now = Date.now()): Promise<KiokuSession> {
  const [prog, st, evs] = await Promise.all([
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
    db
      .from("flashcard_reviews")
      .select("item_type,item_id,aspect,direction,rating,created_at,meta")
      .eq("user_id", userId)
      .eq("meta->>source", "kioku")
      .order("created_at", { ascending: false })
      .limit(400),
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

  // Error Engine input: recent Kioku events -> unresolved errors + A<->B pairs; relation tables for those items only.
  const base = buildSignals(evs.error ? [] : toReviewEvents(evs.data ?? []), [], now);
  const signals: Signals = { ...base, relations: await fetchRelations(base) };
  const ranked = selectExercises(rankCandidates(learned, states, now, signals), SESSION_SIZE * 2);
  const ids: Record<KiokuItemType, string[]> = { kanji: [], vocabulary: [], grammar: [] };
  for (const s of ranked) {
    if (!ids[s.itemType].includes(s.itemId)) ids[s.itemType].push(s.itemId);
    const pid = s.remedy?.partnerId ?? partnerFor(s.itemType, s.itemId, signals)?.id;
    if (pid && s.remedy && !ids[s.itemType].includes(pid)) ids[s.itemType].push(pid); // partner content is a distractor, not "learned"
  }
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
          .select(cols + (TABLE[t].extra ?? ""))
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
