import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  accountProviders,
  CANONICAL_ORIGIN,
  isGoogleOnly,
  providerLabel,
  recoveryRedirectUrl,
} from "../auth-account";
import {
  authErrorMessage,
  INVALID_CREDENTIALS_MESSAGE,
  isAlreadyRegistered,
  NETWORK_MESSAGE,
  RATE_LIMIT_MESSAGE,
  RECOVERY_LINK_INVALID_MESSAGE,
} from "../auth-errors";
import { PASSWORD_MISMATCH_MESSAGE, validateNewPassword } from "../password-policy";

const root = new URL("../../../", import.meta.url).pathname;
const read = (p: string) => readFileSync(join(root, p), "utf8");
const authPage = read("src/routes/auth.tsx");
const resetPage = read("src/routes/reset-password.tsx");
const security = read("src/components/account/AccountSecurity.tsx");
const flow = read("src/lib/auth-flow.ts");
const actions = read("src/lib/auth-actions.ts");
const pengaturan = read("src/routes/_authenticated/pengaturan.tsx");

describe("password policy (satu aturan untuk daftar/atur ulang/ubah)", () => {
  it("memvalidasi kosong, pendek, dan konfirmasi berbeda", () => {
    expect(validateNewPassword("")).toBe("Masukkan kata sandi baru.");
    expect(validateNewPassword("short")).toBe("Kata sandi minimal 8 karakter.");
    expect(validateNewPassword("password1", "password2")).toBe(PASSWORD_MISMATCH_MESSAGE);
    expect(validateNewPassword("password1", "password1")).toBeNull();
    expect(validateNewPassword("password1")).toBeNull();
  });
  it("ketiga alur memakai helper yang sama", () => {
    expect(authPage).toContain("PASSWORD_MIN_LENGTH");
    expect(resetPage).toContain("validateNewPassword");
    expect(security).toContain("validateNewPassword");
  });
});

describe("pemeta error Auth → Bahasa Indonesia", () => {
  it("kredensial salah tetap generik (tidak membocorkan keberadaan email)", () => {
    expect(authErrorMessage({ code: "invalid_credentials" }, "signin")).toBe(
      INVALID_CREDENTIALS_MESSAGE,
    );
    expect(authErrorMessage({ message: "Invalid login credentials" }, "signin")).toBe(
      "Email atau kata sandi tidak cocok.",
    );
    expect(INVALID_CREDENTIALS_MESSAGE).not.toMatch(/tidak terdaftar/i);
  });
  it("memetakan rate limit, jaringan, lemah, sama, kedaluwarsa, dan server", () => {
    expect(authErrorMessage({ status: 429 }, "signin")).toBe(RATE_LIMIT_MESSAGE);
    expect(authErrorMessage({ code: "over_email_send_rate_limit" }, "recovery-request")).toBe(
      RATE_LIMIT_MESSAGE,
    );
    expect(authErrorMessage({ name: "AuthRetryableFetchError", message: "x" }, "signin")).toBe(
      NETWORK_MESSAGE,
    );
    expect(authErrorMessage({ code: "weak_password" }, "password-update")).toMatch(/terlalu lemah/);
    expect(authErrorMessage({ code: "same_password" }, "password-update")).toMatch(/berbeda/);
    expect(authErrorMessage({ code: "otp_expired" }, "recovery-link")).toBe(
      RECOVERY_LINK_INVALID_MESSAGE,
    );
    expect(authErrorMessage({ code: "reauthentication_not_valid" }, "password-update")).toMatch(
      /Kode verifikasi/,
    );
    expect(authErrorMessage({ status: 503 }, "signin")).toMatch(/Layanan sedang bermasalah/);
  });
  it("tidak pernah menampilkan pesan mentah Supabase", () => {
    const raw = "AuthApiError: internal db error at pg_hba token=abc123";
    const out = authErrorMessage({ message: raw, code: "unexpected_failure" }, "signin");
    expect(out).not.toContain("pg_hba");
    expect(out).not.toContain("abc123");
    expect(out).toBe("Gagal masuk. Coba lagi.");
  });
  it("hanya error eksplisit yang dianggap 'sudah terdaftar'", () => {
    expect(isAlreadyRegistered({ code: "user_already_exists" })).toBe(true);
    expect(isAlreadyRegistered({ code: "email_exists" })).toBe(true);
    expect(isAlreadyRegistered({ message: "User already registered" })).toBe(true);
    expect(isAlreadyRegistered({ code: "invalid_credentials" })).toBe(false);
    expect(isAlreadyRegistered(null)).toBe(false);
  });
});

describe("provider akun dari identitas Auth (bukan tebakan email)", () => {
  const u = (providers: string[]) => ({
    identities: providers.map((provider) => ({ provider })) as never,
    app_metadata: {},
  });
  it("Email, Google-only, dan keduanya", () => {
    const email = accountProviders(u(["email"]));
    expect(email.email && !isGoogleOnly(email)).toBe(true);
    expect(providerLabel(email)).toBe("Email dan kata sandi");
    const google = accountProviders(u(["google"]));
    expect(isGoogleOnly(google)).toBe(true);
    expect(google.email).toBe(false);
    expect(providerLabel(google)).toBe("Google");
    const both = accountProviders(u(["email", "google"]));
    expect(both.email).toBe(true);
    expect(isGoogleOnly(both)).toBe(false);
    expect(providerLabel(both)).toBe("Email dan Google");
  });
  it("fallback ke app_metadata.providers; tak diketahui tidak ditebak", () => {
    const meta = accountProviders({ identities: [], app_metadata: { providers: ["google"] } });
    expect(isGoogleOnly(meta)).toBe(true);
    const unknown = accountProviders({ app_metadata: {} } as never);
    expect(unknown.known).toBe(false);
    expect(unknown.email).toBe(false);
    expect(isGoogleOnly(unknown)).toBe(false);
  });
  it("redirect pemulihan konstan ke domain produksi", () => {
    expect(CANONICAL_ORIGIN).toBe("https://www.enonihongo.com");
    expect(recoveryRedirectUrl()).toBe("https://www.enonihongo.com/reset-password");
  });
});

describe("kontrak UI/alur Auth", () => {
  it("Lupa kata sandi: tautan, API resmi, redirect konstan, respons netral", () => {
    expect(authPage).toContain("Lupa kata sandi?");
    expect(authPage).toContain("resetPasswordForEmail");
    expect(authPage).toContain("redirectTo: recoveryRedirectUrl()");
    expect(authPage).toContain(
      "Jika email tersebut terdaftar, tautan untuk mengatur ulang kata sandi",
    );
    // kegagalan "email tidak ada" tidak pernah ditampilkan: hanya rate limit/jaringan
    expect(authPage).toMatch(/isRateLimited\(recoverError\) \|\| isNetworkError\(recoverError\)/);
  });
  it("Daftar: respons netral yang sama + aksi Masuk yang mempertahankan email", () => {
    expect(authPage).toContain(
      "Jika email ini sudah memiliki akun, silakan masuk. Jika belum, periksa email Anda untuk melanjutkan pendaftaran.",
    );
    expect(authPage).toContain("function goToSignIn()");
    expect(authPage).toMatch(/function goToSignIn\(\)[\s\S]*?setPassword\(""\)/);
    expect(authPage).not.toMatch(/function goToSignIn\(\)[\s\S]{0,200}setEmail\(""\)/);
    expect(authPage).toContain("isAlreadyRegistered(caught)");
  });
  it("tidak ada endpoint/penelusuran akun dan tidak ada eksposur klien", () => {
    const files = [authPage, resetPage, security, flow, actions, read("src/lib/auth-account.ts")];
    for (const src of files) {
      expect(src).not.toMatch(/service_role/i);
      expect(src).not.toMatch(/auth\.users/);
      expect(src).not.toMatch(/admin\.(listUsers|getUserByEmail)/);
      expect(src).not.toMatch(
        /console\.(log|info|debug|warn)\s*\([^)]*(password|token|nonce|code)/i,
      );
    }
    expect(authPage).not.toMatch(/linkIdentity|unlinkIdentity/);
  });
  it("Atur ulang: hanya sesi pemulihan dari event Supabase, konfirmasi, error Indonesia", () => {
    expect(flow).toContain('event === "PASSWORD_RECOVERY"');
    expect(flow).toContain("isRecoverySession()");
    expect(resetPage).toContain("isRecoverySession()");
    expect(resetPage).toContain("validateNewPassword(password, confirm)");
    expect(resetPage).toContain("supabase.auth.updateUser({ password })");
    expect(resetPage).toContain("RECOVERY_LINK_INVALID_MESSAGE");
    expect(resetPage).toContain("/auth?mode=lupa");
    expect(resetPage).toContain("clearRecoverySession()");
    expect(resetPage).toMatch(/disabled=\{busy\}/);
  });
  it("Keamanan Akun: form hanya untuk akun email; Google-only tanpa form; reauth resmi; global sign-out", () => {
    expect(pengaturan).toContain("<AccountSecurity />");
    expect(security).toContain("Keamanan Akun");
    expect(security).toMatch(/providers\.email && \(\s*<SecurityRow[\s\S]*?Ubah kata sandi/);
    expect(security).toContain("isGoogleOnly(providers)");
    expect(security).toContain("Anda masuk menggunakan Google");
    expect(security).toContain('attempt.error.code === "reauthentication_needed"');
    expect(security).toContain("supabase.auth.reauthenticate()");
    expect(security).toContain("nonce: code.trim()");
    expect(security).toContain("confirm(");
    expect(actions).toContain('supabase.auth.signOut({ scope: "global" })');
    expect(security).toContain("signOutEverywhere(qc)");
  });
  it("tidak ada ganti email/penautan manual identitas", () => {
    for (const src of [authPage, resetPage, security]) {
      expect(src).not.toMatch(/updateUser\(\s*\{\s*email/);
      expect(src).not.toMatch(/linkIdentity|signInWithIdToken/);
    }
  });
  it("mandatory username gate tetap membungkus semua rute terautentikasi", () => {
    const layout = read("src/routes/_authenticated/route.tsx");
    expect(layout).toContain("<UsernameGate>");
    expect(statSync(join(root, "src/components/social/UsernameGate.tsx")).isFile()).toBe(true);
    expect(readdirSync(join(root, "supabase/migrations")).length).toBeGreaterThan(0);
  });
});
