/** @mention ringan: hanya username utuh (tanpa autocomplete); dipecah murni agar bisa diuji. */
export type BodyPart = { type: "text"; text: string } | { type: "mention"; username: string };

const MENTION = /(^|[\s(])@([a-z0-9_]{3,20})(?![a-z0-9_@])/g;

export function splitMentions(body: string): BodyPart[] {
  const parts: BodyPart[] = [];
  let last = 0;
  for (const m of body.matchAll(MENTION)) {
    const lead = m[1] ?? "";
    const start = (m.index ?? 0) + lead.length;
    if (start > last) parts.push({ type: "text", text: body.slice(last, start) });
    parts.push({ type: "mention", username: m[2] as string });
    last = start + 1 + (m[2] as string).length;
  }
  if (last < body.length) parts.push({ type: "text", text: body.slice(last) });
  return parts;
}

/** Pesan boleh diedit pemiliknya selama 15 menit (server menegakkan; ini hanya untuk menampilkan tombol). */
export const EDIT_WINDOW_MS = 15 * 60_000;
export function canEditByAge(createdAtIso: string, now = Date.now()): boolean {
  const t = new Date(createdAtIso).getTime();
  return Number.isFinite(t) && now - t < EDIT_WINDOW_MS;
}
