import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { createSoundGate } from "../social/chat-sound";
import { statusFromChannel } from "../social/social-presence";
import {
  formatJoined,
  isPermanentSendError,
  socialErrorMessage,
} from "../social/social-validation";

const root = process.cwd();
const read = (f: string) => readFileSync(join(root, f), "utf8");
const sql = read("supabase/migrations/20261013000000_social_core_v4.sql");
const code = sql.replace(/--.*$/gm, "");
const fn = (name: string) => {
  const i = code.indexOf(`function public.${name}(`);
  expect(i, name).toBeGreaterThan(-1);
  const j = code.indexOf("\n$$;", i);
  const k = code.indexOf("\n$function$;", i);
  return code.slice(i, j === -1 ? k : k === -1 ? j : Math.min(j, k));
};

describe("v4 migration: Owner", () => {
  it("excludes the Owner from both public leaderboards before ranking (by role, not name/email)", () => {
    const lb = fn("get_leaderboard");
    expect(lb).toMatch(
      /where not exists \(select 1 from public\.profiles pr where pr\.id = uls\.user_id and pr\.role = 'owner'\)/,
    );
    expect(lb.indexOf("where not exists")).toBeLessThan(lb.lastIndexOf("limit "));
    const comp = fn("get_competition_leaderboard");
    expect(comp).toMatch(/where p\.role is distinct from 'owner'/);
    // filter ada di CTE agg, sebelum row_number() dihitung
    expect(comp.indexOf("distinct from 'owner'")).toBeLessThan(comp.indexOf("row_number()"));
    for (const f of [lb, comp]) expect(f).not.toMatch(/username|email|display_name\s*=/i);
  });
  it("auto-friends Owner ↔ member server-side, idempotently, respecting block and suspended accounts", () => {
    const befriend = fn("social_owner_befriend");
    expect(befriend).toMatch(/suspended_at is not null or role = 'owner'/);
    expect(befriend).toMatch(/social_blocked_between\(o\.id, p_user\)/);
    expect(befriend).toMatch(
      /on conflict \(user_low, user_high\) do update set status = 'accepted'/,
    );
    expect(befriend).toMatch(/where public\.social_friendships\.status = 'pending'/);
    const backfill = fn("social_backfill_owner_friends");
    for (const k of [
      "eligible",
      "already_friend",
      "created",
      "skipped_blocked",
      "skipped_suspended",
      "failed",
    ])
      expect(backfill).toContain(`'${k}'`);
    const trig = fn("social_profiles_auto_friend");
    expect(trig).toMatch(/exception when others then\s+raise warning/); // signup tidak pernah gagal
    expect(code).toMatch(/after insert on public\.profiles/);
    expect(code).toMatch(/after update of role on public\.profiles/);
  });
  it("blocks removal of the automatic Owner friendship (no unfriend → auto-friend loop)", () => {
    expect(fn("friend_remove")).toMatch(
      /role = 'owner'\) then\s+raise exception 'owner_friendship_locked'/,
    );
  });
});

describe("v4 migration: link ban", () => {
  it("is enforced in BOTH message RPCs and only Owner/Guru are exempt (Premium is not)", () => {
    expect(fn("global_send_message")).toMatch(/social_assert_link_allowed\(v_uid, v_body\)/);
    expect(fn("dm_send_message")).toMatch(/social_assert_link_allowed\(v_uid, v_body\)/);
    const assertFn = fn("social_assert_link_allowed");
    expect(assertFn).toMatch(/role in \('owner', 'teacher'\)/);
    expect(assertFn).not.toMatch(/plan|premium|username/i);
    // link ditolak sebelum INSERT apa pun
    for (const name of ["global_send_message", "dm_send_message"]) {
      const f = fn(name);
      expect(f.indexOf("social_assert_link_allowed")).toBeLessThan(
        f.indexOf("insert into public."),
      );
    }
  });
  it("uses a bounded TLD list (not a naive substring) and normalises disguised dots", () => {
    const f = fn("social_contains_link");
    expect(f).toMatch(/tld constant text := 'com\|net\|org/);
    expect(f).toMatch(/NFKC/);
    expect(f).toMatch(/\(dot\|titik\)/);
    expect(f).toMatch(/https\?\|ftp\|wss\?/);
  });
  it("the old dm_send path cannot bypass the new rules (delegates to dm_send_message)", () => {
    expect(fn("dm_send")).toMatch(
      /select public\.dm_send_message\(p_to, p_body, p_reply_to, null\)/,
    );
  });
});

describe("v4 migration: DM policy, mute, limits, settings", () => {
  it("dm_send_message checks block + policy through ONE function used by the card too", () => {
    expect(fn("dm_send_message")).toMatch(/v_reason := public\.social_dm_allowed\(v_uid, p_to\)/);
    expect(fn("social_profile_card")).toMatch(/social_dm_allowed\(v_uid, p_user\)/);
    const allowed = fn("social_dm_allowed");
    expect(allowed.indexOf("social_blocked_between")).toBeLessThan(allowed.indexOf("dm_policy"));
    for (const c of [
      "blocked",
      "user_unavailable",
      "not_friends",
      "dm_disabled_self",
      "dm_disabled",
      "dm_not_accepted",
    ])
      expect(allowed).toContain(`'${c}'`);
  });
  it("is idempotent per client_id and rate-limits many NEW recipients", () => {
    const f = fn("dm_send_message");
    expect(f).toMatch(/where sender_id = v_uid and client_id = p_client_id/);
    expect(code).toMatch(/create unique index if not exists dm_messages_sender_client_key/);
    expect(f).toMatch(/count\(distinct recipient_id\)[\s\S]*>= 6/);
    expect(f).toMatch(/>= 8[\s\S]*>= 40/); // batas lama dipertahankan
  });
  it("mutes live in an internal table (RLS on, no client grants)", () => {
    expect(code).toMatch(/alter table public\.social_dm_mutes enable row level security/);
    expect(code).toMatch(
      /revoke all on table public\.social_dm_mutes from public, anon, authenticated/,
    );
    expect(fn("dm_conversation_list")).toMatch(/'muted', exists/);
  });
  it("new settings default to visible/friends and validate the DM policy", () => {
    for (const col of ["show_online", "show_country", "show_jlpt", "show_xp"])
      expect(code).toContain(`add column if not exists ${col} boolean not null default true`);
    expect(code).toMatch(/dm_policy text not null default 'friends'/);
    expect(code).toMatch(/dm_policy in \('friends', 'started_by_me', 'none'\)/);
    expect(fn("social_update_settings")).toMatch(/raise exception 'invalid_setting'/);
  });
  it("the card applies privacy on the server and supports a public self-preview", () => {
    const f = fn("social_profile_card");
    expect(f).toMatch(/v_apply := p_user <> v_uid or coalesce\(p_public, false\)/);
    for (const k of ["show_country", "show_xp", "show_jlpt", "show_online"]) expect(f).toContain(k);
    expect(f).toMatch(/'joined', to_char\(v_created at time zone 'UTC', 'YYYY-MM'\)/);
    expect(f).not.toMatch(/email|raw_user_meta_data/i);
    expect(f).not.toMatch(/'joined', v_created[,)]/); // hanya bulan, bukan timestamp
  });
  it("is additive: no drop/truncate/RLS weakening", () => {
    expect(code).not.toMatch(
      /\bdrop\s+(function|table|trigger|policy)|truncate|disable row level security/i,
    );
    expect(code).not.toMatch(/delete from public\.(?!social_dm_mutes)/);
  });
});

describe("v4 client logic", () => {
  it("maps the new server error codes to Indonesian messages", () => {
    expect(socialErrorMessage(new Error("link_not_allowed"))).toBe(
      "Link tidak dapat dikirim melalui chat.",
    );
    expect(socialErrorMessage(new Error("dm_disabled"))).toMatch(/tidak menerima pesan/);
    expect(socialErrorMessage(new Error("owner_friendship_locked"))).toMatch(/otomatis/);
    expect(socialErrorMessage(new Error("user_unavailable"))).toBe("Pengguna tidak tersedia.");
  });
  it("only network/transient errors are retryable; rejections are permanent", () => {
    for (const c of [
      "message_rejected",
      "link_not_allowed",
      "dm_disabled",
      "blocked",
      "not_friends",
      "suspended",
    ])
      expect(isPermanentSendError(new Error(c)), c).toBe(true);
    for (const c of ["rate_limited", "Failed to fetch", "NetworkError", "timeout"])
      expect(isPermanentSendError(new Error(c)), c).toBe(false);
  });
  it("formats the join date as month + year only", () => {
    expect(formatJoined("2026-09")).toBe("Sep 2026");
    expect(formatJoined("2026-05")).toBe("Mei 2026");
    for (const bad of ["", "2026", "2026-13", "2026-09-01", "x"])
      expect(formatJoined(bad)).toBeNull();
  });
  it("muted conversations never play a sound but are still marked as processed", () => {
    const g = createSoundGate({ now: () => 0 });
    const m = { id: "1", senderId: "o", meId: "me", enabled: true };
    expect(g.shouldPlay({ ...m, muted: true })).toBe(false);
    expect(g.shouldPlay(m)).toBe(false); // id yang sama tidak bunyi belakangan
    expect(g.shouldPlay({ ...m, id: "2" })).toBe(true);
  });
  it("reports reconnecting honestly from the channel status", () => {
    expect(statusFromChannel("SUBSCRIBED")).toBe("online");
    for (const s of ["CHANNEL_ERROR", "TIMED_OUT", "CLOSED"])
      expect(statusFromChannel(s)).toBe("reconnecting");
    expect(statusFromChannel("JOINING")).toBeNull();
  });
});

describe("v4 UI contract", () => {
  const card = read("src/components/social/SocialProfileCard.tsx");
  it("Owner card: no rank, no Hapus Pertemanan, 'Akun Resmi' instead of join date", () => {
    expect(card).toMatch(/ctx\?\.rank !== undefined && !c\?\.official/);
    expect(card).toMatch(/caps\?\.can_unfriend/);
    expect(card).toMatch(/Akun Resmi/);
    expect(card).toMatch(/Bergabung \$\{joined\}/);
  });
  it("hidden fields simply disappear; unavailable users get a safe state without actions", () => {
    expect(card).toMatch(/\{c\.country && \(/);
    expect(card).toMatch(/c\.xp !== null \? getAccountLevel/);
    expect(card).toMatch(/Pengguna tidak tersedia/);
    expect(card).toMatch(/socialErrorCode\(card\.error\) === "user_not_found"/);
    expect(card).toMatch(/c\.relation === "unavailable"/);
  });
  it("accessibility: labelled dialog, busy state, 44px close target, focus handling", () => {
    expect(card).toMatch(/aria-labelledby=\{titleId\}/);
    expect(card).toMatch(/aria-busy=\{card\.isLoading\}/);
    expect(card).toMatch(/size-11/);
    expect(card).toMatch(/dialogRef\.current\?\.focus\(\)/);
    expect(card).toMatch(/trigger\.focus/);
  });
  it("DM errors are shown from the server; Message button mirrors dm_blocked", () => {
    expect(card).toMatch(/disabled=\{!caps\?\.can_message\}/);
    expect(card).toMatch(/socialErrorMessage\(c\.dm_blocked\)/);
  });
  it("report cannot be spammed (disabled after success)", () => {
    expect(card).toMatch(/disabled=\{busy \|\| isReported\}/);
    expect(card).toMatch(/setReported\(uid\)/);
  });
  it("Edit Profil exposes privacy toggles, DM policy and the public preview through the same card", () => {
    const a = read("src/components/social/SocialAccountCard.tsx");
    expect(a).toMatch(/Tampilkan status online/);
    expect(a).toMatch(/Siapa yang dapat mengirim pesan/);
    expect(a).toMatch(/Lihat sebagai pengguna lain/);
    expect(a).toMatch(/\{ preview: true \}/);
    expect(read("src/components/social/SocialProfileCard.tsx")).toMatch(
      /socialApi\.profileCard\(userId as string, preview\)/,
    );
  });
  it("optimistic DM send: client id, failed state with retry, permanent errors keep the input", () => {
    const dm = read("src/components/social/DmPanel.tsx");
    expect(dm).toMatch(/crypto\.randomUUID\(\)/);
    expect(dm).toMatch(/dmSend\(other\.user_id, p\.body, p\.replyTo, p\.clientId\)/);
    expect(dm).toMatch(/isPermanentSendError\(e\)/);
    const list = read("src/components/social/MessageList.tsx");
    expect(list).toMatch(/Gagal dikirim/);
    expect(list).toMatch(/Coba lagi/);
    expect(list).toMatch(/disabled=\{!!m\.status\}/);
  });
  it("mute: toggle in the thread header, indicator in the list, sound honours it without a second listener", () => {
    const dm = read("src/components/social/DmPanel.tsx");
    expect(dm).toMatch(/Matikan suara percakapan/);
    expect(dm).toMatch(/Aktifkan suara percakapan/);
    const dock = read("src/components/social/ChatDock.tsx");
    expect(dock).toMatch(/muted: !!row\.sender_id && mutedRef\.current\.has\(row\.sender_id\)/);
    expect(dock.match(/supabase\s*\.channel\(/g)).toHaveLength(1);
  });
  it("ChatDock: friend-request indicator, honest reconnect banner, presence follows the privacy setting", () => {
    const dock = read("src/components/social/ChatDock.tsx");
    expect(dock).toMatch(/data-testid="friend-request-indicator"/);
    expect(dock).toMatch(/connection === "reconnecting"/);
    expect(dock).toMatch(/usePresenceTracking\(userId, me\?\.show_online !== false\)/);
    const pres = read("src/lib/social/social-presence.ts");
    expect(pres).toMatch(/if \(status === "SUBSCRIBED" && shareRef\.current\)/);
    expect(pres).toMatch(/else void channel\.untrack\(\)/);
  });
  it("friends list never offers removing the Owner friendship", () => {
    expect(read("src/components/social/FriendsPanel.tsx")).toMatch(
      /identity\.badges\.verified\) return null/,
    );
  });
  it("global chat shows a safe identity for vanished accounts", () => {
    const g = read("src/components/social/GlobalChatPanel.tsx");
    expect(g).toMatch(/unavailable: !m\.username/);
    expect(read("src/components/social/MessageList.tsx")).toMatch(/Pengguna tidak tersedia/);
  });
});

describe("core flow integration script", () => {
  const flow = read("supabase/tests/social_core_flow.sql");
  it("runs in one always-rolled-back transaction covering the core invariants", () => {
    expect(flow).toMatch(/raise exception 'FLOW_OK %'/);
    expect(flow).not.toMatch(/\bcommit\b/i);
    for (const step of [
      "owner_autofriend_a",
      "owner_not_in_leaderboard",
      "rank_no_gaps",
      "unfriend_owner_rejected",
      "owner_unread_dm",
      "idempotent",
      "muted_in_list",
      "free_dm_link",
      "rejected_link_rows",
      "link_allowed_owner_teacher",
      "privacy_seen_by_other",
      "preview_public",
      "block_owner_rejected",
      "backfill_idempotent",
      "suspended_global_rejected",
    ])
      expect(flow, step).toContain(step);
  });
});
