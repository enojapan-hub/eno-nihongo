import { useEffect, useSyncExternalStore } from "react";
import { supabase } from "@/integrations/supabase/client";

/** Status publik minimal dari RPC `social_badges` (role/plan mentah tidak pernah sampai ke klien). */
export type SocialBadges = { verified: boolean; sensei: boolean; diamond: boolean };

export const NO_BADGES: SocialBadges = { verified: false, sensei: false, diamond: false };

export type BadgeKind = "verified" | "sensei" | "diamond";

export const BADGE_META: Record<BadgeKind, { label: string; text: string }> = {
  verified: { label: "Akun resmi ENO NIHONGO", text: "Verified" },
  sensei: { label: "Guru ENO NIHONGO", text: "Sensei" },
  diamond: { label: "Member Premium", text: "Premium" },
};

/** Urutan tampil tetap: Verified, Sensei, Diamond. Hanya yang benar-benar bernilai true. */
export function badgeKinds(b: SocialBadges | null | undefined): BadgeKind[] {
  if (!b) return [];
  const out: BadgeKind[] = [];
  if (b.verified === true) out.push("verified");
  if (b.sensei === true) out.push("sensei");
  if (b.diamond === true) out.push("diamond");
  return out;
}

/** Respons RPC → peta aman. Nilai selain `true` (termasuk string/angka) diperlakukan sebagai tidak ada. */
export function parseBadgeMap(raw: unknown): Map<string, SocialBadges> {
  const map = new Map<string, SocialBadges>();
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return map;
  for (const [id, v] of Object.entries(raw as Record<string, unknown>)) {
    if (!v || typeof v !== "object") continue;
    const o = v as { verified?: unknown; sensei?: unknown; diamond?: unknown };
    const b: SocialBadges = {
      verified: o.verified === true,
      sensei: o.sensei === true,
      diamond: o.diamond === true,
    };
    if (badgeKinds(b).length > 0) map.set(id, b);
  }
  return map;
}

// --- Cache + batching modul: satu RPC untuk banyak identitas yang tampil bersamaan. -------------
const TTL_MS = 5 * 60_000;
const BATCH_MS = 60;
const MAX_IDS = 100;

type Entry = { badges: SocialBadges; at: number };
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
      const found = parseBadgeMap(data);
      const now = Date.now();
      for (const id of ids) cache.set(id, { badges: found.get(id) ?? NO_BADGES, at: now });
    } catch {
      // Gagal = tanpa badge (tidak pernah menebak); dicoba lagi setelah jeda singkat.
      const now = Date.now() - TTL_MS + 15_000;
      for (const id of ids) cache.set(id, { badges: NO_BADGES, at: now });
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

/** Badge milik satu user; meminta dari server bila belum ada di cache. */
export function useSocialBadges(userId: string | null | undefined): SocialBadges {
  useSyncExternalStore(
    subscribe,
    () => version,
    () => 0,
  );
  useEffect(() => {
    if (userId) request(userId);
  }, [userId]);
  return (userId && cache.get(userId)?.badges) || NO_BADGES;
}
