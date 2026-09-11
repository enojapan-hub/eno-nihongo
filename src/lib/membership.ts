import { supabase } from "@/integrations/supabase/client";

export type MembershipPlan = "free" | "premium" | "lifetime";
export type Membership = {
  plan: MembershipPlan;
  premiumUntil: string | null;
  monthlyExam: boolean;
};
export type FullSimulationAccess = {
  allowed: boolean;
  plan: MembershipPlan;
  usedThisMonth: number;
  monthlyLimit: number | null;
  monthlyExam: boolean;
};

export async function fetchMembership(): Promise<Membership> {
  const { data, error } = await supabase.rpc("get_my_membership");
  if (error) throw error;
  const plan = (data?.plan ?? "free") as MembershipPlan;
  return {
    plan,
    premiumUntil: data?.premium_until ?? null,
    monthlyExam: plan !== "free",
  };
}

export async function fetchFullSimulationAccess(): Promise<FullSimulationAccess> {
  const { data, error } = await supabase.rpc("can_start_full_simulation");
  if (error) throw error;
  return {
    allowed: !!data?.allowed,
    plan: (data?.plan ?? "free") as MembershipPlan,
    usedThisMonth: Number(data?.used_this_month ?? 0),
    monthlyLimit: data?.monthly_limit == null ? null : Number(data.monthly_limit),
    monthlyExam: !!data?.monthly_exam,
  };
}
