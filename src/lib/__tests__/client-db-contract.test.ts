import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// Tes kontrak: kode klien tidak boleh memanggil database dengan cara yang pasti ditolak.
// Sumber kebenaran adalah migration di repo (bukan database live), sehingga tes berjalan offline di CI.

const root = process.cwd();
const migrationsDir = join(root, "supabase", "migrations");

const migrations = readdirSync(migrationsDir)
  .filter((f) => f.endsWith(".sql"))
  .sort()
  .map((f) => ({ name: f, sql: readFileSync(join(migrationsDir, f), "utf8") }));

function clientSourceFiles(dir = join(root, "src")): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      if (entry === "__tests__" || full.endsWith(join("src", "routes", "api"))) continue;
      out.push(...clientSourceFiles(full));
    } else if (/\.(ts|tsx)$/.test(entry) && !entry.endsWith(".server.ts") && entry !== "types.ts") {
      out.push(full);
    }
  }
  return out;
}

const clientSources = clientSourceFiles().map((file) => ({
  file: file.slice(root.length + 1),
  text: readFileSync(file, "utf8"),
}));

describe("kontrak record_learning_activity", () => {
  // Definisi terbaru yang membatasi tipe aktivitas yang boleh dikirim klien.
  const latest = [...migrations].reverse().find((m) => /activity_type not in \(/i.test(m.sql));

  it("menemukan whitelist tipe aktivitas di migration", () => {
    expect(latest).toBeDefined();
  });

  const allowed = new Set(
    [...(latest?.sql.matchAll(/activity_type not in \(([^)]*)\)/gi) ?? [])].flatMap((m) =>
      [...(m[1] ?? "").matchAll(/'([a-z_]+)'/g)].map((x) => x[1] as string),
    ),
  );

  it("whitelist tidak kosong", () => {
    expect(allowed.size).toBeGreaterThan(0);
  });

  it("setiap p_activity_type yang dikirim klien diterima database", () => {
    const rejected: string[] = [];
    for (const { file, text } of clientSources) {
      for (const m of text.matchAll(/p_activity_type:\s*["']([a-z_]+)["']/g)) {
        if (!allowed.has(m[1] as string)) rejected.push(`${file}: ${m[1]}`);
      }
    }
    expect(rejected).toEqual([]);
  });
});

describe("kontrak tabel internal", () => {
  // Tabel yang hak SELECT-nya dicabut untuk klien (kecuali migration berikutnya memberikannya lagi).
  const closed = new Set<string>();
  for (const { sql } of migrations) {
    for (const m of sql.matchAll(
      /revoke\s+all\s+on\s+table\s+public\.([a-z_]+)\s+from\s+[^;]*\bauthenticated\b/gi,
    ))
      closed.add(m[1] as string);
    for (const m of sql.matchAll(
      /grant\s+[^;]*\bselect\b[^;]*\s+on\s+(?:table\s+)?public\.([a-z_]+)\s+to\s+[^;]*\bauthenticated\b/gi,
    ))
      closed.delete(m[1] as string);
  }

  it("mengenali tabel internal dari migration", () => {
    expect(closed.has("vocabulary_relations")).toBe(true);
    expect(closed.has("vocabulary_category_links")).toBe(true);
  });

  it("kanji_vocabulary_examples dapat dibaca klien setelah migration grant", () => {
    expect(closed.has("kanji_vocabulary_examples")).toBe(false);
    const granted = migrations.some((m) =>
      /grant\s+select\s+on\s+table\s+public\.kanji_vocabulary_examples\s+to\s+authenticated/i.test(
        m.sql,
      ),
    );
    expect(granted).toBe(true);
  });

  it("klien tidak mengakses tabel internal secara langsung", () => {
    const offenders: string[] = [];
    for (const { file, text } of clientSources) {
      for (const m of text.matchAll(/\.from\(\s*["'`]([a-z_]+)["'`]\s*\)/g)) {
        if (closed.has(m[1] as string)) offenders.push(`${file}: ${m[1]}`);
      }
    }
    expect(offenders).toEqual([]);
  });
});

describe("kontrak get_published_simulation_questions", () => {
  // Selama overload 2-argumen lama masih ada di database, panggilan tanpa p_exam_no ambigu
  // (PostgREST HTTP 300) dan halaman simulasi tidak dapat memuat soal.
  it("setiap pemanggil mengirim p_exam_no secara eksplisit", () => {
    const offenders: string[] = [];
    let calls = 0;
    for (const { file, text } of clientSources) {
      for (const m of text.matchAll(
        /rpc\(\s*["'`]get_published_simulation_questions["'`]\s*,\s*\{([\s\S]*?)\}\s*\)/g,
      )) {
        calls++;
        if (!/\bp_exam_no\b/.test(m[1] ?? "")) offenders.push(file);
      }
    }
    expect(calls).toBeGreaterThan(0);
    expect(offenders).toEqual([]);
  });
});
