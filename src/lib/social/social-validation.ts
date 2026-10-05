/** Aturan username dan pesan Social/Chat. Database tetap yang menjamin keunikan dan format (lihat migration). */
export const USERNAME_MIN = 3;
export const USERNAME_MAX = 20;
export const USERNAME_PATTERN = /^[a-z0-9_]{3,20}$/;
export const GLOBAL_MESSAGE_MAX = 500;
export const DM_MESSAGE_MAX = 1000;
export const DISPLAY_NAME_MAX = 40;

/** Normalisasi yang sama dengan database: trim + huruf kecil. */
export function normalizeUsername(input: string): string {
  return input.trim().toLowerCase();
}

export type UsernameIssue = "invalid_username" | "invalid_display_name";

/** null bila valid; format saja (keunikan hanya bisa dipastikan database). */
export function usernameIssue(input: string): UsernameIssue | null {
  return USERNAME_PATTERN.test(normalizeUsername(input)) ? null : "invalid_username";
}

export function displayNameIssue(input: string): UsernameIssue | null {
  const v = input.trim();
  if (v === "") return null;
  if (v.length > DISPLAY_NAME_MAX || v.includes("@")) return "invalid_display_name";
  return null;
}

/** Kode galat dari RPC (isi `raise exception`) -> pesan untuk pengguna. */
const MESSAGES: Record<string, string> = {
  auth_required: "Silakan masuk terlebih dahulu.",
  suspended: "Akunmu sedang dinonaktifkan.",
  username_required: "Atur username dulu untuk memakai fitur ini.",
  invalid_username: "Username 3–20 karakter, hanya huruf kecil, angka, dan garis bawah (_).",
  username_reserved: "Username ini tidak tersedia.",
  username_taken: "Username sudah dipakai.",
  username_already_set: "Username sudah diatur dan tidak bisa diganti.",
  invalid_display_name: "Nama tampilan maksimal 40 karakter dan tidak boleh memuat @.",
  user_not_found: "Pengguna tidak ditemukan.",
  self_target: "Tidak bisa dilakukan pada diri sendiri.",
  blocked: "Tidak bisa berinteraksi dengan pengguna ini.",
  already_friends: "Kalian sudah berteman.",
  request_exists: "Permintaan sudah dikirim.",
  no_request: "Permintaan tidak ditemukan.",
  not_friends: "Hanya teman yang bisa saling mengirim pesan.",
  too_many_requests: "Terlalu banyak permintaan menunggu. Coba lagi nanti.",
  message_empty: "Pesan tidak boleh kosong.",
  message_too_long: "Pesan terlalu panjang.",
  rate_limited: "Terlalu cepat. Tunggu sebentar lalu coba lagi.",
  forbidden: "Kamu tidak berhak melakukan ini.",
  not_found: "Pesan tidak ditemukan.",
  invalid_scope: "Laporan tidak valid.",
};

export function socialErrorCode(err: unknown): string | null {
  const raw =
    typeof err === "string"
      ? err
      : err && typeof err === "object" && "message" in err
        ? String((err as { message: unknown }).message)
        : "";
  const code = raw.trim();
  return code in MESSAGES ? code : null;
}

export function socialErrorMessage(err: unknown): string {
  const code = socialErrorCode(err);
  return code ? (MESSAGES[code] as string) : "Terjadi kesalahan. Coba lagi.";
}
