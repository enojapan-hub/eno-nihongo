import { describe, expect, it } from "vitest";
import { parseManifestExam, rowExamNo, selectExamRows } from "@/lib/audio-manifest";

const rows = [
  { id: "legacy-exam1", level: "N5", mapping_scope: "session" }, // baris lama tanpa exam_no
  { id: "n5-002", level: "N5", mapping_scope: "session", exam_no: 2 },
  { id: "exam1-mondai", level: "N5", mapping_scope: "mondai", exam_no: 1 },
  { id: "exam3", level: "N5", mapping_scope: "session", exam_no: 3 },
];

describe("audio manifest per exam", () => {
  it("exam 1 hanya mendapat audio exam 1 (termasuk baris lama tanpa exam_no)", () => {
    const ids = selectExamRows(rows, 1).map((r) => r.id);
    expect(ids).toEqual(["legacy-exam1", "exam1-mondai"]);
    expect(ids).not.toContain("n5-002");
  });

  it("exam 2 hanya mendapat audio N5 002", () => {
    expect(selectExamRows(rows, 2).map((r) => r.id)).toEqual(["n5-002"]);
  });

  it("exam tanpa audio tidak jatuh kembali ke exam lain", () => {
    expect(selectExamRows(rows, 4)).toEqual([]);
  });

  it("exam 1 dan exam 2 tidak pernah berbagi sumber", () => {
    const a = new Set(selectExamRows(rows, 1).map((r) => r.id));
    for (const r of selectExamRows(rows, 2)) expect(a.has(r.id)).toBe(false);
  });

  it("parameter dan exam_no tidak valid = exam 1 (kompatibel dengan data/klien lama)", () => {
    expect(parseManifestExam(null)).toBe(1);
    expect(parseManifestExam("abc")).toBe(1);
    expect(parseManifestExam("0")).toBe(1);
    expect(parseManifestExam("2")).toBe(2);
    expect(rowExamNo({})).toBe(1);
    expect(rowExamNo({ exam_no: null })).toBe(1);
    expect(rowExamNo({ exam_no: 2 })).toBe(2);
  });
});
