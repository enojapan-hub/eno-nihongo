/**
 * Fondasi avatar: database hanya menyimpan `avatar_id` (0–99). Daftar avatar statis ditambah di sini
 * (tanpa migration). Belum ada upload; id yang belum dikenal jatuh ke avatar default.
 */
export type SocialAvatar = { id: number; label: string; tone: string };

export const AVATARS: readonly SocialAvatar[] = [
  { id: 0, label: "Default", tone: "bg-primary/15 text-primary" },
];

export function avatarFor(id: number | null | undefined): SocialAvatar {
  return AVATARS.find((a) => a.id === id) ?? (AVATARS[0] as SocialAvatar);
}
