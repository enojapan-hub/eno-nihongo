import { describe, expect, it, vi } from "vitest";

vi.mock("@/integrations/supabase/client", () => ({ supabase: {} }));
vi.mock("@/lib/auth-user", () => ({ getAuthUser: vi.fn() }));

import { kiokuHomeSummary, type MemoryReportRow } from "../memory-report";

const now = Date.parse("2026-10-10T00:00:00Z");
const past = "2026-10-01T00:00:00Z";
const future = "2026-11-01T00:00:00Z";
const row = (stage: number, due_at: string, last_error_type: string | null = null): MemoryReportRow => ({
  stage,
  due_at,
  overconfident_wrong: 0,
  last_error_type,
});

describe("kiokuHomeSummary", () => {
  it("reports no data instead of inventing numbers", () => {
    const s = kiokuHomeSummary([], now);
    expect(s.hasData).toBe(false);
    expect(s.recommendation).toBeNull();
  });

  it("derives tiles from memory stages and due dates", () => {
    const s = kiokuHomeSummary(
      [row(4, future), row(5, future), row(1, past), row(0, future), row(3, past)],
      now,
    );
    expect(s.strong).toBe(2);
    expect(s.needReview).toBe(2);
    expect(s.needRecovery).toBe(2);
    expect(s.readinessScore).toBeGreaterThan(0);
  });

  it("recommends from the most frequent recent error type", () => {
    const s = kiokuHomeSummary(
      [row(1, past, "usage_context"), row(1, past, "usage_context"), row(0, past, "reading")],
      now,
    );
    expect(s.recommendation?.title).toBe("Perkuat pemahaman konteks");
  });

  it("ignores unknown error types and falls back to due review", () => {
    const s = kiokuHomeSummary([row(1, past, "unknown")], now);
    expect(s.recommendation?.title).toBe("Ulangi materi jatuh tempo");
  });
});
