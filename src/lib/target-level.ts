import { supabase } from "@/integrations/supabase/client";
import { getAuthUser } from "@/lib/auth-user";
import type { Level } from "@/lib/learn-queries";

const LEVELS: Level[] = ["N5", "N4", "N3", "N2", "N1"];

export async function fetchTargetLevel(): Promise<Level> {
  const { data: user } = await getAuthUser();
  if (!user.user) return "N5";
  const { data, error } = await supabase
    .from("profiles")
    .select("target_level")
    .eq("id", user.user.id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  const level = data?.target_level as Level | null | undefined;
  return level && LEVELS.includes(level) ? level : "N5";
}
