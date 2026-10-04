import { beforeEach, describe, expect, it, vi } from "vitest";

const getSession = vi.fn();
const getUser = vi.fn();
const listeners: Array<() => void> = [];
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    auth: {
      getSession: (...a: unknown[]) => getSession(...a),
      getUser: (...a: unknown[]) => getUser(...a),
      onAuthStateChange: (fn: () => void) => {
        listeners.push(fn);
        return { data: { subscription: { unsubscribe() {} } } };
      },
    },
  },
}));

const ok = (id: string) => ({ data: { user: { id } }, error: null });

describe("getAuthUser", () => {
  beforeEach(() => {
    vi.resetModules();
    getSession.mockReset();
    getUser.mockReset();
    listeners.length = 0;
    vi.stubGlobal("window", {});
  });

  it("coalesces concurrent calls and reuses the validated user for the same session", async () => {
    getSession.mockResolvedValue({ data: { session: { access_token: "t1" } } });
    getUser.mockResolvedValue(ok("u1"));
    const { getAuthUser } = await import("../auth-user");
    const results = await Promise.all([getAuthUser(), getAuthUser(), getAuthUser()]);
    await getAuthUser();
    expect(getUser).toHaveBeenCalledTimes(1);
    expect(results.every((r) => r.data.user?.id === "u1")).toBe(true);
  });

  it("asks the server again after the session token changes or on auth state change", async () => {
    getSession.mockResolvedValue({ data: { session: { access_token: "t1" } } });
    getUser.mockResolvedValue(ok("u1"));
    const { getAuthUser } = await import("../auth-user");
    await getAuthUser();
    getSession.mockResolvedValue({ data: { session: { access_token: "t2" } } });
    getUser.mockResolvedValue(ok("u2"));
    expect((await getAuthUser()).data.user?.id).toBe("u2");
    listeners.forEach((fn) => fn());
    await getAuthUser();
    expect(getUser).toHaveBeenCalledTimes(3);
  });

  it("never caches a failed validation and falls through when there is no session", async () => {
    getSession.mockResolvedValue({ data: { session: { access_token: "t1" } } });
    getUser.mockResolvedValueOnce({ data: { user: null }, error: new Error("jwt expired") });
    getUser.mockResolvedValueOnce(ok("u1"));
    const { getAuthUser } = await import("../auth-user");
    expect((await getAuthUser()).error).toBeTruthy();
    expect((await getAuthUser()).data.user?.id).toBe("u1");
    getSession.mockResolvedValue({ data: { session: null } });
    getUser.mockResolvedValue({ data: { user: null }, error: new Error("no session") });
    expect((await getAuthUser()).data.user).toBeNull();
    expect(getUser).toHaveBeenCalledTimes(3);
  });
});
