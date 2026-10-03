import { buildSignals, partnerFor, seenContexts, toReviewEvents, type Signals } from "./signals";
import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";
import { dynamicTable, type DbRecord } from "@/lib/dynamic-db";
import { buildSession, type Content, SESSION_SIZE } from "./session";
import type { KiokuSession } from "./session-types";
import { rankCandidates, toLearned } from "./selector";
import type { KiokuEvent, KiokuItemType, MemoryStateRow } from "./types";

const arr = (v: unknown) => (Array.isArray(v) ? v.filter(Boolean).join("、") : v ? String(v) : "");
const exList = (v: unknown): Array<{ ja: string; id: string }> =>
  Array.isArray(v)
    ? v
        .filter((e) => e && typeof e.ja === "string")
        .map((e) => ({ ja: String(e.ja), id: String(e.id ?? "") }))
    : [];
const wrongList = (v: unknown): Array<{ wrong: string; correct: string; reason: string }> =>
  Array.isArray(v)
    ? v
        .filter((e) => e && typeof e.wrong === "string" && typeof e.correct === "string")
        .map((e) => ({
          wrong: String(e.wrong),
          correct: String(e.correct),
          reason: String(e.reason_id ?? e.reason ?? ""),
        }))
    : [];

const TABLE: Record<
  KiokuItemType,
  { table: string; cols: string; extra?: string; map: (r: DbRecord) => Content }
> = {
  kanji: {
    table: "kanji",
    cols: "id,character,onyomi,kunyomi,meaning_id,level",
    map: (r) => ({
      id: String(r["id"]),
      type: "kanji",
      level: String(r["level"]),
      surface: String(r["character"] ?? ""),
      reading: [arr(r["onyomi"]), arr(r["kunyomi"])].filter(Boolean).join(" / "),
      meaning: String(r["meaning_id"] ?? ""),
    }),
  },
  vocabulary: {
    table: "vocabulary",
    cols: "id,term,reading,meaning_id,level",
    extra: ",examples",
    map: (r) => ({
      id: String(r["id"]),
      type: "vocabulary",
      level: String(r["level"]),
      surface: String(r["term"] ?? ""),
      reading: String(r["reading"] ?? ""),
      meaning: String(r["meaning_id"] ?? ""),
      examples: exList(r["examples"]),
    }),
  },
  grammar: {
    table: "grammar_points",
    cols: "id,pattern,meaning_id,level",
    extra: ",examples,wrong_examples",
    map: (r) => ({
      id: String(r["id"]),
      type: "grammar",
      level: String(r["level"]),
      surface: String(r["pattern"] ?? ""),
      reading: "",
      meaning: String(r["meaning_id"] ?? ""),
      examples: exList(r["examples"]),
      wrong: wrongList(r["wrong_examples"]),
    }),
  },
};

async function fetchRelations(sig: Signals): Promise<Signals["relations"]> {
  // vocabulary_relations sengaja tertutup untuk klien (internal, tanpa policy/grant) dan hanya berisi
  // relasi komponen leksikal, jadi pasangan kosakata tidak diambil dari sana; hanya kanji_relations.
  const kanji = new Set<string>();
  for (const k of sig.unresolved.keys()) {
    const [t, id] = k.split(":");
    if (t === "kanji" && id) kanji.add(id);
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
    const r = await dynamicTable(table)
      .select(`${a},${b}`)
      .or(`${a}.in.${inList},${b}.in.${inList}`)
      .limit(200);
    for (const row of r.data ?? []) out.push({ type, a: String(row[a]), b: String(row[b]) });
  };
  await Promise.all([
    run(kanji, "kanji_relations", "kanji_id", "related_kanji_id", "kanji").catch(() => undefined),
  ]);
  return out;
}

/**
 * One network phase: learned items (user_item_progress) + memory_state + content of the ranked head
 * + distractor pools. Everything after this runs offline. Never selects material the user has not studied.
 */
export async function prefetchSession(userId: string, now = Date.now()): Promise<KiokuSession> {
  const [prog, st, evs] = await Promise.all([
    supabase
      .from("user_item_progress")
      .select("item_type,item_id,level,status,due_at,last_reviewed_at")
      .eq("user_id", userId)
      .neq("status", "new")
      .limit(2000),
    supabase
      .from("memory_state")
      .select(
        "item_type,item_id,aspect,direction,stage,stability,due_at,last_tested_at,lapses,success_count,failure_count,overconfident_wrong,last_error_type",
      )
      .eq("user_id", userId)
      .limit(5000),
    supabase
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
  const seen = seenContexts(evs.error ? [] : toReviewEvents(evs.data ?? []));
  const ranked = rankCandidates(learned, states, now, signals).slice(0, SESSION_SIZE * 3); // per-item cap is applied while building
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
        dynamicTable(table)
          .select(cols + (TABLE[t].extra ?? ""))
          .in("id", ids[t])
          .then((r) => {
            for (const row of r.data ?? []) content.set(`${t}:${row["id"]}`, map(row));
          }),
        dynamicTable(table)
          .select(cols)
          .in("level", [...levels[t]])
          .eq("is_published", true)
          .limit(300)
          .then((r) => {
            for (const row of r.data ?? []) pool.push(map(row));
          }),
      ];
    }),
  );
  await attachContext(content, ids);
  return buildSession(ranked, content, pool, learnedIds, sessionId, now, SESSION_SIZE, seen);
}

/**
 * Context Ladder data (still the single prefetch phase): vocabulary senses with example sentences and, for kanji,
 * the vocabulary compounds that contain them (kanji_vocabulary_examples). Missing data simply means no ladder.
 */
async function attachContext(content: Map<string, Content>, ids: Record<KiokuItemType, string[]>) {
  const ok = async <T>(p: PromiseLike<{ data: T[] | null }>): Promise<T[]> => {
    try {
      return (await p).data ?? [];
    } catch {
      return [];
    }
  };
  const [senses, links] = await Promise.all([
    ids.vocabulary.length
      ? ok(
          supabase
            .from("vocabulary_senses")
            .select("vocabulary_id,meaning_id,examples")
            .in("vocabulary_id", ids.vocabulary),
        )
      : [],
    ids.kanji.length
      ? ok(
          supabase
            .from("kanji_vocabulary_examples")
            .select("kanji_id,vocabulary_id,sort_order")
            .in("kanji_id", ids.kanji)
            .order("sort_order", { ascending: true })
            .limit(400),
        )
      : [],
  ]);
  for (const row of senses) {
    const c = content.get(`vocabulary:${row.vocabulary_id}`);
    const ex = exList(row.examples);
    if (c && ex.length && row.meaning_id)
      (c.senses ??= []).push({ meaning: String(row.meaning_id), examples: ex });
  }
  const perKanji = new Map<string, string[]>();
  for (const l of links) {
    const list = perKanji.get(l.kanji_id) ?? [];
    if (list.length < 3) perKanji.set(l.kanji_id, [...list, l.vocabulary_id]);
  }
  const vids = [...new Set([...perKanji.values()].flat())];
  if (!vids.length) return;
  const { table, cols, extra, map } = TABLE.vocabulary;
  const vocab = await ok(
    dynamicTable(table)
      .select(cols + (extra ?? ""))
      .in("id", vids)
      .eq("is_published", true),
  );
  const byId = new Map(vocab.map((r) => [String(r["id"]), map(r)]));
  for (const [kid, list] of perKanji) {
    const c = content.get(`kanji:${kid}`);
    if (c) c.compounds = list.map((v) => byId.get(v)).filter(Boolean) as Content[];
  }
}

/** Batch persistence path used by the outbox. */
export async function sendEvents(batch: KiokuEvent[]): Promise<void> {
  const { error } = await supabase.rpc("kioku_record_events", {
    p_events: batch as unknown as Json,
  });
  if (error) throw error;
}
