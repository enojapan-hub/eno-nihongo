import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { separateSameItemCards, type DeckCard } from "../flashcard-deck";

type Card = DeckCard & { aspect: string };
const card = (id: string, aspect: string): Card => ({ kind: "vocabulary", id, aspect });
const key = (c: DeckCard) => `${c.kind}:${c.id}`;
// Deck as built by hafalan.tsx: sorted per item, then per aspect.
const sorted = ["a", "b", "c", "d", "e"].flatMap((id) => [card(id, "arti"), card(id, "bacaan")]);

describe("separateSameItemCards", () => {
  it("pressing Ingat (index + 1) never lands on another aspect of the card just shown", () => {
    const deck = separateSameItemCards(sorted);
    for (let i = 0; i < deck.length - 1; i++) {
      expect(key(deck[i + 1]!)).not.toBe(key(deck[i]!));
    }
  });

  it("never puts two cards of one item side by side when the mix allows it", () => {
    const decks: Card[][] = [
      sorted,
      [
        card("a", "x"),
        card("a", "y"),
        card("a", "z"),
        card("b", "x"),
        card("b", "y"),
        card("c", "x"),
      ],
      [
        card("a", "x"),
        card("b", "x"),
        card("b", "y"),
        card("c", "x"),
        card("c", "y"),
        card("c", "z"),
      ],
      ["a", "b", "c"].flatMap((id) => [card(id, "x"), card(id, "y"), card(id, "z")]),
    ];
    for (const original of decks) {
      const counts = new Map<string, number>();
      for (const c of original) counts.set(key(c), (counts.get(key(c)) ?? 0) + 1);
      const feasible = Math.max(...counts.values()) <= Math.ceil(original.length / 2);
      const deck = separateSameItemCards(original);
      expect(deck).toHaveLength(original.length);
      expect(new Set(deck)).toEqual(new Set(original));
      if (feasible)
        for (let i = 0; i < deck.length - 1; i++) expect(key(deck[i + 1]!)).not.toBe(key(deck[i]!));
    }
  });

  it("keeps every card exactly once and the first card of the priority order", () => {
    const deck = separateSameItemCards(sorted);
    expect(deck).toHaveLength(sorted.length);
    expect(new Set(deck)).toEqual(new Set(sorted));
    expect(deck[0]).toBe(sorted[0]);
  });

  it("relaxes the gap when there are too few items instead of dropping cards", () => {
    const two = [card("a", "arti"), card("a", "bacaan"), card("b", "arti"), card("b", "bacaan")];
    const deck = separateSameItemCards(two);
    expect(deck).toHaveLength(4);
    for (let i = 0; i < deck.length - 1; i++) expect(key(deck[i + 1]!)).not.toBe(key(deck[i]!));
    const single = [card("a", "arti"), card("a", "bacaan")];
    expect(separateSameItemCards(single)).toEqual(single);
    expect(separateSameItemCards([])).toEqual([]);
  });
});

describe("hafalan.tsx", () => {
  const src = readFileSync(join(process.cwd(), "src/routes/_authenticated/hafalan.tsx"), "utf8");

  it("builds the deck through separateSameItemCards", () => {
    expect(src).toMatch(/return separateSameItemCards\(a\.slice\(0, n\)\)/);
  });

  it("saves a rating exactly once per press and advances the index before the network call", () => {
    expect(src.match(/rate\(ratedCard,/g)).toHaveLength(1);
    const choose = /function choose\(r: Rating\) \{([\s\S]*?)\n {2}\}\n/.exec(src)?.[1] ?? "";
    expect(choose.indexOf("setIndex((i) => i + 1)")).toBeGreaterThan(-1);
    expect(choose.indexOf("setIndex((i) => i + 1)")).toBeLessThan(
      choose.indexOf("rate(ratedCard,"),
    );
  });
});
