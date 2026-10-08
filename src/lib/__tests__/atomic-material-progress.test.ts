import { beforeEach, describe, expect, it, vi } from "vitest";

const rpc = vi.hoisted(() => vi.fn());

vi.mock("@/integrations/supabase/client", () => ({
  supabase: { rpc },
}));

import { markItemLearned } from "../learn-queries";

describe("markItemLearned atomic RPC", () => {
  beforeEach(() => rpc.mockReset());

  it("uses one server-side call for progress and activity", async () => {
    rpc.mockResolvedValue({ data: true, error: null });
    await expect(
      markItemLearned({ itemType: "vocabulary", itemId: "test-id", level: "N5" }),
    ).resolves.toBe(true);
    expect(rpc).toHaveBeenCalledExactlyOnceWith("mark_material_learned_atomic", {
      p_item_type: "vocabulary",
      p_item_id: "test-id",
      p_level: "N5",
    });
  });

  it("does not claim a second completion changed progress", async () => {
    rpc.mockResolvedValue({ data: false, error: null });
    await expect(
      markItemLearned({ itemType: "kanji", itemId: "test-id", level: "N4" }),
    ).resolves.toBe(false);
  });

  it("propagates database failure instead of reporting success", async () => {
    rpc.mockResolvedValue({ data: null, error: { message: "transaction aborted" } });
    await expect(
      markItemLearned({ itemType: "grammar", itemId: "test-id", level: "N3" }),
    ).rejects.toThrow("transaction aborted");
  });
});
