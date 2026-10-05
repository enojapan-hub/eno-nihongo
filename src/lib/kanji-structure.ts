import { supabase } from "@/integrations/supabase/client";
import type { Level } from "@/lib/learn-queries";

/** Struktur kanji (bushu, komponen, keluarga bushu) dari RPC `get_kanji_structure`. */
export type KanjiRadical = {
  form: string;
  base: string;
  isVariant: boolean;
  position: string | null;
  nameJa: string;
  baseNameJa: string;
  meaningId: string;
  meaningEn: string;
  rule: "general" | "tradit";
};
export type KanjiComponent = { c: string; kanjiId: string | null };
export type KanjiDecomposition = { c: string; p: string[] };
export type KanjiFamilyItem = {
  id: string;
  character: string;
  meaningId: string | null;
  reading: string | null;
};
export type KanjiStructure = {
  radical: KanjiRadical;
  components: KanjiComponent[];
  decomposition: KanjiDecomposition[];
  needsReview: boolean;
  family: KanjiFamilyItem[];
  familyTotal: number;
};

const POSITION_ID: Record<string, string> = {
  へん: "di sisi kiri",
  つくり: "di sisi kanan",
  かんむり: "di bagian atas",
  あし: "di bagian bawah",
  かまえ: "mengelilingi bagian lain",
  たれ: "menaungi dari atas dan kiri",
  にょう: "di bagian kiri dan bawah",
};

const isRec = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);
const str = (v: unknown): string | null => (typeof v === "string" && v.length > 0 ? v : null);

/** Katakana → hiragana (untuk bacaan onyomi yang ditampilkan di keluarga bushu). */
export function toHiragana(s: string): string {
  return s.replace(/[ァ-ヶ]/g, (ch) => String.fromCharCode(ch.charCodeAt(0) - 0x60));
}

/** Bacaan ringkas: kunyomi pertama tanpa penanda okurigana, jika tidak ada onyomi pertama dalam hiragana. */
export function pickReading(
  kunyomi: readonly string[] | null | undefined,
  onyomi: readonly string[] | null | undefined,
): string | null {
  const kun = kunyomi?.[0]?.replace(/[.-]/g, "").trim();
  if (kun) return kun;
  const on = onyomi?.[0]?.replace(/[.-]/g, "").trim();
  return on ? toHiragana(on) : null;
}

/** Validasi payload RPC; mengembalikan null bila bentuknya tidak dikenali (tidak menebak). */
export function parseKanjiStructure(raw: unknown): KanjiStructure | null {
  if (!isRec(raw) || !isRec(raw["radical"])) return null;
  const r = raw["radical"];
  const form = str(r["form"]),
    base = str(r["base"]),
    nameJa = str(r["name_ja"]),
    meaningId = str(r["meaning_id"]);
  if (!form || !base || !nameJa || !meaningId) return null;
  const components: KanjiComponent[] = [];
  for (const c of Array.isArray(raw["components"]) ? raw["components"] : []) {
    if (!isRec(c)) continue;
    const ch = str(c["c"]);
    if (ch) components.push({ c: ch, kanjiId: str(c["kanji_id"]) });
  }
  const decomposition: KanjiDecomposition[] = [];
  for (const d of Array.isArray(raw["decomposition"]) ? raw["decomposition"] : []) {
    if (!isRec(d)) continue;
    const ch = str(d["c"]);
    const parts = (Array.isArray(d["p"]) ? d["p"] : []).filter(
      (x): x is string => typeof x === "string" && x.length > 0,
    );
    if (ch && parts.length >= 2) decomposition.push({ c: ch, p: parts });
  }
  const family: KanjiFamilyItem[] = [];
  for (const f of Array.isArray(raw["family"]) ? raw["family"] : []) {
    if (!isRec(f)) continue;
    const id = str(f["id"]),
      ch = str(f["character"]);
    if (!id || !ch) continue;
    // RPC mengirim elemen pertama kunyomi/onyomi sebagai teks tunggal.
    const kun = str(f["kunyomi"]),
      on = str(f["onyomi"]);
    family.push({
      id,
      character: ch,
      meaningId: str(f["meaning_id"]),
      reading: pickReading(kun ? [kun] : null, on ? [on] : null),
    });
  }
  return {
    radical: {
      form,
      base,
      isVariant: r["is_variant"] === true,
      position: str(r["position"]),
      nameJa,
      baseNameJa: str(r["base_name_ja"]) ?? nameJa,
      meaningId,
      meaningEn: str(r["meaning_en"]) ?? "",
      rule: r["rule"] === "tradit" ? "tradit" : "general",
    },
    components,
    decomposition,
    needsReview: raw["needs_review"] === true,
    family,
    familyTotal: typeof raw["family_total"] === "number" ? raw["family_total"] : family.length,
  };
}

/** Satu panggilan RPC per kanji (tanpa N+1); null bila kanji belum punya data struktur terverifikasi. */
export async function fetchKanjiStructure(
  kanjiId: string,
  level: Level | null,
): Promise<KanjiStructure | null> {
  const { data, error } = await supabase.rpc(
    "get_kanji_structure" as never,
    { p_kanji_id: kanjiId, p_level: level } as never,
  );
  if (error) throw error;
  return parseKanjiStructure(data);
}

/** Judul bushu: bentuk di dalam kanji + nama hiragana, mis. 扌（てへん）. */
export function radicalTitle(r: KanjiRadical): string {
  return `${r.form}（${r.nameJa}）`;
}

/** Keterangan bentuk dasar bila bushu tampil sebagai varian, mis. "bentuk dasar 手". */
export function radicalBaseNote(r: KanjiRadical): string | null {
  return r.form !== r.base || r.isVariant ? `bentuk dasar ${r.base}` : null;
}

function joinParts(parts: readonly string[]): string {
  return parts.map((p) => `「${p}」`).join(" + ");
}

/**
 * Penjelasan "Memahami Bentuk Kanji" yang deterministik dari data terverifikasi.
 * Hanya menjelaskan susunan bentuk (bushu, komponen, uraian), tanpa klaim asal-usul atau mnemonik.
 */
export function buildShapeExplanation(character: string, s: KanjiStructure): string[] {
  const lines: string[] = [];
  const { radical: r } = s;
  if (s.needsReview) {
    lines.push(
      `Bushu kanji 「${character}」 adalah 「${r.form}」. Rincian komponen kanji ini masih dalam peninjauan, jadi belum ditampilkan.`,
    );
    return lines;
  }
  const comps = s.components.map((c) => c.c);
  const distinct = [...new Set(comps)];
  if (comps.length === 0 || (comps.length === 1 && comps[0] === character)) {
    lines.push(
      `Kanji 「${character}」 adalah bentuk dasar yang tidak diuraikan lagi dalam data kami.`,
    );
  } else if (distinct.length === 1 && comps.length > 1) {
    lines.push(
      `Kanji 「${character}」 tersusun dari 「${distinct[0]}」 yang diulang ${comps.length} kali.`,
    );
  } else if (comps.length === 1) {
    lines.push(`Kanji 「${character}」 mengandung komponen 「${comps[0]}」.`);
  } else {
    lines.push(`Kanji 「${character}」 tersusun dari ${joinParts(comps)}.`);
  }
  const where = r.position ? POSITION_ID[r.position] : null;
  const baseNote = radicalBaseNote(r);
  const hasOwnForm = comps.includes(r.form) || r.form === character;
  lines.push(
    `Bushunya adalah 「${r.form}」（${r.nameJa}）${baseNote ? `, ${baseNote}` : ""}, berarti "${r.meaningId}"` +
      `${where && hasOwnForm && r.form !== character ? `, terletak ${where}` : ""}.`,
  );
  for (const d of s.decomposition) {
    lines.push(`Komponen 「${d.c}」 sendiri tersusun dari ${joinParts(d.p)}.`);
  }
  return lines;
}
