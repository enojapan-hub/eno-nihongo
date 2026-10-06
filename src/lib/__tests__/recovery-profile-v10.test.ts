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
const photo = read("src/routes/_authenticated/profil-foto.tsx");
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
    expect(classifyRecoveryFailure({ ...base, hasCode: true }, null, false)).toBe("wrong_browser");
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
  it("halaman reset menunggu inisialisasi + event resmi sebelum menilai tidak berlaku", () => {
    expect(reset).toContain("supabase.auth.initialize()");
    expect(reset).toContain("waitForRecoverySession(RECOVERY_EVENT_WAIT_MS)");
    expect(reset).toContain("classifyRecoveryFailure(");
    // keputusan invalid hanya setelah langkah tunggu: tidak ada setPhase("invalid") sebelum await waitFor...
    const check = reset.slice(
      reset.indexOf("const check = async"),
      reset.indexOf("const { data: sub }"),
    );
    expect(check.indexOf("waitForRecoverySession")).toBeLessThan(
      check.indexOf("setPhase((current)"),
    );
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
  it("event PASSWORD_RECOVERY membangunkan penunggu; penanda dihapus setelah selesai (tanpa loop)", () => {
    expect(flow).toMatch(/recoveryWaiters\.forEach\(\(notify\) => notify\(\)\)/);
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
  it("UX 429 tidak mengarang waktu tunggu", () => {
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
  it("alur unggah: konversi, bersihkan berkas yatim, tidak klaim sukses, segarkan cache identitas", () => {
    expect(photo).toContain("reencodeToJpeg(original)");
    expect(photo).toMatch(/\.remove\(\[path\]\)/);
    expect(photo).toContain("AVATAR_SAVE_FAILED");
    expect(photo).toContain("invalidateIdentityCaches(qc)");
    expect(photo).not.toMatch(/toast\.error\((uploadError|profileError)/);
    expect(photo).not.toMatch(/throw uploadError|throw profileError/);
    // sukses hanya setelah profil tersimpan
    expect(photo.indexOf('toast.success("Foto profil berhasil diganti.")')).toBeGreaterThan(
      photo.indexOf(".update({ avatar_url: publicUrl.publicUrl })"),
    );
  });
});
