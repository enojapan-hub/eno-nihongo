/**
 * Penghubung kecil antara satu langganan Realtime (ChatDock) dan komponen yang menampilkan data.
 * Satu channel untuk seluruh aplikasi: tidak ada langganan ganda dan pembersihan terpusat.
 */
export type SocialEvent =
  | { type: "global"; kind: "insert" | "update"; id: string }
  | { type: "dm"; kind: "insert" | "update"; id: string; conversationId: string }
  | { type: "friends" };

type Listener = (e: SocialEvent) => void;
const listeners = new Set<Listener>();

export function onSocialEvent(fn: Listener): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

export function emitSocialEvent(e: SocialEvent) {
  for (const fn of [...listeners]) fn(e);
}

export function socialListenerCount(): number {
  return listeners.size;
}
