/**
 * Warna username Global Chat: deterministik dari identifier akun yang stabil (user id),
 * dipetakan ke palet terbatas. Tanpa random, tanpa penyimpanan; id tidak pernah tampil di UI.
 * Kelas ditulis lengkap agar terdeteksi Tailwind. Pasangan 700 (terang) / 300 (gelap)
 * dipilih supaya kontras teks kecil ≥ 4.5:1 di latar putih maupun gelap.
 */
export const USERNAME_PALETTE = [
  "text-red-700 dark:text-red-300",
  "text-orange-700 dark:text-orange-300",
  "text-amber-700 dark:text-amber-300",
  "text-lime-800 dark:text-lime-300",
  "text-emerald-700 dark:text-emerald-300",
  "text-teal-700 dark:text-teal-300",
  "text-cyan-700 dark:text-cyan-300",
  "text-blue-700 dark:text-blue-300",
  "text-violet-700 dark:text-violet-300",
  "text-fuchsia-700 dark:text-fuchsia-300",
] as const;

/** FNV-1a 32-bit + finalizer murmur3 (agar id yang mirip tetap tersebar di palet). */
export function stableHash(input: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  h ^= h >>> 16;
  h = Math.imul(h, 0x85ebca6b);
  h ^= h >>> 13;
  h = Math.imul(h, 0xc2b2ae35);
  h ^= h >>> 16;
  return h >>> 0;
}

export function usernameColorIndex(userId: string): number {
  return stableHash(userId) % USERNAME_PALETTE.length;
}

export function usernameColorClass(userId: string): string {
  return USERNAME_PALETTE[usernameColorIndex(userId)] as string;
}
