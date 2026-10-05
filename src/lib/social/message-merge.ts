/** Helper murni untuk menggabungkan halaman pesan (riwayat + realtime) tanpa duplikat. */
type Timed = { id: string; created_at: string };

/** Terbaru dulu; urutan sama dengan RPC (created_at desc, id desc). */
export function compareDesc(a: Timed, b: Timed): number {
  if (a.created_at !== b.created_at) return a.created_at < b.created_at ? 1 : -1;
  return a.id < b.id ? 1 : a.id > b.id ? -1 : 0;
}

/** Gabungkan; item `incoming` menimpa item lama dengan id sama (mis. pesan yang dihapus). */
export function mergeMessages<T extends Timed>(
  existing: readonly T[],
  incoming: readonly T[],
): T[] {
  const byId = new Map<string, T>();
  for (const m of existing) byId.set(m.id, m);
  for (const m of incoming) byId.set(m.id, m);
  return [...byId.values()].sort(compareDesc);
}

/** Kursor halaman berikutnya (pesan tertua yang sudah dimuat). */
export function olderCursor<T extends Timed>(
  messages: readonly T[],
): { at: string; id: string } | null {
  const last = messages[messages.length - 1];
  return last ? { at: last.created_at, id: last.id } : null;
}

/** Lencana ikon mengambang: jumlah semua unread, dibatasi untuk tampilan. */
export function unreadBadge(
  s: { global: number; dm: number; requests: number } | null | undefined,
): {
  total: number;
  label: string | null;
} {
  const total = s ? Math.max(0, s.global) + Math.max(0, s.dm) + Math.max(0, s.requests) : 0;
  return { total, label: total <= 0 ? null : total > 99 ? "99+" : String(total) };
}

/** Halaman yang tidak boleh ditutupi ikon chat: login/publik, pembayaran, dan ujian/kuis fokus. */
export function dockHiddenOn(pathname: string): boolean {
  return (
    pathname === "/" ||
    pathname === "/auth" ||
    pathname.startsWith("/reset-password") ||
    pathname.startsWith("/onboarding") ||
    pathname.startsWith("/checkout") ||
    pathname.startsWith("/pembayaran") ||
    pathname.startsWith("/simulasi-bagian") ||
    pathname.startsWith("/eno-exam/") ||
    /^\/(kelas|guru-kelas)\/[^/]+\/quiz\//.test(pathname) ||
    /^\/guru-kelas\.[^/]+\.quiz\./.test(pathname)
  );
}
