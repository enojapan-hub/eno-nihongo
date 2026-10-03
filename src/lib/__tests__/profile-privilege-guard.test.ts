import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// Tes kontrak: kolom hak istimewa profil hanya boleh diubah lewat fungsi admin/service role.
// Sumber kebenaran adalah migration di repo, sehingga tes berjalan offline di CI.

const root = process.cwd();
const PRIVILEGED = [
  "role",
  "app_role_id",
  "plan",
  "premium_until",
  "referral_points",
  "suspended_at",
  "admin_note",
];

const migrationsDir = join(root, "supabase", "migrations");
const guardMigration = readdirSync(migrationsDir)
  .filter((f) => f.endsWith(".sql"))
  .sort()
  .map((f) => readFileSync(join(migrationsDir, f), "utf8"))
  .reverse()
  .find((sql) => /guard_profile_privileged_columns/.test(sql));

function sources(dir = join(root, "src")): { file: string; text: string }[] {
  const out: { file: string; text: string }[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      if (entry === "__tests__") continue;
      out.push(...sources(full));
    } else if (/\.(ts|tsx)$/.test(entry) && entry !== "types.ts") {
      out.push({ file: full.slice(root.length + 1), text: readFileSync(full, "utf8") });
    }
  }
  return out;
}

describe("penjaga kolom hak istimewa profiles", () => {
  it("ada di migration dan mencakup semua kolom hak istimewa", () => {
    expect(guardMigration).toBeDefined();
    const trigger = /create trigger profiles_00_guard_privileged[\s\S]*?on public\.profiles/i.exec(
      guardMigration ?? "",
    );
    expect(trigger).not.toBeNull();
    for (const column of PRIVILEGED) {
      expect(trigger?.[0]).toMatch(new RegExp(`\\b${column}\\b`));
    }
  });

  it("hanya menolak pemanggil API (authenticated/anon), bukan fungsi definer/service role", () => {
    expect(guardMigration).toMatch(/current_user not in \('authenticated', 'anon'\)/);
    expect(guardMigration).toMatch(
      /revoke all on function public\.guard_profile_privileged_columns/,
    );
  });

  it("kode klien tidak menulis kolom hak istimewa lewat tabel profiles", () => {
    // Penulisan langsung dari klien pasti ditolak penjaga; harus lewat RPC admin.
    const writeCall = /from\(["']profiles["']\)\s*\.(update|upsert|insert)\(([\s\S]{0,400}?)\)/g;
    const offenders: string[] = [];
    for (const { file, text } of sources()) {
      for (const match of text.matchAll(writeCall)) {
        const payload = match[2] ?? "";
        for (const column of PRIVILEGED) {
          if (new RegExp(`\\b${column}\\b\\s*:`).test(payload))
            offenders.push(`${file}: ${column}`);
        }
      }
    }
    expect(offenders).toEqual([]);
  });
});
