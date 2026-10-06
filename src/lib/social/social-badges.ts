import { useEffect, useSyncExternalStore } from "react";
import { supabase } from "@/integrations/supabase/client";

/** Status publik minimal dari RPC `social_badges` (role/plan mentah tidak pernah sampai ke klien). */
export type SocialBadges = { verified: boolean; sensei: boolean; diamond: boolean };

export const NO_BADGES: SocialBadges = { verified: false, sensei: false, diamond: false };

export type BadgeKind = "verified" | "sensei" | "diamond" | "free";

export const BADGE_META: Record<BadgeKind, { label: string; text: string }> = {
  verified: { label: "Akun resmi ENO NIHONGO", text: "Verified" },
  sensei: { label: "Guru ENO NIHONGO", text: "Sensei" },
  diamond: { label: "Member Premium", text: "Premium" },
  free: { label: "Akun Free", text: "FREE" },
};

/**
 * Aturan tampil (satu-satunya): Owner → Verified saja. Selain itu: Sensei bila Guru, lalu Diamond
 * bila Premium aktif, jika tidak Free. `b` harus hasil server yang sudah dimuat (null = belum tahu →
 * tidak ada badge, bukan "Free").
 */
export function badgeKinds(b: SocialBadges | null | undefined): BadgeKind[] {
  if (!b) return [];
  if (b.verified === true) return ["verified"];
  const out: BadgeKind[] = [];
  if (b.sensei === true) out.push("sensei");
  out.push(b.diamond === true ? "diamond" : "free");
  return out;
}

/** Identitas publik: badge + URL foto yang sudah disaring server (null = tidak ada foto aman). */
export type PublicMeta = { badges: SocialBadges; photo: string | null };

/** Respons RPC → peta aman. Nilai selain `true` (termasuk string/angka) diperlakukan sebagai tidak ada. */
export function parsePublicMeta(raw: unknown): Map<string, PublicMeta> {
  const map = new Map<string, PublicMeta>();
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return map;
  for (const [id, v] of Object.entries(raw as Record<string, unknown>)) {
    if (!v || typeof v !== "object") continue;
    const o = v as { verified?: unknown; sensei?: unknown; diamond?: unknown; photo?: unknown };
    map.set(id, {
      badges: {
        verified: o.verified === true,
        sensei: o.sensei === true,
        diamond: o.diamond === true,
      },
      photo: typeof o.photo === "string" && o.photo.startsWith("https://") ? o.photo : null,
    });
  }
  return map;
}

// --- Cache + batching modul: satu RPC untuk banyak identitas yang tampil bersamaan. -------------
const TTL_MS = 5 * 60_000;
const BATCH_MS = 60;
const MAX_IDS = 100;

/** `loaded=false` = server belum menjawab/gagal: tidak boleh menampilkan badge (termasuk "Free"). */
type Entry = { meta: PublicMeta; loaded: boolean; at: number };
const NOT_LOADED: PublicMeta = { badges: NO_BADGES, photo: null };
const cache = new Map<string, Entry>();
const pending = new Set<string>();
const inflight = new Set<string>();
const listeners = new Set<() => void>();
let timer: ReturnType<typeof setTimeout> | undefined;
let version = 0;

function emit() {
  version += 1;
  for (const l of listeners) l();
}

async function flush() {
  timer = undefined;
  const all = [...pending];
  pending.clear();
  for (let i = 0; i < all.length; i += MAX_IDS) {
    const ids = all.slice(i, i + MAX_IDS);
    ids.forEach((id) => inflight.add(id));
    try {
      const { data, error } = await supabase.rpc(
        "social_badges" as never,
        {
          p_users: ids,
        } as never,
      );
      if (error) throw new Error(error.message);
      const found = parsePublicMeta(data);
      const now = Date.now();
      // Id yang tidak ada di jawaban (akun tidak dikenal) tetap "belum dimuat": tanpa badge.
      for (const id of ids) {
        const meta = found.get(id);
        cache.set(id, { meta: meta ?? NOT_LOADED, loaded: meta !== undefined, at: now });
      }
    } catch {
      // Gagal = tanpa badge/foto (tidak pernah menebak); dicoba lagi setelah jeda singkat.
      const now = Date.now() - TTL_MS + 15_000;
      for (const id of ids) cache.set(id, { meta: NOT_LOADED, loaded: false, at: now });
    } finally {
      ids.forEach((id) => inflight.delete(id));
    }
  }
  emit();
}

function request(id: string) {
  const hit = cache.get(id);
  if (hit && Date.now() - hit.at < TTL_MS) return;
  if (pending.has(id) || inflight.has(id)) return;
  pending.add(id);
  timer ??= setTimeout(() => void flush(), BATCH_MS);
}

export function resetSocialBadges() {
  cache.clear();
  pending.clear();
  emit();
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

/** Badge + foto milik satu user; meminta dari server (batch) bila belum ada di cache. */
export function useSocialIdentity(userId: string | null | undefined): PublicMeta & {
  loaded: boolean;
} {
  useSyncExternalStore(
    subscribe,
    () => version,
    () => 0,
  );
  useEffect(() => {
    if (userId) request(userId);
  }, [userId]);
  const hit = userId ? cache.get(userId) : undefined;
  return { ...(hit?.meta ?? NOT_LOADED), loaded: hit?.loaded ?? false };
}
