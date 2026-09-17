import { FormEvent, useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { toast } from "sonner";
import { ArrowRight, BookOpen, Loader2, LockKeyhole, LogIn, Mail, Sparkles, Trophy, UserPlus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { BrandLogo, BrandMark } from "@/components/layout/BrandMark";

export const Route = createFileRoute("/auth")({
  head: () => ({ meta: [{ title: "Masuk atau daftar — enonihongo" }, { name: "description", content: "Masuk atau buat akun ENO NIHONGO untuk menyimpan progres belajar bahasa Jepang." }] }),
  component: AuthPage,
});

const CANONICAL_ORIGIN = "https://www.enonihongo.com";

function selectedPlanCheckout() {
  if (typeof window === "undefined") return null;
  const plan = new URLSearchParams(window.location.search).get("paket");
  return plan && ["premium_monthly", "premium_yearly", "lifetime"].includes(plan) ? `/checkout?plan=${plan}` : null;
}

async function continueAfterAuth() {
  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;
  const user = data.session?.user;
  if (!user) return false;
  const { data: profile } = await supabase.from("profiles").select("onboarding_completed, role").eq("id", user.id).maybeSingle();
  const checkout = selectedPlanCheckout();
  if (checkout) { window.location.replace(checkout); return true; }
  if (profile?.role === "owner" || profile?.role === "admin") { window.location.replace("/admin"); return true; }
  const completed = profile?.onboarding_completed === true || user.user_metadata?.["onboarding_completed"] === true;
  window.location.replace(completed ? "/dashboard" : "/onboarding");
  return true;
}

function LogoLoader() {
  return <div className="grid min-h-screen place-items-center bg-[#f7f7f4] dark:bg-background"><div role="status" aria-label="Memuat" className="animate-[pulse_1.25s_ease-in-out_infinite]"><BrandLogo className="size-[84px]" /></div></div>;
}

function AuthPage() {
  const [checking, setChecking] = useState(true);
  const [loading, setLoading] = useState<"email" | "google" | null>(null);
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    const finish = async () => {
      try {
        const redirected = await continueAfterAuth();
        if (active && !redirected) setChecking(false);
      } catch (caught) {
        if (active) {
          setError(caught instanceof Error ? caught.message : "Sesi tidak dapat diverifikasi.");
          setChecking(false);
        }
      }
    };
    void finish();
    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      if (!active || !session || (event !== "SIGNED_IN" && event !== "TOKEN_REFRESHED")) return;
      window.setTimeout(() => void finish(), 0);
    });
    const timeout = window.setTimeout(() => { if (active) setChecking(false); }, 8000);
    return () => { active = false; window.clearTimeout(timeout); data.subscription.unsubscribe(); };
  }, []);

  function friendlyError(caught: unknown, fallback: string) {
    const message = caught instanceof Error ? caught.message : fallback;
    if (/email not confirmed/i.test(message)) return "Email belum dikonfirmasi. Periksa inbox atau folder Spam lalu buka tautan konfirmasi.";
    if (/invalid login credentials/i.test(message)) return "Email atau kata sandi tidak cocok.";
    if (/user already registered/i.test(message)) return "Email ini sudah terdaftar. Silakan masuk.";
    return message || fallback;
  }

  async function submitEmail(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (loading) return;
    setError(null); setNotice(null);
    const normalizedEmail = email.trim().toLowerCase();
    if (!/^\S+@\S+\.\S+$/.test(normalizedEmail)) { setError("Masukkan alamat email yang valid."); return; }
    if (password.length < 8) { setError("Kata sandi minimal 8 karakter."); return; }
    setLoading("email");
    try {
      if (mode === "signup") {
        const { data, error: signUpError } = await supabase.auth.signUp({ email: normalizedEmail, password, options: { emailRedirectTo: `${CANONICAL_ORIGIN}/` } });
        if (signUpError) throw signUpError;
        if (data.session) { await continueAfterAuth(); return; }
        setNotice("Akun hampir siap. Buka email konfirmasi yang dikirim ke alamatmu, lalu kamu akan masuk secara otomatis.");
        toast.success("Email konfirmasi telah dikirim.");
      } else {
        const { error: signInError } = await supabase.auth.signInWithPassword({ email: normalizedEmail, password });
        if (signInError) throw signInError;
        await continueAfterAuth();
      }
    } catch (caught) {
      const message = friendlyError(caught, mode === "signup" ? "Gagal membuat akun." : "Gagal masuk.");
      setError(message); toast.error(message);
    } finally { setLoading(null); }
  }

  async function signInWithGoogle() {
    if (loading) return;
    setError(null); setNotice(null); setLoading("google");
    try {
      // The root URL is the Supabase-approved site URL. It resolves the locally
      // persisted session first, then routes straight to dashboard/onboarding.
      const { error: oauthError } = await supabase.auth.signInWithOAuth({ provider: "google", options: { redirectTo: `${CANONICAL_ORIGIN}/`, skipBrowserRedirect: false, queryParams: { prompt: "select_account" } } });
      if (oauthError) throw oauthError;
    } catch (caught) {
      const message = friendlyError(caught, "Gagal masuk dengan Google.");
      setError(message); toast.error(message); setLoading(null);
    }
  }

  if (checking) return <LogoLoader />;
  const busy = loading !== null;
  const isSignUp = mode === "signup";
  return <main className="flex min-h-screen items-start justify-center bg-[#f7f7f4] sm:items-center sm:px-5 sm:py-4"><section className="relative flex min-h-screen w-full max-w-[390px] flex-col bg-white px-6 pb-6 pt-8 shadow-xl shadow-[#1f6f4a]/15 sm:min-h-0 sm:rounded-[34px] sm:px-7 sm:py-9"><header className="text-center"><Link to="/" aria-label="enonihongo" className="inline-flex items-center"><BrandMark size="lg" /></Link></header><div className="mt-8 flex flex-col items-center text-center sm:mt-7"><p className="text-[11px] font-bold uppercase tracking-[0.22em] text-[#1f6f4a]">Your Japanese Journey Starts Here</p><h1 className="mt-3 text-[28px] font-black leading-[1.08] tracking-[-0.045em] text-[#263b31]">{isSignUp ? "Buat akun gratis" : "Selamat datang kembali"}</h1><p className="mt-3 max-w-[310px] text-[13px] leading-5 text-[#63756d]">{isSignUp ? "Simpan progres, target belajar, dan hasil latihanmu." : "Masuk untuk melanjutkan perjalanan belajarmu."}</p><div className="mt-5 grid w-full max-w-[320px] grid-cols-3 gap-2"><div className="rounded-2xl bg-[#f5f8f6] px-2 py-2.5"><Sparkles className="mx-auto size-4 text-[#1f6f4a]" /><p className="mt-1.5 text-[10px] font-semibold text-[#30483c]">Belajar</p></div><div className="rounded-2xl bg-[#f5f8f6] px-2 py-2.5"><BookOpen className="mx-auto size-4 text-[#1f6f4a]" /><p className="mt-1.5 text-[10px] font-semibold text-[#30483c]">Latihan</p></div><div className="rounded-2xl bg-[#f5f8f6] px-2 py-2.5"><Trophy className="mx-auto size-4 text-[#1f6f4a]" /><p className="mt-1.5 text-[10px] font-semibold text-[#30483c]">JLPT</p></div></div></div><div className="mt-7 space-y-3"><div className="grid grid-cols-2 rounded-xl bg-[#f3f7f4] p-1"><button type="button" onClick={() => { setMode("signin"); setError(null); setNotice(null); }} className={`rounded-lg py-2 text-xs font-bold transition ${!isSignUp ? "bg-white text-[#1f6f4a] shadow-sm" : "text-[#718078]"}`}>Masuk</button><button type="button" onClick={() => { setMode("signup"); setError(null); setNotice(null); }} className={`rounded-lg py-2 text-xs font-bold transition ${isSignUp ? "bg-white text-[#1f6f4a] shadow-sm" : "text-[#718078]"}`}>Daftar</button></div>{error && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-[11px] leading-4 text-red-700">{error}</p>}{notice && <p role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-[11px] leading-4 text-emerald-800">{notice}</p>}<form className="space-y-2.5" onSubmit={submitEmail}><label className="block"><span className="sr-only">Email</span><span className="flex h-11 items-center gap-2 rounded-xl border border-[#dbe5df] bg-white px-3 focus-within:border-[#1f6f4a] focus-within:ring-2 focus-within:ring-[#1f6f4a]/10"><Mail className="size-4 text-[#6d8177]" /><input value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" inputMode="email" type="email" placeholder="Email" className="h-full min-w-0 flex-1 bg-transparent text-sm text-[#263b31] outline-none placeholder:text-[#92a199]" disabled={busy} required /></span></label><label className="block"><span className="sr-only">Kata sandi</span><span className="flex h-11 items-center gap-2 rounded-xl border border-[#dbe5df] bg-white px-3 focus-within:border-[#1f6f4a] focus-within:ring-2 focus-within:ring-[#1f6f4a]/10"><LockKeyhole className="size-4 text-[#6d8177]" /><input value={password} onChange={(event) => setPassword(event.target.value)} autoComplete={isSignUp ? "new-password" : "current-password"} type="password" placeholder="Kata sandi (minimal 8 karakter)" className="h-full min-w-0 flex-1 bg-transparent text-sm text-[#263b31] outline-none placeholder:text-[#92a199]" disabled={busy} required /></span></label><Button type="submit" disabled={busy} className="h-11 w-full rounded-full bg-[#1f6f4a] text-sm font-bold text-white shadow-lg shadow-[#1f6f4a]/20 hover:bg-[#164c35]">{loading === "email" ? <Loader2 className="mr-2 size-4 animate-spin" /> : isSignUp ? <UserPlus className="mr-2 size-4" /> : <LogIn className="mr-2 size-4" />}{loading === "email" ? "Memproses…" : isSignUp ? "Buat akun dengan Email" : "Masuk dengan Email"}<ArrowRight className="ml-1 size-4" /></Button></form><div className="flex items-center gap-3 py-1"><span className="h-px flex-1 bg-[#e2e9e5]" /><span className="text-[10px] font-medium text-[#87958e]">atau</span><span className="h-px flex-1 bg-[#e2e9e5]" /></div><Button type="button" variant="outline" onClick={signInWithGoogle} disabled={busy} className="h-11 w-full rounded-full border-[#dbe5df] text-sm font-bold text-[#30483c] hover:bg-[#f5f8f6]">{loading === "google" ? <Loader2 className="mr-2 size-4 animate-spin" /> : <span className="mr-2 grid size-5 place-items-center rounded-full bg-[#4285f4] text-[11px] font-black text-white">G</span>}{loading === "google" ? "Menghubungkan Google…" : "Lanjutkan dengan Google"}</Button><p className="text-center text-[10px] leading-4 text-[#7f9189]">{isSignUp ? "Kami mengirim email konfirmasi untuk menjaga akun tetap aman." : "Gunakan metode yang sama seperti saat pertama mendaftar."}</p><p className="pt-1 text-center text-[9px] leading-4 text-[#a0afa9]">© {new Date().getFullYear()} enonihongo · Belajar Jepang bersama-sama</p></div></section></main>;
}
