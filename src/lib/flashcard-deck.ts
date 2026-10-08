export type DeckCard = { kind: string; id: string };

const itemKey = (card: DeckCard) => `${card.kind}:${card.id}`;

/**
 * Cards of one item (for example the "Arti" and "Bacaan" card of the same word) share the same
 * front. The deck is sorted per item, so rating a card showed the next aspect of the same word and
 * the flashcard looked like it had not advanced.
 *
 * Keeps the priority order but takes the next card from an item that was not shown in the last
 * `gap` cards whenever one is available (relaxing the gap when there are too few items), then moves
 * any card that is still next to a card of its own item to the nearest spot where it is not.
 * Never drops or duplicates a card.
 */
export function separateSameItemCards<T extends DeckCard>(cards: T[], gap = 3): T[] {
  const pending = [...cards];
  const out: T[] = [];
  while (pending.length > 0) {
    let pick = 0;
    for (let window = gap; window > 0; window--) {
      const recent = new Set(out.slice(-window).map(itemKey));
      const found = pending.findIndex((card) => !recent.has(itemKey(card)));
      if (found !== -1) {
        pick = found;
        break;
      }
    }
    out.push(...pending.splice(pick, 1));
  }
  // Tail repair: when only one item is left its cards end up side by side.
  for (let i = 1; i < out.length; i++) {
    const key = itemKey(out[i]!);
    if (key !== itemKey(out[i - 1]!)) continue;
    for (let j = i - 1; j >= 1; j--) {
      if (itemKey(out[j - 1]!) !== key && itemKey(out[j]!) !== key) {
        out.splice(j, 0, ...out.splice(i, 1));
        break;
      }
    }
  }
  return out;
}

/**
 * Reinsert a difficult card after a small gap. Lupa returns sooner than Sulit.
 * The queue is capped by the caller's original session; this helper only places one retry.
 */
export function retryAfterGap<T>(card: T, rating: 0 | 1, answeredAfter: number): T | null {
  const gap = rating === 0 ? 3 : 5;
  return answeredAfter >= gap ? card : null;
}
