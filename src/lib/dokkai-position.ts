/** Last Dokkai reading position on this device, so the learner can resume where they stopped. */
export const DOKKAI_LAST_KEY = "eno:dokkai:last";
export type DokkaiLastPosition = {
  id: string;
  title: string;
  level: string;
  scrollY: number;
  at: number;
};

export function readDokkaiPosition(): DokkaiLastPosition | null {
  try {
    const value = JSON.parse(localStorage.getItem(DOKKAI_LAST_KEY) ?? "null") as unknown;
    if (!value || typeof value !== "object") return null;
    const v = value as Partial<DokkaiLastPosition>;
    return typeof v.id === "string" && typeof v.title === "string"
      ? {
          id: v.id,
          title: v.title,
          level: String(v.level ?? ""),
          scrollY: Number(v.scrollY ?? 0),
          at: Number(v.at ?? 0),
        }
      : null;
  } catch {
    return null;
  }
}

export function saveDokkaiPosition(value: DokkaiLastPosition) {
  try {
    localStorage.setItem(DOKKAI_LAST_KEY, JSON.stringify(value));
  } catch {
    /* storage unavailable */
  }
}
