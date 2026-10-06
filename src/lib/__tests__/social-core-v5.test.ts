import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { canEditByAge, splitMentions } from "../social/mentions";
import { TIER_FRAME, TIER_LABEL, cardTier, resolveCapabilities } from "../social/card-role";
import { badgeKinds, parsePublicMeta } from "../social/social-badges";
import { getDraft, resetDrafts, setDraft } from "../social/chat-drafts";
import {
  isEffectivelyEmpty,
  socialErrorMessage,
  usernameHint,
  isPermanentSendError,
} from "../social/social-validation";
import type { ProfileCardData } from "../social/social-types";

const root = process.cwd();
const read = (f: string) => readFileSync(join(root, f), "utf8");
const sql = read("supabase/migrations/20261014000000_social_core_v5.sql");
const code = sql.replace(/--.*$/gm, "");
const fn = (name: string) => {
  const i = code.indexOf(`function public.${name}(`);
  expect(i, name).toBeGreaterThan(-1);
  const j = code.indexOf("\n$$;", i);
  return code.slice(i, j === -1 ? undefined : j);
};

const card = (o: Partial<ProfileCardData>): ProfileCardData => ({
  has_username: true,
  username: "x",
  display_name: null,
  avatar_id: 0,
  photo: null,
  bio: null,
  country: null,
  xp: 10,
  level: "N5",
  official: false,
  show_online: true,
  friends: 0,
  joined: "2026-10",
  dm_blocked: null,
  relation: "none",
  viewer_has_username: true,
  can_request: true,
  ...o,
});

describe("v5 migration: Owner/Admin protection (server-side, trusted role)", () => {
  it("staff = role owner/admin from profiles, never username/email", () => {
    const f = fn("social_is_staff");
    expect(f).toMatch(/role in \('owner', 'admin'\)/);
    expect(f).not.toMatch(/username|email|display_name/);
  });
  it("block, and every report path, reject staff targets", () => {
    expect(fn("social_block")).toMatch(
      /social_is_staff\(p_user\) then raise exception 'protected_target'/,
    );
    expect(fn("social_report_submit")).toMatch(
      /social_is_staff\(v_sender\) then raise exception 'protected_target'/,
    );
    expect(fn("social_report_user")).toMatch(/social_report_submit\('user'/);
    expect(fn("social_report_message")).toMatch(/social_report_submit\(p_scope/);
  });
  it("report categories are validated and the evidence snapshot is stored with the report", () => {
    const f = fn("social_report_submit");
    expect(f).toMatch(/'spam', 'harassment', 'inappropriate', 'other'/);
    expect(f).toMatch(/left\(v_body, 500\)/);
    expect(f).toMatch(/chat_category, target_user_id/);
  });
  it("internal helpers are not callable by clients", () => {
    for (const n of [
      "social_is_staff",
      "social_is_owner",
      "social_assert_writer",
      "social_assert_moderator",
    ])
      expect(code, n).toMatch(
        new RegExp(
          `revoke all on function public\\.${n}\\([^)]*\\) from public, anon, authenticated`,
        ),
      );
  });
});

describe("v5 migration: Owner unrestricted DM", () => {
  const f = () => fn("social_dm_allowed");
  it("Owner bypasses friendship/policy only AFTER account-state validation; Admin gets no bypass", () => {
    const body = f();
    expect(body.indexOf("'user_unavailable'")).toBeLessThan(
      body.indexOf("social_is_owner(p_from)"),
    );
    expect(body.indexOf("social_is_owner(p_from)")).toBeLessThan(body.indexOf("'not_friends'"));
    expect(body).not.toMatch(/role = 'admin'|social_is_staff/);
  });
  it("send keeps validation, link policy, idempotency and flood rules for everyone", () => {
    const s = fn("dm_send_message");
    for (const re of [
      /social_assert_writer\(\)/,
      /social_effectively_empty/,
      /char_length\(v_body\) > 1000/,
      /social_assert_clean/,
      /social_assert_link_allowed/,
      /client_id = p_client_id/,
      /'duplicate_message'/,
      /'rate_limited'/,
    ])
      expect(s).toMatch(re);
  });
});

describe("v5 migration: capabilities, premium, username", () => {
  it("profile card returns server capabilities and role/premium; owner has no rank data", () => {
    const f = fn("social_profile_card");
    expect(f).toMatch(/'capabilities', jsonb_build_object/);
    for (const k of ["can_message", "can_friend", "can_unfriend", "can_block", "can_report"])
      expect(f).toContain(`'${k}'`);
    expect(f).toMatch(/'role', case when v_role in \('owner', 'admin', 'teacher'\)/);
    expect(f).toMatch(/v_role = 'teacher' or v_plan = 'lifetime'/);
  });
  it("Guru is effective Premium in the identity RPC without any payment write", () => {
    const f = fn("social_badges");
    expect(f).toMatch(/p\.role = 'teacher' or p\.plan = 'lifetime'/);
    expect(code).not.toMatch(/insert into public\.(subscriptions|payments|transactions|orders)/i);
  });
  it("initial username is not subject to cooldown; later change is; lookalikes rejected for non-staff", () => {
    const set = fn("social_set_username");
    expect(set).not.toMatch(/username_cooldown|username_changed_at/);
    expect(set).toMatch(/social_official_lookalike/);
    expect(set).toMatch(/\^\[a-z0-9_\]\{3,20\}\$/);
    expect(fn("social_change_username")).toMatch(/username_cooldown/);
  });
  it("lookalike detection maps Unicode confusables and leetspeak", () => {
    const f = fn("social_official_lookalike");
    expect(f).toMatch(/translate\(/);
    expect(f).toMatch(/enonihongo/);
    expect(f).toMatch(/'admin'.*'owner'/s);
  });
});

describe("v5 migration: per-user conversation delete", () => {
  it("only touches the caller's own hidden state and read marker; no message/conversation deletes", () => {
    const f = fn("dm_conversation_hide");
    expect(f).toMatch(/social_assert_member\(\)/);
    expect(f).toMatch(
      /insert into public\.dm_conversation_hidden \(user_id, conversation_id, hidden_at\) values \(v_uid/,
    );
    expect(f).not.toMatch(/delete from/i);
    expect(code).not.toMatch(/delete from public\.(dm_messages|dm_conversations)/i);
    expect(code).not.toMatch(/\bdrop table\b|\btruncate\b/i);
  });
  it("list/history only show messages after hidden_at; new messages restore without extra writes", () => {
    expect(fn("dm_conversation_list")).toMatch(/m\.created_at > coalesce\(h\.hidden_at/);
    expect(fn("dm_history")).toMatch(/d\.created_at > coalesce\(h\.hidden_at/);
  });
  it("hidden table: RLS on, own-row select policy only, no client writes", () => {
    expect(code).toMatch(/alter table public\.dm_conversation_hidden enable row level security/);
    expect(code).toMatch(/for select to authenticated using \(user_id = auth\.uid\(\)\)/);
    expect(code).toMatch(/grant select on public\.dm_conversation_hidden to authenticated/);
    expect(code).not.toMatch(/grant (insert|update|delete|all)[^;]*dm_conversation_hidden/i);
  });
});

describe("v5 migration: global chat, moderation, audit", () => {
  it("slow mode is server enforced (staff exempt) and limited to Off/5/10/30", () => {
    expect(fn("global_send_message")).toMatch(/not public\.social_is_staff\(v_uid\)/);
    expect(fn("global_send_message")).toMatch(/raise exception 'slow_mode'/);
    expect(code).toMatch(/slow_mode_seconds in \(0, 5, 10, 30\)/);
    expect(fn("global_set_slow_mode")).toMatch(/social_assert_moderator/);
  });
  it("single pinned announcement via a one-row config table", () => {
    expect(code).toMatch(/id smallint primary key default 1 check \(id = 1\)/);
    expect(fn("global_set_pin")).toMatch(/social_assert_moderator/);
  });
  it("edit re-validates (empty/length/moderation/link), within 15 minutes, own message only", () => {
    for (const n of ["global_edit_message", "dm_edit_message"]) {
      const f = fn(n);
      for (const re of [
        /social_effectively_empty/,
        /social_assert_clean/,
        /social_assert_link_allowed/,
        /interval '15 minutes'/,
        /sender_id = v_uid/,
        /edited_at = now\(\)/,
      ])
        expect(f, n).toMatch(re);
    }
  });
  it("social suspension is separate from auth ban and blocks writes only", () => {
    expect(fn("social_assert_writer")).toMatch(/social_suspended_at is not null/);
    expect(fn("social_assert_writer")).toMatch(/raise exception 'social_suspended'/);
    expect(fn("social_admin_suspend")).toMatch(/social_assert_moderator/);
    expect(fn("social_admin_suspend")).toMatch(
      /social_is_staff\(p_user\) then raise exception 'protected_target'/,
    );
    expect(fn("social_admin_suspend")).not.toMatch(/update public\.profiles/); // profiles.suspended_at (ban autentikasi) tidak disentuh
    expect(code).toMatch(
      /replace\(d, 'public\.social_assert_member\(\)', 'public\.social_assert_writer\(\)'\)/,
    );
  });
  it("every moderator action writes the audit log", () => {
    for (const n of [
      "social_admin_suspend",
      "social_admin_report_resolve",
      "global_set_slow_mode",
      "global_set_pin",
      "global_delete_message",
    ])
      expect(fn(n), n).toMatch(/insert into public\.admin_audit_log/);
  });
  it("moderation queue returns safe evidence only (bounded), no auth data", () => {
    const f = fn("social_admin_reports");
    expect(f).toMatch(/left\(r\.description, 600\)/);
    expect(f).not.toMatch(/auth\.users|email/);
    expect(f).toMatch(/limit least\(greatest\(coalesce\(p_limit, 50\), 1\), 100\)/);
  });
  it("mention lookup is exact (no autocomplete) and respects blocks", () => {
    const f = fn("social_user_by_username");
    expect(f).toMatch(/username = v_name/);
    expect(f).not.toMatch(/like /i);
    expect(f).toMatch(/social_blocked_between/);
  });
});

describe("v5 client: pure helpers", () => {
  it("tier hierarchy OWNER > ADMIN > SENSEI > PREMIUM > FREE; role beats subscription", () => {
    expect(cardTier(card({ official: true, role: "owner", premium: true }))).toBe("owner");
    expect(cardTier(card({ role: "admin", premium: true }))).toBe("admin");
    expect(cardTier(card({ role: "teacher", premium: true }))).toBe("sensei");
    expect(cardTier(card({ role: null, premium: true }))).toBe("premium");
    expect(cardTier(card({ role: null, premium: false }))).toBe("free");
    expect(cardTier(card({}))).toBe("free");
  });
  it("labels and frames are distinct per role; only Owner has a label with 'AKUN RESMI'", () => {
    expect(TIER_LABEL.owner).toBe("OWNER · AKUN RESMI");
    expect(TIER_LABEL.admin).toBe("ADMIN · TIM ENO NIHONGO");
    expect(TIER_LABEL.sensei).toBe("先生 · PENGAJAR");
    expect(new Set(Object.values(TIER_FRAME)).size).toBe(5);
    expect(TIER_FRAME.owner).toMatch(/amber/);
    expect(TIER_FRAME.admin).toMatch(/red/);
    expect(TIER_FRAME.sensei).toMatch(/indigo/);
  });
  it("capabilities come from the server; the fallback is conservative for official accounts", () => {
    const caps = {
      can_message: true,
      can_friend: false,
      can_unfriend: false,
      can_block: false,
      can_report: false,
    };
    expect(resolveCapabilities(card({ capabilities: caps }))).toEqual(caps);
    const fb = resolveCapabilities(card({ official: true, relation: "friend" }));
    expect(fb.can_unfriend || fb.can_block || fb.can_report).toBe(false);
  });
  it("badges: admin shows Admin only; Guru shows Sensei + Diamond when server says premium", () => {
    expect(badgeKinds({ verified: false, admin: true, sensei: false, diamond: true })).toEqual([
      "admin",
    ]);
    expect(badgeKinds({ verified: true, admin: false, sensei: false, diamond: true })).toEqual([
      "verified",
    ]);
    expect(badgeKinds({ verified: false, sensei: true, diamond: true })).toEqual([
      "sensei",
      "diamond",
    ]);
    expect(badgeKinds(null)).toEqual([]);
    const m = parsePublicMeta({
      u1: { verified: false, admin: "true", sensei: true, diamond: true },
    });
    expect(m.get("u1")?.badges.admin).toBe(false);
  });
  it("mentions: whole usernames only, not emails or short names; click targets are plain text", () => {
    expect(splitMentions("halo @sakura_01, apa kabar").map((p) => p.type)).toEqual([
      "text",
      "mention",
      "text",
    ]);
    expect(splitMentions("hubungi a@b.com").every((p) => p.type === "text")).toBe(true);
    expect(splitMentions("@ab pendek").every((p) => p.type === "text")).toBe(true);
    expect(splitMentions("@sakura_01").length).toBe(1);
  });
  it("edit window is 15 minutes", () => {
    const now = Date.now();
    expect(canEditByAge(new Date(now - 14 * 60_000).toISOString(), now)).toBe(true);
    expect(canEditByAge(new Date(now - 16 * 60_000).toISOString(), now)).toBe(false);
  });
  it("effective-empty: spaces/zero-width/control are empty, Japanese and emoji are not", () => {
    expect(isEffectivelyEmpty("  ​⁠﻿ \n\t")).toBe(true);
    expect(isEffectivelyEmpty("\u0007")).toBe(true);
    expect(isEffectivelyEmpty("こんにちは")).toBe(false);
    expect(isEffectivelyEmpty("ありがとう！")).toBe(false);
    expect(isEffectivelyEmpty("a")).toBe(false);
  });
  it("username hints are Indonesian and exact", () => {
    expect(usernameHint("")).toBeNull();
    expect(usernameHint("ab")).toBe("Username minimal 3 karakter.");
    expect(usernameHint("Ab c")).toBe("Gunakan huruf kecil, angka, atau garis bawah.");
    expect(usernameHint("sakura_01")).toBeNull();
  });
  it("server error codes map to the required messages", () => {
    expect(socialErrorMessage(new Error("username_taken"))).toBe("Username sudah digunakan.");
    expect(socialErrorMessage(new Error("username_reserved"))).toBe("Username tidak tersedia.");
    expect(socialErrorMessage(new Error("protected_target"))).toMatch(/akun resmi/);
    expect(socialErrorMessage(new Error("slow_mode"))).toMatch(/Mode lambat/);
    expect(isPermanentSendError(new Error("social_suspended"))).toBe(true);
    expect(isPermanentSendError(new Error("slow_mode"))).toBe(true);
  });
  it("drafts live in memory and are cleared on reset (logout/account switch)", () => {
    setDraft("dm:1", "halo");
    expect(getDraft("dm:1")).toBe("halo");
    setDraft("dm:1", "");
    expect(getDraft("dm:1")).toBe("");
    setDraft("global", "x");
    resetDrafts();
    expect(getDraft("global")).toBe("");
  });
});

describe("v5 UI contract", () => {
  const gate = read("src/components/social/UsernameGate.tsx");
  const route = read("src/routes/_authenticated/route.tsx");
  it("mandatory username gate wraps EVERY authenticated route and the dock", () => {
    expect(route).toMatch(/<UsernameGate>\s*<Outlet \/>\s*<ChatDock \/>\s*<\/UsernameGate>/);
    expect(gate).toMatch(/Buat Username/);
    expect(gate).toMatch(/Username digunakan sebagai identitas Anda di ENO NIHONGO\./);
    expect(gate).toMatch(/!me\.data\.has_username/);
    expect(gate).toMatch(/signOutCleanly/);
    expect(gate).toMatch(/aria-label="Username"/);
  });
  it("never auto-generates a username; the only write is the existing RPC", () => {
    expect(gate).toMatch(/socialApi\.setUsername\(normalizeUsername\(username\), null\)/);
    expect(gate).not.toMatch(/crypto\.randomUUID|Math\.random|email|user_metadata|full_name/);
  });
  it("cached identity is per account (query key includes the user id)", () => {
    expect(read("src/components/social/social-queries.ts")).toMatch(
      /\[\.\.\.socialKeys\.me, user\?\.id \?\? "anon"\]/,
    );
  });
  it("composer: IME-safe Enter, effective-empty guard, counter, in-memory draft", () => {
    const c = read("src/components/social/Composer.tsx");
    expect(c).toMatch(/isComposing/);
    expect(c).toMatch(/keyCode === 229/);
    expect(c).toMatch(/isEffectivelyEmpty/);
    expect(c).toMatch(/composer-counter/);
    expect(c).toMatch(/getDraft\(draftKey\)/);
    expect(c).not.toMatch(/localStorage|sessionStorage/);
  });
  it("message list: tombstone, reply fallback, Diedit, copy, protected targets hide report/block, new-message pill", () => {
    const m = read("src/components/social/MessageList.tsx");
    for (const re of [
      /Pesan telah dihapus\./,
      /Pesan tidak tersedia\./,
      /Diedit/,
      /Salin pesan/,
      /new-message-pill/,
      /protectedTarget/,
    ])
      expect(m).toMatch(re);
    expect(m).toMatch(/!m\.mine && actions\.onReport && !protectedTarget/);
    expect(m).toMatch(/!m\.mine && actions\.onBlock && !protectedTarget/);
  });
  it("friends list hides Blokir for Owner/Admin; client never compares raw roles", () => {
    expect(read("src/components/social/FriendsPanel.tsx")).toMatch(
      /identity\.badges\.verified \|\| identity\.badges\.admin/,
    );
    for (const f of [
      "DmPanel",
      "GlobalChatPanel",
      "MessageList",
      "SocialProfileCard",
      "UsernameGate",
      "Composer",
    ])
      expect(read(`src/components/social/${f}.tsx`), f).not.toMatch(/\brole\s*===|\.role\s*!==/);
  });
  it("delete conversation: required confirmation copy, closes thread, own account only", () => {
    const d = read("src/components/social/DmPanel.tsx");
    expect(d).toMatch(/Hapus percakapan ini dari daftar chat Anda\?/);
    expect(d).toMatch(/Percakapan hanya dihapus dari akun Anda\./);
    expect(d).toMatch(/socialApi\.dmHide\(other\.user_id\)/);
    expect(d).toMatch(/dock\.openDm\(null\)/);
  });
  it("Owner shimmer: only the Owner frame, static under prefers-reduced-motion", () => {
    const card = read("src/components/social/SocialProfileCard.tsx");
    expect(card).toMatch(/tier === "owner" &&[\s\S]{0,80}owner-shimmer/);
    const css = read("src/styles.css");
    expect(css).toMatch(
      /@media \(prefers-reduced-motion: reduce\)\s*\{\s*\.eno-owner-shimmer::after \{\s*animation: none/,
    );
  });
  it("moderation UI uses the server RPCs only", () => {
    const a = read("src/components/social/AdminSocialReports.tsx");
    expect(a).toMatch(/socialApi\.adminReports/);
    expect(a).toMatch(/socialApi\.adminResolveReport/);
    expect(a).not.toMatch(/from\("content_reports"\)/);
    expect(read("src/routes/_authenticated/admin-operasional.tsx")).toMatch(
      /x\.category === "chat"\) return false/,
    );
  });
  it("reconnect catches up from the server by cursor (no duplicates: merge by id)", () => {
    const d = read("src/components/social/ChatDock.tsx");
    expect(d).toMatch(/wasDown/);
    expect(d).toMatch(/resetDrafts\(\)/);
  });
  it("the integration flow covers the required v5 scenarios", () => {
    const t = read("supabase/tests/social_core_flow.sql");
    for (const k of [
      "block_owner_rejected",
      "report_admin_direct_rejected",
      "owner_dm_policy_none_ok",
      "admin_dm_no_bypass",
      "hidden_for_a",
      "restored_on_new_message",
      "no_phantom_unread",
      "suspended_global_rejected",
      "guru_none_premium",
      "revoked_guru_no_sub_free",
      "initial_ok",
      "lookalike_leet_rejected",
      "first_change_no_cooldown",
      "idempotent",
      "learning_xp_unchanged",
    ])
      expect(t, k).toContain(k);
    expect(t).toMatch(/raise exception 'FLOW_OK/);
  });
});
