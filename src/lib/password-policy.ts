/** Satu aturan kata sandi untuk daftar, atur ulang, dan ubah dari profil. */
export const PASSWORD_MIN_LENGTH = 8;

export const PASSWORD_TOO_SHORT_MESSAGE = `Kata sandi minimal ${PASSWORD_MIN_LENGTH} karakter.`;
export const PASSWORD_MISMATCH_MESSAGE = "Kata sandi baru dan konfirmasi tidak sama.";

/** Mengembalikan pesan Indonesia bila tidak valid, atau null bila valid. Tidak pernah mencatat kata sandi. */
export function validateNewPassword(password: string, confirm?: string): string | null {
  if (!password) return "Masukkan kata sandi baru.";
  if (password.length < PASSWORD_MIN_LENGTH) return PASSWORD_TOO_SHORT_MESSAGE;
  if (confirm !== undefined && password !== confirm) return PASSWORD_MISMATCH_MESSAGE;
  return null;
}
