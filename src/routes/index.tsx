import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/")({
  head: () => ({ meta: [{ title: "enonihongo — Belajar Bahasa Jepang" }, { name: "description", content: "Belajar bahasa Jepang N5–N1 bersama enonihongo." }] }),
  component: RootEntry,
});

const CANONICAL_ORIGIN = "https://enonihongo.com";

function withTimeout<T>(promise: PromiseLike<T>, ms: number): Promise<T> {
  return Promise.race([
    Promise.resolve(promise),
    new Promise<T>((_, reject) => window.setTimeout(() => reject(new Error("timeout")), ms)),
  ]);
}

function RootEntry() {
  const [message, setMessage] = useState("Memuat enonihongo…");

  useEffect(() => {
    let active = true;
    const redirect = (path: string) => window.location.replace(`${CANONICAL_ORIGIN}${path}`);

    // Absolute escape hatch: the splash screen must never remain forever,
    // including Safari/WebView cases where an auth/storage request stalls.
    const escapeTimer = window.setTimeout(() => {
      if (active) redirect("/auth");
    }, 10000);

    async function finish() {
      if (window.location.origin !== CANONICAL_ORIGIN) {
        window.location.replace(`${CANONICAL_ORIGIN}${window.location.pathname}${window.location.search}${window.location.hash}`);
        return;
      }

      const params = new URLSearchParams(window.location.search);
      const code = params.get("code");
      const errorDescription = params.get("error_description") || params.get("error");

      if (errorDescription) {
        if (active) setMessage(`Login gagal: ${errorDescription}`);
        window.setTimeout(() => redirect("/auth"), 700);
        return;
      }

      try {
        if (code) {
          if (active) setMessage("Menyelesaikan login Google…");
          const exchange = await withTimeout(supabase.auth.exchangeCodeForSession(code), 6000);
          if (exchange.error) throw exchange.error;
          window.history.replaceState({}, document.title, "/");
        }

        const sessionResult = await withTimeout(supabase.auth.getSession(), 3500);
        if (sessionResult.error) throw sessionResult.error;
        const user = sessionResult.data.session?.user;
        if (!user) {
          redirect("/auth");
          return;
        }

        let completed = user.user_metadata?.["onboarding_completed"] === true;
        let role = "student";
        try {
          const profileResult = await withTimeout(
            supabase.from("profiles").select("onboarding_completed, role").eq("id", user.id).maybeSingle(),
            2500,
          );
          if (!profileResult.error) {
            completed = profileResult.data?.onboarding_completed === true;
            role = profileResult.data?.role ?? "student";
            if (completed && user.user_metadata?.["onboarding_completed"] !== true) {
              void supabase.auth.updateUser({ data: { onboarding_completed: true } });
            }
          }
        } catch {
          // Profile lookup must never block routing.
        }

        if (role === "owner" || role === "admin") {
          redirect("/admin");
          return;
        }
        redirect(completed ? "/dashboard" : "/onboarding");
      } catch (caught) {
        const text = caught instanceof Error && caught.message !== "timeout"
          ? caught.message
          : "Sesi login terlalu lama. Silakan login ulang.";
        if (active) setMessage(`Login gagal: ${text}`);
        window.setTimeout(() => redirect("/auth"), 700);
      }
    }

    void finish();
    return () => {
      active = false;
      window.clearTimeout(escapeTimer);
    };
  }, []);

  return <main className="grid min-h-screen place-items-center bg-[#f7f7f4] px-6 text-center"><div><Loader2 className="mx-auto size-6 animate-spin text-[#1f6f4a]" aria-hidden /><p className="mt-3 text-sm font-medium text-[#30483c]">{message}</p></div></main>;
}
