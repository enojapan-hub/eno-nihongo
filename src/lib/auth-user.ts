import type { User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

/**
 * Satu sumber "siapa user saat ini" untuk query data.
 *
 * `supabase.auth.getUser()` selalu memanggil /auth/v1/user (jaringan). Setiap halaman memanggilnya
 * 3–4 kali. Hasil validasi server yang sama dipakai ulang selama sesi (access token) yang sama
 * dan masih baru (TTL singkat), dan permintaan yang sedang berjalan digabung. Batas keamanan tidak
 * berubah: setiap query/RPC tetap divalidasi server lewat JWT + RLS; ini hanya mengambil user id.
 */
const TTL_MS = 20_000;
type UserResult = Awaited<ReturnType<typeof supabase.auth.getUser>>;

let cache: { token: string; at: number; result: UserResult } | null = null;
let inflight: { token: string; promise: Promise<UserResult> } | null = null;

if (typeof window !== "undefined") {
  // Login/logout/refresh/update profil: buang cache agar tidak pernah memakai user lama.
  supabase.auth.onAuthStateChange(() => {
    cache = null;
    inflight = null;
  });
}

export function resetAuthUserCache() {
  cache = null;
  inflight = null;
}

export async function getAuthUser(): Promise<UserResult> {
  const { data: sessionData } = await supabase.auth.getSession(); // lokal, tanpa jaringan
  const token = sessionData.session?.access_token;
  if (!token) return supabase.auth.getUser();
  if (cache && cache.token === token && Date.now() - cache.at < TTL_MS) return cache.result;
  if (inflight && inflight.token === token) return inflight.promise;
  const promise = supabase.auth.getUser(token).then((result) => {
    if (!result.error && result.data.user) cache = { token, at: Date.now(), result };
    if (inflight?.promise === promise) inflight = null;
    return result;
  });
  inflight = { token, promise };
  return promise;
}

export type { User };
