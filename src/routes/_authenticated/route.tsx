import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";

// beforeLoad berjalan pada SETIAP navigasi; pemeriksaan suspend ke database di-cache singkat per user
// agar perpindahan halaman tidak menunggu satu round-trip. Akun yang di-suspend tetap dikeluarkan
// paling lambat satu TTL kemudian.
const SUSPEND_CHECK_TTL_MS = 60_000;
let suspendChecked: { userId: string; at: number } | null = null;

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    const { data, error } = await supabase.auth.getSession();

    if (!error && data.session?.user) {
      const recent =
        suspendChecked?.userId === data.session.user.id &&
        Date.now() - suspendChecked.at < SUSPEND_CHECK_TTL_MS;
      if (recent) return { user: data.session.user };
      const { data: profile } = await supabase
        .from("profiles")
        .select("suspended_at")
        .eq("id", data.session.user.id)
        .maybeSingle();
      if (!profile?.suspended_at) suspendChecked = { userId: data.session.user.id, at: Date.now() };
      if (profile?.suspended_at) {
        suspendChecked = null;
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
