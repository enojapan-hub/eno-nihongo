import { QueryClient } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";

export const getRouter = () => {
  const queryClient = new QueryClient();
  // Data kurikulum/level hampir statis: jangan di-fetch ulang tiap pindah halaman (default staleTime 0).
  // Progres, notifikasi, dan data pengguna lain TIDAK diubah (tetap revalidasi saat mount).
  // target-level di-invalidate saat profil/target diubah (edit-profil).
  const FIVE_MIN = 5 * 60_000;
  for (const key of [
    "target-level",
    "materi-kanji",
    "materi-vocab",
    "materi-grammar",
    "materi-extra-vocab",
    "hafalan-kanji",
    "hafalan-vocab",
    "hafalan-grammar",
    "vocab-lessons",
    "vocab-count",
    "vocab-category-count",
  ])
    queryClient.setQueryDefaults([key], { staleTime: FIVE_MIN });

  const router = createRouter({
    routeTree,
    context: { queryClient },
    scrollRestoration: true,
    defaultPreloadStaleTime: 0,
  });

  return router;
};
