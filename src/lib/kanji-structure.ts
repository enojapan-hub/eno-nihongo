import { supabase } from "@/integrations/supabase/client";
import type { Level } from "@/lib/learn-queries";

/** Struktur kanji (bushu, pohon komponen, peran bunyi/makna, keluarga) dari RPC `get_kanji_structure`. */
export type KanjiRadicalStatus = "verified" | "conflict" | "single_source";
export type KanjiRadical = {
  form: string;
  base: string;
  isVariant: boolean;
  position: string | null;
  nameJa: string;
  baseNameJa: string;
  meaningId: string;
  meaningEn: string;
  status: KanjiRadicalStatus;
  /** Bushu klasik (Kangxi) menurut KANJIDIC2; dipakai untuk validasi silang. */
  kd2: { base: string; nameJa: string; meaningId: string } | null;
};
export type KanjiNodeType = "kanji" | "radical" | "graphic" | "nonunicode";
export type KanjiRole = "phonetic" | "semantic";
export type KanjiTreeNode = {
  id: number;
  element: string;
  type: KanjiNodeType;
  role: KanjiRole | null;
  /** Kanji terpublikasi dengan karakter yang sama; null bila bukan kanji mandiri. */
  kanjiId: string | null;
  meaningId: string | null;
  /** Bentuk dasar bila node adalah varian bushu (mis. 氵 → 水), beserta kanji dasarnya bila tersedia. */
  baseForm: string | null;
  baseKanjiId: string | null;
  children: KanjiTreeNode[];
};
export type KanjiFamilyItem = {
  id: string;
  character: string;
  meaningId: string | null;
  reading: string | null;
};
export type KanjiStructure = {
  radical: KanjiRadical;
  /** Akar pohon (komponen langsung); kosong untuk kanji atomik atau yang masih ditinjau. */
  tree: KanjiTreeNode[];
  needsReview: boolean;
  mnemonic: string | null;
  phoneticElement: string | null;
  phoneticFamily: KanjiFamilyItem[];
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

/** Katakana → hiragana (untuk bacaan onyomi yang ditampilkan di keluarga). */
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

function parseFamily(raw: unknown): KanjiFamilyItem[] {
  const out: KanjiFamilyItem[] = [];
  for (const f of Array.isArray(raw) ? raw : []) {
    if (!isRec(f)) continue;
    const id = str(f["id"]),
      ch = str(f["character"]);
    if (!id || !ch) continue;
    // RPC mengirim elemen pertama kunyomi/onyomi sebagai teks tunggal.
    const kun = str(f["kunyomi"]),
      on = str(f["onyomi"]);
    out.push({
      id,
      character: ch,
      meaningId: str(f["meaning_id"]),
      reading: pickReading(kun ? [kun] : null, on ? [on] : null),
    });
  }
  return out;
}

const NODE_TYPES: readonly KanjiNodeType[] = ["kanji", "radical", "graphic", "nonunicode"];

/** Susun daftar node datar (id, parent, ord) menjadi pohon; node yatim dibuang, bukan ditebak. */
export function buildTree(raw: unknown): KanjiTreeNode[] {
  const rows: Array<{ node: KanjiTreeNode; parent: number | null; ord: number }> = [];
  for (const r of Array.isArray(raw) ? raw : []) {
    if (!isRec(r)) continue;
    const id = typeof r["id"] === "number" ? r["id"] : null,
      el = str(r["el"]);
    const type = NODE_TYPES.find((t) => t === r["type"]);
    if (id === null || !el || !type) continue;
    const role = r["role"] === "phonetic" || r["role"] === "semantic" ? r["role"] : null;
    rows.push({
      parent: typeof r["parent"] === "number" ? r["parent"] : null,
      ord: typeof r["ord"] === "number" ? r["ord"] : 0,
      node: {
        id,
        element: el,
        type,
        role,
        kanjiId: str(r["kanji_id"]),
        meaningId: str(r["meaning_id"]),
        baseForm: str(r["base"]),
        baseKanjiId: str(r["base_kanji_id"]),
        children: [],
      },
    });
  }
  const byId = new Map(rows.map((r) => [r.node.id, r]));
  const roots: Array<{ node: KanjiTreeNode; ord: number }> = [];
  for (const r of [...rows].sort((a, b) => a.ord - b.ord || a.node.id - b.node.id)) {
    if (r.parent === null) roots.push(r);
    else byId.get(r.parent)?.node.children.push(r.node);
  }
  return roots.map((r) => r.node);
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
  const kd2 = isRec(r["kd2"]) ? r["kd2"] : null;
  const kd2Base = kd2 ? str(kd2["base"]) : null;
  const status: KanjiRadicalStatus =
    r["status"] === "conflict" || r["status"] === "single_source" ? r["status"] : "verified";
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
      status,
      kd2:
        kd2 && kd2Base
          ? {
              base: kd2Base,
              nameJa: str(kd2["name_ja"]) ?? "",
              meaningId: str(kd2["meaning_id"]) ?? "",
            }
          : null,
    },
    tree: buildTree(raw["tree"]),
    needsReview: raw["needs_review"] === true,
    mnemonic: str(raw["mnemonic"]),
    phoneticElement: str(raw["phonetic_element"]),
    phoneticFamily: parseFamily(raw["phonetic_family"]),
    family: parseFamily(raw["family"]),
    familyTotal:
      typeof raw["family_total"] === "number"
        ? raw["family_total"]
        : parseFamily(raw["family"]).length,
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

/** Bushu klasik hanya ditampilkan terpisah bila sumber berbeda pendapat (tidak memilih salah satu). */
export function hasRadicalConflict(r: KanjiRadical): boolean {
  return r.status === "conflict" && r.kd2 !== null;
}

/** Label singkat jenis node untuk pemula. */
export function nodeKindLabel(n: KanjiTreeNode): string {
  if (n.type === "nonunicode") return "Bagian grafis tanpa karakter Unicode";
  if (n.type === "graphic") return "Bagian grafis (bukan kanji mandiri)";
  if (n.type === "radical") return n.baseForm ? `Bentuk bushu dari ${n.baseForm}` : "Bentuk bushu";
  return n.baseForm ? `Kanji (bentuk bushu dari ${n.baseForm})` : "Kanji";
}

/** Tampilan karakter node: bagian non-Unicode tidak punya karakter yang bisa dirender. */
export function nodeGlyph(n: KanjiTreeNode): string {
  return n.type === "nonunicode" ? "◌" : n.element;
}

function nameOf(n: KanjiTreeNode): string {
  return n.type === "nonunicode" ? "satu bagian grafis" : `「${n.element}」`;
}
function joinNodes(nodes: readonly KanjiTreeNode[]): string {
  return nodes.map(nameOf).join(" + ");
}

/**
 * Penjelasan "Memahami Bentuk Kanji": hanya fakta terverifikasi (struktur, bushu, peran bunyi/makna yang
 * disetujui dua sumber). Tidak memuat asal-usul atau mnemonik; keduanya punya bagian tersendiri.
 */
export function buildShapeExplanation(character: string, s: KanjiStructure): string[] {
  const lines: string[] = [];
  const { radical: r, tree } = s;
  if (tree.length === 0) {
    lines.push(
      s.needsReview
        ? `Rincian komponen kanji 「${character}」 masih dalam peninjauan, jadi belum ditampilkan.`
        : `Kanji 「${character}」 adalah bentuk dasar pada tingkat struktur ini dan tidak diuraikan lebih lanjut.`,
    );
  } else {
    const names = tree.map((n) => n.element);
    const distinct = new Set(names);
    if (distinct.size === 1 && tree.length > 1)
      lines.push(
        `Kanji 「${character}」 tersusun dari ${nameOf(tree[0]!)} yang diulang ${tree.length} kali.`,
      );
    else if (tree.length === 1)
      lines.push(`Kanji 「${character}」 mengandung komponen ${nameOf(tree[0]!)}.`);
    else lines.push(`Kanji 「${character}」 tersusun dari ${joinNodes(tree)}.`);
  }
  if (hasRadicalConflict(r)) {
    lines.push(
      `Sumber berbeda soal bushu: KanjiVG menandai 「${r.form}」, sedangkan bushu klasik (Kangxi) menurut KANJIDIC2 adalah 「${r.kd2!.base}」. Keduanya ditampilkan apa adanya.`,
    );
  } else {
    const where = r.position ? POSITION_ID[r.position] : null;
    const baseNote = radicalBaseNote(r);
    const inside = tree.some((n) => n.element === r.form);
    lines.push(
      `Bushunya adalah 「${r.form}」（${r.nameJa}）${baseNote ? `, ${baseNote}` : ""}, berarti "${r.meaningId}"` +
        `${where && inside && r.form !== character ? `, terletak ${where}` : ""}.`,
    );
  }
  const phon = tree.find((n) => n.role === "phonetic");
  const sem = tree.find((n) => n.role === "semantic");
  if (phon && sem) {
    const meaning = sem.meaningId ? ` (berkaitan dengan "${sem.meaningId}")` : "";
    lines.push(
      `Menurut sumber data kami, ${nameOf(sem)}${meaning} berfungsi sebagai petunjuk kelompok makna, sedangkan ${nameOf(phon)} berfungsi sebagai petunjuk bunyi. Bunyi yang dimaksud adalah bunyi Tionghoa asal kanji, yang tidak selalu sama dengan bacaan Jepang sekarang.`,
    );
  } else if (phon) {
    lines.push(
      `Menurut sumber data kami, ${nameOf(phon)} berfungsi sebagai petunjuk bunyi. Bunyi yang dimaksud adalah bunyi Tionghoa asal kanji, yang tidak selalu sama dengan bacaan Jepang sekarang.`,
    );
  }
  const seen = new Set<string>();
  const walk = (nodes: readonly KanjiTreeNode[]) => {
    for (const n of nodes) {
      if (n.children.length >= 2) {
        const key = `${n.element}:${n.children.map((c) => c.element).join("")}`;
        if (!seen.has(key)) {
          seen.add(key);
          lines.push(`Komponen ${nameOf(n)} sendiri tersusun dari ${joinNodes(n.children)}.`);
        }
      }
      walk(n.children);
    }
  };
  walk(tree);
  return lines;
}
