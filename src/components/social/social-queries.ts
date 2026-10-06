import { useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { socialApi } from "@/lib/social/social-api";

export const socialKeys = {
  me: ["social", "me"] as const,
  overview: ["social", "overview"] as const,
  unread: ["social", "unread"] as const,
  dmList: ["social", "dm-list"] as const,
};

/** Kunci menyertakan id pengguna: akun berbeda tidak pernah memakai cache username akun sebelumnya. */
export function useSocialMe(enabled = true) {
  const { user } = useAuth();
  return useQuery({
    queryKey: [...socialKeys.me, user?.id ?? "anon"],
    queryFn: socialApi.me,
    enabled: enabled && !!user,
    staleTime: 5 * 60_000,
    refetchOnWindowFocus: false,
  });
}

export function useSocialOverview(enabled: boolean) {
  return useQuery({
    queryKey: socialKeys.overview,
    queryFn: socialApi.overview,
    enabled,
    staleTime: 20_000,
  });
}

export function useUnread(enabled: boolean) {
  return useQuery({
    queryKey: socialKeys.unread,
    queryFn: socialApi.unread,
    enabled,
    staleTime: 20_000,
  });
}

export function useDmList(enabled: boolean) {
  return useQuery({
    queryKey: socialKeys.dmList,
    queryFn: socialApi.dmList,
    enabled,
    staleTime: 10_000,
  });
}

export function useSocialInvalidate() {
  const qc = useQueryClient();
  return (...keys: Array<keyof typeof socialKeys>) => invalidate(qc, keys);
}

export function invalidate(qc: QueryClient, keys: ReadonlyArray<keyof typeof socialKeys>) {
  for (const k of keys) void qc.invalidateQueries({ queryKey: socialKeys[k] });
}
