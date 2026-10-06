import type { ReportCategory } from "./social-types";

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

/** Pesan khusus saat mengetik username (sebelum dikirim ke server). */
export function usernameHint(input: string): string | null {
  const v = normalizeUsername(input);
  if (v === "") return null;
  if (v.length < USERNAME_MIN) return "Username minimal 3 karakter.";
  if (!USERNAME_PATTERN.test(v)) return "Gunakan huruf kecil, angka, atau garis bawah.";
  return null;
}

/** Teks efektif kosong (spasi, kontrol, zero-width); aksara Jepang tidak terpengaruh. Cermin social_effectively_empty. */
export function isEffectivelyEmpty(input: string): boolean {
  const stripped = input
    .normalize("NFKC")
    .replace(/[\s\u200b-\u200f\u2028-\u202e\u2060\ufeff\u00ad\u3164]/g, "");
  // Karakter kontrol (U+0000–U+001F, U+007F) dibuang tanpa regex kontrol (lint no-control-regex).
  for (const ch of stripped) {
    const c = ch.codePointAt(0) as number;
    if (c > 0x1f && c !== 0x7f) return false;
  }
  return true;
}

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
  invalid_username: "Gunakan huruf kecil, angka, atau garis bawah (3–20 karakter).",
  username_reserved: "Username tidak tersedia.",
  username_taken: "Username sudah digunakan.",
  username_already_set: "Username sudah diatur. Gunakan Ubah Username di Edit Profil.",
  invalid_display_name: "Nama tampilan maksimal 40 karakter dan tidak boleh memuat @.",
  user_not_found: "Pengguna tidak ditemukan.",
  self_target: "Tidak bisa dilakukan pada diri sendiri.",
  blocked: "Tidak bisa berinteraksi dengan pengguna ini.",
  already_friends: "Kalian sudah berteman.",
  request_exists: "Permintaan sudah dikirim.",
  no_request: "Permintaan tidak ditemukan.",
  not_friends: "Hanya teman yang bisa saling mengirim pesan.",
  too_many_requests: "Terlalu banyak permintaan pertemanan. Coba lagi nanti.",
  message_empty: "Pesan tidak boleh kosong.",
  message_too_long: "Pesan terlalu panjang.",
  rate_limited: "Terlalu cepat. Tunggu sebentar lalu coba lagi.",
  forbidden: "Kamu tidak berhak melakukan ini.",
  not_found: "Pesan tidak ditemukan.",
  invalid_scope: "Laporan tidak valid.",
  message_rejected: "Pesan tidak dapat dikirim karena mengandung kata yang tidak diizinkan.",
  username_not_allowed: "Username atau nama ini mengandung kata yang tidak diizinkan.",
  username_cooldown: "Username baru bisa diubah lagi setelah masa tunggu 30 hari berakhir.",
  username_unchanged: "Itu sudah menjadi usernamemu.",
  requests_disabled: "Pengguna ini tidak menerima permintaan pertemanan.",
  link_not_allowed: "Link tidak dapat dikirim melalui chat.",
  dm_disabled: "Pengguna ini tidak menerima pesan pribadi.",
  dm_not_accepted: "Pengguna ini hanya membalas percakapan yang ia mulai.",
  dm_disabled_self: "Aktifkan pesan pribadi di Edit Profil untuk mengirim pesan.",
  user_unavailable: "Pengguna tidak tersedia.",
  owner_friendship_locked: "Pertemanan dengan akun resmi bersifat otomatis.",
  invalid_setting: "Pengaturan tidak valid.",
  protected_target: "Tindakan ini tidak tersedia untuk akun resmi ENO NIHONGO.",
  invalid_category: "Pilih kategori laporan.",
  duplicate_message: "Pesan yang sama baru saja dikirim.",
  slow_mode: "Mode lambat aktif. Tunggu sebentar sebelum mengirim lagi.",
  social_suspended: "Fitur sosial akunmu sedang dibatasi. Belajar tetap bisa dilakukan.",
  edit_expired: "Pesan hanya bisa diedit dalam 15 menit setelah dikirim.",
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

/** Galat yang pasti ditolak server (bukan jaringan): pesan tidak ditawarkan "Coba lagi" dan teks tetap di kotak ketik. */
const PERMANENT_SEND_ERRORS = new Set([
  "message_rejected",
  "link_not_allowed",
  "message_empty",
  "message_too_long",
  "blocked",
  "not_friends",
  "dm_disabled",
  "dm_not_accepted",
  "dm_disabled_self",
  "user_unavailable",
  "suspended",
  "social_suspended",
  "duplicate_message",
  "slow_mode",
  "forbidden",
  "username_required",
  "auth_required",
]);
export function isPermanentSendError(err: unknown): boolean {
  const code = socialErrorCode(err);
  return code !== null && PERMANENT_SEND_ERRORS.has(code);
}

export function socialErrorMessage(err: unknown): string {
  const code = socialErrorCode(err);
  return code ? (MESSAGES[code] as string) : "Terjadi kesalahan. Coba lagi.";
}

/** Tanggal ramah pengguna untuk masa tunggu username, mis. "12 November 2026". */
export function formatCooldownDate(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" });
}

/** "2026-09" → "Sep 2026" (hanya bulan + tahun). */
export function formatJoined(ym: string): string | null {
  const m = /^(\d{4})-(\d{2})$/.exec(ym);
  if (!m) return null;
  const month = Number(m[2]);
  if (month < 1 || month > 12) return null;
  const names = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "Mei",
    "Jun",
    "Jul",
    "Agu",
    "Sep",
    "Okt",
    "Nov",
    "Des",
  ];
  return `${names[month - 1]} ${m[1]}`;
}

/** Kategori laporan (Owner/Admin tidak bisa dilaporkan; server menolak). */
export const REPORT_CATEGORIES: ReadonlyArray<readonly [ReportCategory, string]> = [
  ["spam", "Spam"],
  ["harassment", "Pelecehan"],
  ["inappropriate", "Konten tidak pantas"],
  ["other", "Lainnya"],
];
