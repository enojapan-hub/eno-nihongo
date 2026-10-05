import { useSyncExternalStore } from "react";

/** Konteks publik yang boleh ditampilkan di Profile Card (hanya bila pemanggil memang menampilkannya, mis. Leaderboard). */
export type ProfileCardContext = {
  rank?: number;
  points?: number;
  pointsLabel?: string;
  level?: string;
};
export type ProfileCardState = { userId: string; context: ProfileCardContext | null } | null;

let state: ProfileCardState = null;
const subs = new Set<() => void>();
const emit = () => {
  for (const fn of [...subs]) fn();
};

/** Satu Profile Card untuk seluruh aplikasi (Global, Leaderboard, Teman, Chat). */
export const profileCard = {
  get: () => state,
  open: (userId: string, context: ProfileCardContext | null = null) => {
    state = { userId, context };
    emit();
  },
  close: () => {
    if (state === null) return;
    state = null;
    emit();
  },
};

export function useProfileCard(): ProfileCardState {
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
