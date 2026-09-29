import type { KiokuEvent } from "./types";

export type StorageLike = Pick<Storage, "getItem" | "setItem" | "removeItem">;
export const BATCH_SIZE = 50;

const key = (userId: string) => `eno-kioku-outbox-v1:${userId}`;

function read(storage: StorageLike, userId: string): KiokuEvent[] {
  try {
    const raw = storage.getItem(key(userId));
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}
function write(storage: StorageLike, userId: string, events: KiokuEvent[]) {
  try {
    if (events.length) storage.setItem(key(userId), JSON.stringify(events));
    else storage.removeItem(key(userId));
  } catch {
    /* storage full/blocked: events stay in memory copy held by the caller */
  }
}

/**
 * Durable outbox. `push` is synchronous (no network). `flush` sends batches through `sender`
 * (idempotent server side via client_event_id); events are removed only after the sender resolves,
 * so a failed batch or a crash keeps everything for the next flush / next page load.
 */
export function createOutbox(
  userId: string,
  storage: StorageLike,
  sender: (batch: KiokuEvent[]) => Promise<void>,
) {
  let inflight: Promise<{ sent: number; remaining: number; ok: boolean }> | null = null;
  const memory: KiokuEvent[] = read(storage, userId);

  const persist = () => write(storage, userId, memory);
  const api = {
    pending: () => memory.length,
    push(ev: KiokuEvent) {
      if (memory.some((e) => e.client_event_id === ev.client_event_id)) return;
      memory.push(ev);
      persist();
    },
    flush(): Promise<{ sent: number; remaining: number; ok: boolean }> {
      if (inflight) return inflight;
      inflight = (async () => {
        let sent = 0;
        try {
          while (memory.length) {
            const batch = memory.slice(0, BATCH_SIZE);
            await sender(batch);
            const ids = new Set(batch.map((e) => e.client_event_id));
            for (let i = memory.length - 1; i >= 0; i--)
              if (ids.has(memory[i]!.client_event_id)) memory.splice(i, 1);
            persist();
            sent += batch.length;
          }
          return { sent, remaining: 0, ok: true };
        } catch {
          return { sent, remaining: memory.length, ok: false };
        } finally {
          inflight = null;
        }
      })();
      return inflight;
    },
  };
  return api;
}
