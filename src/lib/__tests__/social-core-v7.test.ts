import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { NO_BADGES, badgeKinds } from "../social/social-badges";

const root = process.cwd();
const read = (f: string) => readFileSync(join(root, f), "utf8");
const sql = read("supabase/migrations/20261016000000_social_core_v7.sql");
const code = sql.replace(/--.*$/gm, "");
const fn = (name: string) => {
  const i = code.indexOf(`function public.${name}(`);
  expect(i, name).toBeGreaterThan(-1);
  const j = code.indexOf("\n$$;", i);
  return code.slice(i, j === -1 ? undefined : j);
};

describe("v7 migration: admin reports via moderator RPC", () => {
  it("list is moderator-only, explicit columns, bounded, excludes chat (own queue)", () => {
    const f = fn("admin_list_reports");
    expect(f).toMatch(/social_assert_moderator\(\)/);
    expect(f).toMatch(/r\.category <> 'chat'/);
    expect(f).toMatch(/limit least\(greatest\(coalesce\(p_limit, 100\), 1\), 200\)/);
    expect(f).toMatch(/left\(r\.description, 1000\)/);
    expect(f).not.toMatch(/reporter_id|auth\.users|email|select \*/);
    expect(f).toMatch(/security definer/);
    expect(f).toMatch(/set search_path = ''/);
  });
  it("update is moderator-only, validated, audited and never touches chat reports", () => {
    const f = fn("admin_update_report");
    expect(f).toMatch(/social_assert_moderator\(\)/);
    expect(f).toMatch(/'reviewing', 'resolved', 'rejected'/);
    expect(f).toMatch(/category <> 'chat'/);
    expect(f).toMatch(/insert into public\.admin_audit_log/);
  });
  it("neither RPC is executable by anon; RLS and grants on the table are not widened", () => {
    expect(code).toMatch(
      /revoke all on function public\.admin_list_reports\(text, integer\) from public, anon/,
    );
    expect(code).toMatch(
      /revoke all on function public\.admin_update_report\(uuid, text, text\) from public, anon/,
    );
    expect(code).not.toMatch(/grant [^;]*on (table )?public\.content_reports/i);
    expect(code).not.toMatch(/create policy[^;]*content_reports/i);
    expect(code).not.toMatch(/disable row level security/i);
  });
});

describe("v7 migration: final badge rule (server)", () => {
  it("diamond only for non-owner/admin/teacher members with active paid Premium", () => {
    const f = fn("social_badges");
    expect(f).toMatch(/p\.role not in \('owner', 'admin', 'teacher'\)/);
    expect(f).toMatch(
      /p\.plan = 'lifetime' or \(p\.plan = 'premium' and \(p\.premium_until is null or p\.premium_until > now\(\)\)\)/,
    );
    expect(f).not.toMatch(/p\.role = 'teacher' or p\.plan/);
  });
  it("does not create any fake subscription/payment or touch premium_until", () => {
    expect(code).not.toMatch(/insert into public\.(subscriptions|payments|transactions|orders)/i);
    expect(code).not.toMatch(/update public\.profiles/i);
  });
});

describe("v7 migration: display-name mirror", () => {
  it("mirrors only the display_name column, truncated to the social limit, and never raises", () => {
    const f = fn("social_mirror_display_name");
    expect(f).toMatch(/update public\.social_profiles set display_name = nullif\(left\(btrim/);
    expect(f).toMatch(/, 40\)/);
    expect(f).not.toMatch(/username|xp|role|plan|friend|dm_messages|raise exception/i);
    expect(code).toMatch(/after update of display_name on public\.profiles/);
    expect(code).toMatch(/before insert on public\.social_profiles/);
    expect(code).not.toMatch(/delete from|drop |truncate/i);
  });
});

describe("v7 client: final badge rule", () => {
  const T = true;
  const F = false;
  it("Owner → VERIFIED only; Admin → ADMIN only; Guru → SENSEI only (with or without a subscription)", () => {
    expect(badgeKinds({ verified: T, sensei: F, diamond: T })).toEqual(["verified"]);
    expect(badgeKinds({ verified: T, sensei: F, diamond: F })).toEqual(["verified"]);
    expect(badgeKinds({ verified: F, admin: T, sensei: F, diamond: T })).toEqual(["admin"]);
    expect(badgeKinds({ verified: F, sensei: T, diamond: T })).toEqual(["sensei"]);
    expect(badgeKinds({ verified: F, sensei: T, diamond: F })).toEqual(["sensei"]);
  });
  it("normal members: active Premium → DIAMOND; Free/expired → FREE; unknown → nothing", () => {
    expect(badgeKinds({ verified: F, sensei: F, diamond: T })).toEqual(["diamond"]);
    expect(badgeKinds(NO_BADGES)).toEqual(["free"]);
    expect(badgeKinds(null)).toEqual([]);
  });
  it("never yields a forbidden combination for any flag combination", () => {
    for (const verified of [T, F])
      for (const admin of [T, F])
        for (const sensei of [T, F])
          for (const diamond of [T, F]) {
            const k = badgeKinds({ verified, admin, sensei, diamond });
            expect(k.length).toBe(1);
            if (k[0] === "sensei" || k[0] === "verified") {
              expect(k).not.toContain("diamond");
              expect(k).not.toContain("free");
            }
          }
  });
  it("one resolver: every surface renders badges through IdentityBadges/badgeKinds only", () => {
    expect(read("src/components/social/IdentityBadges.tsx")).toMatch(
      /badgeKinds\(identity\.badges\)/,
    );
    for (const f of ["FriendsPanel", "MessageList", "DmPanel", "SocialProfileCard"])
      expect(read(`src/components/social/${f}.tsx`), f).not.toMatch(
        /badges\.diamond|badges\.sensei \?/,
      );
  });
});

describe("v7 client: Admin Operasional → Laporan", () => {
  const src = read("src/routes/_authenticated/admin-operasional.tsx");
  it("reads and updates reports only through RPC, never the table directly", () => {
    expect(src).not.toMatch(/from\("content_reports"\)/);
    expect(src).not.toMatch(/table\s*=\s*[^;]*content_reports/);
    expect(src).toMatch(/"admin_list_reports" as never/);
    expect(src).toMatch(/"admin_update_report" as never/);
  });
  it("distinguishes empty from failed", () => {
    expect(src).toMatch(/Belum ada laporan\./);
    expect(src).toMatch(/Gagal memuat laporan\./);
    expect(src).toMatch(/list\.isError/);
    expect(src).toMatch(/list\.isSuccess && filtered\.length === 0/);
  });
});

describe("v7 client: identity freshness and OAuth", () => {
  it("saving the profile invalidates identity caches only (no logout/reload/clear)", () => {
    const h = read("src/lib/identity-cache.ts");
    for (const k of [
      "my-account",
      "my-account-profile",
      "leaderboard",
      "competition-leaderboard",
      "social",
    ])
      expect(h).toContain(`["${k}"]`);
    expect(h).not.toMatch(/\.clear\(\)|signOut|location\.reload|localStorage|setInterval/);
    expect(read("src/routes/_authenticated/edit-profil.tsx")).toMatch(
      /invalidateIdentityCaches\(qc\)/,
    );
    expect(read("src/routes/_authenticated/onboarding.tsx")).toMatch(
      /invalidateIdentityCaches\(qc\)/,
    );
  });
  it("custom ENO name outranks Google metadata in every client prefill", () => {
    expect(read("src/routes/_authenticated/onboarding.tsx")).toMatch(
      /m\["display_name"\] \?\? m\["full_name"\]/,
    );
    const cert = read("src/routes/_authenticated/sertifikat-simulasi.$level.tsx");
    expect(cert).toMatch(/meta\?\.\["display_name"\]/);
    expect(cert).toMatch(/from\("profiles"\)[\s\S]{0,120}select\("display_name"\)/);
  });
  it("the Google metadata sync only fills an EMPTY display name (server)", () => {
    const m = read("supabase/migrations/20260904152806_reward_avatar_notification_sync.sql");
    expect(m).toMatch(
      /display_name=coalesce\(nullif\(display_name,''\),new\.raw_user_meta_data->>'full_name'/,
    );
  });
});

describe("v7 integration flow coverage", () => {
  const t = read("supabase/tests/social_core_flow.sql");
  it("covers reports RBAC, rename invariants, OAuth and final badges", () => {
    for (const k of [
      "reports_owner_ok",
      "reports_member_rejected",
      "resolve_member_rejected",
      "resolve_owner_ok",
      "no_anon_report_rpcs",
      "rename_leaderboard_source",
      "rename_social_mirror",
      "rename_global_history",
      "rename_dm_list",
      "rename_username_unchanged",
      "rename_xp_unchanged",
      "rename_friendship_unchanged",
      "rename_messages_unchanged",
      "rename_role_plan_unchanged",
      "rename_long_name_does_not_fail",
      "oauth_does_not_overwrite_eno_name",
      "oauth_fills_only_when_empty",
      "owner_verified_only",
      "guru_paid_sensei_only",
      "normal_active_diamond",
      "normal_expired_free_badge",
      "guru_entitlement_from_role",
      "revoked_guru_with_sub_diamond",
    ])
      expect(t, k).toContain(k);
  });
});

describe("v7 identity cache helper (behavior)", () => {
  it("invalidates exactly the identity-bearing queries and resets the badge cache", async () => {
    const { invalidateIdentityCaches } = await import("../identity-cache");
    const calls: unknown[] = [];
    const qc = {
      invalidateQueries: (o: { queryKey: unknown }) => (calls.push(o.queryKey), Promise.resolve()),
    };
    await invalidateIdentityCaches(qc as never);
    expect(calls).toEqual([
      ["my-account"],
      ["my-account-profile"],
      ["my-account-edit"],
      ["leaderboard"],
      ["competition-leaderboard"],
      ["social"],
    ]);
  });
});
