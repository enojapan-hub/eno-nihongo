import type { StorageLike } from "./outbox";
import type { KiokuSession } from "./session-types";

const TTL_MS = 24 * 3600 * 1000;
const key = (userId: string) => `eno-kioku-session-v1:${userId}`;

export function saveSession(storage: StorageLike, userId: string, s: KiokuSession) {
  try {
    storage.setItem(key(userId), JSON.stringify(s));
  } catch {
    /* ignore */
  }
}
export function clearSession(storage: StorageLike, userId: string) {
  try {
    storage.removeItem(key(userId));
  } catch {
    /* ignore */
  }
}
/** Restores an unfinished session of the last 24h; anything else is dropped. */
export function loadSession(
  storage: StorageLike,
  userId: string,
  now = Date.now(),
): KiokuSession | null {
  try {
    const raw = storage.getItem(key(userId));
    if (!raw) return null;
    const s = JSON.parse(raw) as KiokuSession;
    if (!s?.sessionId || !Array.isArray(s.exercises) || s.finished || s.index >= s.exercises.length)
      return null;
    if (now - new Date(s.createdAt).getTime() > TTL_MS) return null;
    return s;
  } catch {
    return null;
  }
}
