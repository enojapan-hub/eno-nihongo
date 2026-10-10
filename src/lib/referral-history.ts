// Pelabelan riwayat referral. Kosakata status mengikuti tabel `referrals` ('pending' -> 'completed').
export function referralStatusInfo(status: string, role: "referrer" | "referred") {
  if (status === "completed") {
    return role === "referrer"
      ? { label: "Hadiah diterima", tone: "ok" as const }
      : { label: "Kamu sudah mulai belajar", tone: "ok" as const };
  }
  if (status === "pending") {
    return role === "referrer"
      ? { label: "Menunggu teman mulai belajar", tone: "wait" as const }
      : { label: "Mulai belajar agar pengundang mendapat hadiah", tone: "wait" as const };
  }
  return { label: status || "Tidak diketahui", tone: "neutral" as const };
}

export function summarizeReferrals(rows: { status: string }[]) {
  const total = rows.length;
  const completed = rows.filter((r) => r.status === "completed").length;
  return { total, completed, pending: rows.filter((r) => r.status === "pending").length };
}
