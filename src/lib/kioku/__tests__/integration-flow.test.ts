import { describe, expect, it } from "vitest";
import { retryAfterGap } from "../../flashcard-deck";
import { memoryReadiness } from "../insights";
import { applyEvent, initialMem } from "../progression";
import { rankCandidates, toLearned } from "../selector";
import type { MemoryStateRow } from "../types";

const NOW = Date.parse("2026-10-08T00:00:00Z");

describe("Materi → Flashcard → Kioku → laporan", () => {
  it("keeps new material out, admits learned material, spaces weak Flashcards, then updates readiness from Kioku", () => {
    const progress = [
      {
        item_type: "vocabulary",
        item_id: "learned",
        level: "N5",
        status: "learning",
        due_at: null,
        last_reviewed_at: null,
      },
      {
        item_type: "vocabulary",
        item_id: "new",
        level: "N5",
        status: "new",
        due_at: null,
        last_reviewed_at: null,
      },
    ];
    const learned = toLearned(progress);
    expect(learned.map((x) => x.itemId)).toEqual(["learned"]);
    expect(rankCandidates(learned, [], NOW).some((x) => x.itemId === "new")).toBe(false);

    const card = { kind: "vocabulary", id: "learned" };
    expect(retryAfterGap(card, 0, 2)).toBeNull();
    expect(retryAfterGap(card, 0, 3)).toEqual(card);

    const afterKioku = applyEvent(initialMem(), {
      correct: true,
      usedHint: false,
      confidence: "yakin",
      errorType: null,
      responseMs: 2500,
      hintLevel: 3,
      at: NOW,
    });
    expect(afterKioku.stage).toBe(1);

    const row: MemoryStateRow = {
      item_type: "vocabulary",
      item_id: "learned",
      aspect: "meaning",
      direction: "forward",
      stage: afterKioku.stage,
      stability: afterKioku.stability,
      due_at: new Date(afterKioku.dueAt).toISOString(),
      last_tested_at: new Date(NOW).toISOString(),
      lapses: afterKioku.lapses,
      success_count: afterKioku.successCount,
      failure_count: afterKioku.failureCount,
      overconfident_wrong: afterKioku.overconfidentWrong,
      last_error_type: afterKioku.lastErrorType,
    };
    const readiness = memoryReadiness([row], NOW);
    expect(readiness).toMatchObject({ score: 0, label: "Perlu diperkuat", strong: 0, due: 0 });
  });

  it("treats confident wrong as a stronger correction signal than unsure wrong", () => {
    const base = { ...initialMem(), stage: 3, stability: 10, successCount: 3 };
    const common = {
      correct: false,
      usedHint: false,
      errorType: "meaning",
      responseMs: 2500,
      hintLevel: 1,
      at: NOW,
    };
    const yakin = applyEvent(base, { ...common, confidence: "yakin" });
    const ragu = applyEvent(base, { ...common, confidence: "ragu" });
    expect(yakin.stage).toBeLessThan(ragu.stage);
    expect(yakin.stability).toBeLessThan(ragu.stability);
    expect(yakin.overconfidentWrong).toBe(1);
    expect(ragu.overconfidentWrong).toBe(0);
  });
});
