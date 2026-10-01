import type { ErrorType, KiokuItemType, PairSource, Remedy } from "./types";

/** Kioku event as read back from `flashcard_reviews` (meta jsonb). */
export type ReviewEvent = {
  item_type: string;
  item_id: string;
  aspect: string;
  direction: string;
  correct: boolean;
  error_type: string | null;
  selected_item_id: string | null;
  variant?: string | null;
  context_ref?: string | null;
  created_at: string;
};
export type ErrSignal = { type: ErrorType; count: number };
export type PairInfo = {
  type: KiokuItemType;
  a: string;
  b: string;
  count: number;
  confused: number;
};
export type Partner = {
  id: string;
  type: KiokuItemType;
  source: PairSource;
  count: number;
  confirmed: boolean;
};
export type Signals = {
  /** combo key -> unresolved error (latest events for the combo are errors) */
  unresolved: Map<string, ErrSignal>;
  pairs: Map<string, PairInfo>;
  /** relation table rows (kanji_relations / vocabulary_relations) */
  relations: Array<{ type: KiokuItemType; a: string; b: string }>;
};
export const HOLD_AFTER = 4; // stop escalating remediation after this many consecutive errors on a combo

export const comboKey = (t: string, id: string, aspect: string, dir: string) =>
  `${t}:${id}:${aspect}:${dir}`;
export const pairKey = (t: string, a: string, b: string) =>
  a < b ? `${t}:${a}|${b}` : `${t}:${b}|${a}`;

export function toReviewEvents(
  rows: Array<{
    item_type: string;
    item_id: string;
    aspect: string;
    direction: string;
    rating: number;
    created_at: string;
    meta: Record<string, any> | null;
  }>,
): ReviewEvent[] {
  return rows
    .filter((r) => r.meta?.["source"] === "kioku")
    .map((r) => ({
      item_type: r.item_type,
      item_id: r.item_id,
      aspect: r.aspect,
      direction: r.direction,
      correct:
        typeof r.meta?.["correct"] === "boolean" ? (r.meta["correct"] as boolean) : r.rating >= 2,
      error_type: (r.meta?.["error_type"] as string | undefined) ?? null,
      selected_item_id: (r.meta?.["selected_item_id"] as string | undefined) ?? null,
      variant: (r.meta?.["variant"] as string | undefined) ?? null,
      context_ref: (r.meta?.["context_ref"] as string | undefined) ?? null,
      created_at: r.created_at,
    }));
}

const isError = (e: ReviewEvent) => !e.correct || e.error_type === "slow_recall";

/**
 * Events must be newest first. A combo is "unresolved" while its newest events are errors; one clean
 * correct answer resolves it (so remediation never repeats forever). Wrong choices that picked a real item
 * are recorded as A<->B pairs; only a `confusion`-labelled pick or a repeated pick makes a pair relevant.
 */
export const MAX_ERROR_AGE_MS = 30 * 86400000; // an old, never re-tested error stops steering remediation

export function buildSignals(
  eventsNewestFirst: ReviewEvent[],
  relations: Signals["relations"] = [],
  now?: number,
): Signals {
  const state = new Map<string, { sig?: ErrSignal; closed: boolean }>();
  const pairs = new Map<string, PairInfo>();
  for (const e of eventsNewestFirst) {
    // The immediate repeat after a mistake is short-term memory: a correct repeat must not "resolve" the error.
    if (e.variant === "repeat" && e.correct) continue;
    if (now !== undefined && now - new Date(e.created_at).getTime() > MAX_ERROR_AGE_MS) continue;
    const k = comboKey(e.item_type, e.item_id, e.aspect, e.direction);
    const cur = state.get(k);
    if (!cur) {
      state.set(
        k,
        isError(e)
          ? {
              sig: { type: ((e.error_type as ErrorType) ?? "general") as ErrorType, count: 1 },
              closed: false,
            }
          : { closed: true },
      );
    } else if (!cur.closed) {
      if (isError(e)) cur.sig!.count++;
      else cur.closed = true;
    }
    if (
      !e.correct &&
      e.selected_item_id &&
      !e.selected_item_id.includes(":") &&
      e.selected_item_id !== e.item_id
    ) {
      const pk = pairKey(e.item_type, e.item_id, e.selected_item_id);
      const p = pairs.get(pk) ?? {
        type: e.item_type as KiokuItemType,
        a: e.item_id,
        b: e.selected_item_id,
        count: 0,
        confused: 0,
      };
      p.count++;
      if (e.error_type === "confusion") p.confused++;
      pairs.set(pk, p);
    }
  }
  const unresolved = new Map<string, ErrSignal>();
  for (const [k, v] of state) if (v.sig) unresolved.set(k, v.sig);
  return { unresolved, pairs, relations };
}

/** Real error pairs first, then relation tables. (wrong_examples / heuristic are content-level and resolved by the session builder.) */
export function partnerFor(type: KiokuItemType, id: string, sig: Signals): Partner | null {
  let best: Partner | null = null;
  let bestW = -1;
  for (const p of sig.pairs.values()) {
    if (p.type !== type || (p.a !== id && p.b !== id)) continue;
    if (p.confused < 1 && p.count < 2) continue; // a single unlabelled wrong pick is not evidence of confusion
    const w = p.confused * 10 + p.count;
    if (w > bestW) {
      bestW = w;
      best = {
        id: p.a === id ? p.b : p.a,
        type,
        source: "error",
        count: p.count,
        confirmed: p.count >= 2,
      };
    }
  }
  if (best) return best;
  const r = sig.relations.find((x) => x.type === type && (x.a === id || x.b === id));
  return r
    ? { id: r.a === id ? r.b : r.a, type, source: "relation", count: 0, confirmed: false }
    : null;
}

/** Deterministic error_type -> remediation mapping (no LLM). */
export function remedyFor(
  err: ErrSignal | undefined,
  ctx: { itemType: KiokuItemType; partner: Partner | null; hasWrongExamples: boolean },
): Remedy | null {
  if (!err || err.count >= HOLD_AFTER) return null;
  const count = err.count;
  switch (err.type) {
    case "meaning":
      return { kind: "meaning", partnerId: ctx.partner?.id, source: ctx.partner?.source, count };
    case "reading":
      return { kind: "reading", partnerId: ctx.partner?.id, source: ctx.partner?.source, count };
    case "confusion": {
      const repeated =
        !!ctx.partner &&
        (ctx.partner.confirmed || (ctx.partner.source === "relation" && count >= 2));
      return {
        kind: repeated ? "contrast" : "jebakan",
        partnerId: ctx.partner?.id,
        source: ctx.partner?.source,
        count,
      };
    }
    case "usage_context":
      return ctx.itemType === "grammar" && !ctx.hasWrongExamples ? null : { kind: "usage", count };
    case "slow_recall":
      return { kind: "slow", count };
    case "likely_guess":
      return { kind: "guess", count };
    default:
      return null; // general -> normal reinforcement
  }
}

/** Example sentences already used per item (from persisted events), so the next session can pick a different one. */
export function seenContexts(events: ReviewEvent[]): Map<string, Set<string>> {
  const out = new Map<string, Set<string>>();
  for (const e of events) {
    if (!e.context_ref) continue;
    const k = `${e.item_type}:${e.item_id}`;
    (out.get(k) ?? out.set(k, new Set()).get(k)!).add(e.context_ref);
  }
  return out;
}
