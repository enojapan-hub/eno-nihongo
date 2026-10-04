import { describe, expect, it } from "vitest";
import {
  authStatus,
  canonicalAuthUrl,
  hasStoredSession,
  parseAuthCallback,
  pickDestination,
} from "../auth-flow";
import {
  clampFontStep,
  LIST_FONT_DEFAULT,
  LIST_FONT_KEY,
  LIST_FONT_MAX,
  LIST_FONT_MIN,
  LIST_FONT_SIZES,
  readFontStep,
} from "../list-font";
import { fitScale } from "../fit-scale";

describe("auth state: loading is never unauthenticated", () => {
  it("keeps loading distinct from logged out", () => {
    expect(authStatus(true, false)).toBe("loading");
    expect(authStatus(true, true)).toBe("loading");
    expect(authStatus(false, false)).toBe("unauthenticated");
    expect(authStatus(false, true)).toBe("authenticated");
  });
});

describe("auth callback detection", () => {
  it("recognises PKCE code, hash tokens and provider errors", () => {
    expect(parseAuthCallback("?code=abc", "").present).toBe(true);
    expect(parseAuthCallback("", "#access_token=x&refresh_token=y").present).toBe(true);
    const failed = parseAuthCallback("?error_code=otp_expired&error_description=expired", "");
    expect(failed).toEqual({ present: true, error: "expired" });
  });
  it("ignores ordinary pages and the route guard's own ?error= message", () => {
    expect(parseAuthCallback("", "").present).toBe(false);
    expect(parseAuthCallback("?paket=lifetime", "").present).toBe(false);
    expect(parseAuthCallback("?error=Akun+dinonaktifkan", "").present).toBe(false);
  });
});

describe("first-login routing", () => {
  it("sends owners/admins to /admin, onboarded users to /dashboard, new users to /onboarding", () => {
    expect(pickDestination({ role: "admin" }, false, null)).toBe("/admin");
    expect(pickDestination({ role: "student", onboarding_completed: true }, false, null)).toBe(
      "/dashboard",
    );
    expect(pickDestination(null, true, null)).toBe("/dashboard");
    expect(pickDestination(null, false, null)).toBe("/onboarding");
    expect(pickDestination({ role: "student" }, false, "/checkout?plan=lifetime")).toBe(
      "/checkout?plan=lifetime",
    );
  });
  it("moves auth started on the apex domain to www (PKCE verifier is per origin)", () => {
    const base = { pathname: "/auth", search: "?paket=lifetime", hash: "" };
    expect(canonicalAuthUrl({ hostname: "enonihongo.com", ...base })).toBe(
      "https://www.enonihongo.com/auth?paket=lifetime",
    );
    expect(canonicalAuthUrl({ hostname: "www.enonihongo.com", ...base })).toBeNull();
    expect(canonicalAuthUrl({ hostname: "localhost", ...base })).toBeNull();
  });
  it("detects a persisted Supabase session so the public page can wait", () => {
    const store = (keys: string[]) => ({
      length: keys.length,
      key: (i: number) => keys[i] ?? null,
    });
    expect(hasStoredSession(store(["theme", "sb-abc123-auth-token"]))).toBe(true);
    expect(hasStoredSession(store(["theme", "sb-abc123-auth-token-code-verifier"]))).toBe(false);
    expect(hasStoredSession(store([]))).toBe(false);
  });
});

describe("Kosakata list font size", () => {
  it("clamps to the min/max step", () => {
    expect(clampFontStep(LIST_FONT_MIN - 5)).toBe(LIST_FONT_MIN);
    expect(clampFontStep(LIST_FONT_MAX + 5)).toBe(LIST_FONT_MAX);
    expect(clampFontStep(3)).toBe(3);
    expect(clampFontStep(Number.NaN)).toBe(LIST_FONT_DEFAULT);
  });
  it("grows monotonically for kanji, kana and meaning", () => {
    for (let i = 1; i < LIST_FONT_SIZES.length; i += 1) {
      const a = LIST_FONT_SIZES[i - 1]!;
      const b = LIST_FONT_SIZES[i]!;
      expect(b.kanji).toBeGreaterThan(a.kanji);
      expect(b.kana).toBeGreaterThan(a.kana);
      expect(b.meaning).toBeGreaterThan(a.meaning);
    }
  });
  it("reads the persisted choice and survives bad storage", () => {
    expect(readFontStep({ getItem: (k) => (k === LIST_FONT_KEY ? "4" : null) })).toBe(4);
    expect(readFontStep({ getItem: () => "99" })).toBe(LIST_FONT_MAX);
    expect(readFontStep({ getItem: () => "abc" })).toBe(LIST_FONT_DEFAULT);
    expect(readFontStep({ getItem: () => null })).toBe(LIST_FONT_DEFAULT);
    expect(
      readFontStep({
        getItem: () => {
          throw new Error("blocked");
        },
      }),
    ).toBe(LIST_FONT_DEFAULT);
    expect(readFontStep(null)).toBe(LIST_FONT_DEFAULT);
  });
});

describe("flashcard fit-to-card scale", () => {
  it("keeps full size when the content already fits", () => {
    expect(fitScale(300, () => 200)).toBe(1);
  });
  it("shrinks until the scaled content fits, never below the minimum", () => {
    const s = fitScale(300, () => 420);
    expect(s).toBeLessThan(1);
    expect(420 * s).toBeLessThanOrEqual(300);
    expect(fitScale(100, () => 1000)).toBe(0.6);
  });
  it("benefits from wrapping: a wider logical width lowers the height", () => {
    const heightAt = (scale: number) => 400 / (1 / scale);
    const s = fitScale(300, heightAt);
    expect(s).toBeGreaterThan(0.8);
    expect(heightAt(s) * s).toBeLessThanOrEqual(300);
  });
});
