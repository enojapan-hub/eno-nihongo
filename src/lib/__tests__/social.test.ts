import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  compareDesc,
  dockHiddenOn,
  mergeMessages,
  olderCursor,
  unreadBadge,
} from "../social/message-merge";
import { avatarFor, AVATARS } from "../social/social-avatar";
import { emitSocialEvent, onSocialEvent, socialListenerCount } from "../social/social-bus";
import {
  displayNameIssue,
  normalizeUsername,
  socialErrorCode,
  socialErrorMessage,
  usernameIssue,
} from "../social/social-validation";

describe("username rules", () => {
  it("normalizes to lowercase", () => {
    expect(normalizeUsername("  Alice_01 ")).toBe("alice_01");
  });
  it("accepts valid usernames", () => {
    for (const u of ["abc", "a_b_c", "user_01", "ABC123", "a".repeat(20)])
      expect(usernameIssue(u)).toBeNull();
  });
  it("rejects invalid usernames", () => {
    for (const u of [
      "",
      "ab",
      "a".repeat(21),
      "bad-name",
      "has space",
      "dot.name",
      "日本語",
      "me@mail",
    ])
      expect(usernameIssue(u)).toBe("invalid_username");
  });
  it("rejects display names that look like emails or are too long", () => {
    expect(displayNameIssue("")).toBeNull();
    expect(displayNameIssue("Sakura")).toBeNull();
    expect(displayNameIssue("me@mail.com")).toBe("invalid_display_name");
    expect(displayNameIssue("x".repeat(41))).toBe("invalid_display_name");
  });
});

describe("error mapping", () => {
  it("maps database error codes to learner messages", () => {
    expect(socialErrorCode(new Error("username_taken"))).toBe("username_taken");
    expect(socialErrorMessage(new Error("username_taken"))).toMatch(/sudah dipakai/);
    expect(socialErrorMessage(new Error("rate_limited"))).toMatch(/Tunggu/);
  });
  it("never leaks raw database errors", () => {
    expect(socialErrorMessage(new Error('permission denied for table "x"'))).toBe(
      "Terjadi kesalahan. Coba lagi.",
    );
    expect(socialErrorMessage(null)).toBe("Terjadi kesalahan. Coba lagi.");
  });
});

describe("message merging", () => {
  const m = (id: string, at: string, extra = {}) => ({ id, created_at: at, ...extra });
  it("sorts newest first with id as tie-breaker", () => {
    const out = mergeMessages(
      [m("a", "2026-01-01T10:00:00Z")],
      [m("b", "2026-01-01T10:00:00Z"), m("c", "2026-01-01T11:00:00Z")],
    );
    expect(out.map((x) => x.id)).toEqual(["c", "b", "a"]);
    expect(compareDesc(m("a", "t1"), m("a", "t1"))).toBe(0);
  });
  it("de-duplicates and lets the incoming copy win (soft delete)", () => {
    const out = mergeMessages(
      [m("a", "2026-01-01T10:00:00Z", { deleted: false })],
      [m("a", "2026-01-01T10:00:00Z", { deleted: true })],
    );
    expect(out).toHaveLength(1);
    expect((out[0] as unknown as { deleted: boolean }).deleted).toBe(true);
  });
  it("returns the oldest loaded message as the next cursor", () => {
    const list = mergeMessages(
      [],
      [m("a", "2026-01-01T10:00:00Z"), m("b", "2026-01-01T09:00:00Z")],
    );
    expect(olderCursor(list)).toEqual({ at: "2026-01-01T09:00:00Z", id: "b" });
    expect(olderCursor([])).toBeNull();
  });
});

describe("unread badge", () => {
  it("sums global, dm and requests and caps the label", () => {
    expect(unreadBadge(null)).toEqual({ total: 0, label: null });
    expect(unreadBadge({ global: 0, dm: 0, requests: 0 }).label).toBeNull();
    expect(unreadBadge({ global: 2, dm: 3, requests: 1 })).toEqual({ total: 6, label: "6" });
    expect(unreadBadge({ global: 99, dm: 99, requests: 5 }).label).toBe("99+");
    expect(unreadBadge({ global: -4, dm: 1, requests: 0 }).total).toBe(1);
  });
});

describe("dock visibility", () => {
  it("is hidden on public/auth/payment and focused exam pages", () => {
    for (const p of [
      "/",
      "/auth",
      "/reset-password",
      "/onboarding",
      "/checkout",
      "/pembayaran/sukses",
      "/simulasi-bagian/N5/vocab",
      "/eno-exam/abc",
      "/kelas/1/quiz/2",
      "/guru-kelas/1/quiz/2",
    ])
      expect(dockHiddenOn(p)).toBe(true);
  });
  it("is visible on normal learning pages", () => {
    for (const p of [
      "/dashboard",
      "/belajar",
      "/kanji",
      "/kelas",
      "/kelas/1",
      "/pengaturan",
      "/notifikasi",
    ])
      expect(dockHiddenOn(p)).toBe(false);
  });
});

describe("avatar foundation", () => {
  it("falls back to the default avatar for unknown ids", () => {
    expect(AVATARS.length).toBeGreaterThanOrEqual(1);
    expect(avatarFor(0).id).toBe(0);
    expect(avatarFor(42).id).toBe(0);
    expect(avatarFor(null).id).toBe(0);
  });
});

describe("realtime bus", () => {
  it("delivers events and removes listeners on cleanup (no leak)", () => {
    const seen: string[] = [];
    const before = socialListenerCount();
    const off = onSocialEvent((e) => seen.push(e.type));
    expect(socialListenerCount()).toBe(before + 1);
    emitSocialEvent({ type: "friends" });
    emitSocialEvent({ type: "global", kind: "insert", id: "x" });
    off();
    emitSocialEvent({ type: "friends" });
    expect(seen).toEqual(["friends", "global"]);
    expect(socialListenerCount()).toBe(before);
  });
});

// --- Kontrak migration + kode klien (offline, sumber kebenaran = migration di repo) ---
const root = process.cwd();
const sql = readFileSync(
  join(root, "supabase/migrations/20261009000000_social_chat_v1.sql"),
  "utf8",
);
const TABLES = [
  "social_profiles",
  "social_global_read",
  "social_blocks",
  "social_friendships",
  "global_messages",
  "dm_conversations",
  "dm_messages",
];

function sources(dir = join(root, "src")): { file: string; text: string }[] {
  const out: { file: string; text: string }[] = [];
  for (const e of readdirSync(dir)) {
    const full = join(dir, e);
    if (statSync(full).isDirectory()) {
      if (e === "__tests__") continue;
      out.push(...sources(full));
    } else if (/\.(ts|tsx)$/.test(e) && e !== "types.ts") {
      out.push({ file: full.slice(root.length + 1), text: readFileSync(full, "utf8") });
    }
  }
  return out;
}

describe("social migration contract", () => {
  it("enables RLS and revokes everything from clients on every table", () => {
    for (const t of TABLES) {
      expect(sql).toMatch(new RegExp(`alter table public\\.${t} enable row level security`));
      expect(sql).toMatch(
        new RegExp(`revoke all on table public\\.${t} from public, anon, authenticated`),
      );
      expect(sql).toMatch(new RegExp(`grant select on public\\.${t} to authenticated`));
    }
  });

  it("gives clients SELECT only (writes only via RPC)", () => {
    expect(sql).not.toMatch(
      /grant\s+(insert|update|delete|all|truncate)[^;]*to\s+[^;]*(authenticated|anon)/i,
    );
    expect(sql).not.toMatch(/create policy[^;]*for\s+(insert|update|delete|all)/i);
    expect(sql).not.toMatch(/to anon/i);
    expect(sql).not.toMatch(/service_role/i);
  });

  it("guarantees uniqueness and limits in the database", () => {
    expect(sql).toMatch(
      /create unique index if not exists social_profiles_username_key on public\.social_profiles \(username\)/,
    );
    expect(sql).toMatch(/username ~ '\^\[a-z0-9_\]\{3,20\}\$'/);
    expect(sql).toMatch(/constraint social_friendships_pair unique \(user_low, user_high\)/);
    expect(sql).toMatch(/constraint social_friendships_order check \(user_low < user_high\)/);
    expect(sql).toMatch(/char_length\(body\) <= 500/);
    expect(sql).toMatch(/char_length\(body\) <= 1000/);
    expect(sql).toMatch(/constraint social_blocks_not_self/);
  });

  it("defines every function with a pinned search_path and without public/anon execute", () => {
    const defs = [...sql.matchAll(/create or replace function public\.([a-z_]+)\(/g)].map(
      (m) => m[1] as string,
    );
    expect(defs.length).toBeGreaterThanOrEqual(25);
    const bodies = sql.split(/create or replace function /).slice(1);
    for (const b of bodies) expect(b).toMatch(/set search_path = ''/);
    for (const name of defs) {
      expect(sql).toMatch(new RegExp(`revoke all on function public\\.${name}\\(`));
    }
    // fungsi internal tidak diberikan ke klien
    for (const name of [
      "social_assert_member",
      "social_blocked_between",
      "social_drop_pending",
      "social_end_friendship",
    ])
      expect(sql).not.toMatch(new RegExp(`grant execute on function public\\.${name}`));
  });

  it("never trusts client-supplied identity: no sender/user id parameters on write RPCs", () => {
    for (const m of sql.matchAll(
      /create or replace function public\.(global_send_message|dm_send|global_delete_message|dm_delete_message)\(([^)]*)\)/g,
    ))
      expect(m[2]).not.toMatch(/p_sender|p_user_id|p_from/);
    expect(sql).toMatch(/v_uid uuid := public\.social_assert_member\(\)/);
  });

  it("reuses the existing role system for moderation", () => {
    expect(sql).toMatch(/has_permission\('operations\.manage'\)/);
    expect(sql).not.toMatch(/create table[^;]*role/i);
    expect(sql).toMatch(/insert into public\.content_reports/);
  });

  it("is additive: no DROP/TRUNCATE and deletes only touch friendship/block rows", () => {
    expect(sql).not.toMatch(/\b(drop\s+table|drop\s+function|drop\s+column|truncate)\b/i);
    expect(sql).not.toMatch(/disable row level security/i);
    for (const m of sql.matchAll(/delete from public\.([a-z_]+)/g))
      expect(["social_friendships", "social_blocks"]).toContain(m[1]);
  });

  it("adds only the three social tables to Realtime", () => {
    expect(sql).toMatch(/array\['global_messages', 'dm_messages', 'social_friendships'\]/);
  });
});

describe("social client contract", () => {
  const files = sources();
  const api = files.find((f) => f.file.endsWith("social/social-api.ts"))?.text ?? "";

  it("only calls RPCs that the migration defines", () => {
    const called = [...api.matchAll(/rpc<[^>]*(?:<[^>]*>)?[^>]*>\("([a-z_]+)"/g)].map(
      (m) => m[1] as string,
    );
    expect(called.length).toBeGreaterThanOrEqual(20);
    for (const name of called)
      expect(sql, name).toMatch(new RegExp(`create or replace function public\\.${name}\\(`));
  });

  it("never writes social tables directly from the client", () => {
    const offenders: string[] = [];
    for (const { file, text } of files) {
      if (file.includes("integrations/supabase")) continue;
      for (const t of TABLES) {
        const re = new RegExp(
          `\\.from\\(["']${t}["'][^)]*\\)\\s*\\.(insert|update|upsert|delete)`,
          "g",
        );
        if (re.test(text)) offenders.push(`${file}:${t}`);
      }
    }
    expect(offenders).toEqual([]);
  });

  it("does not use the service role or expose email in social UI code", () => {
    for (const { file, text } of files) {
      if (!/components\/social|lib\/social/.test(file)) continue;
      expect(text, file).not.toMatch(/service_role|SERVICE_ROLE/);
      expect(text, file).not.toMatch(/\.email\b/);
    }
  });

  it("has exactly one Realtime channel creation (no duplicate subscriptions)", () => {
    const channels = files.filter((f) => /\.channel\(/.test(f.text)).map((f) => f.file);
    expect(channels).toEqual(["src/components/social/ChatDock.tsx"]);
    const dock = files.find((f) => f.file.endsWith("social/ChatDock.tsx"))?.text ?? "";
    expect(dock).toMatch(/removeChannel/);
  });
});
