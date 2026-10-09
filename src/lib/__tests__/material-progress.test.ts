import { describe, expect, it } from "vitest";
import { isMaterialLearned, learnedActionLabel } from "../material-progress";

describe("material progress semantics", () => {
  it("only treats active learned statuses as learned", () => {
    expect(isMaterialLearned("new")).toBe(false);
    expect(isMaterialLearned(null)).toBe(false);
    expect(isMaterialLearned(undefined)).toBe(false);
    expect(isMaterialLearned("learning")).toBe(true);
    expect(isMaterialLearned("review")).toBe(true);
    expect(isMaterialLearned("mastered")).toBe(true);
  });

  it("does not present an unlearned item as already learned", () => {
    expect(learnedActionLabel(false)).toBe("Belum Dipelajari");
    expect(learnedActionLabel(true)).toBe("Sudah Dipelajari");
  });
});
