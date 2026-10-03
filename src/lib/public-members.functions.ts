import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env["VITE_SUPABASE_URL"];
const supabaseAnonKey = import.meta.env["VITE_SUPABASE_ANON_KEY"];

export const getPublicMembers = createServerFn({ method: "GET" }).handler(async () => {
  if (!supabaseUrl || !supabaseAnonKey) return [];

  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data, error } = await supabase
    .from("profiles")
    .select("id, display_name, avatar_url, created_at")
    .not("avatar_url", "is", null)
    .neq("avatar_url", "")
    .order("created_at", { ascending: false })
    .limit(9);

  if (error) return [];

  return (data ?? []).map((member) => ({
    id: member.id,
    name: member.display_name || "ENO JAPAN member",
    avatar_url: member.avatar_url,
  }));
});
