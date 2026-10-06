import type { User } from "@supabase/supabase-js";

/** Origin kanonis produksi. Satu-satunya sumber redirect Auth: tidak pernah berasal dari input pengguna. */
export const CANONICAL_ORIGIN = "https://www.enonihongo.com";
export const PASSWORD_RECOVERY_PATH = "/reset-password";

export const recoveryRedirectUrl = () => `${CANONICAL_ORIGIN}${PASSWORD_RECOVERY_PATH}`;

export interface AccountProviders {
  /** Punya identitas email+kata sandi (boleh mengubah kata sandi). */
  email: boolean;
  google: boolean;
  /** Provider lain (mis. dari konfigurasi masa depan). */
  others: string[];
  /** Data identitas tersedia dari Auth; bila false jangan menebak. */
  known: boolean;
}

/**
 * Provider ditentukan dari identitas Auth milik sesi (user.identities, lalu app_metadata.providers),
 * bukan dari tebakan email. Klien tidak pernah menelusuri tabel pengguna Auth.
 */
export function accountProviders(
  user: Pick<User, "identities" | "app_metadata"> | null | undefined,
): AccountProviders {
  const fromIdentities = (user?.identities ?? []).map((i) => i.provider);
  const raw = (user?.app_metadata as { providers?: unknown } | undefined)?.providers;
  const fromMeta = Array.isArray(raw) ? raw.filter((p): p is string => typeof p === "string") : [];
  const providers = fromIdentities.length ? fromIdentities : fromMeta;
  return {
    email: providers.includes("email"),
    google: providers.includes("google"),
    others: providers.filter((p) => p !== "email" && p !== "google"),
    known: providers.length > 0,
  };
}

export const isGoogleOnly = (p: AccountProviders) => p.known && p.google && !p.email;

export function providerLabel(p: AccountProviders): string {
  if (!p.known) return "Tidak dapat ditentukan";
  if (p.email && p.google) return "Email dan Google";
  if (p.google) return "Google";
  if (p.email) return "Email dan kata sandi";
  return "Penyedia lain";
}

/**
 * Meminta email atur ulang kata sandi lewat alur resmi Supabase (resetPasswordForEmail). `redirectTo`
 * konstan; token tidak dibuat/diproses aplikasi. Pembatasan laju tetap di sisi server Supabase.
 */
export async function requestPasswordRecovery(email: string): Promise<{ error: unknown }> {
  const { createRecoveryRequestClient } = await import("@/integrations/supabase/client");
  const { error } = await createRecoveryRequestClient().auth.resetPasswordForEmail(email, {
    redirectTo: recoveryRedirectUrl(),
  });
  return { error };
}
