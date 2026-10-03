import { supabase } from "@/integrations/supabase/client";
import type { Level } from "@/lib/learn-queries";

const QUERY_TIMEOUT_MS = 8000;
export const VOCAB_PAGE_SIZE = 60;
function withTimeout<T>(promise: PromiseLike<T>, ms = QUERY_TIMEOUT_MS): Promise<T> {
  return Promise.race([
    Promise.resolve(promise),
    new Promise<T>((_, reject) =>
      setTimeout(
        () => reject(new Error("Permintaan database terlalu lama. Silakan coba lagi.")),
        ms,
      ),
    ),
  ]);
}

export async function fetchVocabCount(level: Level): Promise<number> {
  const res = await withTimeout(supabase.rpc("get_vocabulary_count_by_level", { p_level: level }));
  if (res.error) throw new Error(res.error.message);
  return Number(res.data ?? 0);
}

export async function fetchVocabLessonCounts(level: Level) {
  const res = await withTimeout(supabase.rpc("get_vocabulary_lesson_counts", { p_level: level }));
  if (res.error) throw new Error(res.error.message);
  return res.data ?? [];
}

export async function fetchVocabLessonPage(
  level: Level,
  lesson: number,
  offset = 0,
  limit = VOCAB_PAGE_SIZE,
) {
  const res = await withTimeout(
    supabase.rpc("get_vocabulary_page_by_lesson", {
      p_level: level,
      p_lesson: lesson,
      p_offset: offset,
      p_limit: limit,
    }),
  );
  if (res.error) throw new Error(res.error.message);
  return (res.data ?? []).map((row) => ({
    ...row,
    senses: [],
    curriculum: [],
    profile_level: level,
  }));
}

export async function fetchVocabPage(level: Level, offset = 0, limit = VOCAB_PAGE_SIZE) {
  const res = await withTimeout(
    supabase.rpc("get_vocabulary_page_by_level", {
      p_level: level,
      p_offset: offset,
      p_limit: limit,
    }),
  );
  if (res.error) throw new Error(res.error.message);
  return (res.data ?? []).map((row) => ({
    ...row,
    senses: [],
    curriculum: [],
    profile_level: level,
  }));
}

export async function fetchVocabById(id: string) {
  const res = await withTimeout(
    supabase
      .from("vocabulary")
      .select(
        "id, term, reading, romaji, meaning_id, meaning_en, part_of_speech, examples, level, lesson_number, usage_note_id",
      )
      .eq("id", id)
      .eq("is_published", true)
      .maybeSingle(),
  );
  if (res.error) throw new Error(res.error.message);
  return res.data;
}

export async function fetchVocabSenses(vocabularyId: string) {
  const res = await withTimeout(
    supabase
      .from("vocabulary_senses")
      .select("meaning_id, part_of_speech, usage_note_id, examples, source_book")
      .eq("vocabulary_id", vocabularyId),
  );
  if (res.error) throw new Error(res.error.message);
  return res.data ?? [];
}

// Pola usage yang diketahui buruk (template/generik). Harus sama dengan aturan di scripts/sql/vocab_audit_final.sql.
const BAD_USAGE_PATTERNS = [
  /^Kata [A-Za-z -]+ (yang )?digunakan untuk menyatakan “/,
  /Dapat (menjadi|dipakai sebagai) (topik|subjek)/,
  /^Penggunaan pada materi N[1-5]:/,
  /^(Penggunaan sesuai arti|Digunakan sebagai kata kerja sesuai maknanya|Dipakai sebagai kata kerja sesuai maknanya)/,
  /#NAME\?/,
  /\{\{|\[\[/,
  /^(used |this word|a word|the word|to )/i,
  /[一-鿿ぁ-ゟ゠-ヿ]{25,}/,
];
export function isUsableUsageNote(value: unknown): value is string {
  if (typeof value !== "string") return false;
  const text = value.trim();
  return text.length >= 15 && !BAD_USAGE_PATTERNS.some((p) => p.test(text));
}

// Sumber utama: vocabulary.usage_note_id. Fallback transisi ke senses: abaikan usage kosong/buruk,
// lalu pilih secara deterministik (arti sama dengan kosakata, bukan canonical-merge, lalu urutan teks)
// agar tidak bergantung pada urutan baris dari PostgreSQL.
type UsageSense = {
  usage_note_id?: string | null;
  meaning_id?: string | null;
  source_book?: string | null;
};
export function pickUsageNote(
  item: { usage_note_id?: string | null; meaning_id?: string | null },
  senses: UsageSense[],
): string | undefined {
  const own = item.usage_note_id?.trim();
  if (own) return own;
  const meaning = (item.meaning_id ?? "").trim().toLowerCase();
  const rank = (s: UsageSense) => ({
    meaning:
      String(s.meaning_id ?? "")
        .trim()
        .toLowerCase() === meaning
        ? 0
        : 1,
    merge: String(s.source_book ?? "").startsWith("canonical-merge") ? 1 : 0,
  });
  const candidates = senses
    .filter((s): s is UsageSense & { usage_note_id: string } => isUsableUsageNote(s?.usage_note_id))
    .sort((a, b) => {
      const ra = rank(a),
        rb = rank(b);
      if (ra.meaning !== rb.meaning) return ra.meaning - rb.meaning;
      if (ra.merge !== rb.merge) return ra.merge - rb.merge;
      const ta = a.usage_note_id.trim(),
        tb = b.usage_note_id.trim();
      return ta < tb ? -1 : ta > tb ? 1 : 0;
    });
  return candidates[0]?.usage_note_id.trim();
}

// Kompatibilitas untuk pemanggil lama: memuat bertahap agar tidak mengirim ribuan ID dalam satu query.
export async function fetchVocabListResilient(level: Level) {
  const total = await fetchVocabCount(level),
    rows: Awaited<ReturnType<typeof fetchVocabPage>> = [];
  for (let offset = 0; offset < total; offset += 200)
    rows.push(...(await fetchVocabPage(level, offset, 200)));
  return rows;
}

export async function fetchVocabCategoryCount(level: Level, category: string): Promise<number> {
  const res = await withTimeout(
    supabase.rpc("get_vocabulary_count_by_category", {
      p_level: level,
      p_category_slug: category,
    }),
  );
  if (res.error) throw new Error(res.error.message);
  return Number(res.data ?? 0);
}

export async function fetchVocabCategoryPage(
  level: Level,
  category: string,
  offset = 0,
  limit = VOCAB_PAGE_SIZE,
) {
  const res = await withTimeout(
    supabase.rpc("get_vocabulary_page_by_category", {
      p_level: level,
      p_category_slug: category,
      p_offset: offset,
      p_limit: limit,
    }),
  );
  if (res.error) throw new Error(res.error.message);
  return (res.data ?? []).map((row) => ({
    ...row,
    senses: [],
    curriculum: [],
    profile_level: level,
  }));
}
