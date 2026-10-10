import { describe, expect, it } from "vitest";
import { referralStatusInfo, summarizeReferrals } from "../referral-history";

describe("referral-history", () => {
  it("memberi label berbeda untuk pengundang dan yang diundang", () => {
    expect(referralStatusInfo("completed", "referrer").label).toBe("Hadiah diterima");
    expect(referralStatusInfo("completed", "referred").label).toBe("Kamu sudah mulai belajar");
    expect(referralStatusInfo("pending", "referrer").tone).toBe("wait");
  });
  it("tidak menyatakan sukses untuk status tak dikenal", () => {
    expect(referralStatusInfo("x", "referrer")).toEqual({ label: "x", tone: "neutral" });
  });
  it("merangkum jumlah", () => {
    expect(summarizeReferrals([{ status: "completed" }, { status: "pending" }, { status: "pending" }])).toEqual({ total: 3, completed: 1, pending: 2 });
    expect(summarizeReferrals([])).toEqual({ total: 0, completed: 0, pending: 0 });
  });
});
