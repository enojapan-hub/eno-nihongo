import type { QueryClient } from "@tanstack/react-query";
import { resetSocialBadges } from "@/lib/social/social-badges";

/**
 * Setelah nama/foto akun berubah: segarkan HANYA cache yang menampilkan identitas akun
 * (profil, dashboard, leaderboard, seluruh data sosial). Tidak ada logout/reload/clear storage.
 */
export function invalidateIdentityCaches(qc: QueryClient): Promise<unknown> {
  resetSocialBadges();
  const keys: ReadonlyArray<readonly string[]> = [
    ["my-account"],
    ["my-account-profile"],
    ["my-account-edit"],
    ["leaderboard"],
    ["competition-leaderboard"],
    ["social"],
  ];
  return Promise.all(keys.map((queryKey) => qc.invalidateQueries({ queryKey })));
}
