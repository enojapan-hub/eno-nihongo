import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const read = (p: string) => readFileSync(new URL(`../../../${p}`, import.meta.url), "utf8");
const sql = read("supabase/migrations/20261018000000_admin_announcement_audience.sql");
const flow = read("supabase/tests/admin_announcement_flow.sql");
const ops = read("src/routes/_authenticated/admin-operasional.tsx");

const fn = (name: string) => {
  const body = sql.slice(sql.indexOf(`function public.${name}(`));
  return body.slice(0, body.indexOf("$$;", body.indexOf("as $$")));
};

describe("admin announcement v9: izin", () => {
  it.each(["publish_admin_announcement", "delete_admin_announcement", "admin_log_event"])(
    "%s memakai operations.manage, bukan gate role lama",
    (name) => {
      const f = fn(name);
      expect(f).toMatch(/security definer set search_path = ''/);
      expect(f).toMatch(
        /(auth\.uid\(\)|v_uid) is null or not public\.has_permission\('operations\.manage', null\)/,
      );
      expect(f).not.toMatch(/not in\s*\(\s*'editor'/i);
      expect(sql).toMatch(
        new RegExp(`revoke all on function public\\.${name}\\([^)]*\\) from public, anon;`),
      );
      expect(sql).toMatch(
        new RegExp(`grant execute on function public\\.${name}\\([^)]*\\) to authenticated;`),
      );
    },
  );

  it("tidak membuka akses tabel atau melemahkan RLS", () => {
    expect(sql).not.toMatch(
      /grant\s+(select|insert|update|delete|all)[^;]*\bon\s+(table\s+)?public\./i,
    );
    expect(sql).not.toMatch(
      /using\s*\(\s*true\s*\)|with check\s*\(\s*true\s*\)|disable row level security|drop policy/i,
    );
  });
});

describe("admin announcement v9: audience dan penerima", () => {
  const f = fn("publish_admin_announcement");

  it("penerima dipilih server dari profil aktif sesuai audience yang didukung", () => {
    expect(f).toMatch(/where p\.suspended_at is null/);
    expect(f).toMatch(/a\.audience = 'all'/);
    expect(f).toMatch(/a\.audience = 'premium'/);
    expect(f).toMatch(/a\.audience = 'teacher' and p\.role = 'teacher'/);
    // entitlement Premium kanonik (sama dengan get_my_membership / is_premium)
    expect(f).toContain("p.role in ('owner', 'admin', 'editor', 'teacher')");
    expect(f).toContain("p.plan = 'lifetime'");
    expect(f).toMatch(
      /p\.plan = 'premium' and \(p\.premium_until is null or p\.premium_until > now\(\)\)/,
    );
    expect(f).not.toMatch(
      /select id,a\.title,a\.body,'announcement',now\(\)\s*from public\.profiles\s*;/,
    );
  });

  it("idempoten: hanya status non-published yang diterbitkan dan dikirim", () => {
    expect(f).toMatch(/where id = p_id and status <> 'published'/);
    expect(f).toContain("already_published");
    expect(f).toContain("raise exception 'not found'");
  });

  it("audit mencatat audience dan jumlah penerima", () => {
    expect(f).toMatch(/'publish', 'announcement'/);
    expect(f).toMatch(/jsonb_build_object\('audience', a\.audience, 'recipients', v_n\)/);
  });

  it("audience selaras dengan nilai UI dan constraint tabel", () => {
    for (const v of ["all", "premium", "teacher"]) expect(ops).toContain(`value="${v}"`);
    expect(sql).toContain("'all'");
  });

  it("tes integrasi mencakup izin, audience, entitlement, duplikat, idempoten, dan rollback", () => {
    for (const k of [
      "anon_publish_allowed",
      "member_publish_allowed",
      "teacher_publish_allowed",
      "unauthorized_mutation",
      "teacher_audience_leak",
      "premium_audience_leak",
      "suspended_notified",
      "duplicate_notification",
      "not_idempotent",
      "historical_republished",
      "publish_audit_missing",
    ])
      expect(flow).toContain(k);
    expect(flow).toMatch(/raise exception 'FLOW_OK % checks'/);
  });
});
