import { supabase } from "@/integrations/supabase/client";
import { getAuthUser } from "@/lib/auth-user";

export type MembershipPlan = "free" | "premium" | "lifetime";
export type Membership = {
  plan: MembershipPlan;
  premiumUntil: string | null;
  monthlyExam: boolean;
};
export type MembershipAccess = Membership & { hasPremiumAccess: boolean };
export type FullSimulationAccess = {
  allowed: boolean;
  plan: MembershipPlan;
  usedThisMonth: number;
  monthlyLimit: number | null;
  monthlyExam: boolean;
};

// Bentuk JSON yang dikembalikan RPC (tipe generated hanya menyebutnya Json).
type MembershipRpc = { plan?: string | null; premium_until?: string | null } | null;
type FullSimulationRpc = {
  allowed?: boolean | null;
  plan?: string | null;
  used_this_month?: number | string | null;
  monthly_limit?: number | string | null;
  monthly_exam?: boolean | null;
} | null;

export async function fetchMembership(): Promise<Membership> {
  const { data: raw, error } = await supabase.rpc("get_my_membership");
  if (error) throw error;
  const data = raw as MembershipRpc;
  const plan = (data?.plan ?? "free") as MembershipPlan;
  return { plan, premiumUntil: data?.premium_until ?? null, monthlyExam: plan !== "free" };
}

export async function fetchMembershipAccess(): Promise<MembershipAccess> {
  const membership = await fetchMembership();
  const { data: userData } = await getAuthUser();
  const userId = userData.user?.id;
  if (!userId) return { ...membership, hasPremiumAccess: false };
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", userId)
    .maybeSingle();
  const privileged = ["owner", "admin", "editor", "teacher"].includes(profile?.role ?? "");
  return { ...membership, hasPremiumAccess: privileged || membership.plan !== "free" };
}

export async function fetchFullSimulationAccess(): Promise<FullSimulationAccess> {
  const { data: raw, error } = await supabase.rpc("can_start_full_simulation");
  if (error) throw error;
  const data = raw as FullSimulationRpc;
  return {
    allowed: !!data?.allowed,
    plan: (data?.plan ?? "free") as MembershipPlan,
    usedThisMonth: Number(data?.used_this_month ?? 0),
    monthlyLimit: data?.monthly_limit == null ? null : Number(data.monthly_limit),
    monthlyExam: !!data?.monthly_exam,
  };
}
