import { describe, expect, it } from "vitest";
import { parseMyReports, reportCategoryLabel, reportStatusInfo } from "../my-reports";

const row = { id: "1", category: "bug", subject: "S", status: "open", created_at: "2026-10-11T00:00:00Z", updated_at: "2026-10-11T00:00:00Z" };

describe("my-reports", () => {
  it("memetakan semua status constraint", () => {
    expect(reportStatusInfo("open").label).toBe("Baru");
    expect(reportStatusInfo("reviewing").label).toBe("Diproses");
    expect(reportStatusInfo("resolved").tone).toBe("ok");
    expect(reportStatusInfo("rejected").label).toBe("Ditutup");
  });
  it("tidak menyatakan sukses untuk status tak dikenal", () => {
    expect(reportStatusInfo("x")).toEqual({ label: "x", tone: "neutral" });
  });
  it("memetakan kategori", () => {
    expect(reportCategoryLabel("content")).toBe("Materi");
    expect(reportCategoryLabel("zzz")).toBe("zzz");
  });
  it("membuang baris rusak dan bukan-array", () => {
    expect(parseMyReports(null)).toEqual([]);
    expect(parseMyReports([row, { id: 2 }, null, "x"])).toEqual([row]);
  });
  it("tidak meneruskan kolom internal", () => {
    const leaked = { ...row, resolution_note: "rahasia", assigned_to: "u" };
    expect(Object.keys(parseMyReports([leaked])[0]).sort()).toEqual(["category", "created_at", "id", "status", "subject", "updated_at"]);
  });
});
