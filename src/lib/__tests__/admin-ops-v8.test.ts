import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const read = (p: string) => readFileSync(new URL(`../../../${p}`, import.meta.url), "utf8");
const sql = read("supabase/migrations/20261017000000_admin_ops_rpc.sql");
const ops = read("src/routes/_authenticated/admin-operasional.tsx");
const media = read("src/routes/_authenticated/admin-media.tsx");
const flow = read("supabase/tests/admin_ops_flow.sql");

describe("admin ops v8: migrasi", () => {
  it("tidak membuka akses tabel atau melemahkan RLS", () => {
    expect(sql).not.toMatch(
      /grant\s+(select|insert|update|delete|all)[^;]*\bon\s+(table\s+)?public\./i,
    );
    expect(sql).not.toMatch(/using\s*\(\s*true\s*\)|with check\s*\(\s*true\s*\)/i);
    expect(sql).not.toMatch(/disable row level security|drop policy|alter table/i);
    expect(sql).not.toMatch(/select\s+\*/i);
  });

  it.each([
    "admin_list_announcements(integer)",
    "admin_create_announcement(text, text, text)",
    "admin_list_media(integer)",
  ])("%s: izin pusat, search_path kosong, anon dicabut", (sig) => {
    const name = sig.split("(")[0];
    const body = sql.slice(sql.indexOf(`function public.${name}(`));
    const fn = body.slice(0, body.indexOf("$$;", body.indexOf("as $$")));
    expect(fn).toMatch(/security definer set search_path = ''/);
    expect(fn).toMatch(
      /auth\.uid\(\) is null or not public\.has_permission\('operations\.manage', null\)/,
    );
    expect(sql).toContain(`revoke all on function public.${sig} from public, anon;`);
    expect(sql).toContain(`grant execute on function public.${sig} to authenticated;`);
  });

  it("pengumuman dibuat sebagai draft dengan audit dan validasi", () => {
    expect(sql).toMatch(/values \(v_title, v_body, 'draft', v_aud, auth\.uid\(\)\)/);
    expect(sql).toContain("'create_announcement'");
    expect(sql).toContain("invalid audience");
    expect(sql).toMatch(/limit least\(greatest\(coalesce\(p_limit, 100\), 1\), 200\)/);
    expect(sql).toMatch(/limit least\(greatest\(coalesce\(p_limit, 500\), 1\), 500\)/);
  });

  it("tes integrasi mencakup owner, member, anon, dan rollback", () => {
    for (const k of [
      "member_list_ann_allowed",
      "member_direct_ann_read",
      "anon_list_media_allowed",
      "audit_missing",
    ])
      expect(flow).toContain(k);
    expect(flow).toMatch(/raise exception 'FLOW_OK % checks'/);
  });
});

describe("admin ops v8: UI memakai RPC", () => {
  it("tidak ada akses tabel langsung ke admin_announcements/media_library untuk baca/simpan", () => {
    for (const src of [ops, media]) {
      expect(src).not.toMatch(/\.from\(\s*["']admin_announcements["']/);
      expect(src).not.toMatch(/\.from\(\s*["']media_library["']/);
      expect(src).not.toMatch(/\.from\(table\)/);
    }
    expect(ops).toContain("admin_list_announcements");
    expect(ops).toContain("admin_create_announcement");
    expect(ops).toContain("admin_list_media");
    expect(media).toContain("admin_list_media");
  });

  it("membedakan gagal dari kosong", () => {
    for (const label of [
      "Gagal memuat pengumuman.",
      "Belum ada pengumuman.",
      "Gagal memuat media.",
      "Belum ada media.",
    ])
      expect(ops + media).toContain(label);
    expect(media).toMatch(/q\.isError/);
    expect(media).toMatch(/q\.isSuccess && !rows\.length/);
  });

  it("mutasi lama (publish, hapus, register/hapus media) tidak diubah", () => {
    expect(ops).toContain("publish_admin_announcement");
    expect(ops).toContain("delete_admin_announcement");
    expect(media).toContain("admin_register_media");
    expect(media).toContain("admin_delete_media");
  });
});
