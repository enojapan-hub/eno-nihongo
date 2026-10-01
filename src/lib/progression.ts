export type AccountLevel = {
  level: number;
  currentXp: number;
  currentFloor: number;
  nextFloor: number | null;
  progress: number;
  xpToNext: number;
};

export const MAX_ACCOUNT_LEVEL = 100;

// Cumulative XP needed to enter a level.
// Lv1 = 0, Lv2 = 200, Lv3 = 500, Lv4 = 900, Lv5 = 1400, ...
export function xpFloorForLevel(level: number) {
  const safe = Math.max(1, Math.min(MAX_ACCOUNT_LEVEL, Math.trunc(level)));
  if (safe <= 1) return 0;
  return 50 * (safe - 1) * (safe + 2);
}

export function getAccountLevel(xp: number): AccountLevel {
  const safeXp = Math.max(0, Math.trunc(xp || 0));
  let level = 1;
  while (level < MAX_ACCOUNT_LEVEL && safeXp >= xpFloorForLevel(level + 1)) level += 1;
  const currentFloor = xpFloorForLevel(level);
  const nextFloor = level < MAX_ACCOUNT_LEVEL ? xpFloorForLevel(level + 1) : null;
  const span = nextFloor == null ? 1 : Math.max(1, nextFloor - currentFloor);
  const progress = nextFloor == null ? 100 : Math.min(100, Math.max(0, ((safeXp - currentFloor) / span) * 100));
  return { level, currentXp: safeXp, currentFloor, nextFloor, progress, xpToNext: nextFloor == null ? 0 : Math.max(0, nextFloor - safeXp) };
}

export const LEAGUES = [
  { name: "Bronze", minWeeklyXp: 0, rewardPoints: 25, rewardLabel: "25 Poin" },
  { name: "Silver", minWeeklyXp: 1500, rewardPoints: 50, rewardLabel: "50 Poin" },
  { name: "Gold", minWeeklyXp: 3500, rewardPoints: 100, rewardLabel: "100 Poin" },
  { name: "Platinum", minWeeklyXp: 7000, rewardPoints: 200, rewardLabel: "200 Poin" },
  { name: "Diamond", minWeeklyXp: 12000, rewardPoints: 350, rewardLabel: "350 Poin" },
] as const;

export type LeagueName = typeof LEAGUES[number]["name"];

export function getLeague(weeklyXp: number) {
  const xp = Math.max(0, Math.trunc(weeklyXp || 0));
  let index = 0;
  for (let i = 0; i < LEAGUES.length; i += 1) if (xp >= LEAGUES[i].minWeeklyXp) index = i;
  const current = LEAGUES[index];
  const next = LEAGUES[index + 1] ?? null;
  return {
    ...current,
    index,
    weeklyXp: xp,
    next,
    xpToNext: next ? Math.max(0, next.minWeeklyXp - xp) : 0,
    progress: next ? Math.min(100, ((xp - current.minWeeklyXp) / Math.max(1, next.minWeeklyXp - current.minWeeklyXp)) * 100) : 100,
  };
}
