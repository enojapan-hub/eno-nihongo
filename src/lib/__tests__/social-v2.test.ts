import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { openChatLink, parseChatLink } from "../social/chat-links";
import { profileCard } from "../social/profile-card-state";
import {
  formatCooldownDate,
  socialErrorCode,
  socialErrorMessage,
} from "../social/social-validation";

const root = process.cwd();
const read = (f: string) => readFileSync(join(root, f), "utf8");
const sql = read("supabase/migrations/20261010000000_social_chat_v2.sql");

describe("v2 user-facing messages", () => {
  it("maps the new server error codes", () => {
    expect(socialErrorMessage(new Error("message_rejected"))).toBe(
      "Pesan tidak dapat dikirim karena mengandung kata yang tidak diizinkan.",
    );
    for (const c of [
      "username_cooldown",
      "username_unchanged",
      "username_not_allowed",
      "requests_disabled",
    ])
      expect(socialErrorCode(new Error(c))).toBe(c);
  });
  it("formats the cooldown date for people", () => {
    expect(formatCooldownDate("2026-11-12T10:00:00Z")).toMatch(/12 November 2026/);
    expect(formatCooldownDate(null)).toBeNull();
    expect(formatCooldownDate("bukan tanggal")).toBeNull();
  });
});

describe("notification deep links", () => {
  const id = "5845d72b-43fc-482f-a713-f4b411430b29";
  it("parses only well-formed chat links", () => {
    expect(parseChatLink("chat:friends")).toEqual({ kind: "friends" });
    expect(parseChatLink(`chat:dm:${id}`)).toEqual({ kind: "dm", userId: id });
    expect(parseChatLink(`chat:profile:${id}`)).toEqual({ kind: "profile", userId: id });
    for (const bad of [
      null,
      undefined,
      "",
      "/dashboard",
      "chat:dm:not-a-uuid",
      "chat:other",
      "chat:dm",
    ])
      expect(parseChatLink(bad)).toBeNull();
  });
  it("opens the profile card for a profile link without navigating", async () => {
    profileCard.close();
    await openChatLink({ kind: "profile", userId: id });
    expect(profileCard.get()?.userId).toBe(id);
    profileCard.close();
    expect(profileCard.get()).toBeNull();
  });
});

describe("single profile card state", () => {
  it("keeps only public context passed by the caller", () => {
    profileCard.open("u1", { rank: 3, points: 120, pointsLabel: "Poin", level: "N4" });
    expect(profileCard.get()).toEqual({
      userId: "u1",
      context: { rank: 3, points: 120, pointsLabel: "Poin", level: "N4" },
    });
    profileCard.open("u2");
    expect(profileCard.get()).toEqual({ userId: "u2", context: null });
    profileCard.close();
  });
});

describe("social v2 migration contract", () => {
  const TABLES = [
    "social_settings",
    "social_username_history",
    "social_moderation_terms",
    "social_request_log",
  ];
  it("keeps new tables internal: RLS on, no client grants or policies", () => {
    for (const t of TABLES) {
      expect(sql).toMatch(new RegExp(`alter table public\\.${t} enable row level security`));
      expect(sql).toMatch(
        new RegExp(`revoke all on table public\\.${t} from public, anon, authenticated`),
      );
      expect(sql).not.toMatch(new RegExp(`grant[^;]*on (table )?public\\.${t}`, "i"));
    }
    expect(sql).not.toMatch(/create policy/i);
    expect(sql).not.toMatch(/to anon/i);
    expect(sql).not.toMatch(/service_role/i);
  });
  it("is additive and non-destructive", () => {
    expect(sql).not.toMatch(
      /\b(drop\s+(table|function|column|policy)|truncate|delete\s+from|alter\s+table[^;]*drop)\b/i,
    );
    expect(sql).not.toMatch(/disable row level security/i);
  });
  it("enforces the 30-day username cooldown on the server and never counts the first username", () => {
    expect(sql).toMatch(/username_changed_at \+ interval '30 days'/);
    expect(sql).toMatch(/raise exception 'username_cooldown'/);
    const setUsername = sql.slice(
      sql.indexOf("function public.social_set_username"),
      sql.indexOf("function public.social_change_username"),
    );
    expect(setUsername).not.toMatch(/username_changed_at/);
    expect(sql).toMatch(/for update/);
    expect(sql).toMatch(/insert into public\.social_username_history/);
  });
  it("filters every user-message path server-side before inserting", () => {
    for (const fn of ["global_send_message", "dm_send"]) {
      const body = sql.slice(sql.indexOf(`function public.${fn}`));
      const upTo = body.slice(0, body.indexOf("$$;", 10));
      expect(upTo).toMatch(/perform public\.social_assert_clean\(v_body\)/);
      expect(upTo.indexOf("social_assert_clean")).toBeLessThan(upTo.indexOf("insert into public."));
    }
    expect(sql).toMatch(/social_assert_clean\(v_name, 'username_not_allowed'\)/);
  });
  it("adds privacy, request anti-spam and reserved-name protection", () => {
    expect(sql).toMatch(/raise exception 'requests_disabled'/);
    expect(sql).toMatch(/social_request_log/);
    expect(sql).toMatch(/'too_many_requests'/);
    expect(sql).toMatch(/'enonihongo'/);
  });
  it("exposes history and term edits to moderators only", () => {
    for (const fn of [
      "social_admin_username_history",
      "social_admin_terms_list",
      "social_admin_term_upsert",
    ]) {
      const body = sql.slice(sql.indexOf(`function public.${fn}`));
      expect(body.slice(0, body.indexOf("$$;", 10))).toMatch(
        /has_permission\('operations\.manage'\)/,
      );
    }
  });
  it("never returns email/uuid/role from the profile card", () => {
    const card = sql.slice(
      sql.indexOf("function public.social_profile_card"),
      sql.indexOf("function public.friend_request_send"),
    );
    expect(card).not.toMatch(/email|'user_id'|'role'|permission/i);
  });
  it("pins search_path and revokes public execute on every v2 function", () => {
    const defs = [...sql.matchAll(/create or replace function public\.([a-z_]+)\(/g)].map(
      (m) => m[1] as string,
    );
    expect(defs.length).toBeGreaterThanOrEqual(15);
    for (const b of sql.split(/create or replace function /).slice(1))
      expect(b).toMatch(/set search_path = ''/);
    for (const name of defs)
      expect(sql).toMatch(new RegExp(`revoke all on function public\\.${name}\\(`));
    for (const name of ["social_assert_clean", "social_normalize_text", "social_username_reserved"])
      expect(sql).not.toMatch(new RegExp(`grant execute on function public\\.${name}`));
  });
});

describe("chat dock UI contract", () => {
  const dockSrc = read("src/components/social/ChatDock.tsx");
  it("uses a ~52px button just above the bottom nav with safe-area handling", () => {
    expect(dockSrc).toMatch(/size-\[52px\]/);
    expect(dockSrc).toMatch(
      /bottom-\[calc\(4\.15rem\+env\(safe-area-inset-bottom\)\+0\.625rem\)\]/,
    );
  });
  it("blurs the page behind, keeps the panel above the backdrop and closes on backdrop tap", () => {
    expect(dockSrc).toMatch(/backdrop-blur/);
    expect(dockSrc).toMatch(/z-\[45\]/);
    expect(dockSrc).toMatch(/z-50/);
    expect(dockSrc).toMatch(/onClick=\{\(\) => dock\.close\(\)\}/);
  });
  it("locks background scroll and always restores it on cleanup", () => {
    expect(dockSrc).toMatch(/body\.style\.overflow = "hidden"/);
    expect(dockSrc).toMatch(/body\.style\.overflow = prev\.bodyOverflow/);
    expect(dockSrc).toMatch(/html\.style\.overflow = prev\.htmlOverflow/);
  });
  it("opens the profile card above the dock with a single blur layer", () => {
    const cardSrc = read("src/components/social/SocialProfileCard.tsx");
    expect(cardSrc).toMatch(/z-\[60\]/);
    expect(cardSrc.match(/backdrop-blur-\[6px\]/g)).toHaveLength(1);
    expect(dockSrc).toMatch(/!cardOpen && "backdrop-blur/);
    expect(cardSrc).not.toMatch(/\.email|uuid/i);
  });
});
