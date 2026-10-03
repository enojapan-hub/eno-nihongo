import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    const { data, error } = await supabase.auth.getSession();

    if (!error && data.session?.user) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("suspended_at")
        .eq("id", data.session.user.id)
        .maybeSingle();
      if (profile?.suspended_at) {
        await supabase.auth.signOut({ scope: "local" });
        throw redirect({
          to: "/auth",
          search: { error: "Akun Anda sedang dinonaktifkan. Hubungi Admin." },
        });
      }
      return { user: data.session.user };
    }

    if (error) await supabase.auth.signOut({ scope: "local" });
    throw redirect({ to: "/auth" });
  },
  component: () => <Outlet />,
});
