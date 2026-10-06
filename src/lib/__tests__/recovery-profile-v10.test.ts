import { rateLimitSeconds } from "../auth-errors";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { classifyRecoveryFailure, parseAuthCallback, readRecoveryHashTokens } from "../auth-flow";
import {
  AVATAR_MAX_BYTES,
  AVATAR_NOT_IMAGE,
  AVATAR_TOO_LARGE,
  AVATAR_UPLOAD_FAILED,
  avatarObjectPath,
  avatarStorageErrorMessage,
  fitWithin,
  isAllowedAvatarType,
  needsReencode,
} from "../avatar-upload";
import { NAME_UNAVAILABLE, PROFILE_SAVE_FAILED, profileSaveErrorMessage } from "../profile-errors";
import { RECOVERY_RATE_LIMIT_MESSAGE, authErrorMessage } from "../auth-errors";

const root = new URL("../../../", import.meta.url).pathname;
const read = (p: string) => readFileSync(join(root, p), "utf8");
const sql = read("supabase/migrations/20261019000000_profile_name_guard_definer.sql");
const flowSql = read("supabase/tests/profile_save_flow.sql");
const flow = read("src/lib/auth-flow.ts");
const reset = read("src/routes/reset-password.tsx");
const client = read("src/integrations/supabase/client.ts");
const account = read("src/lib/auth-account.ts");
const profileFn = read("src/lib/profile.functions.ts");

describe("recovery: deteksi callback dan alasan kegagalan definitif", () => {
  it("parseAuthCallback memberi tahu jenis callback tanpa menyimpan token", () => {
    const hash = "#access_token=abc&refresh_token=r&type=recovery";
    const info = parseAuthCallback("", hash);
    expect(info.present && info.hasTokens && info.recoveryType).toBe(true);
    expect(JSON.stringify(info)).not.toContain("abc");
    expect(parseAuthCallback("?code=xyz", "").hasCode).toBe(true);
    expect(parseAuthCallback("?code=xyz", "").recoveryType).toBe(false);
    expect(parseAuthCallback("?error_code=otp_expired", "").errorCode).toBe("otp_expired");
  });
  it("kedaluwarsa, beda browser, gagal tukar, dan tanpa callback dibedakan", () => {
    const base = { present: true, error: null, errorCode: null, hasCode: false, hasTokens: false };
    expect(classifyRecoveryFailure({ ...base, errorCode: "otp_expired" }, null, false)).toBe(
      "expired",
    );
    expect(
      classifyRecoveryFailure(
        { ...base, hasCode: true },
        { name: "AuthPKCECodeVerifierMissingError" },
        false,
      ),
    ).toBe("wrong_browser");
    // tautan lama bergaya kode (bukti produksi: bad_code_verifier / token sudah dipakai) → arahkan ke tautan terbaru
    expect(classifyRecoveryFailure({ ...base, hasCode: true }, null, false)).toBe("expired");
    expect(
      classifyRecoveryFailure({ ...base, hasCode: true }, { code: "flow_state_expired" }, false),
    ).toBe("expired");
    expect(
      classifyRecoveryFailure({ ...base, hasCode: true }, { code: "unexpected_failure" }, false),
    ).toBe("exchange_failed");
    expect(classifyRecoveryFailure({ ...base, present: false }, null, false)).toBe("no_callback");
    expect(classifyRecoveryFailure({ ...base, present: false }, null, true)).toBe("not_recovery");
  });
});

describe("recovery: mekanisme dan balapan", () => {
  it("satu mekanisme implicit: tanpa initialize()/PKCE/menunggu event; invalid hanya setelah getSession definitif", () => {
    expect(reset).not.toContain("initialize()");
    expect(reset).not.toContain("waitForRecoverySession");
    expect(reset).not.toContain("onAuthStateChange");
    const check = reset.slice(reset.indexOf("const check = async"), reset.indexOf("void check()"));
    expect(check.indexOf("getSession()")).toBeLessThan(check.lastIndexOf('setPhase("invalid")'));
    expect(check).toContain("isRecoverySession()");
    expect(reset).toContain("<AuthLoader />");
  });
  it("tidak ada pertukaran kode/OTP manual; setSession hanya di halaman reset untuk tautan recovery", () => {
    for (const f of [reset, flow, read("src/routes/auth.tsx"), account]) {
      expect(f).not.toMatch(/exchangeCodeForSession|verifyOtp/);
    }
    for (const f of [flow, read("src/routes/auth.tsx"), account, read("src/routes/__root.tsx")]) {
      expect(f).not.toMatch(/setSession\(/);
    }
    expect(reset).toMatch(/readRecoveryHashTokens\(window\.location\.hash\)/);
    expect(reset).toMatch(/supabase\.auth\.setSession\(hashTokens\)/);
    // token dibersihkan dari URL segera setelah dipakai
    expect(reset.indexOf("setSession(hashTokens)")).toBeLessThan(reset.indexOf("replaceState"));
  });
  it("fragment recovery: hanya type=recovery dengan kedua token", () => {
    expect(readRecoveryHashTokens("#access_token=a&refresh_token=r&type=recovery")).toEqual({
      access_token: "a",
      refresh_token: "r",
    });
    expect(readRecoveryHashTokens("#access_token=a&refresh_token=r&type=signup")).toBeNull();
    expect(readRecoveryHashTokens("#access_token=a&type=recovery")).toBeNull();
    expect(readRecoveryHashTokens("#refresh_token=r&type=recovery")).toBeNull();
    expect(readRecoveryHashTokens("")).toBeNull();
    expect(readRecoveryHashTokens("?access_token=a&refresh_token=r&type=recovery")).toEqual({
      access_token: "a",
      refresh_token: "r",
    });
  });
  it("pendaratan di halaman lain diteruskan ke tujuan konstan, sebelum rute menilai callback gagal", () => {
    expect(flow).toMatch(
      /initialAuthCallback\.recoveryType &&\s*initialAuthCallback\.hasTokens &&\s*window\.location\.pathname !== RECOVERY_DESTINATION/,
    );
    expect(flow).toContain(
      "window.location.replace(`${RECOVERY_DESTINATION}${window.location.hash}`)",
    );
    expect(flow).toContain('export const RECOVERY_DESTINATION = "/reset-password"');
    expect(flow.indexOf("RECOVERY_DESTINATION =")).toBeLessThan(
      flow.indexOf("window.location.replace(`${RECOVERY_DESTINATION}"),
    );
  });
  it("penanda sesi pemulihan dihapus setelah selesai (tanpa loop)", () => {
    expect(flow).not.toContain("recoveryWaiters");
    expect(flow).toContain("recoveryConsumed = true");
    expect(flow).toMatch(
      /!recoveryConsumed && \(isRecoverySession\(\) \|\| initialAuthCallback\.recoveryType\)/,
    );
  });
  it("permintaan tautan memakai alur implicit resmi lewat klien khusus tanpa sesi tersimpan", () => {
    expect(client).toContain("export function createRecoveryRequestClient()");
    expect(client).toMatch(/flowType: "implicit"[\s\S]*storageKey: "sb-eno-recovery-request"/);
    expect(client).toMatch(/persistSession: false/);
    expect(account).toContain("createRecoveryRequestClient().auth.resetPasswordForEmail");
    expect(account).toContain("redirectTo: recoveryRedirectUrl()");
    // klien utama tetap PKCE untuk login Google/email
    expect(client).toMatch(/flowType: "pkce"/);
  });
  it("429: detik tunggu hanya dari server (tidak dikarang), tanpa retry otomatis", () => {
    expect(
      rateLimitSeconds("For security purposes, you can only request this after 52 seconds."),
    ).toBe(52);
    expect(rateLimitSeconds("email rate limit exceeded")).toBeNull();
    expect(
      authErrorMessage(
        {
          status: 429,
          message: "For security purposes, you can only request this after 52 seconds.",
        },
        "recovery-request",
      ),
    ).toContain("52 detik");
    expect(account).not.toMatch(/setTimeout|setInterval|retry/i);
  });
  it("bukti produksi: tautan lama bergaya kode/sudah dipakai → pesan 'kedaluwarsa', bukan form", () => {
    // Log produksi: 'One-time token not found' (tautan lama diklik ulang) dan bad_code_verifier (PKCE lintas konteks).
    const info = parseAuthCallback("?code=old", "");
    expect(classifyRecoveryFailure(info, null, false)).toBe("expired");
    const fromHash = parseAuthCallback(
      "",
      "#error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid+or+has+expired",
    );
    expect(classifyRecoveryFailure(fromHash, null, false)).toBe("expired");
  });
  it("UX 429 tanpa detik dari server tidak mengarang waktu tunggu", () => {
    expect(authErrorMessage({ status: 429 }, "recovery-request")).toBe(RECOVERY_RATE_LIMIT_MESSAGE);
    expect(RECOVERY_RATE_LIMIT_MESSAGE).not.toMatch(/\d+\s*(detik|menit|jam)/i);
    expect(RECOVERY_RATE_LIMIT_MESSAGE).toMatch(/Spam/);
  });
});

describe("profil: migrasi guard nama", () => {
  it("fungsi penjaga menjadi definer dengan search_path kosong dan dikunci dari klien", () => {
    expect(sql).toMatch(
      /profiles_guard_official_name\(\)[\s\S]*security definer set search_path = ''/,
    );
    expect(sql).toMatch(
      /revoke all on function public\.profiles_guard_official_name\(\) from public, anon, authenticated;/,
    );
  });
  it("tidak membuka helper internal atau melemahkan RLS/trigger", () => {
    expect(sql).not.toMatch(/grant\s+execute[^;]*social_normalize_text/i);
    expect(sql).not.toMatch(
      /grant\s+(select|insert|update|delete|all)[^;]*\bon\s+(table\s+)?public\./i,
    );
    expect(sql).not.toMatch(/drop\s+trigger|disable row level security|drop policy|alter table/i);
    expect(sql).toContain("public.social_official_lookalike(new.display_name)");
    expect(sql).toContain("old.role not in ('owner', 'admin')");
  });
  it("tes integrasi mencakup semua role, lintas-pengguna, anon, peniruan, dan helper terkunci", () => {
    for (const k of [
      "own_name_update_failed_",
      "cross_user_update_allowed",
      "anon_update_allowed",
      "impersonation_allowed_",
      "normalize_exposed",
      "guard_exposed",
      "normalize_callable_by_client",
      "social_mirror_not_synced",
      "role_escalation_allowed",
    ])
      expect(flowSql).toContain(k);
    expect(flowSql).toMatch(/raise exception 'FLOW_OK % checks'/);
  });
});

describe("profil: pesan error tanpa detail database", () => {
  it("pesan permission denied tidak diteruskan ke pengguna", () => {
    const raw = "permission denied for function social_normalize_text";
    expect(profileSaveErrorMessage(raw)).toBe(PROFILE_SAVE_FAILED);
    expect(profileSaveErrorMessage(raw)).not.toMatch(/permission|function|social_/i);
    expect(profileSaveErrorMessage("Nama tampilan tidak tersedia.")).toBe(NAME_UNAVAILABLE);
    expect(profileSaveErrorMessage(undefined)).toBe(PROFILE_SAVE_FAILED);
  });
  it("profile.functions memakai pemeta dan mencatat detail hanya di log server", () => {
    expect(profileFn).toContain("profileSaveErrorMessage(profileError.message)");
    expect(profileFn).not.toMatch(/Profil gagal disimpan: \$\{/);
    expect(profileFn).not.toMatch(/Pengaturan gagal disimpan: \$\{/);
    expect(profileFn).toContain("console.error(");
  });
});

describe("foto profil: validasi, konversi, dan kegagalan", () => {
  it("HEIC atau >5 MB dikonversi; JPG/PNG/WebP/GIF kecil langsung diunggah", () => {
    expect(needsReencode({ type: "image/heic", size: 1000 })).toBe(true);
    expect(needsReencode({ type: "image/jpeg", size: AVATAR_MAX_BYTES + 1 })).toBe(true);
    expect(needsReencode({ type: "image/jpeg", size: 1000 })).toBe(false);
    expect(needsReencode({ type: "image/webp", size: AVATAR_MAX_BYTES })).toBe(false);
    expect(isAllowedAvatarType("image/svg+xml")).toBe(false);
  });
  it("fitWithin menjaga rasio dan batas sisi terpanjang", () => {
    expect(fitWithin(4000, 3000)).toEqual({ width: 1024, height: 768 });
    expect(fitWithin(500, 300)).toEqual({ width: 500, height: 300 });
    expect(fitWithin(1, 5000).height).toBe(1024);
  });
  it("path objek berada di folder pengguna sendiri dan bersih", () => {
    expect(avatarObjectPath("u-1", "JPG", 123)).toBe("u-1/profile-123.jpg");
    expect(avatarObjectPath("u-1", "../x!", 5)).toBe("u-1/profile-5.x");
    expect(avatarObjectPath("u-1", "", 5)).toBe("u-1/profile-5.jpg");
  });
  it("kegagalan storage dipetakan ke pesan Indonesia tanpa pesan mentah", () => {
    expect(
      avatarStorageErrorMessage({ message: "The object exceeded the maximum allowed size" }),
    ).toBe(AVATAR_TOO_LARGE);
    expect(avatarStorageErrorMessage({ message: "mime type image/heic is not supported" })).toBe(
      AVATAR_NOT_IMAGE,
    );
    expect(
      avatarStorageErrorMessage({ message: "new row violates row-level security policy" }),
    ).toBe(AVATAR_UPLOAD_FAILED);
    expect(avatarStorageErrorMessage(new Error("db internal xyz"))).not.toContain("xyz");
  });
  it("alur unggah (avatar-save + dialog crop): konversi, bersihkan berkas yatim, tidak klaim sukses, segarkan cache", () => {
    const save = read("src/lib/avatar-save.ts");
    const dialog = read("src/components/profile/AvatarCropDialog.tsx");
    expect(dialog).toContain("reencodeToJpeg(original)");
    expect(save).toMatch(/\.remove\(\[path\]\)/);
    expect(save).toContain("AVATAR_SAVE_FAILED");
    expect(save).toContain("invalidateIdentityCaches(qc)");
    expect(save).not.toMatch(/throw uploadError|throw profileError/);
    // sukses (toast) hanya setelah simpan profil berhasil
    const edit = read("src/routes/_authenticated/edit-profil.tsx");
    expect(edit.indexOf('toast.success("Foto profil berhasil diperbarui.")')).toBeGreaterThan(
      edit.indexOf("result.ok"),
    );
  });
});
