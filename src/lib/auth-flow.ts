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
}

// "error" polos sengaja tidak dihitung: /auth?error=... dipakai route guard untuk pesan sendiri.
const CALLBACK_KEYS = ["code", "access_token", "token_hash", "error_code", "error_description"];

export function parseAuthCallback(search: string, hash: string): AuthCallbackInfo {
  const params = new URLSearchParams(search);
  const fromHash = new URLSearchParams(hash.replace(/^#/, ""));
  const get = (key: string) => params.get(key) ?? fromHash.get(key);
  const present = CALLBACK_KEYS.some((key) => get(key) !== null);
  return { present, error: get("error_description") };
}

// Dibaca saat modul dimuat: klien Supabase membersihkan URL setelah memproses callback.
export const initialAuthCallback: AuthCallbackInfo =
  typeof window === "undefined"
    ? { present: false, error: null }
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
