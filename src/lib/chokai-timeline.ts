/**
 * Timeline Chōkai simulasi: satu audio penuh dipetakan ke urutan soal Chōkai.
 * `q` = posisi soal (1-based) dalam daftar soal listening sesi tersebut, bukan nomor yang
 * diucapkan di audio. Detik dihitung dari awal file audio.
 */
export interface TimelineEntry {
  q: number;
  start: number;
  end: number;
}

/** Parse tegas: entri yang tidak valid membuat seluruh timeline ditolak (tidak ada tebakan). */
export function parseTimeline(raw: unknown): TimelineEntry[] | null {
  if (!Array.isArray(raw) || raw.length === 0) return null;
  const out: TimelineEntry[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") return null;
    const { q, start, end } = item as Record<string, unknown>;
    if (
      typeof q !== "number" ||
      typeof start !== "number" ||
      typeof end !== "number" ||
      !Number.isInteger(q) ||
      !Number.isFinite(start) ||
      !Number.isFinite(end)
    )
      return null;
    out.push({ q, start, end });
  }
  return out;
}

/**
 * Valid bila persis `count` entri berurutan q=1..count, start≥0, start<end, tidak tumpang tindih
 * dan waktu tidak mundur. Timeline yang tidak valid tidak dipakai (sesi kembali ke pemutar lama).
 */
export function isValidTimeline(timeline: TimelineEntry[] | null, count: number): boolean {
  if (!timeline || count < 1 || timeline.length !== count) return false;
  let previousEnd = 0;
  for (let i = 0; i < timeline.length; i += 1) {
    const e = timeline[i]!;
    if (e.q !== i + 1 || e.start < 0 || e.start >= e.end || e.start < previousEnd) return false;
    previousEnd = e.end;
  }
  return true;
}

/**
 * Posisi soal (0-based) yang aktif pada waktu `t`. Sebelum soal pertama dimulai tetap soal 1;
 * di antara dua soal (jeda) soal sebelumnya tetap aktif sampai soal berikutnya dimulai.
 */
export function activePosition(timeline: TimelineEntry[], t: number): number {
  let position = 0;
  for (let i = 0; i < timeline.length; i += 1) {
    if (t >= timeline[i]!.start) position = i;
    else break;
  }
  return position;
}

/** Soal hanya boleh maju: tidak pernah kembali ke indeks yang lebih kecil. */
export const forwardOnly = (current: number, target: number) => Math.max(current, target);

export interface ChokaiProgress {
  /** Detik terakhir yang diputar (hanya untuk melanjutkan setelah reload, bukan replay). */
  t: number;
  finished: boolean;
}

export function readChokaiProgress(
  storage: Pick<Storage, "getItem"> | null | undefined,
  key: string,
): ChokaiProgress | null {
  try {
    const raw = storage?.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<ChokaiProgress>;
    const t = Number(parsed.t);
    return { t: Number.isFinite(t) && t > 0 ? t : 0, finished: parsed.finished === true };
  } catch {
    return null;
  }
}

export function writeChokaiProgress(
  storage: Pick<Storage, "setItem"> | null | undefined,
  key: string,
  progress: ChokaiProgress,
) {
  try {
    storage?.setItem(key, JSON.stringify(progress));
  } catch {
    /* penyimpanan tidak tersedia: audio tetap berjalan, hanya tidak bisa dilanjutkan setelah reload */
  }
}
