import type { Exercise, KiokuSession } from "./session-types";
import { MAX_PER_ITEM } from "./selector";
import type { KiokuAspect, KiokuDirection, KiokuItemType, Selection } from "./types";

export const SESSION_SIZE = 20;
export const REPEAT_GAP = 4;

export type Content = {
  id: string;
  type: KiokuItemType;
  level: string;
  surface: string;
  reading: string;
  meaning: string;
  examples?: Array<{ ja: string; id: string }>;
  /** vocabulary_senses (only senses that have example sentences) */
  senses?: Array<{ meaning: string; examples: Array<{ ja: string; id: string }> }>;
  /** kanji: vocabulary compounds that contain the kanji (kanji_vocabulary_examples) */
  compounds?: Content[];
  wrong?: Array<{ wrong: string; correct: string; reason: string }>;
  forms?: Array<{ code: string; label: string; value: string }>;
};

function fnv(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
const HAN = /\p{Script=Han}/gu;
const norm = (s: string) => s.replace(/\s+/g, "").trim();

/** Look-alike test on Japanese surface/reading only (shared kanji, shared reading prefix >= 2, shared grammar prefix). */
export function isConfusable(a: Content, b: Content): boolean {
  if (a.type !== b.type || a.id === b.id) return false;
  if (a.type === "grammar") {
    const x = norm(a.surface),
      y = norm(b.surface);
    return x.length >= 2 && y.length >= 2 && x.slice(0, 2) === y.slice(0, 2);
  }
  const ha = new Set(a.surface.match(HAN) ?? []);
  if ((b.surface.match(HAN) ?? []).some((c) => ha.has(c))) return true;
  const ra = norm(a.reading),
    rb = norm(b.reading);
  return ra.length >= 2 && rb.length >= 2 && ra.slice(0, 2) === rb.slice(0, 2);
}

/** Deterministic masked hint: first character kept, the rest hidden (word gaps and punctuation preserved). */
export function makeHint(answer: string): string {
  const chars = [...answer.trim()];
  const sep = (ch: string | undefined) => !ch || /[\s;,、/／・.]/.test(ch);
  const out = chars.map((ch, i) => (sep(ch) || sep(chars[i - 1]) ? ch : "○"));
  return out.length > 16 ? out.slice(0, 16).join("") + "…" : out.join("");
}

/** Text shown for `c` when it is a question (prompt side) or an option/answer for the given aspect+direction. */
export function promptOf(c: Content, aspect: KiokuAspect, direction: KiokuDirection): string {
  return direction === "reverse" ? c.meaning : c.surface;
}
export function answerOf(c: Content, aspect: KiokuAspect, direction: KiokuDirection): string {
  if (direction === "reverse") return c.surface;
  return aspect === "reading" ? c.reading : c.meaning;
}
const usable = (c: Content | undefined, aspect: KiokuAspect, direction: KiokuDirection) =>
  !!c &&
  !!norm(c.surface) &&
  !!norm(promptOf(c, aspect, direction)) &&
  !!norm(answerOf(c, aspect, direction));

type Opt = Exercise["options"][number];
const SENTENCE_BLANK = "＿＿";
const clip = (t: string, n = 140) => (t.length > n ? `${t.slice(0, n - 1)}…` : t);

const HAN_ONLY = /\p{Script=Han}/u;
/** Dictionary form without trailing okurigana (会う -> 会): used when the example only contains an inflected form. */
export function stemOf(surface: string): string {
  const stem = surface.replace(/[\u3040-\u309f]+$/u, "");
  return stem && stem !== surface && HAN_ONLY.test(stem) ? stem : surface;
}
type Cloze = {
  blanked: string;
  translation: string;
  stem: boolean;
  ref: string;
  ja: string;
  needle: string;
};
const isHan = (ch: string | undefined) => !!ch && HAN_ONLY.test(ch);
const isHira = (ch: string | undefined) => !!ch && /[\u3040-\u309f]/u.test(ch);
const indexesOf = (text: string, needle: string) => {
  const out: number[] = [];
  for (let i = text.indexOf(needle); i >= 0; i = text.indexOf(needle, i + needle.length))
    out.push(i);
  return out;
};
/**
 * Blanks `needle` in `ja` without touching other words: every occurrence must stand alone (not glued to another
 * kanji, e.g. 会 inside 会社), otherwise the sentence is rejected. `stem` mode needs exactly one occurrence followed by kana.
 * The result never contains the needle and un-blanking restores the original Japanese exactly.
 */
export function blankOut(ja: string, needle: string, stem: boolean): string | null {
  const at = indexesOf(ja, needle);
  if (!at.length) return null;
  const glued = (i: number) =>
    (isHan(needle[0]) && isHan(ja[i - 1])) ||
    (isHan(needle[needle.length - 1]) && isHan(ja[i + needle.length]));
  if (at.some(glued)) return null;
  if (stem && (at.length !== 1 || !isHira(ja[at[0]! + needle.length]))) return null;
  const out = ja.split(needle).join(SENTENCE_BLANK);
  return out.includes(needle) ? null : out;
}
export const refOf = (text: string) => fnv(text).toString(36);
type Ctx = { ja: string; id: string };
/** All real example sentences of an item: its own examples plus the ones attached to its senses (de-duplicated). */
export function contextsOf(c: Content): Ctx[] {
  const out: Ctx[] = [];
  const seen = new Set<string>();
  const add = (e: Ctx) => {
    if (e.ja && !seen.has(e.ja)) {
      seen.add(e.ja);
      out.push(e);
    }
  };
  (c.examples ?? []).forEach(add);
  (c.senses ?? []).forEach((sn) => sn.examples.forEach(add));
  return out;
}
/** Deterministic context variation: prefer contexts not shown before, then pick by seed (same seed => same pick). */
export function pickContext<T>(
  list: T[],
  refFn: (t: T) => string,
  seen: Set<string> | undefined,
  seed: string,
): T | null {
  if (!list.length) return null;
  const fresh = seen ? list.filter((t) => !seen.has(refFn(t))) : list;
  const from = fresh.length ? fresh : list;
  return from[fnv(seed) % from.length]!;
}
/** Every example of `c` that can be blanked safely; exact surface forms are preferred over inflected (stem) forms. */
function blankables(c: Content): Cloze[] {
  const stem = stemOf(c.surface);
  const exact: Cloze[] = [];
  const inflected: Cloze[] = [];
  for (const e of contextsOf(c)) {
    const b = c.surface ? blankOut(e.ja, c.surface, false) : null;
    if (b) {
      exact.push({
        blanked: b,
        translation: e.id,
        stem: false,
        ref: refOf(e.ja),
        ja: e.ja,
        needle: c.surface,
      });
      continue;
    }
    const sb = stem !== c.surface ? blankOut(e.ja, stem, true) : null;
    if (sb)
      inflected.push({
        blanked: sb,
        translation: e.id,
        stem: true,
        ref: refOf(e.ja),
        ja: e.ja,
        needle: stem,
      });
  }
  return exact.length ? exact : inflected;
}
function clozeExample(c: Content, seed = c.id, seen?: Set<string>): Cloze | null {
  return pickContext(blankables(c), (x) => x.ref, seen, `${seed}|${c.id}|cloze`);
}
/**
 * Phrase level of the Context Ladder: a real contiguous chunk of the example sentence around the target
 * (previous particle phrase + the target + its trailing kana). Spaced text uses a token window. Never invented.
 */
export function phraseAround(ja: string, needle: string): string | null {
  const at = ja.indexOf(needle);
  if (at < 0) return null;
  if (/\s/.test(ja)) {
    const toks = ja.split(/\s+/).filter(Boolean);
    const i = toks.findIndex((t) => t.includes(needle));
    if (i < 0) return null;
    const ph = toks.slice(Math.max(0, i - 2), Math.min(toks.length, i + 2)).join(" ");
    return ph.length < ja.replace(/\s+/g, " ").length ? ph : null;
  }
  const B = /[はがをにでとものへ、。「」]/;
  let start = at;
  if (start > 0 && B.test(ja[start - 1]!)) start--;
  while (start > 0 && !B.test(ja[start - 1]!)) start--;
  let end = at + needle.length;
  for (let n = 0; end < ja.length && n < 4 && isHira(ja[end]) && !B.test(ja[end]!); n++) end++;
  const ph = ja.slice(start, end);
  return ph.length >= 2 && ph.length < ja.length ? ph : null;
}
/** Grammar particles (は・が・に・で ...): blank the particle itself when the example has exactly one; otherwise the pattern is identified in the sentence. */
const simpleParticle = (pattern: string) => {
  const clean = pattern.replace(/[〜~\s（）()＋+]/g, "");
  return /^[\u3040-\u309f]{1,2}$/u.test(clean) ? clean : null;
};
function grammarContext(
  c: Content,
  partner: Content,
): { prompt: string; sub: string; a: string; b: string } | null {
  const ex = (c.examples ?? []).find((e) => e.ja);
  if (!ex) return null;
  const pa = simpleParticle(c.surface),
    pb = simpleParticle(partner.surface);
  if (pa && pb && pa !== pb) {
    for (const e of c.examples ?? []) {
      const at = indexesOf(e.ja, pa);
      if (at.length === 1)
        return {
          prompt: `${e.ja.slice(0, at[0]!)}${SENTENCE_BLANK}${e.ja.slice(at[0]! + pa.length)}`,
          sub: e.id,
          a: pa,
          b: pb,
        };
    }
  }
  return { prompt: ex.ja, sub: ex.id, a: c.surface, b: partner.surface };
}
const formOf = (c: Content, stem: boolean) => (stem ? stemOf(c.surface) : c.surface);

/** Short, data-backed difference between two items (no invented explanation). */
export function pairFeedback(a: Content, b: Content, aspect: KiokuAspect): string {
  const side = (c: Content) =>
    `${c.surface} ${aspect === "reading" && c.reading ? c.reading : c.meaning}`;
  return `${side(a)} · ${side(b)}`;
}

function pickDistractors(
  c: Content,
  pool: Content[],
  learnedIds: Set<string>,
  prefer: Set<string>,
  textOf: (x: Content) => string,
  ok: (x: Content) => boolean,
  n: number,
  exclude: Set<string>,
) {
  const seen = new Set(exclude);
  const cands = pool
    .filter((p) => p.type === c.type && p.id !== c.id && ok(p))
    .map((p) => ({
      p,
      prefer: prefer.has(p.id),
      confusable: isConfusable(c, p),
      learned: learnedIds.has(`${p.type}:${p.id}`),
      h: fnv(`${p.id}|${c.id}`),
    }))
    .sort(
      (a, b) =>
        Number(b.prefer) - Number(a.prefer) ||
        Number(b.confusable) - Number(a.confusable) ||
        Number(b.learned) - Number(a.learned) ||
        a.h - b.h,
    );
  const picked: Opt[] = [];
  for (const x of cands) {
    const text = textOf(x.p);
    if (seen.has(norm(text))) continue;
    seen.add(norm(text));
    picked.push({ id: x.p.id, text, confusable: x.confusable || x.prefer });
    if (picked.length === n) break;
  }
  return picked;
}

type Part = Pick<
  Exercise,
  "prompt" | "promptSub" | "answer" | "options" | "variant" | "label" | "feedback"
> &
  Partial<Pick<Exercise, "aspect" | "direction" | "ladder" | "contextRef">>;
type Shuffle = (o: Opt[]) => Opt[];
const meaningLine = (c: Content) =>
  `${c.surface}${c.reading && c.reading !== c.surface ? ` (${c.reading})` : ""} = ${c.meaning}`;

/**
 * Sentence ordering only uses source examples that already contain whitespace-delimited chunks.
 * We deliberately do not guess Japanese word boundaries. This keeps every ordering exercise
 * reversible to the exact validated source sentence.
 */
export function sentenceOrderParts(ja: string): string[] | null {
  const parts = ja.trim().split(/\s+/u).filter(Boolean);
  if (parts.length < 3 || parts.length > 8) return null;
  if (new Set(parts).size !== parts.length) return null;
  return parts.join(" ") === ja.trim().replace(/\s+/gu, " ") ? parts : null;
}

const PARTICLES = ["は", "が", "を", "に", "で", "へ", "と", "も", "の", "から", "まで", "より"];

function particleChoice(c: Content, sel: Selection, shuffle: Shuffle): Part | null {
  if (c.type !== "grammar") return null;
  for (const e of c.examples ?? []) {
    const particle = PARTICLES.find((p) => indexesOf(e.ja, p).length === 1);
    if (!particle) continue;
    const at = e.ja.indexOf(particle);
    const prompt = `${e.ja.slice(0, at)}${SENTENCE_BLANK}${e.ja.slice(at + particle.length)}`;
    const distractors = PARTICLES.filter((p) => p !== particle)
      .sort((a, b) => fnv(`${sel.itemId}|${a}`) - fnv(`${sel.itemId}|${b}`))
      .slice(0, 3);
    return {
      aspect: "function_context",
      direction: "forward",
      prompt,
      promptSub: e.id || "Pilih partikel yang tepat.",
      answer: particle,
      options: shuffle([
        { id: c.id, text: particle, confusable: false },
        ...distractors.map((text, i) => ({ id: `particle:${i}`, text, confusable: true })),
      ]),
      variant: "particle_choice",
      label: "Partikel",
      feedback: `Kalimat sumber: ${e.ja}`,
      contextRef: refOf(e.ja),
    };
  }
  return null;
}

function errorSpot(c: Content, sel: Selection, shuffle: Shuffle): Part | null {
  if (c.type !== "grammar" || !c.wrong?.length) return null;
  const w = c.wrong[fnv(sel.itemId) % c.wrong.length];
  if (!w?.wrong || !w.correct || norm(w.wrong) === norm(w.correct)) return null;
  return {
    aspect: "function_context",
    direction: "forward",
    prompt: w.wrong,
    promptSub: "Kalimat di atas salah. Pilih perbaikannya.",
    answer: w.correct,
    options: shuffle([
      { id: c.id, text: w.correct, confusable: false },
      { id: "wrong:source", text: w.wrong, confusable: true },
    ]),
    variant: "error_spot",
    label: "Perbaiki Kesalahan",
    feedback: w.reason || `Bentuk yang benar: ${w.correct}`,
    contextRef: refOf(w.wrong),
  };
}

function conjugationChoice(c: Content, sel: Selection, shuffle: Shuffle): Part | null {
  if (c.type !== "vocabulary" || !c.forms || c.forms.length < 3) return null;
  const target = c.forms[fnv(`${sel.itemId}|form`) % c.forms.length];
  if (!target) return null;
  const alternatives = c.forms
    .filter((x) => x.code !== target.code && norm(x.value) !== norm(target.value))
    .sort((a, b) => fnv(`${sel.itemId}|${a.code}`) - fnv(`${sel.itemId}|${b.code}`))
    .slice(0, 3);
  if (alternatives.length < 2) return null;
  return {
    aspect: "usage",
    direction: "forward",
    prompt: c.surface,
    promptSub: `Pilih ${target.label}`,
    answer: target.value,
    options: shuffle([
      { id: c.id, text: target.value, confusable: false },
      ...alternatives.map((x) => ({ id: `form:${x.code}`, text: x.value, confusable: true })),
    ]),
    variant: "conjugation_choice",
    label: "Konjugasi",
    feedback: `${target.label}: ${target.value}`,
  };
}

function sentenceOrder(
  c: Content,
  seed: string,
  used: Set<string> | undefined,
  shuffle: Shuffle,
): Part | null {
  if (c.type === "kanji") return null;
  const candidates = contextsOf(c)
    .map((e) => ({ e, parts: sentenceOrderParts(e.ja) }))
    .filter((x): x is { e: Ctx; parts: string[] } => !!x.parts);
  const pick = pickContext(candidates, (x) => refOf(x.e.ja), used, `${seed}|order`);
  if (!pick) return null;
  const options = shuffle(
    pick.parts.map((text, index) => ({ id: `part:${index}`, text, confusable: false })),
  );
  return {
    aspect: "usage",
    direction: "forward",
    prompt: pick.e.id || "Susun potongan menjadi kalimat Jepang yang benar.",
    promptSub: "Tekan potongan sesuai urutan. Pilihan pertama otomatis menjadi nomor ①.",
    answer: pick.parts.join(" "),
    options,
    variant: "sentence_order",
    label: "Susun Kalimat",
    feedback: `${pick.e.ja}${c.meaning ? ` · ${c.meaning}` : ""}`,
    ladder: 4,
    contextRef: refOf(pick.e.ja),
  };
}

/** Vocabulary: L2 phrase -> L3 sentence -> L4 real context (sense in a sentence, or another sentence). */
function vocabUsage(
  c: Content,
  sel: Selection,
  level: number,
  seed: string,
  used: Set<string> | undefined,
  pool: Content[],
  learnedIds: Set<string>,
  shuffle: Shuffle,
): Part | null {
  const usageAspect = { aspect: "usage" as const, direction: "forward" as const };
  if (level >= 4) {
    const senses = (c.senses ?? []).filter((x) => x.examples.length && norm(x.meaning));
    const target = new Set([c.surface, stemOf(c.surface)]);
    const owned = senses
      .flatMap((sn) => sn.examples.map((e) => ({ e, sn })))
      .filter(
        (x) =>
          senses.filter((t) => t.examples.some((y) => y.ja === x.e.ja)).length === 1 &&
          [...target].some((t) => x.e.ja.includes(t)),
      );
    // Senses must be genuinely different in the data ("Sisa" vs "sisa; yang tersisa ..." is one meaning, not two).
    const lower = (m: string) => norm(m).toLowerCase();
    const meanings: string[] = [];
    for (const x of senses) {
      const m = lower(x.meaning);
      if (!meanings.some((k) => lower(k).includes(m) || m.includes(lower(k))))
        meanings.push(x.meaning);
    }
    const keep = new Set(meanings.map(lower));
    const usable4 = owned.filter((x) => keep.has(lower(x.sn.meaning)));
    const pick =
      meanings.length >= 2
        ? pickContext(usable4, (x) => refOf(x.e.ja), used, `${seed}|sense`)
        : null;
    if (pick) {
      const others = meanings.filter((m) => lower(m) !== lower(pick.sn.meaning));
      const extra = pickDistractors(
        c,
        pool,
        learnedIds,
        new Set(),
        (x) => x.meaning,
        (x) => !!norm(x.meaning),
        3,
        new Set([norm(pick.sn.meaning), ...others.map(norm)]),
      ).map((o) => o.text);
      const texts = [...others, ...extra].slice(0, 3);
      if (texts.length >= 2) {
        const opts = shuffle([
          { id: `s:${norm(pick.sn.meaning)}`, text: pick.sn.meaning, confusable: false },
          ...texts.map((t) => ({ id: `s:${norm(t)}`, text: t, confusable: false })),
        ]);
        return {
          ...usageAspect,
          prompt: pick.e.ja,
          promptSub: `Arti “${c.surface}” pada kalimat ini?`,
          answer: pick.sn.meaning,
          options: opts,
          variant: "sense_context",
          label: "Konteks",
          feedback: `${meaningLine(c)} · ${clip(pick.e.id, 90)}`,
          ladder: 4,
          contextRef: refOf(pick.e.ja),
        };
      }
    }
  }
  const cz = clozeExample(c, seed, used);
  if (!cz) return null;
  let prompt = cz.blanked;
  let ladder = level >= 3 ? 3 : 2;
  if (level <= 2) {
    const ph = phraseAround(cz.ja, cz.needle);
    const pb = ph ? blankOut(ph, cz.needle, cz.stem) : null;
    if (pb) prompt = pb;
    else ladder = 3;
  }
  const picked = pickDistractors(
    c,
    pool,
    learnedIds,
    new Set(sel.remedy?.partnerId ? [sel.remedy.partnerId] : []),
    (x) => formOf(x, cz.stem),
    (x) => !!norm(x.surface),
    3,
    new Set([norm(formOf(c, cz.stem))]),
  );
  if (picked.length < 2) return null;
  const opts = shuffle([{ id: c.id, text: formOf(c, cz.stem), confusable: false }, ...picked]);
  return {
    ...usageAspect,
    prompt,
    promptSub: cz.translation,
    answer: formOf(c, cz.stem),
    options: opts,
    variant: sel.aspect === "usage" ? "context" : "cloze",
    label: sel.aspect === "usage" ? "Konteks" : "Penggunaan",
    feedback: meaningLine(c),
    ladder,
    contextRef: cz.ref,
  };
}

/** Kanji: L2 compound with the kanji blanked -> L3 sentence with the compound blanked (compounds from kanji_vocabulary_examples). */
function kanjiUsage(
  c: Content,
  level: number,
  seed: string,
  used: Set<string> | undefined,
  pool: Content[],
  learnedIds: Set<string>,
  shuffle: Shuffle,
): Part | null {
  const comps = (c.compounds ?? []).filter(
    (x) => x.surface !== c.surface && x.surface.split(c.surface).length === 2 && norm(x.meaning),
  );
  if (!comps.length) return null;
  const fb = (x: Content) => `${c.surface} ${c.meaning} · ${meaningLine(x)}`;
  const usageAspect = { aspect: "usage" as const, direction: "forward" as const };
  if (level >= 3) {
    const cands = comps
      .flatMap((x) =>
        (x.examples ?? []).map((e) => ({ x, e, b: blankOut(e.ja, x.surface, false) })),
      )
      .filter((y) => !!y.b);
    const pick = pickContext(cands, (y) => refOf(y.e.ja), used, `${seed}|kanji`);
    if (pick) {
      const dist = pool.filter(
        (p) => p.type === "vocabulary" && p.surface !== pick.x.surface && !!norm(p.surface),
      );
      const ranked = dist
        .map((p) => ({
          p,
          k: p.surface.includes(c.surface) ? 0 : 1,
          l: learnedIds.has(`vocabulary:${p.id}`) ? 0 : 1,
          h: fnv(`${p.id}|${c.id}`),
        }))
        .sort((a, b) => a.k - b.k || a.l - b.l || a.h - b.h);
      const seenT = new Set([norm(pick.x.surface)]);
      const texts: Opt[] = [];
      for (const r of ranked) {
        if (seenT.has(norm(r.p.surface))) continue;
        seenT.add(norm(r.p.surface));
        texts.push({ id: r.p.id, text: r.p.surface, confusable: r.k === 0 });
        if (texts.length === 3) break;
      }
      if (texts.length >= 2)
        return {
          ...usageAspect,
          prompt: pick.b!,
          promptSub: pick.e.id,
          answer: pick.x.surface,
          options: shuffle([{ id: pick.x.id, text: pick.x.surface, confusable: false }, ...texts]),
          variant: "context",
          label: "Konteks",
          feedback: fb(pick.x),
          ladder: 3,
          contextRef: refOf(pick.e.ja),
        };
    }
  }
  const comp = pickContext(comps, (x) => refOf(x.id), used, `${seed}|kanji2`)!;
  const picked = pickDistractors(
    c,
    pool,
    learnedIds,
    new Set(),
    (x) => x.surface,
    (x) => !!norm(x.surface),
    3,
    new Set([norm(c.surface)]),
  );
  if (picked.length < 2) return null;
  return {
    ...usageAspect,
    prompt: comp.surface.replace(c.surface, "＿"),
    promptSub: `${comp.reading} · ${comp.meaning}`,
    answer: c.surface,
    options: shuffle([{ id: c.id, text: c.surface, confusable: false }, ...picked]),
    variant: "context",
    label: "Konteks",
    feedback: fb(comp),
    ladder: 2,
    contextRef: refOf(comp.id),
  };
}

/** Grammar: L3 which pattern is used in a real example -> L4 correct vs wrong sentence (real wrong_examples with reason). */
function grammarUsage(
  c: Content,
  level: number,
  seed: string,
  used: Set<string> | undefined,
  pool: Content[],
  learnedIds: Set<string>,
  shuffle: Shuffle,
): Part | null {
  if (level >= 4) {
    const list = c.wrong ?? [];
    const w = list.length ? list[fnv(`${seed}|wx`) % list.length] : undefined;
    if (w && norm(w.correct) && norm(w.wrong) && w.correct !== w.wrong)
      return {
        prompt: c.surface,
        promptSub: "Pilih kalimat yang benar.",
        answer: w.correct,
        options: shuffle([
          { id: "wx:correct", text: w.correct, confusable: false },
          { id: "wx:wrong", text: w.wrong, confusable: false },
        ]),
        variant: "wrong_example",
        label: "Penggunaan",
        feedback: clip(w.reason || ""),
        ladder: 4,
      };
  }
  const ex = pickContext(contextsOf(c), (e) => refOf(e.ja), used, `${seed}|gram`);
  if (!ex) return null;
  const picked = pickDistractors(
    c,
    pool,
    learnedIds,
    new Set(),
    (x) => x.surface,
    (x) => !!norm(x.surface),
    3,
    new Set([norm(c.surface)]),
  );
  if (picked.length < 2) return null;
  return {
    aspect: "usage",
    direction: "forward",
    prompt: ex.ja,
    promptSub: ex.id,
    answer: c.surface,
    options: shuffle([{ id: c.id, text: c.surface, confusable: false }, ...picked]),
    variant: "context",
    label: "Konteks",
    feedback: `${c.surface}: ${c.meaning}`,
    ladder: 3,
    contextRef: refOf(ex.ja),
  };
}

/**
 * Builds one exercise from prefetched content. Returns null when content is missing
 * (the caller then moves on to the next ranked candidate). Pure and deterministic.
 * Remediation variants (jebakan / contrast / usage) fall back to the normal exercise when their data is missing.
 */
export function buildExercise(
  sel: Selection,
  content: Map<string, Content>,
  pool: Content[],
  learnedIds: Set<string>,
  sessionId: string,
  index: number,
  seen?: Map<string, Set<string>>,
): Exercise | null {
  const c = content.get(`${sel.itemType}:${sel.itemId}`);
  if (!c) return null;
  const id = `${sessionId}:${index}`;
  const base = {
    id,
    itemType: sel.itemType,
    itemId: sel.itemId,
    level: sel.level,
    aspect: sel.aspect,
    direction: sel.direction,
    stage: sel.stage,
    reason: sel.reason,
    isRepeat: false,
  } as const;
  const shuffle = (opts: Opt[]) =>
    [...opts].sort((a, b) => fnv(`${id}|${a.id}`) - fnv(`${id}|${b.id}`));
  const kind = sel.remedy?.kind;

  // ---- Usage: Context Ladder (aspect "usage") and usage remediation (real sentences only; no data => fallback)
  if (sel.aspect === "usage" || kind === "usage") {
    const used = seen?.get(`${c.type}:${c.id}`);
    const seed = `${sessionId}|${c.id}`;
    if (c.type === "vocabulary" && sel.stage >= 1 && fnv(`${seed}|conjugation`) % 3 === 0) {
      const form = conjugationChoice(c, sel, shuffle);
      if (form)
        return {
          ...base,
          hintLevel: 3,
          exerciseType: "conjugation_choice",
          hintText: "",
          ...form,
        };
    }
    if (c.type === "grammar" && sel.stage >= 1) {
      const special =
        fnv(`${seed}|grammar-special`) % 2 === 0
          ? particleChoice(c, sel, shuffle) ?? errorSpot(c, sel, shuffle)
          : errorSpot(c, sel, shuffle) ?? particleChoice(c, sel, shuffle);
      if (special)
        return {
          ...base,
          hintLevel: 3,
          exerciseType:
            special.variant === "particle_choice" ? "particle_choice" : "error_spot",
          hintText: "",
          ...special,
        };
    }
    // Advanced usage can become a click-to-order sentence exercise, but only when the
    // source sentence already carries trustworthy whitespace token boundaries.
    if (sel.stage >= 2 && fnv(`${seed}|sentence-order`) % 2 === 0) {
      const ordered = sentenceOrder(c, seed, used, shuffle);
      if (ordered)
        return {
          ...base,
          hintLevel: 3,
          exerciseType: "sentence_order",
          hintText: "",
          ...ordered,
        };
    }
    const level =
      sel.aspect === "usage"
        ? sel.stage <= 0
          ? 2
          : sel.stage === 1
            ? 3
            : 4
        : c.type === "grammar"
          ? 4
          : 3;
    const part =
      c.type === "vocabulary"
        ? vocabUsage(c, sel, level, seed, used, pool, learnedIds, shuffle)
        : c.type === "kanji"
          ? kanjiUsage(c, level, seed, used, pool, learnedIds, shuffle)
          : grammarUsage(
              c,
              sel.aspect === "usage" ? (sel.stage >= 1 ? 4 : 3) : 4,
              seed,
              used,
              pool,
              learnedIds,
              shuffle,
            );
    if (part) return { ...base, hintLevel: 3, exerciseType: "usage", hintText: "", ...part };
    if (sel.aspect === "usage") return null; // a usage-only combo without data is simply skipped
  }

  if (!usable(c, sel.aspect, sel.direction)) return null;

  // ---- Jebakan / Contrast: the pair comes from real errors, relation tables, or (last resort) the look-alike heuristic
  if (kind === "jebakan" || kind === "contrast") {
    const partner =
      (sel.remedy?.partnerId ? content.get(`${c.type}:${sel.remedy.partnerId}`) : undefined) ??
      pool.find((p) => isConfusable(c, p) && usable(p, sel.aspect, sel.direction));
    if (
      partner &&
      usable(partner, sel.aspect, sel.direction) &&
      norm(answerOf(partner, sel.aspect, sel.direction)) !==
        norm(answerOf(c, sel.aspect, sel.direction))
    ) {
      const fb = pairFeedback(c, partner, sel.aspect);
      if (kind === "contrast" && c.type !== "kanji") {
        const gctx = c.type === "grammar" ? grammarContext(c, partner) : null;
        const ctxA: Cloze | null =
          c.type === "vocabulary"
            ? clozeExample(c)
            : gctx
              ? {
                  blanked: gctx.prompt,
                  translation: gctx.sub,
                  stem: false,
                  ref: "",
                  ja: "",
                  needle: "",
                }
              : null;
        if (
          ctxA &&
          norm(gctx ? gctx.a : formOf(c, ctxA.stem)) !==
            norm(gctx ? gctx.b : formOf(partner, ctxA.stem))
        ) {
          const opts = shuffle([
            { id: c.id, text: gctx ? gctx.a : formOf(c, ctxA.stem), confusable: false },
            { id: partner.id, text: gctx ? gctx.b : formOf(partner, ctxA.stem), confusable: true },
          ]);
          return {
            ...base,
            exerciseType: "contrast",
            hintLevel: 3,
            prompt: ctxA.blanked,
            promptSub: ctxA.translation,
            hintText: "",
            answer: gctx ? gctx.a : formOf(c, ctxA.stem),
            options: opts,
            variant: "contrast",
            label: "Bedakan",
            feedback:
              c.type === "grammar"
                ? `${c.surface}: ${c.meaning} · ${partner.surface}: ${partner.meaning}`
                : fb,
          };
        }
      }
      const answer = answerOf(c, sel.aspect, sel.direction);
      const extra = pickDistractors(
        c,
        pool,
        learnedIds,
        new Set(),
        (x) => answerOf(x, sel.aspect, sel.direction),
        (x) => usable(x, sel.aspect, sel.direction) && x.id !== partner.id,
        1,
        new Set([norm(answer), norm(answerOf(partner, sel.aspect, sel.direction))]),
      );
      const opts = shuffle([
        { id: c.id, text: answer, confusable: false },
        { id: partner.id, text: answerOf(partner, sel.aspect, sel.direction), confusable: true },
        ...extra,
      ]);
      return {
        ...base,
        exerciseType: "choice",
        hintLevel: 3,
        prompt: promptOf(c, sel.aspect, sel.direction),
        promptSub:
          sel.direction === "forward" && sel.aspect !== "reading" && c.type !== "kanji"
            ? c.reading
            : "",
        hintText: makeHint(answer),
        answer,
        options: opts,
        variant: "jebakan",
        label: "Jebakan",
        feedback: fb,
      };
    }
    // no relevant pair -> normal exercise below
  }

  // ---- Normal exercise (also meaning / reading / slow / guess remediation; a known partner is preferred as distractor)
  const answer = answerOf(c, sel.aspect, sel.direction);
  const prefer = new Set(sel.remedy?.partnerId ? [sel.remedy.partnerId] : []);
  const need = Math.max(2, (sel.optionCount || 4) - 1);
  const picked = pickDistractors(
    c,
    pool,
    learnedIds,
    prefer,
    (x) => answerOf(x, sel.aspect, sel.direction),
    (x) => usable(x, sel.aspect, sel.direction),
    3,
    new Set([norm(answer)]),
  );
  // not enough distractors for a choice question: fall back to another candidate
  if (picked.length < need && sel.exerciseType === "choice") return null;
  let options: Opt[] = [];
  // recall exercises keep options as a fallback for the easier repeat after a mistake
  if (picked.length >= 2)
    options = shuffle([{ id: c.id, text: answer, confusable: false }, ...picked.slice(0, need)]);
  return {
    ...base,
    exerciseType: sel.exerciseType,
    hintLevel: sel.hintLevel,
    hintText: makeHint(answer),
    prompt: promptOf(c, sel.aspect, sel.direction),
    promptSub:
      sel.direction === "forward" && sel.aspect !== "reading" && c.type !== "kanji"
        ? c.reading
        : "",
    answer,
    options,
  };
}

export const REMEDY_SHARE = 0.4;
export const RETEST_SHARE = 0.2;
export const CONTEXT_SHARE = 0.3;
const itemKey = (e: { itemType: string; itemId: string }) => `${e.itemType}:${e.itemId}`;

/** Same item never appears again within `gap` slots when another exercise can go in between. */
export function spaceOut<T extends { itemType: string; itemId: string }>(list: T[], gap = 2): T[] {
  const out = [...list];
  for (let i = 0; i < out.length; i++) {
    const recent = out.slice(Math.max(0, i - gap), i).map(itemKey);
    if (!recent.includes(itemKey(out[i]!))) continue;
    const j = out.findIndex((e, k) => k > i && !recent.includes(itemKey(e)));
    if (j > i) out.splice(i, 0, out.splice(j, 1)[0]!);
  }
  return out;
}

/**
 * Walks the ranked list (already capped per item) and keeps the first `size` buildable exercises. No new material is ever
 * added to reach `size`. Remediation is bounded: at most REMEDY_SHARE of a session, one exercise per A<->B pair.
 */
export function buildSession(
  ranked: Selection[],
  content: Map<string, Content>,
  pool: Content[],
  learnedIds: Set<string>,
  sessionId: string,
  now: number,
  size = SESSION_SIZE,
  seen?: Map<string, Set<string>>,
): KiokuSession {
  const exercises: Exercise[] = [];
  const remedyCap = Math.max(1, Math.ceil(size * REMEDY_SHARE));
  const retestCap = Math.max(1, Math.ceil(size * RETEST_SHARE));
  const contextCap = Math.max(1, Math.ceil(size * CONTEXT_SHARE));
  let remedies = 0;
  let retests = 0;
  let contexts = 0;
  const pairsUsed = new Set<string>();
  const perItem = new Map<string, number>();
  for (const sel0 of ranked) {
    if (exercises.length >= size) break;
    let sel = sel0;
    // At most MAX_PER_ITEM planned exercises per item, counted on what was actually built (an unbuildable combo frees its slot).
    if ((perItem.get(`${sel.itemType}:${sel.itemId}`) ?? 0) >= MAX_PER_ITEM) continue;
    // No mechanism may dominate a session: mastered re-tests and context exercises are capped too.
    if (sel.retention === "retest" && retests >= retestCap) continue;
    if (sel.aspect === "usage" && contexts >= contextCap) continue;
    const r = sel.remedy;
    if (r) {
      const pk = r.partnerId ? [sel.itemId, r.partnerId].sort().join("|") : null;
      if (
        remedies >= remedyCap ||
        (pk && (r.kind === "jebakan" || r.kind === "contrast") && pairsUsed.has(pk))
      ) {
        const { remedy: _drop, ...rest } = sel;
        sel = { ...rest, reason: `${sel.reason}+remedy_limited` };
      }
    }
    const ex = buildExercise(sel, content, pool, learnedIds, sessionId, exercises.length, seen);
    if (!ex) continue;
    if (sel.remedy) {
      remedies++;
      if (sel.remedy.partnerId) pairsUsed.add([sel.itemId, sel.remedy.partnerId].sort().join("|"));
    }
    if (sel.retention === "retest") {
      retests++;
      ex.retention = "retest";
    }
    if (ex.aspect === "usage") contexts++;
    perItem.set(
      `${sel.itemType}:${sel.itemId}`,
      (perItem.get(`${sel.itemType}:${sel.itemId}`) ?? 0) + 1,
    );
    exercises.push(ex);
  }
  // Composition guard on the FINAL size: no mechanism may take more than its share of the session (lowest ranked go first).
  const trimShare = (test: (e: Exercise) => boolean, share: number) => {
    while (exercises.filter(test).length > Math.max(1, Math.ceil(exercises.length * share))) {
      const at = exercises.map(test).lastIndexOf(true);
      exercises.splice(at, 1);
    }
  };
  trimShare((e) => e.aspect === "usage", CONTEXT_SHARE);
  trimShare((e) => e.retention === "retest", RETEST_SHARE);
  const spaced = spaceOut(exercises);
  return {
    sessionId,
    createdAt: new Date(now).toISOString(),
    exercises: spaced,
    index: 0,
    results: {},
    finished: spaced.length === 0,
  };
}

// ---------------------------------------------------------------------------------------------------------------
// Ingatan Tertunda: a correct answer that still needs retention verification comes back after a POSITION gap in the
// session (other exercises in between, no timer). The delayed copy lives in the session state, so it survives reload.
export const DELAYED_SHARE = 0.3;
export const DELAY_MIN = 5;
export const DELAY_MAX = 15;
export const DELAY_MIN_SEPARATION = 3;
const comboOf = (e: Pick<Exercise, "itemType" | "itemId" | "aspect" | "direction">) =>
  `${e.itemType}:${e.itemId}:${e.aspect}:${e.direction}`;

/** Desired number of other exercises between the answer and its delayed check (5-15, scaled to the session length). */
export const delayGap = (base: number) =>
  Math.min(DELAY_MAX, Math.max(DELAY_MIN, Math.round(base * 0.35)));

/** Strong items (recall at Produksi+) are verified by due/re-test instead; delayed copies are never delayed again. */
export function needsRetentionCheck(ex: Exercise): boolean {
  if (ex.isDelayed || ex.retention === "retest") return false;
  if (ex.exerciseType === "recall_flip" && ex.stage >= 3) return false;
  return true;
}

function delayedCopy(ex: Exercise): Exercise {
  const id = `${ex.id}~d`;
  // Delayed recall asks with less help than the first time (never for a brand-new, stage 0 item).
  const recall =
    ex.exerciseType === "choice" && !ex.variant && ex.options.length >= 3 && ex.stage >= 1;
  const form = recall
    ? { exerciseType: "recall_flip" as const, hintLevel: 1 }
    : ex.exerciseType === "recall_flip"
      ? { hintLevel: Math.min(ex.hintLevel, 1) }
      : {};
  return {
    ...ex,
    ...form,
    id,
    isDelayed: true,
    isRepeat: false,
    retention: "delayed",
    reason: "delayed_recall",
    options: [...ex.options].sort((a, b) => fnv(`${id}|${a.id}`) - fnv(`${id}|${b.id}`)),
  };
}

export function scheduleDelayed(s: KiokuSession, ex: Exercise, independent: boolean): KiokuSession {
  if (!independent || !needsRetentionCheck(ex)) return s;
  const key = comboOf(ex);
  if (s.exercises.some((e) => e.isDelayed && comboOf(e) === key)) return s;
  if (
    s.exercises.filter((e) => e.itemId === ex.itemId && e.itemType === ex.itemType).length >=
    MAX_APPEARANCES
  )
    return s;
  const base = s.exercises.filter((e) => !e.isRepeat && !e.isDelayed).length;
  if (s.exercises.filter((e) => e.isDelayed).length >= Math.max(1, Math.ceil(base * DELAYED_SHARE)))
    return s;
  const remaining = s.exercises.length - (s.index + 1);
  const gap = Math.min(delayGap(base), remaining);
  if (gap < DELAY_MIN_SEPARATION) return s; // not enough other exercises to separate: never re-ask right away
  const at = s.index + 1 + gap;
  return {
    ...s,
    exercises: [...s.exercises.slice(0, at), delayedCopy(ex), ...s.exercises.slice(at)],
  };
}

export const MAX_APPEARANCES = 3;
/** Wrong answer => the same exercise comes back once, REPEAT_GAP positions later (or at the end), never beyond MAX_APPEARANCES per item. */
export function queueRepeat(s: KiokuSession, ex: Exercise): KiokuSession {
  if (ex.isRepeat) return s;
  if (s.exercises.some((e) => e.isRepeat && e.id === `${ex.id}~r`)) return s;
  if (
    s.exercises.filter((e) => e.itemId === ex.itemId && e.itemType === ex.itemType).length >=
    MAX_APPEARANCES
  )
    return s;
  // A weak item never comes back harder: a missed recall repeats as an easy choice question when options exist.
  const easier = ex.exerciseType === "recall_flip" && ex.options.length >= 3;
  const copy: Exercise = {
    ...ex,
    id: `${ex.id}~r`,
    isRepeat: true,
    reason: "repeat_after_error",
    isDelayed: false,
    retention: undefined,
    ...(easier ? { exerciseType: "choice" as const, hintLevel: 3 } : {}),
  };
  const at = Math.min(s.exercises.length, s.index + 1 + REPEAT_GAP);
  return { ...s, exercises: [...s.exercises.slice(0, at), copy, ...s.exercises.slice(at)] };
}
