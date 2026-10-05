import { useSyncExternalStore } from "react";
import type { SocialIdentity } from "./social-types";

/** Status panel chat mengambang; di luar komponen agar tidak reset saat minimize atau pindah halaman. */
export type DockTab = "global" | "friends" | "chat";
export type DockState = {
  open: boolean;
  everOpened: boolean;
  tab: DockTab;
  /** Percakapan DM yang sedang dibuka (null = daftar percakapan). */
  dm: SocialIdentity | null;
};

let state: DockState = { open: false, everOpened: false, tab: "global", dm: null };
const subs = new Set<() => void>();

function set(next: Partial<DockState>) {
  state = { ...state, ...next };
  for (const fn of [...subs]) fn();
}

export const dock = {
  get: () => state,
  open: (tab?: DockTab) => set({ open: true, everOpened: true, ...(tab ? { tab } : {}) }),
  close: () => set({ open: false }),
  setTab: (tab: DockTab) => set({ tab }),
  openDm: (who: SocialIdentity | null) =>
    set({ dm: who, ...(who ? { tab: "chat" as const, open: true, everOpened: true } : {}) }),
  reset: () => {
    state = { open: false, everOpened: false, tab: "global", dm: null };
    for (const fn of [...subs]) fn();
  },
};

export function useDock(): DockState {
  return useSyncExternalStore(
    (fn) => {
      subs.add(fn);
      return () => {
        subs.delete(fn);
      };
    },
    () => state,
    () => state,
  );
}
