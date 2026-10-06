import { supabase } from "@/integrations/supabase/client";
import type { QueryClient } from "@tanstack/react-query";

/**
 * Sign-out bersih: batalkan query berjalan, kosongkan cache, baru hapus sesi.
 */
export async function signOutCleanly(queryClient: QueryClient) {
  await queryClient.cancelQueries();
  queryClient.clear();
  await supabase.auth.signOut();
}

/**
 * Keluar dari SEMUA perangkat: pencabutan sesi resmi Supabase (scope "global"). Daftar sesi tidak
 * disimpan sendiri. Cache aplikasi dibuang lokal karena sesi ini pun berakhir.
 */
export async function signOutEverywhere(queryClient: QueryClient) {
  await queryClient.cancelQueries();
  const { error } = await supabase.auth.signOut({ scope: "global" });
  if (error) throw error;
  queryClient.clear();
}
