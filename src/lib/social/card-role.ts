import type { ProfileCapabilities, ProfileCardData } from "./social-types";

/** Hirarki bingkai Profile Card: OWNER > ADMIN > SENSEI > PREMIUM > FREE (role mengalahkan langganan). */
export type CardTier = "owner" | "admin" | "sensei" | "premium" | "free";

/** Tier dari data SERVER (role/premium efektif); tidak pernah dari username atau nama. */
export function cardTier(c: Pick<ProfileCardData, "official" | "role" | "premium">): CardTier {
  if (c.official || c.role === "owner") return "owner";
  if (c.role === "admin") return "admin";
  if (c.role === "teacher") return "sensei";
  if (c.premium === true) return "premium";
  return "free";
}

export const TIER_LABEL: Record<CardTier, string | null> = {
  owner: "OWNER · AKUN RESMI",
  admin: "ADMIN · TIM ENO NIHONGO",
  sensei: "先生 · PENGAJAR",
  premium: null,
  free: null,
};

/** Bingkai (tebal/warna/glow). Shimmer hanya untuk Owner dan dirender terpisah (lihat OwnerShimmer). */
export const TIER_FRAME: Record<CardTier, string> = {
  owner:
    "border-2 border-amber-400/90 ring-1 ring-emerald-500/60 shadow-[0_0_28px_-6px_rgba(16,185,129,0.55)]",
  admin: "border-2 border-red-600/85 ring-1 ring-red-700/40",
  sensei: "border-2 border-indigo-500/85 ring-1 ring-purple-500/40",
  premium: "border-[1.5px] border-sky-300/80 ring-1 ring-cyan-200/40",
  free: "border",
};

export const TIER_LABEL_CLASS: Record<CardTier, string> = {
  owner: "bg-emerald-600/10 text-emerald-700 ring-1 ring-amber-400/60 dark:text-emerald-300",
  admin: "bg-red-600/10 text-red-700 ring-1 ring-red-500/40 dark:text-red-300",
  sensei: "bg-indigo-600/10 text-indigo-700 ring-1 ring-purple-400/40 dark:text-indigo-300",
  premium: "",
  free: "",
};

/** Capabilities dari server; bila belum ada (server lama) turunkan secara konservatif dari field lama. */
export function resolveCapabilities(c: ProfileCardData): ProfileCapabilities {
  if (c.capabilities) return c.capabilities;
  const friend = c.relation === "friend";
  const open =
    friend || c.relation === "none" || c.relation === "incoming" || c.relation === "outgoing";
  return {
    can_message: friend && !c.dm_blocked,
    can_friend: c.relation === "none" && c.can_request,
    can_unfriend: friend && !c.official,
    can_block: open && c.has_username && !c.official,
    can_report: open && c.has_username && !c.official,
  };
}
