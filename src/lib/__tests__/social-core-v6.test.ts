import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { dock } from "../social/dock-state";
import { openChatLink, parseChatLink } from "../social/chat-links";
import { splitMentions } from "../social/mentions";

const root = process.cwd();
const read = (f: string) => readFileSync(join(root, f), "utf8");
const sql = read("supabase/migrations/20261015000000_social_core_v6.sql");
const code = sql.replace(/--.*$/gm, "");
const fn = (name: string) => {
  const i = code.indexOf(`function public.${name}(`);
  expect(i, name).toBeGreaterThan(-1);
  const j = code.indexOf("\n$$;", i);
  return code.slice(i, j === -1 ? undefined : j);
};

describe("v6 migration: Premium source of truth", () => {
  it("is_premium honours expiry, keeps role entitlement (Guru) and stays self-only", () => {
    const f = fn("is_premium");
    expect(f).toMatch(/p\.role in \('owner', 'admin', 'editor', 'teacher'\)/);
    expect(f).toMatch(
      /p\.plan = 'premium' and \(p\.premium_until is null or p\.premium_until > now\(\)\)/,
    );
    expect(f).toMatch(/p_user_id is distinct from auth\.uid\(\) then false/);
    expect(f).not.toMatch(/security definer/i);
    // semantik yang sama dengan jalur entitlement yang dipakai aplikasi
    expect(f).toMatch(/p\.plan = 'lifetime'/);
  });
  it("does not touch payments, subscriptions or premium_until values", () => {
    expect(code).not.toMatch(/update public\.profiles/i);
    expect(code).not.toMatch(/insert into public\.(subscriptions|payments|transactions|orders)/i);
  });
});

describe("v6 migration: mention notifications", () => {
  const f = () => fn("global_send_message");
  it("only whole usernames, max 5 unique targets, never the sender", () => {
    expect(f()).toMatch(/\(\^\|\[\\s\(\]\)@\(\[a-z0-9_\]\{3,20\}\)\(\?!\[a-z0-9_@\]\)/);
    expect(f()).toMatch(/limit 5/);
    expect(f()).toMatch(/v_target = v_uid/);
  });
  it("is block-aware, account-state-aware and deduplicated", () => {
    expect(f()).toMatch(/social_blocked_between\(v_uid, v_target\)/);
    expect(f()).toMatch(/pr\.suspended_at is null/);
    expect(f()).toMatch(/kind = 'mention' and read_at is null and body = v_note/);
  });
  it("notification carries no message text and a stable source link", () => {
    expect(f()).toMatch(/menyebutmu di Global Chat\./);
    expect(f()).toMatch(/'chat:global:' \|\| v_id::text/);
    expect(f()).not.toMatch(/v_note := [^;]*v_body/);
  });
  it("keeps every v5 guard (writer, empty, length, moderation, link, flood, slow mode)", () => {
    for (const re of [
      /social_assert_writer\(\)/,
      /social_effectively_empty/,
      /char_length\(v_body\) > 500/,
      /social_assert_clean/,
      /social_assert_link_allowed/,
      /'rate_limited'/,
      /'slow_mode'/,
      /'duplicate_message'/,
    ])
      expect(f()).toMatch(re);
  });
});

describe("v6 migration: stale notifications", () => {
  it("resolver only touches friend_request notifications of that pair and strips the action", () => {
    const f = fn("social_resolve_request_notifications");
    expect(f).toMatch(/n\.kind = 'friend_request'/);
    expect(f).toMatch(/action_url = null/);
    expect(f).toMatch(/read_at = coalesce\(n\.read_at, now\(\)\)/);
    expect(f).not.toMatch(/delete from/i);
    expect(code).toMatch(
      /revoke all on function public\.social_resolve_request_notifications\(uuid, uuid\) from public, anon, authenticated/,
    );
  });
  it("cancel, reject, accept, mutual-accept and block resolve the notification; hide clears DM ones", () => {
    expect(fn("friend_request_cancel")).toMatch(/social_resolve_request_notifications/);
    const r = fn("friend_request_respond");
    expect((r.match(/social_resolve_request_notifications/g) ?? []).length).toBe(2);
    expect(fn("social_block")).toMatch(/social_resolve_request_notifications\(p_user, v_uid\)/);
    expect(code).toMatch(/perform public\.social_resolve_request_notifications\(v_uid, v_target\)/);
    expect(fn("dm_conversation_hide")).toMatch(
      /kind = 'dm' and read_at is null and action_url = 'chat:dm:' \|\| p_with::text/,
    );
  });
  it("protections from v5 are preserved in the rewritten functions", () => {
    expect(fn("social_block")).toMatch(
      /social_is_staff\(p_user\) then raise exception 'protected_target'/,
    );
    expect(fn("friend_request_respond")).toMatch(/social_blocked_between\(v_uid, p_user\)/);
    expect(fn("dm_conversation_hide")).not.toMatch(/delete from/i);
  });
});

describe("v6 migration: official display names, retention", () => {
  it("display name guard fires only on UPDATE by non-staff (signup never fails)", () => {
    expect(code).toMatch(/before update of display_name on public\.profiles/);
    expect(code).not.toMatch(/before insert[^;]*profiles/i);
    const f = fn("profiles_guard_official_name");
    expect(f).toMatch(/old\.role not in \('owner', 'admin'\)/);
    expect(f).toMatch(/social_official_lookalike\(new\.display_name\)/);
  });
  it("retention prunes only the rate-limit log, is not client-callable and is scheduled once via pg_cron", () => {
    const f = fn("social_prune_logs");
    expect(f).toMatch(
      /delete from public\.social_request_log where created_at < now\(\) - interval '30 days'/,
    );
    expect((f.match(/delete from/gi) ?? []).length).toBe(1);
    expect(code).toMatch(
      /revoke all on function public\.social_prune_logs\(\) from public, anon, authenticated/,
    );
    expect(code).toMatch(
      /not exists \(select 1 from cron\.job where jobname = 'social-prune-logs'\)/,
    );
    expect(code).not.toMatch(
      /delete from public\.(dm_messages|global_messages|content_reports|admin_audit_log|social_username_history|user_notifications)/i,
    );
  });
  it("migration is additive: no drop/truncate/alter-table-drop", () => {
    expect(code).not.toMatch(/\bdrop (table|column|function|policy|index)\b|\btruncate\b/i);
  });
});

describe("v6 client", () => {
  const id = "5845d72b-43fc-482f-a713-f4b411430b29";
  it("parses mention notification links and rejects malformed ones", () => {
    expect(parseChatLink(`chat:global:${id}`)).toEqual({ kind: "global", messageId: id });
    expect(parseChatLink("chat:global")).toBeNull();
    expect(parseChatLink("chat:global:not-a-uuid")).toBeNull();
  });
  it("opens Global Chat for a mention link (safe even if the message was deleted)", async () => {
    await openChatLink({ kind: "global", messageId: id });
    expect(dock.get().open).toBe(true);
    expect(dock.get().tab).toBe("global");
  });
  it("mention text resolution uses the exact-username RPC only (no search endpoint)", () => {
    const m = read("src/components/social/MessageList.tsx");
    expect(m).toMatch(/socialApi\.userByUsername\(username\)/);
    expect(m).toMatch(/if \(r\?\.user_id\) profileCard\.open\(r\.user_id\)/);
    expect(m).toMatch(/Pengguna tidak ditemukan\./);
    expect(splitMentions("@free_budi ok")[0]).toEqual({ type: "mention", username: "free_budi" });
  });
  it("the integration flow covers the v6 scenarios", () => {
    const t = read("supabase/tests/social_core_flow.sql");
    for (const k of [
      "mention_dedupe",
      "mention_blocked_none",
      "mention_suspended_none",
      "cancel_resolves_notification",
      "reject_resolves_notification",
      "accept_resolves_notification",
      "normal_expired_free",
      "guru_expired_is_premium",
      "revoked_active_is_premium",
      "revoked_expired_free",
      "evidence_survives_delete",
      "reports_table_not_directly_readable",
      "admin_cannot_browse_dm",
      "display_name_lookalike_rejected",
      "prune_removed_old",
      "privileged_rpc_not_anon",
    ])
      expect(t, k).toContain(k);
  });
});
