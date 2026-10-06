/**
 * Pesan simpan profil untuk pengguna. Pesan mentah database (mis. "permission denied for function ...")
 * tidak pernah ditampilkan; detail teknis tetap tercatat di log server.
 */
export const PROFILE_SAVE_FAILED = "Profil belum berhasil disimpan. Silakan coba lagi.";
export const SETTINGS_SAVE_FAILED = "Pengaturan belum berhasil disimpan. Silakan coba lagi.";
export const NAME_UNAVAILABLE = "Nama tampilan tidak tersedia. Gunakan nama lain.";

/** Hanya penolakan nama resmi dari aturan anti-peniruan yang diteruskan (sudah berbahasa Indonesia). */
export function profileSaveErrorMessage(raw: string | null | undefined): string {
  if (raw && raw.includes("Nama tampilan tidak tersedia")) return NAME_UNAVAILABLE;
  return PROFILE_SAVE_FAILED;
}
