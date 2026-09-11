import { supabase } from "@/integrations/supabase/client";
import type { Level, VocabSense } from "@/lib/learn-queries";

const QUERY_TIMEOUT_MS = 8000;
export const VOCAB_PAGE_SIZE = 60;

type QueryResult<T> = { data: T | null; error: { message: string } | null };
type VocabRpcRow = Record<string, unknown>;
export type ResilientVocabRow = VocabRpcRow & {
  senses: VocabSense[];
  curriculum: unknown[];
  profile_level: Level;
};

function withTimeout<T>(promise: PromiseLike<T>, ms = QUERY_TIMEOUT_MS): Promise<T> {
  return Promise.race([
    Promise.resolve(promise),
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error("Permintaan database terlalu lama. Silakan coba lagi.")), ms),
    ),
  ]);
}

export async function fetchVocabCount(level: Level): Promise<number> {
  const res = (await withTimeout(
    supabase.rpc("get_vocabulary_count_by_level", { p_level: level }),
  )) as QueryResult<number>;
  if (res.error) throw new Error(res.error.message);
  return Number(res.data ?? 0);
}

export async function fetchVocabPage(
  level: Level,
  offset = 0,
  limit = VOCAB_PAGE_SIZE,
): Promise<ResilientVocabRow[]> {
  const res = (await withTimeout(
    supabase.rpc("get_vocabulary_page_by_level", {
      p_level: level,
      p_offset: offset,
      p_limit: limit,
    }),
  )) as QueryResult<VocabRpcRow[]>;
  if (res.error) throw new Error(res.error.message);
  return (res.data ?? []).map((row) => ({
    ...row,
    senses: [],
    curriculum: [],
    profile_level: level,
  }));
}

export async function fetchVocabSenses(vocabularyId: string): Promise<VocabSense[]> {
  const res = await withTimeout(
    supabase
      .from("vocabulary_senses")
      .select("meaning_id, part_of_speech, usage_note_id, examples, source_book")
      .eq("vocabulary_id", vocabularyId),
  );
  if (res.error) throw new Error(res.error.message);
  return (res.data ?? []) as VocabSense[];
}

// Kompatibilitas untuk pemanggil lama: memuat bertahap agar tidak mengirim ribuan ID dalam satu query.
export async function fetchVocabListResilient(level: Level): Promise<ResilientVocabRow[]> {
  const total = await fetchVocabCount(level);
  const rows: ResilientVocabRow[] = [];
  for (let offset = 0; offset < total; offset += 200) {
    rows.push(...(await fetchVocabPage(level, offset, 200)));
  }
  return rows;
}
