// Pelabelan Riwayat Pembelian. Kosakata status/jenis mengikuti CHECK constraint `payment_orders`.
export type OrderStatus = "pending" | "paid" | "failed" | "cancelled" | "refunded";

const STATUS: Record<OrderStatus, { label: string; tone: "ok" | "wait" | "bad" | "neutral" }> = {
  pending: { label: "Menunggu pembayaran", tone: "wait" },
  paid: { label: "Berhasil", tone: "ok" },
  failed: { label: "Gagal", tone: "bad" },
  cancelled: { label: "Dibatalkan", tone: "neutral" },
  refunded: { label: "Dikembalikan", tone: "neutral" },
};

export function orderStatusInfo(status: string) {
  return STATUS[status as OrderStatus] ?? { label: status || "Tidak diketahui", tone: "neutral" as const };
}

const PRODUCT: Record<string, string> = {
  subscription: "Langganan Premium",
  lifetime: "Premium Lifetime",
  teacher_class: "Kelas",
};

const PLAN: Record<string, string> = { monthly: "Bulanan", yearly: "Tahunan", lifetime: "Lifetime" };

export function orderTitle(productType: string, plan: string | null, durationDays: number | null) {
  const base = PRODUCT[productType] ?? productType;
  const planLabel = plan ? PLAN[plan] : undefined;
  const parts = [base];
  if (planLabel && productType === "subscription") parts.push(planLabel);
  if (durationDays && productType === "subscription") parts.push(`${durationDays} hari`);
  return parts.join(" · ");
}

const GRANT: Record<string, string> = {
  referral_premium: "Hadiah referral",
  points_premium: "Tukar poin",
};

export function grantTitle(kind: string, premiumDays: number | null) {
  const base = GRANT[kind] ?? kind;
  return premiumDays ? `${base} · Premium ${premiumDays} hari` : base;
}
