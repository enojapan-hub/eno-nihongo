import { describe, expect, it } from "vitest";
import { masteryLabel } from "../mastery";

describe("mastery labels", () => {
  it("maps memory stages to user-facing labels", () => {
    expect(masteryLabel(0)).toBe("Perlu diperkuat");
    expect(masteryLabel(1)).toBe("Perlu diperkuat");
    expect(masteryLabel(2)).toBe("Mulai kuat");
    expect(masteryLabel(3)).toBe("Mulai kuat");
    expect(masteryLabel(4)).toBe("Ingat kuat");
    expect(masteryLabel(8)).toBe("Ingat kuat");
  });
});
