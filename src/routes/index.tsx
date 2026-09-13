import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/")({
  head: () => ({ meta: [{ title: "enonihongo — Belajar Bahasa Jepang" }, { name: "description", content: "Belajar bahasa Jepang N5–N1 bersama enonihongo." }] }),
  component: RootEntry,
});
const CANONICAL_ORIGIN = "https://enonihongo.com";
const sleep = (ms: number) => new Promise<never>((_, reject) => window.setTimeout(() => reject(new Error("timeout")), ms));
function RootEntry() {
  const [message, setMessage] = useState("Memuat enonihongo…");
  useEffect(() => {
    let active = true;
    const hardRedirect = (path: string) => window.location.replace(`${CANONICAL_ORIGIN}${path}`);
    async function finish() {
      if (typeof window === "undefined") return;
      if (window.location.origin !== CANONICAL_ORIGIN) { window.location.replace(`${CANONICAL_ORIGIN}${window.location.pathname}${window.location.search}${window.location.hash}`); return; }
      const params = new URLSearchParams(window.location.search);
      const code = params.get("code");
      const errorDescription = params.get("error_description") || params.get("error");
      if (errorDescription) { if (active) setMessage(`Login gagal: ${errorDescription}`); window.setTimeout(() => hardRedirect("/auth"), 800); return; }
      try {
        if (code) {
          if (active) setMessage("Menyelesaikan login Google…");
          const { error } = await Promise.race([supabase.auth.exchangeCodeForSession(code), sleep(8000)]);
          if (error) throw error;
          window.history.replaceState({}, document.title, "/");
        }
        const sessionResult = await Promise.race([supabase.auth.getSession(), sleep(5000)]);
        if (sessionResult.error) throw sessionResult.error;
        const user = sessionResult.data.session?.user;
        if (!user) { hardRedirect("/auth"); return; }
        let completed = user.user_metadata?.["onboarding_completed"] === true;
        let role = "student";
        try {
          const profileResult = await Promise.race([
            supabase.from("profiles").select("onboarding_completed, role").eq("id", user.id).maybeSingle(),
            sleep(4000),
          ]);
          if (!profileResult.error) {
            completed = profileResult.data?.onboarding_completed === true;
            role = profileResult.data?.role ?? "student";
            if (completed && user.user_metadata?.["onboarding_completed"] !== true) void supabase.auth.updateUser({ data: { onboarding_completed: true } });
          }
        } catch { /* Profile lookup must not block normal login. */ }
        if (role === "owner" || role === "admin") { hardRedirect("/admin"); return; }
        hardRedirect(completed ? "/dashboard" : "/onboarding");
      } catch (caught) {
        const text = caught instanceof Error && caught.message !== "timeout" ? caught.message : "Sesi login terlalu lama. Silakan login ulang.";
        if (active) setMessage(`Login gagal: ${text}`);
        window.setTimeout(() => hardRedirect("/auth"), 1200);
      }
    }
    void finish(); return () => { active = false; };
  }, []);
  return <main className="grid min-h-screen place-items-center bg-[#f7f7f4] px-6 text-center"><div><Loader2 className="mx-auto size-6 animate-spin text-[#1f6f4a]" aria-hidden /><p className="mt-3 text-sm font-medium text-[#30483c]">{message}</p></div></main>;
}
