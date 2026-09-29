import type { Exercise, KiokuSession } from "./session-types";
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
  wrong?: Array<{ wrong: string; correct: string; reason: string }>;
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
type Cloze = { blanked: string; translation: string; stem: boolean };
/** Sentence example of `c` that can be blanked safely: exact surface first, otherwise the kanji stem of an inflected form. */
function clozeExample(c: Content): Cloze | null {
  const list = c.examples ?? [];
  const exact = list.find((e) => e.ja && c.surface && e.ja.includes(c.surface));
  if (exact)
    return {
      blanked: exact.ja.split(c.surface).join(SENTENCE_BLANK),
      translation: exact.id,
      stem: false,
    };
  const stem = stemOf(c.surface);
  const inflected = stem !== c.surface ? list.find((e) => e.ja && e.ja.includes(stem)) : undefined;
  return inflected
    ? {
        blanked: inflected.ja.split(stem).join(SENTENCE_BLANK),
        translation: inflected.id,
        stem: true,
      }
    : null;
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

  // ---- Usage: vocabulary cloze (aspect "usage") or grammar correct-vs-wrong sentence (real wrong_examples)
  if (sel.aspect === "usage" || kind === "usage") {
    if (c.type === "grammar") {
      const list = c.wrong ?? [];
      const w = list.length ? list[fnv(`${sessionId}|${c.id}`) % list.length] : undefined;
      if (w && norm(w.correct) && norm(w.wrong) && w.correct !== w.wrong) {
        const opts = shuffle([
          { id: "wx:correct", text: w.correct, confusable: false },
          { id: "wx:wrong", text: w.wrong, confusable: false },
        ]);
        return {
          ...base,
          exerciseType: "usage",
          hintLevel: 3,
          prompt: c.surface,
          promptSub: "Pilih kalimat yang benar.",
          hintText: "",
          answer: w.correct,
          options: opts,
          variant: "wrong_example",
          label: "Penggunaan",
          feedback: clip(w.reason || ""),
        };
      }
    } else {
      const cz = clozeExample(c);
      const partner = sel.remedy?.partnerId
        ? content.get(`${c.type}:${sel.remedy.partnerId}`)
        : undefined;
      const prefer = new Set(partner ? [partner.id] : []);
      const stem = cz?.stem ?? false;
      const picked = pickDistractors(
        c,
        pool,
        learnedIds,
        prefer,
        (x) => formOf(x, stem),
        (x) => !!norm(x.surface),
        3,
        new Set([norm(formOf(c, stem))]),
      );
      if (cz && picked.length >= 2) {
        const opts = shuffle([{ id: c.id, text: formOf(c, stem), confusable: false }, ...picked]);
        return {
          ...base,
          aspect: "usage",
          direction: "forward",
          exerciseType: "usage",
          hintLevel: 3,
          prompt: cz.blanked,
          promptSub: cz.translation,
          hintText: "",
          answer: formOf(c, stem),
          options: opts,
          variant: "cloze",
          label: "Penggunaan",
          feedback: `${c.surface}${c.reading && c.reading !== c.surface ? ` (${c.reading})` : ""} = ${c.meaning}`,
        };
      }
    }
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
        const ctxA: Cloze | null =
          c.type === "vocabulary"
            ? clozeExample(c)
            : (c.examples ?? [])[0]
              ? {
                  blanked: (c.examples ?? [])[0]!.ja,
                  translation: (c.examples ?? [])[0]!.id,
                  stem: false,
                }
              : null;
        if (ctxA && norm(formOf(c, ctxA.stem)) !== norm(formOf(partner, ctxA.stem))) {
          const opts = shuffle([
            { id: c.id, text: formOf(c, ctxA.stem), confusable: false },
            { id: partner.id, text: formOf(partner, ctxA.stem), confusable: true },
          ]);
          return {
            ...base,
            exerciseType: "contrast",
            hintLevel: 3,
            prompt: ctxA.blanked,
            promptSub: ctxA.translation,
            hintText: "",
            answer: formOf(c, ctxA.stem),
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
): KiokuSession {
  const exercises: Exercise[] = [];
  const remedyCap = Math.max(1, Math.ceil(size * REMEDY_SHARE));
  let remedies = 0;
  const pairsUsed = new Set<string>();
  for (const sel0 of ranked) {
    if (exercises.length >= size) break;
    let sel = sel0;
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
    const ex = buildExercise(sel, content, pool, learnedIds, sessionId, exercises.length);
    if (!ex) continue;
    if (sel.remedy) {
      remedies++;
      if (sel.remedy.partnerId) pairsUsed.add([sel.itemId, sel.remedy.partnerId].sort().join("|"));
    }
    exercises.push(ex);
  }
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
    ...(easier ? { exerciseType: "choice" as const, hintLevel: 3 } : {}),
  };
  const at = Math.min(s.exercises.length, s.index + 1 + REPEAT_GAP);
  return { ...s, exercises: [...s.exercises.slice(0, at), copy, ...s.exercises.slice(at)] };
}
