import { useEffect, useSyncExternalStore } from "react";
import { supabase } from "@/integrations/supabase/client";

/**
 * Status Online dari Supabase Realtime Presence (bukan kolom database). Kunci presence = id akun;
 * online bila minimal satu sesi (tab/perangkat) masih terhubung. Tidak ada last seen/lokasi/halaman.
 */
const PRESENCE_CHANNEL = "social-presence";

/** `presenceState()` → id yang punya >= 1 sesi aktif. */
export function onlineFromState(state: Record<string, unknown[] | undefined> | null): Set<string> {
  const out = new Set<string>();
  if (!state) return out;
  for (const [key, sessions] of Object.entries(state)) {
    if (Array.isArray(sessions) && sessions.length > 0) out.add(key);
  }
  return out;
}

let online = new Set<string>();
let version = 0;
const listeners = new Set<() => void>();
function setOnline(next: Set<string>) {
  online = next;
  version += 1;
  for (const l of listeners) l();
}
function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

export function useIsOnline(userId: string | null | undefined): boolean {
  useSyncExternalStore(
    subscribe,
    () => version,
    () => 0,
  );
  return !!userId && online.has(userId);
}

/** Satu channel Presence untuk seluruh aplikasi; dipasang di ChatDock saat sudah masuk. */
export function usePresenceTracking(userId: string | null) {
  useEffect(() => {
    if (!userId) return;
    const channel = supabase.channel(PRESENCE_CHANNEL, {
      config: { presence: { key: userId } },
    });
    channel
      .on("presence", { event: "sync" }, () => {
        setOnline(onlineFromState(channel.presenceState() as Record<string, unknown[]>));
      })
      .subscribe((status) => {
        if (status === "SUBSCRIBED") void channel.track({ online: true });
      });
    return () => {
      void channel.untrack();
      void supabase.removeChannel(channel);
      setOnline(new Set());
    };
  }, [userId]);
}
