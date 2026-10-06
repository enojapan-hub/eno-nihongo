import { supabase } from "@/integrations/supabase/client";

/**
 * Alur first-login: callback OAuth/verifikasi email mendarat di "/" dan sesi baru ada setelah
 * pertukaran kode PKCE selesai. Semua entry point memakai resolver yang sama supaya
 * LOADING tidak pernah dianggap UNAUTHENTICATED.
 */
export type AuthStatus = "loading" | "authenticated" | "unauthenticated";

export const authStatus = (loading: boolean, hasSession: boolean): AuthStatus =>
  loading ? "loading" : hasSession ? "authenticated" : "unauthenticated";

export interface AuthCallbackInfo {
  present: boolean;
  error: string | null;
  /** error_code dari Supabase (mis. otp_expired); tidak pernah berisi token. */
  errorCode: string | null;
  hasCode: boolean;
  hasTokens: boolean;
  /** Callback implicit bertipe recovery (type=recovery di fragment): penanda deterministik tanpa menunggu event. */
  recoveryType: boolean;
}

// "error" polos sengaja tidak dihitung: /auth?error=... dipakai route guard untuk pesan sendiri.
const CALLBACK_KEYS = ["code", "access_token", "token_hash", "error_code", "error_description"];

export function parseAuthCallback(search: string, hash: string): AuthCallbackInfo {
  const params = new URLSearchParams(search);
  const fromHash = new URLSearchParams(hash.replace(/^#/, ""));
  const get = (key: string) => params.get(key) ?? fromHash.get(key);
  const present = CALLBACK_KEYS.some((key) => get(key) !== null);
  return {
    present,
    error: get("error_description"),
    errorCode: get("error_code"),
    hasCode: get("code") !== null,
    hasTokens: get("access_token") !== null || get("token_hash") !== null,
    recoveryType: get("type") === "recovery",
  };
}

// Dibaca saat modul dimuat: klien Supabase membersihkan URL setelah memproses callback.
export const initialAuthCallback: AuthCallbackInfo =
  typeof window === "undefined"
    ? {
        present: false,
        error: null,
        errorCode: null,
        hasCode: false,
        hasTokens: false,
        recoveryType: false,
      }
    : parseAuthCallback(window.location.search, window.location.hash);

export const CALLBACK_FAILED_MESSAGE =
  "Tautan masuk tidak dapat diselesaikan di browser ini (kedaluwarsa atau dibuka di browser/perangkat lain). Silakan masuk sekali lagi.";

/** Sesi tersimpan = ada token Supabase di storage; dipakai agar halaman publik tidak berkedip. */
export function hasStoredSession(storage: Pick<Storage, "length" | "key">): boolean {
  for (let i = 0; i < storage.length; i += 1) {
    const key = storage.key(i);
    if (key && /^sb-.+-auth-token$/.test(key)) return true;
  }
  return false;
}

/**
 * PKCE menyimpan code_verifier per-origin. Alur yang dimulai dari origin lain (mis. apex
 * enonihongo.com) lalu kembali ke www tidak bisa menukar kode, dan pengguna jatuh ke beranda.
 */
export function canonicalAuthUrl(loc: {
  hostname: string;
  pathname: string;
  search: string;
  hash: string;
}): string | null {
  if (loc.hostname !== "enonihongo.com") return null;
  return `https://www.enonihongo.com${loc.pathname}${loc.search}${loc.hash}`;
}

/**
 * Sesi pemulihan kata sandi. Tautan email menukar kode PKCE menjadi sesi penuh; tanpa penanda ini
 * halaman masuk akan langsung mengirim pengguna ke dashboard sebelum sempat memasang kata sandi baru.
 * Penanda hanya berasal dari event PASSWORD_RECOVERY milik Supabase (bukan dari URL/input pengguna),
 * disimpan di sessionStorage tab ini, dan dihapus setelah kata sandi diganti atau keluar.
 */
export const RECOVERY_SESSION_KEY = "eno-recovery-session";
export const RECOVERY_DESTINATION = "/reset-password";
let recoveryDetected = false;
// Setelah kata sandi diganti/keluar, penanda callback awal halaman ini tidak berlaku lagi (hindari loop).
let recoveryConsumed = false;

function readRecoveryFlag(): boolean {
  try {
    return (
      typeof window !== "undefined" && window.sessionStorage.getItem(RECOVERY_SESSION_KEY) === "1"
    );
  } catch {
    return false;
  }
}

export const isRecoverySession = (): boolean => recoveryDetected || readRecoveryFlag();

// PASSWORD_RECOVERY dipancarkan setelah getSession()/initialize() selesai (antrean inisialisasi + setTimeout
// di auth-js). Menilai "tautan tidak berlaku" sebelum event itu tiba adalah balapan yang salah.
const recoveryWaiters = new Set<() => void>();

/** True bila sesi pemulihan terdeteksi dalam batas waktu (menunggu event resmi Supabase). */
export function waitForRecoverySession(timeoutMs: number): Promise<boolean> {
  if (isRecoverySession()) return Promise.resolve(true);
  return new Promise((resolve) => {
    const done = () => {
      window.clearTimeout(timer);
      resolve(true);
    };
    const timer = window.setTimeout(() => {
      recoveryWaiters.delete(done);
      resolve(isRecoverySession());
    }, timeoutMs);
    recoveryWaiters.add(done);
  });
}

/** Menandai sesi pemulihan yang sudah divalidasi server (mis. lewat setSession dari tautan email). */
export function markRecoverySession(): void {
  recoveryDetected = true;
  recoveryConsumed = false;
  try {
    window.sessionStorage.setItem(RECOVERY_SESSION_KEY, "1");
  } catch {
    /* penyimpanan tidak tersedia */
  }
  recoveryWaiters.forEach((notify) => notify());
  recoveryWaiters.clear();
}

/**
 * Token dari tautan atur ulang bergaya implicit (fragment `#access_token=…&refresh_token=…&type=recovery`).
 * Murni dan ketat: hanya `type=recovery` dengan kedua token; tidak pernah mencatat/menyimpan token.
 */
export function readRecoveryHashTokens(
  hash: string,
): { access_token: string; refresh_token: string } | null {
  const params = new URLSearchParams(hash.replace(/^#/, ""));
  const access_token = params.get("access_token");
  const refresh_token = params.get("refresh_token");
  if (params.get("type") !== "recovery" || !access_token || !refresh_token) return null;
  return { access_token, refresh_token };
}

export type RecoveryFailure =
  "expired" | "wrong_browser" | "exchange_failed" | "no_callback" | "not_recovery";

/**
 * Alasan kegagalan pemulihan yang DEFINITIF (dipanggil hanya setelah inisialisasi Auth selesai dan
 * jendela tunggu event habis). Murni: tidak membaca atau mencatat token.
 */
export function classifyRecoveryFailure(
  info: Pick<AuthCallbackInfo, "present" | "error" | "errorCode" | "hasCode" | "hasTokens">,
  initError: { name?: string | undefined; code?: string | undefined } | null | undefined,
  hasSession: boolean,
): RecoveryFailure {
  if (info.errorCode === "otp_expired" || /expired|invalid/i.test(info.error ?? ""))
    return "expired";
  if (initError) {
    if (
      initError.code === "flow_state_expired" ||
      initError.code === "otp_expired" ||
      initError.code === "refresh_token_not_found" ||
      initError.code === "refresh_token_already_used" ||
      initError.code === "session_expired"
    )
      return "expired";
    if (
      /PKCECodeVerifierMissing/i.test(initError.name ?? "") ||
      initError.code === "bad_code_verifier" ||
      initError.code === "flow_state_not_found"
    )
      return "wrong_browser";
    return "exchange_failed";
  }
  if (info.hasCode && !hasSession) return "wrong_browser";
  if (!info.present) return hasSession ? "not_recovery" : "no_callback";
  return "exchange_failed";
}

export function clearRecoverySession(): void {
  recoveryDetected = false;
  recoveryConsumed = true;
  try {
    window.sessionStorage.removeItem(RECOVERY_SESSION_KEY);
  } catch {
    /* penyimpanan tidak tersedia */
  }
}

// Cadangan: bila Supabase mendarat di halaman lain (mis. "/") dengan tautan atur ulang, teruskan segera ke
// /reset-password beserta fragment-nya, sebelum rute lain menilainya sebagai callback gagal. Tidak ada data
// dari pengguna selain fragment itu sendiri; tujuan konstan.
if (
  typeof window !== "undefined" &&
  initialAuthCallback.recoveryType &&
  initialAuthCallback.hasTokens &&
  window.location.pathname !== RECOVERY_DESTINATION
) {
  window.location.replace(`${RECOVERY_DESTINATION}${window.location.hash}`);
}

if (typeof window !== "undefined") {
  supabase.auth.onAuthStateChange((event) => {
    if (event === "PASSWORD_RECOVERY") {
      markRecoverySession();
    } else if (event === "SIGNED_OUT") {
      clearRecoverySession();
    }
  });
}

interface DestinationProfile {
  role?: string | null;
  onboarding_completed?: boolean | null;
}

export function pickDestination(
  profile: DestinationProfile | null,
  metadataOnboarded: boolean,
  checkout: string | null,
): string {
  if (checkout) return checkout;
  if (profile?.role === "owner" || profile?.role === "admin") return "/admin";
  return profile?.onboarding_completed === true || metadataOnboarded ? "/dashboard" : "/onboarding";
}

export type AuthResolution =
  { authenticated: true; destination: string } | { authenticated: false; callbackFailed: boolean };

let inflight: Promise<AuthResolution> | null = null;

async function resolveOnce(): Promise<AuthResolution> {
  const { data, error } = await supabase.auth.getSession();
  const user = data.session?.user;
  if (error || !user) {
    return { authenticated: false, callbackFailed: initialAuthCallback.present };
  }
  // Sesi pemulihan: pengguna wajib menetapkan kata sandi baru, bukan masuk ke dashboard.
  if (!recoveryConsumed && (isRecoverySession() || initialAuthCallback.recoveryType))
    return { authenticated: true, destination: RECOVERY_DESTINATION };
  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("onboarding_completed, role")
    .eq("id", user.id)
    .maybeSingle();
  const metadataOnboarded = user.user_metadata?.["onboarding_completed"] === true;
  // Gagal membaca profil tidak boleh melempar pengguna yang sudah login ke beranda.
  const destination = profileError
    ? "/dashboard"
    : pickDestination(profile, metadataOnboarded, null);
  return { authenticated: true, destination };
}

/** Satu eksekusi bersama untuk semua pemanggil yang berjalan bersamaan (root, beranda, /auth). */
export function resolveAuth(): Promise<AuthResolution> {
  if (!inflight) {
    inflight = resolveOnce().finally(() => {
      inflight = null;
    });
  }
  return inflight;
}
