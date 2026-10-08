import { describe, expect, it } from "vitest";
import { fatigueSuggested, levelReadiness, memoryReadiness, weeklyLearning } from "../insights";

describe("Kioku learning insights", () => {
  it("calculates readiness from tested memory stages without claiming JLPT pass probability", () => {
    const now = Date.parse("2026-10-08T00:00:00Z");
    const r = memoryReadiness([
      { stage: 4, due_at: "2026-10-09T00:00:00Z" },
      { stage: 3, due_at: "2026-10-07T00:00:00Z" },
      { stage: 1, due_at: "2026-10-10T00:00:00Z" },
    ], now);
    expect(r.score).toBe(50);
    expect(r.label).toBe("Perlu diperkuat");
    expect(r.due).toBe(1);
  });

  it("summarizes only the last seven days", () => {
    const now = Date.parse("2026-10-08T00:00:00Z");
    const r = weeklyLearning([
      { correct: true, created_at: "2026-10-07T10:00:00Z" },
      { correct: false, created_at: "2026-10-07T11:00:00Z" },
      { correct: true, created_at: "2026-10-06T10:00:00Z" },
      { correct: true, created_at: "2026-09-20T10:00:00Z" },
    ], now);
    expect(r).toEqual({ reviews: 3, correct: 2, accuracy: 67, activeDays: 2 });
  });

  it("suggests stopping only after enough evidence of fatigue", () => {
    expect(fatigueSuggested(10, 8)).toBe(false);
    expect(fatigueSuggested(12, 6)).toBe(true);
    expect(fatigueSuggested(30, 2)).toBe(true);
  });

  it("maps tested memory back to the learned item level", () => {
    const rows = levelReadiness(
      [
        { item_type: "kanji", item_id: "a", level: "N5", status: "learning" },
        { item_type: "kanji", item_id: "b", level: "N4", status: "new" },
      ],
      [
        { item_type: "kanji", item_id: "a", stage: 4, due_at: "2026-10-09T00:00:00Z" },
        { item_type: "kanji", item_id: "b", stage: 4, due_at: "2026-10-09T00:00:00Z" },
      ],
      Date.parse("2026-10-08T00:00:00Z"),
    );
    expect(rows.find((x) => x.level === "N5")?.score).toBe(100);
    expect(rows.find((x) => x.level === "N4")?.score).toBe(0);
  });
});
