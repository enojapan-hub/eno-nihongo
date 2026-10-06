import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { googlePhotoFromMetadata, googlePhotoToSync } from "@/lib/social/profile-photo";

const checked = new Map<string, string>();

/**
 * Menyamakan `profiles.avatar_url` dengan foto Google terbaru dari metadata Auth. Hanya menulis bila
 * foto saat ini kosong/berasal dari Google DAN berbeda (idempotent, tanpa loop); foto unggahan pengguna
 * tidak pernah ditimpa. Diperiksa sekali per sesi aplikasi per URL; tanpa penyimpanan/unduh ulang.
 */
export function useGooglePhotoSync(
  user: { id: string; user_metadata?: unknown } | null | undefined,
) {
  const qc = useQueryClient();
  const userId = user?.id ?? null;
  const google = googlePhotoFromMetadata(user?.user_metadata);
  useEffect(() => {
    if (!userId || !google || checked.get(userId) === google) return;
    checked.set(userId, google);
    void (async () => {
      try {
        const { data, error } = await supabase
          .from("profiles")
          .select("avatar_url")
          .eq("id", userId)
          .maybeSingle();
        if (error || !data) return;
        const next = googlePhotoToSync(data.avatar_url, google);
        if (!next) return;
        const { error: updateError } = await supabase
          .from("profiles")
          .update({ avatar_url: next })
          .eq("id", userId);
        if (updateError) {
          checked.delete(userId);
          return;
        }
        void qc.invalidateQueries({ queryKey: ["leaderboard"] });
        void qc.invalidateQueries({ queryKey: ["my-account"] });
      } catch {
        checked.delete(userId);
      }
    })();
  }, [userId, google, qc]);
}
