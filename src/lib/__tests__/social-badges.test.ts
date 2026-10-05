import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { BADGE_META, badgeKinds, NO_BADGES, parseBadgeMap } from "../social/social-badges";
import {
  USERNAME_PALETTE,
  stableHash,
  usernameColorClass,
  usernameColorIndex,
} from "../social/username-color";

const root = process.cwd();
const read = (f: string) => readFileSync(join(root, f), "utf8");

describe("badge model", () => {
  it("renders only flags that are strictly true, in a fixed order", () => {
    expect(badgeKinds({ verified: true, sensei: true, diamond: true })).toEqual([
      "verified",
      "sensei",
      "diamond",
    ]);
    expect(badgeKinds({ verified: false, sensei: true, diamond: true })).toEqual([
      "sensei",
      "diamond",
    ]);
    expect(badgeKinds(NO_BADGES)).toEqual([]);
    expect(badgeKinds(null)).toEqual([]);
    expect(badgeKinds(undefined)).toEqual([]);
  });
  it("does not trust truthy-but-not-true values from a response", () => {
    const m = parseBadgeMap({
      a: { verified: "true", sensei: 1, diamond: "yes" },
      b: { verified: true },
      c: { diamond: true, sensei: true },
      d: null,
      e: "x",
    });
    expect(m.has("a")).toBe(false);
    expect(badgeKinds(m.get("b"))).toEqual(["verified"]);
    expect(badgeKinds(m.get("c"))).toEqual(["sensei", "diamond"]);
    expect(m.has("d") || m.has("e")).toBe(false);
  });
  it("tolerates malformed payloads", () => {
    for (const bad of [null, undefined, 5, "x", [], [{ verified: true }]])
      expect(parseBadgeMap(bad).size).toBe(0);
  });
  it("uses the labels the product asked for", () => {
    expect(BADGE_META.verified.label).toBe("Akun resmi ENO NIHONGO");
    expect(BADGE_META.sensei.label).toBe("Guru ENO NIHONGO");
    expect(BADGE_META.diamond.label).toBe("Member Premium");
  });
});

describe("badge source of truth (server)", () => {
  const sql = read("supabase/migrations/20261011000000_social_badges.sql");
  it("derives badges from role/plan, never from username or display name", () => {
    expect(sql).toMatch(/p\.role = 'owner' as verified/);
    expect(sql).toMatch(/p\.role = 'teacher' as sensei/);
    expect(sql.replace(/--.*$/gm, "")).not.toMatch(/username|display_name/i);
  });
  it("counts only an active paid plan as Diamond (same rule as membership)", () => {
    expect(sql).toMatch(
      /p\.plan = 'lifetime' or \(p\.plan = 'premium' and \(p\.premium_until is null or p\.premium_until > now\(\)\)\)/,
    );
    expect(sql).not.toMatch(/p\.role in \(/);
  });
  it("is authenticated-only, bounded, and exposes only three booleans", () => {
    expect(sql).toMatch(
      /revoke all on function public\.social_badges\(uuid\[\]\) from public, anon/,
    );
    expect(sql).toMatch(
      /grant execute on function public\.social_badges\(uuid\[\]\) to authenticated/,
    );
    expect(sql).toMatch(/auth\.uid\(\) is null then raise exception/);
    expect(sql).toMatch(/cardinality\(p_users\) > 100/);
    expect(sql).toMatch(/security definer/);
    expect(sql).toMatch(/set search_path = ''/);
    expect(sql).not.toMatch(/\b(email|premium_until,|'role'|'plan')/);
  });
  it("is additive: no table, policy or other function is touched", () => {
    const code = sql.replace(/--.*$/gm, "");
    expect(code).not.toMatch(
      /create table|alter table|drop |policy|delete from|update public|insert into/i,
    );
    expect(code.match(/create or replace function/g)).toHaveLength(1);
  });
  it("does not add a second role/premium system (no new migration besides this one for it)", () => {
    const files = readdirSync(join(root, "supabase/migrations")).filter((f) => f >= "20261011");
    expect(files).toEqual(["20261011000000_social_badges.sql"]);
  });
});

describe("global username colors", () => {
  const ids = Array.from(
    { length: 200 },
    (_, i) => `00000000-0000-4000-8000-${String(i).padStart(12, "0")}`,
  );
  it("is deterministic for the same account id", () => {
    for (const id of ids.slice(0, 20)) {
      expect(usernameColorClass(id)).toBe(usernameColorClass(id));
      expect(usernameColorIndex(id)).toBe(usernameColorIndex(id));
    }
    expect(stableHash("abc")).toBe(stableHash("abc"));
  });
  it("always maps into the curated palette", () => {
    for (const id of ids) expect(USERNAME_PALETTE).toContain(usernameColorClass(id));
  });
  it("spreads accounts over the palette (not one colour)", () => {
    const used = new Set(ids.map(usernameColorIndex));
    expect(used.size).toBeGreaterThanOrEqual(USERNAME_PALETTE.length - 2);
  });
  it("has a bounded, readable palette with light and dark variants", () => {
    expect(USERNAME_PALETTE.length).toBeGreaterThanOrEqual(8);
    expect(USERNAME_PALETTE.length).toBeLessThanOrEqual(12);
    for (const c of USERNAME_PALETTE) {
      expect(c).toMatch(/^text-[a-z]+-[78]00 dark:text-[a-z]+-300$/);
    }
  });
  it("does not depend on username or randomness", () => {
    const src =
      read("src/lib/social/username-color.ts") + read("src/components/social/MessageList.tsx");
    expect(src).not.toMatch(/Math\.random|Date\.now|crypto\.getRandom/);
    expect(read("src/components/social/MessageList.tsx")).toMatch(
      /usernameColorClass\(m\.author\.userId\)/,
    );
  });
  it("colours only Global Chat names, never the message body or badges", () => {
    const list = read("src/components/social/MessageList.tsx");
    expect(read("src/components/social/GlobalChatPanel.tsx")).toMatch(/\n\s+colorize\n/);
    expect(read("src/components/social/DmPanel.tsx")).not.toMatch(/colorize/);
    expect(list.match(/usernameColorClass/g)).toHaveLength(2); // import + single use on the name
    const badges = read("src/components/social/IdentityBadges.tsx");
    expect(badges).not.toMatch(/usernameColor/);
  });
});

describe("profile card layout contract", () => {
  const src = read("src/components/social/SocialProfileCard.tsx");
  it("is a compact centred floating card, not a sheet/fullscreen", () => {
    expect(src).toMatch(/fixed inset-0[^"]*items-center justify-center/);
    expect(src).toMatch(/w-\[min\(86vw,21rem\)\]/);
    expect(src).toMatch(/md:w-\[22\.5rem\]/);
    expect(src).toMatch(/max-h-\[min\(34rem,calc\(100dvh-2rem\)\)\]/);
    expect(src).toMatch(/safe-area-inset-bottom/);
    expect(src).not.toMatch(/items-end|rounded-t-3xl|slide-in-from-bottom/);
  });
  it("fades/scales in (reduced-motion safe), closes by X/backdrop/Escape, restores focus", () => {
    expect(src).toMatch(/motion-safe:zoom-in-95/);
    expect(src).toMatch(/aria-label="Tutup"/);
    expect(src).toMatch(/onClick=\{\(\) => profileCard\.close\(\)\}/);
    expect(src).toMatch(/e\.key !== "Escape"/);
    expect(src).toMatch(/trigger\.focus/);
    expect(src).toMatch(/aria-modal="true"/);
  });
  it("shows badges through the single IdentityBadges component", () => {
    expect(src).toMatch(/<IdentityBadges userId=\{uid\} size="md"/);
  });
});

describe("one identity entry point", () => {
  const files = [
    "src/components/social/MessageList.tsx",
    "src/components/social/FriendsPanel.tsx",
    "src/components/social/DmPanel.tsx",
    "src/routes/_authenticated/leaderboard.tsx",
  ];
  it("every surface opens the same profile card and shows the same badges", () => {
    for (const f of files) {
      const s = read(f);
      expect(s, f).toMatch(/profileCard\.open|openProfile/);
      expect(s, f).toMatch(/<IdentityBadges/);
    }
    expect(read("src/routes/_authenticated/leaderboard.tsx")).toMatch(/profileCard\.open/);
  });
  it("only one profile host exists and badge logic is not duplicated", () => {
    expect(read("src/components/social/ChatDock.tsx").match(/<SocialProfileHost/g)).toHaveLength(1);
    for (const f of [...files, "src/components/social/SocialProfileCard.tsx"])
      expect(read(f), f).not.toMatch(
        /role\s*===|plan\s*===|premium_until|username === "enonihongo"/,
      );
  });
  it("does not make arbitrary @text clickable or touch Edit Profil inputs", () => {
    expect(read("src/components/social/SocialAccountCard.tsx")).not.toMatch(
      /profileCard|IdentityBadges/,
    );
    expect(read("src/routes/_authenticated/edit-profil.tsx")).not.toMatch(/profileCard\.open/);
  });
});
