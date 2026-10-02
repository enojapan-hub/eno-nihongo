// Generates permanent media for JLPT full-simulation questions (exam_no >= 2):
// listening audio via OpenAI TTS (multi-speaker, one mp3 per question) and
// picture-question images via OpenAI Images. Files go to the public
// `jlpt-simulation-audio` bucket and the question row stores the public URL.
// Auth: x-cron-secret, verified against the vault secret like ai-translate-cron.
import { createClient } from "npm:@supabase/supabase-js@2";

const BUCKET = "jlpt-simulation-audio";
const TTS_MODEL = "gpt-4o-mini-tts";
const IMAGE_MODEL = "gpt-image-1";
const TTS_INSTRUCTIONS =
  "自然な日本語で話してください。JLPT聴解試験の音声のように、はっきり、落ち着いた速さで、感情は控えめに読んでください。";

const json = (x: unknown, s = 200) =>
  new Response(JSON.stringify(x), { status: s, headers: { "Content-Type": "application/json" } });

function serviceKey() {
  const legacy = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (legacy) return legacy;
  try {
    return JSON.parse(Deno.env.get("SUPABASE_SECRET_KEYS") ?? "{}").default ?? "";
  } catch {
    return "";
  }
}

type Line = { speaker: string; text: string };

/** "女：…" / "男の人：…" / "ナレーター：…" → speaker + text. Lines without a label belong to the narrator. */
function parseScript(transcript: string): Line[] {
  return transcript
    .split(/\n+/)
    .map((l) => l.trim())
    .filter(Boolean)
    .map((l) => {
      const m = l.match(/^([^：:]{1,12})[：:]\s*(.+)$/);
      return m ? { speaker: m[1].trim(), text: m[2].trim() } : { speaker: "ナレーター", text: l };
    });
}

function voiceFor(speaker: string, seen: Map<string, string>) {
  const hit = seen.get(speaker);
  if (hit) return hit;
  const female = /女|母|姉|妹|娘|妻|おばあ|店員（女）|先生（女）/.test(speaker);
  const male = /男|父|兄|弟|息子|夫|おじい|店員（男）|先生（男）/.test(speaker);
  const used = new Set(seen.values());
  let voice: string;
  if (/ナレーター|アナウンス|問題/.test(speaker)) voice = "sage";
  else if (female) voice = used.has("nova") ? "shimmer" : "nova";
  else if (male) voice = used.has("onyx") ? "echo" : "onyx";
  else voice = used.has("coral") ? "alloy" : "coral";
  seen.set(speaker, voice);
  return voice;
}

async function tts(key: string, voice: string, input: string): Promise<Uint8Array> {
  for (let attempt = 1; attempt <= 3; attempt++) {
    const r = await fetch("https://api.openai.com/v1/audio/speech", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: TTS_MODEL,
        voice,
        input,
        instructions: TTS_INSTRUCTIONS,
        response_format: "mp3",
      }),
    });
    if (r.ok) return new Uint8Array(await r.arrayBuffer());
    if (attempt === 3 || (r.status < 500 && r.status !== 429)) {
      throw new Error(`TTS ${r.status}: ${(await r.text()).slice(0, 300)}`);
    }
    await new Promise((res) => setTimeout(res, 1500 * attempt));
  }
  throw new Error("TTS failed");
}

async function image(key: string, prompt: string): Promise<Uint8Array> {
  const r = await fetch("https://api.openai.com/v1/images/generations", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: IMAGE_MODEL,
      size: "1024x1024",
      quality: "low",
      prompt:
        "Simple black-and-white line illustration in the style of a JLPT listening test picture. No text, no letters, no numbers unless explicitly requested. " +
        prompt,
    }),
  });
  if (!r.ok) throw new Error(`Image ${r.status}: ${(await r.text()).slice(0, 300)}`);
  const d = await r.json();
  const b64 = d.data?.[0]?.b64_json;
  if (!b64) throw new Error("Image: no b64_json");
  return Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
}

function concat(parts: Uint8Array[]) {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let o = 0;
  for (const p of parts) {
    out.set(p, o);
    o += p.length;
  }
  return out;
}

Deno.serve(async (req) => {
  const supplied = req.headers.get("x-cron-secret") ?? "";
  if (!supplied) return json({ error: "Unauthorized" }, 401);
  const url = Deno.env.get("SUPABASE_URL") ?? "";
  const key = Deno.env.get("OPENAI_API_KEY") ?? "";
  const db = createClient(url, serviceKey());
  const { data: ok, error: authError } = await db.rpc("verify_translation_cron_secret", {
    p_candidate: supplied,
  });
  if (authError || ok !== true) return json({ error: "Unauthorized" }, 401);

  const body = await req.json().catch(() => ({}));
  const mode = String(body.mode ?? "probe");
  const limit = Math.min(Number(body.limit) || 3, 10);
  if (mode === "probe") {
    const res: Record<string, unknown> = { openaiKeyPresent: Boolean(key) };
    if (key && body.test) {
      try {
        const bytes = await tts(key, "nova", "これはテストです。");
        const path = "probe/tts-test.mp3";
        const up = await db.storage
          .from(BUCKET)
          .upload(path, bytes, { contentType: "audio/mpeg", upsert: true });
        res.ttsBytes = bytes.length;
        res.uploadError = up.error?.message ?? null;
        res.publicUrl = db.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
      } catch (e) {
        res.ttsError = e instanceof Error ? e.message : String(e);
      }
    }
    return json(res);
  }
  if (!key) return json({ error: "OPENAI_API_KEY missing" }, 503);

  const ids: string[] | null = Array.isArray(body.ids) ? body.ids.map(String) : null;
  const results: unknown[] = [];

  if (mode === "audio") {
    let q = db
      .from("jlpt_simulation_questions")
      .select("id,level,exam_no,transcript_jp")
      .eq("section", "listening")
      .gt("exam_no", 1)
      .is("audio_url", null)
      .not("transcript_jp", "is", null)
      .order("level")
      .order("exam_no")
      .order("mondai_no")
      .order("question_no")
      .limit(limit);
    if (ids) q = q.in("id", ids);
    const { data: rows, error } = await q;
    if (error) return json({ error: error.message }, 500);
    for (const row of rows ?? []) {
      try {
        const seen = new Map<string, string>();
        const lines = parseScript(String(row.transcript_jp));
        const parts: Uint8Array[] = [];
        for (const line of lines)
          parts.push(await tts(key, voiceFor(line.speaker, seen), line.text));
        const bytes = concat(parts);
        if (bytes.length < 2000) throw new Error("audio too small");
        const path = `${row.level}/exam${row.exam_no}/${row.id}.mp3`;
        const up = await db.storage
          .from(BUCKET)
          .upload(path, bytes, { contentType: "audio/mpeg", upsert: true });
        if (up.error) throw up.error;
        const publicUrl = db.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
        const { error: e } = await db
          .from("jlpt_simulation_questions")
          .update({ audio_url: publicUrl })
          .eq("id", row.id)
          .is("audio_url", null);
        if (e) throw e;
        results.push({ id: row.id, ok: true, bytes: bytes.length, lines: lines.length });
      } catch (e) {
        results.push({ id: row.id, ok: false, error: e instanceof Error ? e.message : String(e) });
      }
    }
  } else if (mode === "image") {
    let q = db
      .from("jlpt_simulation_questions")
      .select("id,level,exam_no,image_prompt")
      .gt("exam_no", 1)
      .is("image_url", null)
      .not("image_prompt", "is", null)
      .order("level")
      .order("exam_no")
      .order("mondai_no")
      .order("question_no")
      .limit(limit);
    if (ids) q = q.in("id", ids);
    const { data: rows, error } = await q;
    if (error) return json({ error: error.message }, 500);
    for (const row of rows ?? []) {
      try {
        const bytes = await image(key, String(row.image_prompt));
        const path = `${row.level}/exam${row.exam_no}/img/${row.id}.png`;
        const up = await db.storage
          .from(BUCKET)
          .upload(path, bytes, { contentType: "image/png", upsert: true });
        if (up.error) throw up.error;
        const publicUrl = db.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
        const { error: e } = await db
          .from("jlpt_simulation_questions")
          .update({ image_url: publicUrl })
          .eq("id", row.id)
          .is("image_url", null);
        if (e) throw e;
        results.push({ id: row.id, ok: true, bytes: bytes.length });
      } catch (e) {
        results.push({ id: row.id, ok: false, error: e instanceof Error ? e.message : String(e) });
      }
    }
  } else {
    return json({ error: "unknown mode" }, 400);
  }
  return json({ ok: true, mode, processed: results.length, results });
});
