import { createFileRoute } from "@tanstack/react-router";
import { authorizeTranslationRequest } from "@/lib/translation.server";
import { supabaseAdmin } from "@/lib/supabase.server";
const cfg: any = {
  kanji: {
    table: "kanji",
    key: "character",
    required: ["character", "level", "meaning_id"],
    fields: [
      "id",
      "character",
      "level",
      "onyomi",
      "kunyomi",
      "meaning_id",
      "meaning_en",
      "stroke_count",
      "sort_order",
      "is_published",
      "source_book",
      "lesson_number",
      "lesson_title",
    ],
  },
  vocabulary: {
    table: "vocabulary",
    key: "id",
    required: ["term", "level", "meaning_id"],
    fields: [
      "id",
      "term",
      "reading",
      "romaji",
      "meaning_id",
      "meaning_en",
      "part_of_speech",
      "examples",
      "level",
      "sort_order",
      "is_published",
      "source_book",
      "lesson_number",
      "lesson_title",
      "usage_note_id",
    ],
  },
  grammar: {
    table: "grammar_points",
    key: "id",
    required: ["pattern", "level", "meaning_id"],
    fields: [
      "id",
      "pattern",
      "meaning_id",
      "meaning_en",
      "structure",
      "explanation_id",
      "explanation_en",
      "examples",
      "level",
      "sort_order",
      "is_published",
      "source_book",
      "lesson_number",
      "lesson_title",
      "reading_hiragana",
      "romaji",
      "usage_id",
      "wrong_examples",
      "notes_id",
    ],
  },
  reading: {
    table: "reading_passages",
    key: "id",
    required: ["title", "level", "body_jp"],
    fields: [
      "id",
      "title",
      "level",
      "body_jp",
      "translation_id",
      "translation_en",
      "estimated_minutes",
      "sort_order",
      "is_published",
      "body_furigana",
      "source_book",
      "lesson_number",
      "lesson_title",
    ],
  },
  listening: {
    table: "listening_items",
    key: "id",
    required: ["title", "level"],
    fields: [
      "id",
      "title",
      "level",
      "audio_url",
      "transcript_jp",
      "translation_id",
      "duration_seconds",
      "sort_order",
      "is_published",
      "question_type",
      "audio_license",
      "audio_attribution",
      "source",
      "transcript_en",
      "source_book",
      "lesson_number",
      "lesson_title",
    ],
  },
  questions: {
    table: "jlpt_simulation_questions",
    key: "id",
    required: [
      "level",
      "section",
      "mondai_no",
      "question_no",
      "question_type",
      "instruction_jp",
      "prompt_jp",
      "choices",
      "correct_index",
    ],
    fields: [
      "id",
      "level",
      "section",
      "mondai_no",
      "question_no",
      "question_type",
      "instruction_jp",
      "prompt_jp",
      "choices",
      "correct_index",
      "passage_title",
      "passage_jp",
      "audio_url",
      "transcript_jp",
      "source_kind",
      "is_published",
      "image_url",
      "display_question_no",
      "explanation_indonesian",
      "exam_no",
      "test_type",
      "session_no",
      "target_text",
      "target_occurrence",
      "image_prompt",
    ],
  },
};
const nums = [
    "sort_order",
    "stroke_count",
    "lesson_number",
    "estimated_minutes",
    "duration_seconds",
    "mondai_no",
    "question_no",
    "correct_index",
    "display_question_no",
    "exam_no",
    "session_no",
    "target_occurrence",
  ],
  jsons = ["examples", "wrong_examples", "choices"];
async function auth(r: Request) {
  const t = (r.headers.get("authorization") || "").replace(/^Bearer /, "");
  if (!t) throw Error("Unauthorized");
  const { data, error } = await supabaseAdmin.auth.getUser(t);
  if (error || !data.user) throw Error("Unauthorized");
  await authorizeTranslationRequest(data.user.id);
  return data.user.id;
}
function clean(raw: any, c: any, rowNo: number) {
  const o: any = {},
    errors: string[] = [];
  for (const k of c.fields)
    if (raw[k] !== undefined && raw[k] !== "" && k !== "created_at") o[k] = raw[k];
  for (const k of nums)
    if (o[k] != null) {
      const n = Number(o[k]);
      if (!Number.isFinite(n)) errors.push(k + " harus angka valid");
      else o[k] = n;
    }
  if (o.is_published != null) {
    const s = String(o.is_published).toLowerCase();
    if (!["true", "false", "1", "0"].includes(s) && typeof o.is_published !== "boolean")
      errors.push("is_published harus true/false");
    o.is_published = o.is_published === true || s === "true" || s === "1";
  }
  for (const k of jsons)
    if (typeof o[k] === "string")
      try {
        o[k] = JSON.parse(o[k]);
      } catch {
        errors.push(k + " JSON tidak valid");
      }
  for (const k of ["onyomi", "kunyomi"])
    if (typeof o[k] === "string")
      o[k] = o[k]
        .split("|")
        .map((x: string) => x.trim())
        .filter(Boolean);
  if (o.level && !["N5", "N4", "N3", "N2", "N1"].includes(o.level))
    errors.push("level tidak valid");
  if (
    Array.isArray(o.choices) &&
    o.correct_index != null &&
    (o.correct_index < 0 || o.correct_index >= o.choices.length)
  )
    errors.push("correct_index di luar pilihan jawaban");
  return { row: o, rowNo, errors };
}
function safeCsv(v: any) {
  const s = typeof v === "object" && v !== null ? JSON.stringify(v) : String(v ?? "");
  return /^[=+\-@]/.test(s) ? "'" + s : s;
}
export const Route = createFileRoute("/api/admin-import-export")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        try {
          await auth(request);
          const u = new URL(request.url),
            type = u.searchParams.get("type") || "vocabulary",
            level = u.searchParams.get("level"),
            c = cfg[type];
          if (!c) throw Error("Jenis tidak valid");
          const all: any[] = [];
          for (let from = 0; ; from += 1000) {
            let q: any = supabaseAdmin
              .from(c.table)
              .select(c.fields.join(","))
              .range(from, from + 999);
            if (level && level !== "all" && level !== "none") q = q.eq("level", level);
            const { data, error } = await q;
            if (error) throw error;
            all.push(...(data || []));
            if (!data || data.length < 1000) break;
            if (all.length >= 50000) throw Error("Export melebihi batas aman 50.000 baris");
          }
          return Response.json({
            fields: c.fields,
            rows: all.map((r) =>
              Object.fromEntries(Object.entries(r).map(([k, v]) => [k, safeCsv(v)])),
            ),
          });
        } catch (e: any) {
          return Response.json({ error: e.message }, { status: 400 });
        }
      },
      POST: async ({ request }) => {
        try {
          const actor = await auth(request),
            b = await request.json(),
            c = cfg[b.type];
          if (!c) throw Error("Jenis tidak valid");
          if (!["insert", "update"].includes(b.mode)) throw Error("Mode tidak valid");
          const input = Array.isArray(b.rows) ? b.rows : [];
          if (!input.length) throw Error("CSV kosong");
          if (input.length > 5000) throw Error("Maksimal 5.000 baris per import");
          const parsed = input.map((r: any, i: number) => clean(r, c, i + 2)),
            errors: any[] = [];
          for (const x of parsed) {
            const miss = c.required.filter((k: string) => x.row[k] == null || x.row[k] === "");
            if (miss.length) x.errors.push("Field wajib: " + miss.join(", "));
            if (b.mode === "update" && !x.row[c.key]) x.errors.push("Update membutuhkan " + c.key);
            for (const e of x.errors) errors.push({ row: x.rowNo, error: e });
          }
          const seen = new Map<string, number>();
          for (const x of parsed) {
            const k = String(x.row[c.key] ?? "");
            if (!k) continue;
            if (seen.has(k)) {
              errors.push({
                row: x.rowNo,
                error: "Duplikat " + c.key + " dalam file; pertama di baris " + seen.get(k),
              });
            } else seen.set(k, x.rowNo);
          }
          if (b.mode === "update") {
            const keys = parsed.map((x) => x.row[c.key]).filter(Boolean);
            for (let i = 0; i < keys.length; i += 500) {
              const { data, error } = await supabaseAdmin
                .from(c.table)
                .select(c.key)
                .in(c.key, keys.slice(i, i + 500));
              if (error) throw error;
              const exists = new Set((data || []).map((x: any) => String(x[c.key])));
              keys.slice(i, i + 500).forEach((k: any) => {
                if (!exists.has(String(k))) {
                  const x = parsed.find((y) => String(y.row[c.key]) === String(k));
                  if (x) errors.push({ row: x.rowNo, error: "Target update tidak ditemukan" });
                }
              });
            }
          }
          const bad = new Set(errors.map((e) => e.row));
          if (b.dryRun || errors.length)
            return Response.json({
              dryRun: true,
              total: parsed.length,
              valid: parsed.length - bad.size,
              failed: bad.size,
              errors: errors.slice(0, 500),
            });
          if (b.mode === "update") {
            const keys = parsed.map((x) => x.row[c.key]);
            const snapshot: any[] = [];
            for (let i = 0; i < keys.length; i += 500) {
              const { data, error } = await supabaseAdmin
                .from(c.table)
                .select(c.fields.join(","))
                .in(c.key, keys.slice(i, i + 500));
              if (error) throw Error("Gagal membuat snapshot: " + error.message);
              snapshot.push(...(data || []));
            }
            const { error: backupError } = await supabaseAdmin.from("admin_import_backups").insert({
              actor_id: actor,
              content_type: b.type,
              key_field: c.key,
              source_file: b.fileName || null,
              rows: snapshot,
              row_count: snapshot.length,
            });
            if (backupError)
              throw Error("Import dibatalkan karena snapshot gagal: " + backupError.message);
          }
          let success = 0;
          const writeErrors: any[] = [];
          for (const x of parsed) {
            let error: any = null;
            if (b.mode === "update") {
              const key = x.row[c.key],
                payload = { ...x.row };
              delete payload[c.key];
              ({ error } = await supabaseAdmin.from(c.table).update(payload).eq(c.key, key));
            } else ({ error } = await supabaseAdmin.from(c.table).insert(x.row));
            if (error) writeErrors.push({ row: x.rowNo, error: error.message });
            else success++;
          }
          const failed = writeErrors.length;
          await supabaseAdmin.from("admin_import_jobs").insert({
            actor_id: actor,
            content_type: b.type,
            mode: b.mode,
            file_name: b.fileName || null,
            total_rows: parsed.length,
            success_rows: success,
            failed_rows: failed,
            status: failed ? "failed" : "completed",
            errors: writeErrors,
          });
          await supabaseAdmin.from("admin_audit_log").insert({
            actor_id: actor,
            action: "import_content",
            entity_type: b.type,
            metadata: {
              mode: b.mode,
              file_name: b.fileName || null,
              total: parsed.length,
              success,
              failed,
            },
          });
          return Response.json({ total: parsed.length, success, failed, errors: writeErrors });
        } catch (e: any) {
          return Response.json({ error: e.message }, { status: 400 });
        }
      },
    },
  },
});
