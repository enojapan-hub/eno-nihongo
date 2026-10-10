import { describe, expect, it } from "vitest";
import { grantTitle, orderStatusInfo, orderTitle } from "../purchase-history";

describe("purchase-history", () => {
  it("memetakan seluruh status yang diizinkan constraint", () => {
    for (const s of ["pending", "paid", "failed", "cancelled", "refunded"]) {
      expect(orderStatusInfo(s).label).not.toBe(s);
    }
    expect(orderStatusInfo("paid").tone).toBe("ok");
    expect(orderStatusInfo("pending").tone).toBe("wait");
  });
  it("tidak menyatakan sukses untuk status tak dikenal", () => {
    expect(orderStatusInfo("aneh")).toEqual({ label: "aneh", tone: "neutral" });
    expect(orderStatusInfo("").label).toBe("Tidak diketahui");
  });
  it("menyusun judul pesanan", () => {
    expect(orderTitle("subscription", "monthly", 30)).toBe("Langganan Premium · Bulanan · 30 hari");
    expect(orderTitle("lifetime", null, null)).toBe("Premium Lifetime");
  });
  it("menyusun judul hadiah", () => {
    expect(grantTitle("referral_premium", 30)).toBe("Hadiah referral · Premium 30 hari");
    expect(grantTitle("lain", null)).toBe("lain");
  });
});
