import type { Membership } from "@/lib/membership";

/** Peran staf mengikuti resolver server (get_my_membership): tidak punya langganan bertanggal. */
const STAFF_ROLES = ["owner", "admin", "editor", "teacher"];

export type PremiumStatus =
  | { kind: "lifetime"; label: string }
  | { kind: "open"; label: string }
  | { kind: "timed"; label: string; untilLabel: string };

const DAY_MS = 24 * 60 * 60 * 1000;

const formatUntil = (until: Date) =>
  new Intl.DateTimeFormat("id-ID", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "Asia/Jakarta",
  }).format(until);

/**
 * Status Premium untuk Home. Sumber kebenaran: hasil get_my_membership (plan sudah memperhitungkan kedaluwarsa);
 * `now` disuntikkan agar deterministik. Free/kedaluwarsa/staf → null (tidak ada hitung mundur palsu).
 */
export function premiumStatus(
  membership: Pick<Membership, "plan" | "premiumUntil"> | null | undefined,
  role: string | null | undefined,
  now: Date,
): PremiumStatus | null {
  if (!membership || membership.plan === "free") return null;
  if (role && STAFF_ROLES.includes(role)) return null;
  if (membership.plan === "lifetime") return { kind: "lifetime", label: "Premium Seumur Hidup" };
  if (!membership.premiumUntil) return { kind: "open", label: "Premium aktif" };
  const until = new Date(membership.premiumUntil);
  if (Number.isNaN(until.getTime())) return { kind: "open", label: "Premium aktif" };
  const remaining = until.getTime() - now.getTime();
  // Kedaluwarsa walau cron belum menormalkan baris: bukan Premium aktif.
  if (remaining <= 0) return null;
  const label =
    remaining < DAY_MS
      ? "Premium • kurang dari 24 jam lagi"
      : `Premium • ${Math.ceil(remaining / DAY_MS)} hari lagi`;
  return { kind: "timed", label, untilLabel: `Aktif hingga ${formatUntil(until)}` };
}
