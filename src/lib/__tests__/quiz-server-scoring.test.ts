import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// Tes kontrak: skor/XP quiz ditentukan server dan klien tidak bisa menulis attempt secara langsung.
// Sumber kebenaran adalah migration di repo, sehingga tes berjalan offline di CI.

const root = process.cwd();
const migrationsDir = join(root, "supabase", "migrations");
const migrations = readdirSync(migrationsDir)
  .filter((f) => f.endsWith(".sql"))
  .sort()
  .map((f) => ({ name: f, sql: readFileSync(join(migrationsDir, f), "utf8") }));
const latest = (re: RegExp) => [...migrations].reverse().find((m) => re.test(m.sql));

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

describe("klien quiz", () => {
  it("tidak menulis quiz_attempts/quiz_answers langsung dan tidak memanggil record_quiz_attempt", () => {
    const offenders: string[] = [];
    for (const { file, text } of sources()) {
      if (
        /from\(\s*["'`]quiz_(attempts|answers)["'`]\s*\)\s*\.(insert|upsert|update|delete)\(/.test(
          text,
        )
      )
        offenders.push(`${file}: tulis langsung`);
      if (/rpc\(\s*["'`]record_quiz_attempt["'`]/.test(text))
        offenders.push(`${file}: record_quiz_attempt`);
    }
    expect(offenders).toEqual([]);
  });

  it("submitPracticeQuiz hanya mengirim pilihan jawaban, bukan skor/XP/kebenaran", () => {
    const text = readFileSync(join(root, "src", "lib", "learn-queries.ts"), "utf8");
    const call = /rpc\(\s*"submit_practice_quiz",\s*\{([\s\S]*?)\}\);/.exec(text);
    expect(call).not.toBeNull();
    expect(call?.[1]).not.toMatch(/\b(score|xp|correct|isCorrect|is_correct|attempt_kind)\b/i);
  });
});

describe("migration penilaian quiz di server", () => {
  const fn = latest(/function public\.submit_practice_quiz/)?.sql ?? "";

  it("menilai terhadap bank soal, mencatat attempt_kind 'quiz', dan membatasi XP", () => {
    expect(fn).toMatch(/security definer/i);
    expect(fn).toMatch(/q\.correct_index/);
    expect(fn).toMatch(/q\.is_published/);
    expect(fn).toMatch(/'quiz'\s*,\s*\n?\s*v_total/);
    expect(fn).toMatch(/least\(v_correct \* 10, \d+\)/);
    expect(fn).toMatch(
      /grant execute on function public\.submit_practice_quiz[\s\S]*to authenticated/i,
    );
  });

  it("enforce_simulation_membership tidak lagi mengubah quiz menjadi simulation_full", () => {
    const def = latest(/function public\.enforce_simulation_membership/)?.sql ?? "";
    expect(def).not.toBe("");
    expect(def).not.toMatch(/new\.attempt_kind\s*:=/);
  });

  it("penguncian INSERT langsung ada dan mencakup kedua tabel serta fungsi lama", () => {
    const lock =
      latest(/lock_direct_quiz_attempt_writes|drop policy if exists attempts_own_insert/)?.sql ??
      "";
    expect(lock).toMatch(/drop policy if exists attempts_own_insert on public\.quiz_attempts/);
    expect(lock).toMatch(/drop policy if exists answers_own_insert on public\.quiz_answers/);
    expect(lock).toMatch(
      /revoke insert, update, delete, truncate on public\.quiz_attempts from authenticated, anon/,
    );
    expect(lock).toMatch(
      /revoke insert, update, delete, truncate on public\.quiz_answers from authenticated, anon/,
    );
    expect(lock).toMatch(/revoke all on function public\.record_quiz_attempt/);
  });
});
