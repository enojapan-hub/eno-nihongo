/**
 * Pemeta error Auth → pesan Bahasa Indonesia. Pesan mentah Supabase (yang bisa memuat detail internal)
 * tidak pernah ditampilkan ke pengguna.
 */
export type AuthErrorContext =
  | "signin"
  | "signup"
  | "recovery-request"
  | "recovery-link"
  | "password-update"
  | "reauth"
  | "oauth"
  | "signout";

interface AuthErrorLike {
  code?: string;
  status?: number;
  name?: string;
  message?: string;
}

const asLike = (error: unknown): AuthErrorLike =>
  error && typeof error === "object" ? (error as AuthErrorLike) : {};

export const INVALID_CREDENTIALS_MESSAGE = "Email atau kata sandi tidak cocok.";
export const ALREADY_REGISTERED_MESSAGE = "Email ini sudah terdaftar. Silakan masuk ke akun Anda.";
export const RATE_LIMIT_MESSAGE = "Terlalu banyak percobaan. Tunggu beberapa saat lalu coba lagi.";
export const NETWORK_MESSAGE = "Koneksi bermasalah. Periksa internet Anda lalu coba lagi.";
export const SERVER_MESSAGE = "Layanan sedang bermasalah. Coba lagi beberapa saat lagi.";
export const RECOVERY_LINK_INVALID_MESSAGE =
  "Tautan atur ulang kata sandi tidak valid atau sudah kedaluwarsa. Minta tautan baru.";

const FALLBACK: Record<AuthErrorContext, string> = {
  signin: "Gagal masuk. Coba lagi.",
  signup: "Gagal membuat akun. Coba lagi.",
  "recovery-request": "Permintaan tidak dapat diproses. Coba lagi.",
  "recovery-link": RECOVERY_LINK_INVALID_MESSAGE,
  "password-update": "Kata sandi tidak dapat diubah. Coba lagi.",
  reauth: "Kode verifikasi tidak dapat dikirim. Coba lagi.",
  oauth: "Gagal masuk dengan Google. Coba lagi.",
  signout: "Gagal keluar dari perangkat. Coba lagi.",
};

export function isRateLimited(error: unknown): boolean {
  const e = asLike(error);
  return (
    e.status === 429 ||
    e.code === "over_request_rate_limit" ||
    e.code === "over_email_send_rate_limit" ||
    /rate limit|too many requests|security purposes/i.test(e.message ?? "")
  );
}

export function isNetworkError(error: unknown): boolean {
  const e = asLike(error);
  return (
    e.name === "AuthRetryableFetchError" ||
    e.status === 0 ||
    /failed to fetch|network|fetch failed|load failed/i.test(e.message ?? "")
  );
}

/** True bila Supabase secara eksplisit menyatakan email sudah terdaftar (bukan respons kabur). */
export function isAlreadyRegistered(error: unknown): boolean {
  const e = asLike(error);
  return (
    e.code === "user_already_exists" ||
    e.code === "email_exists" ||
    /already registered|already been registered/i.test(e.message ?? "")
  );
}

export function authErrorMessage(error: unknown, context: AuthErrorContext): string {
  const e = asLike(error);
  const message = e.message ?? "";
  if (isRateLimited(error)) return RATE_LIMIT_MESSAGE;
  if (isNetworkError(error)) return NETWORK_MESSAGE;
  if (e.code === "invalid_credentials" || /invalid login credentials/i.test(message))
    return INVALID_CREDENTIALS_MESSAGE;
  if (e.code === "email_not_confirmed" || /email not confirmed/i.test(message))
    return "Email belum dikonfirmasi. Periksa inbox atau folder Spam lalu buka tautan konfirmasi.";
  if (isAlreadyRegistered(error)) return ALREADY_REGISTERED_MESSAGE;
  if (e.code === "weak_password" || /password should be at least|weak password/i.test(message))
    return "Kata sandi terlalu lemah. Gunakan minimal 8 karakter yang sulit ditebak.";
  if (e.code === "same_password" || /different from the old password/i.test(message))
    return "Kata sandi baru harus berbeda dari kata sandi saat ini.";
  if (e.code === "signup_disabled") return "Pendaftaran akun baru sedang dinonaktifkan.";
  if (e.code === "email_address_invalid" || e.code === "validation_failed")
    return "Alamat email tidak valid.";
  if (e.code === "user_banned") return "Akun ini sedang dinonaktifkan. Hubungi Admin.";
  if (e.code === "reauthentication_not_valid" || e.code === "reauth_nonce_missing")
    return "Kode verifikasi tidak valid atau sudah kedaluwarsa. Kirim kode baru.";
  if (
    e.code === "otp_expired" ||
    e.code === "flow_state_expired" ||
    e.code === "flow_state_not_found" ||
    e.code === "bad_code_verifier" ||
    e.code === "session_expired" ||
    e.code === "session_not_found" ||
    e.code === "bad_jwt"
  )
    return context === "password-update" || context === "reauth"
      ? "Sesi Anda sudah berakhir. Masuk kembali lalu ulangi."
      : RECOVERY_LINK_INVALID_MESSAGE;
  if ((e.status ?? 0) >= 500) return SERVER_MESSAGE;
  return FALLBACK[context];
}
