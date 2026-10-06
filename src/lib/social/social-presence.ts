import { useEffect, useRef, useSyncExternalStore } from "react";
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

/** Status koneksi Realtime untuk UI ("Menghubungkan ulang…"), jujur terhadap kondisi sebenarnya. */
export type ConnectionStatus = "connecting" | "online" | "reconnecting";
let connection: ConnectionStatus = "connecting";
const connListeners = new Set<() => void>();
export function setConnectionStatus(next: ConnectionStatus) {
  if (connection === next) return;
  connection = next;
  for (const l of connListeners) l();
}
export function statusFromChannel(status: string): ConnectionStatus | null {
  if (status === "SUBSCRIBED") return "online";
  if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED")
    return "reconnecting";
  return null;
}
export function useConnectionStatus(): ConnectionStatus {
  return useSyncExternalStore(
    (cb) => {
      connListeners.add(cb);
      return () => connListeners.delete(cb);
    },
    () => connection,
    () => "connecting" as ConnectionStatus,
  );
}

/**
 * Satu channel Presence untuk seluruh aplikasi; dipasang di ChatDock saat sudah masuk.
 * `share=false` (privasi "Tampilkan status online" mati): tetap membaca presence orang lain tetapi
 * TIDAK mengumumkan diri sendiri, sehingga akun ini tidak ada di presence state siapa pun.
 */
export function usePresenceTracking(userId: string | null, share: boolean) {
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const subscribed = useRef(false);
  const shareRef = useRef(share);
  shareRef.current = share;

  useEffect(() => {
    if (!userId) return;
    const channel = supabase.channel(PRESENCE_CHANNEL, {
      config: { presence: { key: userId } },
    });
    channelRef.current = channel;
    channel
      .on("presence", { event: "sync" }, () => {
        setOnline(onlineFromState(channel.presenceState() as Record<string, unknown[]>));
      })
      .subscribe((status) => {
        subscribed.current = status === "SUBSCRIBED";
        if (status === "SUBSCRIBED" && shareRef.current) void channel.track({ online: true });
      });
    return () => {
      subscribed.current = false;
      channelRef.current = null;
      void channel.untrack();
      void supabase.removeChannel(channel);
      setOnline(new Set());
    };
  }, [userId]);

  useEffect(() => {
    const channel = channelRef.current;
    if (!channel || !subscribed.current) return;
    if (share) void channel.track({ online: true });
    else void channel.untrack();
  }, [share]);
}
