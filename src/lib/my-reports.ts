// Laporan bantuan milik sendiri (RPC get_my_reports). Kosakata status mengikuti constraint content_reports.
export type MyReport = {
  id: string;
  category: string;
  subject: string;
  status: string;
  created_at: string;
  updated_at: string;
};

const STATUS: Record<string, { label: string; tone: "ok" | "wait" | "neutral" }> = {
  open: { label: "Baru", tone: "wait" },
  reviewing: { label: "Diproses", tone: "wait" },
  resolved: { label: "Selesai", tone: "ok" },
  rejected: { label: "Ditutup", tone: "neutral" },
};

const CATEGORY: Record<string, string> = {
  bug: "Bug / tampilan",
  content: "Materi",
  account: "Akun",
  payment: "Pembayaran",
  suggestion: "Saran",
  other: "Lainnya",
};

export function reportStatusInfo(status: string) {
  return STATUS[status] ?? { label: status || "Tidak diketahui", tone: "neutral" as const };
}

export function reportCategoryLabel(category: string) {
  return CATEGORY[category] ?? category;
}

const isString = (v: unknown): v is string => typeof v === "string";

/** Validasi hasil RPC saat runtime; baris yang bentuknya salah dibuang, bukan ditebak. */
export function parseMyReports(data: unknown): MyReport[] {
  if (!Array.isArray(data)) return [];
  const rows: MyReport[] = [];
  for (const item of data) {
    if (typeof item !== "object" || item === null) continue;
    const r = item as Record<string, unknown>;
    if (isString(r.id) && isString(r.category) && isString(r.subject) && isString(r.status) && isString(r.created_at) && isString(r.updated_at)) {
      rows.push({ id: r.id, category: r.category, subject: r.subject, status: r.status, created_at: r.created_at, updated_at: r.updated_at });
    }
  }
  return rows;
}
