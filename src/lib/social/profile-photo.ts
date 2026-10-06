/**
 * Foto profil sosial: satu sumber, `profiles.avatar_url` (foto Google saat pertama login atau unggahan
 * pengguna). Server hanya meneruskan URL Google / bucket avatars proyek ini ke penonton.
 */
const GOOGLE_PHOTO = /^https:\/\/lh\d{1,2}\.googleusercontent\.com\//;

export function isGooglePhotoUrl(url: string | null | undefined): url is string {
  return typeof url === "string" && GOOGLE_PHOTO.test(url);
}

/** Foto Google berakhir `=s96-c`; minta ukuran yang sesuai tampilan agar tajam (bukan 96px dibesarkan). */
export function sizedPhoto(url: string, px: number): string {
  if (!isGooglePhotoUrl(url)) return url;
  const size = Math.max(32, Math.min(1024, Math.round(px)));
  return /=s\d+(-c)?$/.test(url) ? url.replace(/=s\d+(-c)?$/, `=s${size}-c`) : url;
}

/**
 * Sinkron foto Google bila berubah. Hanya menimpa foto yang saat ini berasal dari Google (atau kosong);
 * foto unggahan pengguna tidak pernah ditimpa. Mengembalikan URL baru atau null (tidak ada perubahan).
 */
export function googlePhotoToSync(
  current: string | null | undefined,
  fromAuth: string | null | undefined,
): string | null {
  if (!isGooglePhotoUrl(fromAuth)) return null;
  const cur = (current ?? "").trim();
  if (cur === fromAuth) return null;
  if (cur === "" || isGooglePhotoUrl(cur)) return fromAuth;
  return null;
}

/** Foto Google dari metadata Auth (bidang yang sama dengan halaman Foto Profil). */
export function googlePhotoFromMetadata(meta: unknown): string | null {
  if (!meta || typeof meta !== "object") return null;
  const m = meta as Record<string, unknown>;
  const url = String(m["avatar_url"] ?? m["picture"] ?? "").trim();
  return isGooglePhotoUrl(url) ? url : null;
}

/** Avatar bawaan ENO NIHONGO (maskot) bila foto tidak ada atau gagal dimuat. */
export const DEFAULT_PHOTO = "/icon-512.png";
export const DEFAULT_PHOTO_SMALL = "/icon-192.png";
