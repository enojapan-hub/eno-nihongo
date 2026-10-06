import { describe, expect, it } from "vitest";
import { premiumStatus } from "../premium-countdown";

const now = new Date("2026-10-06T00:00:00Z");
const timed = (iso: string | null, plan: "premium" | "free" | "lifetime" = "premium") => ({
  plan,
  premiumUntil: iso,
});

describe("hitung mundur Premium di Home", () => {
  it("Free: tidak ada status", () => {
    expect(premiumStatus(timed(null, "free"), "student", now)).toBeNull();
    expect(premiumStatus(null, "student", now)).toBeNull();
  });
  it("Premium aktif: hari tersisa + tanggal berakhir", () => {
    const s = premiumStatus(timed("2026-11-02T00:00:00Z"), "student", now);
    expect(s?.kind).toBe("timed");
    expect(s?.label).toBe("Premium • 27 hari lagi");
    expect(s && "untilLabel" in s && s.untilLabel).toBe("Aktif hingga 2 November 2026");
  });
  it("batas: tepat 24 jam = 1 hari; <24 jam = pesan halus; tepat habis/kedaluwarsa = bukan Premium", () => {
    expect(premiumStatus(timed("2026-10-07T00:00:00Z"), "student", now)?.label).toBe(
      "Premium • 1 hari lagi",
    );
    expect(premiumStatus(timed("2026-10-06T23:59:59Z"), "student", now)?.label).toBe(
      "Premium • kurang dari 24 jam lagi",
    );
    expect(premiumStatus(timed("2026-10-06T00:00:00Z"), "student", now)).toBeNull();
    expect(premiumStatus(timed("2026-10-01T00:00:00Z"), "student", now)).toBeNull();
    const label = premiumStatus(timed("2026-10-06T00:00:01Z"), "student", now)?.label ?? "";
    expect(label).not.toMatch(/0 hari/);
  });
  it("seumur hidup: label tanpa hitung mundur palsu", () => {
    const s = premiumStatus(timed("2030-01-01T00:00:00Z", "lifetime"), "student", now);
    expect(s).toEqual({ kind: "lifetime", label: "Premium Seumur Hidup" });
  });
  it("Premium tanpa tanggal berakhir: aktif tanpa hitung mundur", () => {
    expect(premiumStatus(timed(null), "student", now)).toEqual({
      kind: "open",
      label: "Premium aktif",
    });
  });
  it("peran khusus mengikuti resolver: tidak ada langganan palsu", () => {
    for (const role of ["owner", "admin", "editor", "teacher"])
      expect(premiumStatus(timed("2026-11-02T00:00:00Z"), role, now)).toBeNull();
  });
  it("Home memakai get_my_membership + premiumStatus, tanpa polling", async () => {
    const { readFileSync } = await import("node:fs");
    const src = readFileSync(
      new URL("../../routes/_authenticated/dashboard.tsx", import.meta.url),
      "utf8",
    );
    expect(src).toContain("premiumStatus(membership.data, profile?.role, new Date())");
    expect(src).toContain('data-testid="premium-status"');
    expect(src).toContain('queryKey: ["membership"]');
    expect(src).not.toMatch(/refetchInterval|setInterval/);
  });
});
