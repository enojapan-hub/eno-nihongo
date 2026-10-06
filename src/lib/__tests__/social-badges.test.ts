import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { BADGE_META, badgeKinds, NO_BADGES, parsePublicMeta } from "../social/social-badges";
import {
  USERNAME_PALETTE,
  stableHash,
  usernameColorClass,
  usernameColorIndex,
} from "../social/username-color";

const root = process.cwd();
const read = (f: string) => readFileSync(join(root, f), "utf8");

describe("badge model", () => {
  const F = false;
  const T = true;
  it("Owner shows Verified only, whatever else is true", () => {
    expect(badgeKinds({ verified: T, sensei: T, diamond: T })).toEqual(["verified"]);
    expect(badgeKinds({ verified: T, sensei: F, diamond: T })).toEqual(["verified"]);
    expect(badgeKinds({ verified: T, sensei: F, diamond: F })).toEqual(["verified"]);
  });
  it("Guru Premium → Sensei + Diamond; Guru Free → Sensei + Free", () => {
    expect(badgeKinds({ verified: F, sensei: T, diamond: T })).toEqual(["sensei", "diamond"]);
    expect(badgeKinds({ verified: F, sensei: T, diamond: F })).toEqual(["sensei", "free"]);
  });
  it("Premium user → Diamond; Free (incl. expired premium) → Free", () => {
    expect(badgeKinds({ verified: F, sensei: F, diamond: T })).toEqual(["diamond"]);
    expect(badgeKinds(NO_BADGES)).toEqual(["free"]);
  });
  it("shows no badge at all until the server has answered (never a premature Free)", () => {
    expect(badgeKinds(null)).toEqual([]);
    expect(badgeKinds(undefined)).toEqual([]);
  });
  it("does not trust truthy-but-not-true values from a response", () => {
    const m = parsePublicMeta({
      a: { verified: "true", sensei: 1, diamond: "yes", photo: 5 },
      b: { verified: true },
      c: { diamond: true, sensei: true, photo: "https://lh3.googleusercontent.com/a/x=s96-c" },
      d: null,
      e: "x",
      f: { photo: "http://insecure.example/x.png" },
    });
    expect(badgeKinds(m.get("a")?.badges)).toEqual(["free"]);
    expect(m.get("a")?.photo).toBeNull();
    expect(badgeKinds(m.get("b")?.badges)).toEqual(["verified"]);
    expect(badgeKinds(m.get("c")?.badges)).toEqual(["sensei", "diamond"]);
    expect(m.get("c")?.photo).toMatch(/^https:\/\/lh3\.googleusercontent\.com\//);
    expect(m.get("f")?.photo).toBeNull();
    expect(m.has("d") || m.has("e")).toBe(false);
  });
  it("tolerates malformed payloads", () => {
    for (const bad of [null, undefined, 5, "x", [], [{ verified: true }]])
      expect(parsePublicMeta(bad).size).toBe(0);
  });
  it("uses the labels the product asked for", () => {
    expect(BADGE_META.verified.label).toBe("Akun resmi ENO NIHONGO");
    expect(BADGE_META.sensei.label).toBe("Guru ENO NIHONGO");
    expect(BADGE_META.diamond.label).toBe("Member Premium");
    expect(BADGE_META.free.label).toBe("Akun Free");
    expect(BADGE_META.free.text).toBe("FREE");
  });
});

describe("badge source of truth (server)", () => {
  const v3 = read("supabase/migrations/20261012000000_social_profile_v3.sql");
  const code = (x: string) => x.replace(/--.*$/gm, "");
  const badgesFn = code(v3).slice(
    code(v3).indexOf("function public.social_badges"),
    code(v3).indexOf("function public.social_me"),
  );
  it("derives badges from role/plan, never from username or display name", () => {
    expect(badgesFn).toMatch(/p\.role = 'owner' as verified/);
    expect(badgesFn).toMatch(/p\.role = 'teacher' as sensei/);
    expect(badgesFn).not.toMatch(/username|display_name/i);
  });
  it("counts only an active paid plan as Diamond (same rule as membership)", () => {
    expect(badgesFn).toMatch(
      /p\.plan = 'lifetime' or \(p\.plan = 'premium' and \(p\.premium_until is null or p\.premium_until > now\(\)\)\)/,
    );
    expect(badgesFn).not.toMatch(/p\.role in \(/);
  });
  it("is authenticated-only, bounded, and exposes only three booleans + a vetted photo", () => {
    expect(v3).toMatch(
      /revoke all on function public\.social_badges\(uuid\[\]\) from public, anon/,
    );
    expect(v3).toMatch(
      /grant execute on function public\.social_badges\(uuid\[\]\) to authenticated/,
    );
    expect(badgesFn).toMatch(/auth\.uid\(\) is null then raise exception/);
    expect(badgesFn).toMatch(/cardinality\(p_users\) > 100/);
    expect(badgesFn).toMatch(/security definer/);
    expect(badgesFn).toMatch(/set search_path = ''/);
    expect(badgesFn).toMatch(/public\.social_safe_photo\(p\.avatar_url\)/);
    expect(badgesFn).not.toMatch(/email|premium_until,|'role'|'plan'|\bp\.id::text,\s*'/);
  });
  it("only forwards photos from Google or this project's avatars bucket", () => {
    expect(v3).toMatch(/googleusercontent\\\.com/);
    expect(v3).toMatch(/supabase\\\.co\/storage\/v1\/object\/public\/avatars\//);
    expect(v3).toMatch(
      /revoke all on function public\.social_safe_photo\(text\) from public, anon, authenticated/,
    );
  });
  it("is additive: no policy/RLS change, no destructive statement", () => {
    expect(code(v3)).not.toMatch(
      /drop |policy|delete from|truncate|insert into public\.profiles|update public\.profiles/i,
    );
    expect(code(v3)).toMatch(/add column if not exists bio text/);
    expect(code(v3)).toMatch(
      /add column if not exists sound_enabled boolean not null default true/,
    );
  });
  it("bio constraint: optional, <=160, plain, no whitespace-only", () => {
    expect(v3).toMatch(/profiles_bio_check/);
    expect(v3).toMatch(/char_length\(bio\) between 1 and 160/);
    expect(v3).toMatch(/bio ~ '\\S'/);
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
    expect(src).toMatch(/w-\[min\(84vw,20\.5rem\)\]/);
    expect(src).toMatch(/md:w-\[23rem\]/);
    expect(src).toMatch(/max-h-\[min\(40rem,calc\(100dvh-2rem\)\)\]/);
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
