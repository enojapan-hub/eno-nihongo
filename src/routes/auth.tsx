import { FormEvent, useEffect, useRef, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { toast } from "sonner";
import {
  ArrowRight,
  BookOpen,
  Loader2,
  LockKeyhole,
  LogIn,
  Mail,
  Sparkles,
  Trophy,
  UserPlus,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { BrandMark } from "@/components/layout/BrandMark";
import { AuthLoader } from "@/components/layout/AuthLoader";
import {
  CALLBACK_FAILED_MESSAGE,
  canonicalAuthUrl,
  initialAuthCallback,
  isRecoverySession,
  resolveAuth,
} from "@/lib/auth-flow";
import { CANONICAL_ORIGIN, requestPasswordRecovery } from "@/lib/auth-account";
import {
  authErrorMessage,
  INVALID_CREDENTIALS_MESSAGE,
  isAlreadyRegistered,
  isNetworkError,
  isRateLimited,
} from "@/lib/auth-errors";
import { PASSWORD_MIN_LENGTH, PASSWORD_TOO_SHORT_MESSAGE } from "@/lib/password-policy";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Masuk atau daftar — enonihongo" },
      {
        name: "description",
        content: "Masuk atau buat akun ENO NIHONGO untuk menyimpan progres belajar bahasa Jepang.",
      },
    ],
  }),
  component: AuthPage,
});

function selectedPlanCheckout() {
  if (typeof window === "undefined") return null;
  const plan = new URLSearchParams(window.location.search).get("paket");
  return plan && ["premium_monthly", "premium_yearly", "lifetime"].includes(plan)
    ? `/checkout?plan=${plan}`
    : null;
}

async function continueAfterAuth() {
  const result = await resolveAuth();
  if (!result.authenticated) return false;
  // Sesi pemulihan kata sandi tidak boleh dilompati ke checkout/dashboard.
  window.location.replace(
    isRecoverySession() ? result.destination : (selectedPlanCheckout() ?? result.destination),
  );
  return true;
}

function AuthPage() {
  const [checking, setChecking] = useState(true);
  const [loading, setLoading] = useState<"email" | "google" | "recovery" | null>(null);
  const [mode, setMode] = useState<"signin" | "signup" | "forgot">("signin");
  const passwordRef = useRef<HTMLInputElement>(null);
  const [focusPassword, setFocusPassword] = useState(false);
  const [alreadyRegistered, setAlreadyRegistered] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const code = new URLSearchParams(window.location.search).get("ref");
    if (code && /^[A-Za-z0-9_-]{4,40}$/.test(code)) {
      window.sessionStorage.setItem("eno_referral_code", code.toUpperCase());
    }
    let active = true;
    const canonical = canonicalAuthUrl(window.location);
    if (canonical) {
      window.location.replace(canonical);
      return;
    }
    const finish = async () => {
      try {
        const redirected = await continueAfterAuth();
        if (active && !redirected) {
          if (
            initialAuthCallback.present ||
            new URLSearchParams(window.location.search).get("callback") === "failed"
          )
            setError(CALLBACK_FAILED_MESSAGE);
          if (new URLSearchParams(window.location.search).get("mode") === "lupa") setMode("forgot");
          setChecking(false);
        }
      } catch (caught) {
        if (active) {
          setError("Sesi tidak dapat diverifikasi. Muat ulang halaman lalu coba lagi.");
          setChecking(false);
        }
      }
    };
    void finish();
    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      if (!active || !session || (event !== "SIGNED_IN" && event !== "TOKEN_REFRESHED")) return;
      window.setTimeout(() => void finish(), 0);
    });
    const timeout = window.setTimeout(() => {
      if (active) setChecking(false);
    }, 8000);
    return () => {
      active = false;
      window.clearTimeout(timeout);
      data.subscription.unsubscribe();
    };
  }, []);

  // Setelah render tab Masuk, pindahkan fokus ke kolom kata sandi (email dipertahankan).
  useEffect(() => {
    if (focusPassword && mode === "signin") {
      passwordRef.current?.focus();
      setFocusPassword(false);
    }
  }, [focusPassword, mode]);

  function goToSignIn() {
    setMode("signin");
    setPassword("");
    setError(null);
    setNotice(null);
    setFocusPassword(true);
  }

  async function requestRecovery(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (loading) return;
    setError(null);
    setNotice(null);
    const normalizedEmail = email.trim().toLowerCase();
    if (!/^\S+@\S+\.\S+$/.test(normalizedEmail)) {
      setError("Masukkan alamat email yang valid.");
      return;
    }
    setLoading("recovery");
    try {
      // Alur resmi Supabase; redirectTo konstan di auth-account (bukan dari input: tanpa open redirect).
      const { error: recoverError } = await requestPasswordRecovery(normalizedEmail);
      // Hanya kegagalan umum (batas permintaan/jaringan/server) yang ditampilkan; selain itu respons
      // selalu netral agar keberadaan akun tidak bocor.
      if (recoverError && (isRateLimited(recoverError) || isNetworkError(recoverError)))
        throw recoverError;
      setNotice(
        "Jika email tersebut terdaftar, tautan untuk mengatur ulang kata sandi akan dikirim ke email Anda. Periksa juga folder Spam, dan buka email terbaru saja.",
      );
    } catch (caught) {
      setError(authErrorMessage(caught, "recovery-request"));
    } finally {
      setLoading(null);
    }
  }

  async function submitEmail(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (loading) return;
    setError(null);
    setNotice(null);
    setAlreadyRegistered(false);
    const normalizedEmail = email.trim().toLowerCase();
    if (!/^\S+@\S+\.\S+$/.test(normalizedEmail)) {
      setError("Masukkan alamat email yang valid.");
      return;
    }
    if (password.length < PASSWORD_MIN_LENGTH) {
      setError(PASSWORD_TOO_SHORT_MESSAGE);
      return;
    }
    setLoading("email");
    try {
      if (mode === "signup") {
        const { data, error: signUpError } = await supabase.auth.signUp({
          email: normalizedEmail,
          password,
          options: { emailRedirectTo: `${CANONICAL_ORIGIN}/` },
        });
        if (signUpError) throw signUpError;
        if (data.session) {
          await continueAfterAuth();
          return;
        }
        // Respons yang sama untuk email baru maupun yang sudah punya akun (Supabase menyamarkannya),
        // sehingga tidak ada kebocoran keberadaan akun dari UI.
        setNotice(
          "Jika email ini sudah memiliki akun, silakan masuk. Jika belum, periksa email Anda untuk melanjutkan pendaftaran.",
        );
      } else {
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email: normalizedEmail,
          password,
        });
        if (signInError) throw signInError;
        await continueAfterAuth();
      }
    } catch (caught) {
      const message = authErrorMessage(caught, mode === "signup" ? "signup" : "signin");
      setAlreadyRegistered(mode === "signup" && isAlreadyRegistered(caught));
      setError(message);
      toast.error(message);
    } finally {
      setLoading(null);
    }
  }

  async function signInWithGoogle() {
    if (loading) return;
    setError(null);
    setNotice(null);
    setLoading("google");
    try {
      // The root URL is the Supabase-approved site URL. It resolves the locally
      // persisted session first, then routes straight to dashboard/onboarding.
      const { error: oauthError } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${CANONICAL_ORIGIN}/`,
          skipBrowserRedirect: false,
          queryParams: { prompt: "select_account" },
        },
      });
      if (oauthError) throw oauthError;
    } catch (caught) {
      const message = authErrorMessage(caught, "oauth");
      setError(message);
      toast.error(message);
      setLoading(null);
    }
  }

  if (checking) return <AuthLoader />;
  const busy = loading !== null;
  const isSignUp = mode === "signup";
  const isForgot = mode === "forgot";
  return (
    <main className="flex min-h-screen items-start justify-center bg-[#f7f7f4] sm:items-center sm:px-5 sm:py-4">
      <section className="relative flex min-h-screen w-full max-w-[390px] flex-col bg-white px-6 pb-6 pt-8 shadow-xl shadow-[#1f6f4a]/15 sm:min-h-0 sm:rounded-[34px] sm:px-7 sm:py-9">
        <header className="text-center">
          <Link to="/" aria-label="enonihongo" className="inline-flex items-center">
            <BrandMark size="lg" />
          </Link>
        </header>
        <div className="mt-8 flex flex-col items-center text-center sm:mt-7">
          <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-[#1f6f4a]">
            Your Japanese Journey Starts Here
          </p>
          <h1 className="mt-3 text-[28px] font-black leading-[1.08] tracking-[-0.045em] text-[#263b31]">
            {isForgot
              ? "Atur ulang kata sandi"
              : isSignUp
                ? "Buat akun gratis"
                : "Selamat datang kembali"}
          </h1>
          <p className="mt-3 max-w-[310px] text-[13px] leading-5 text-[#63756d]">
            {isForgot
              ? "Masukkan email akunmu. Kami akan mengirim tautan untuk membuat kata sandi baru."
              : isSignUp
                ? "Simpan progres, target belajar, dan hasil latihanmu."
                : "Masuk untuk melanjutkan perjalanan belajarmu."}
          </p>
          <div className="mt-5 grid w-full max-w-[320px] grid-cols-3 gap-2">
            <div className="rounded-2xl bg-[#f5f8f6] px-2 py-2.5">
              <Sparkles className="mx-auto size-4 text-[#1f6f4a]" />
              <p className="mt-1.5 text-[10px] font-semibold text-[#30483c]">Belajar</p>
            </div>
            <div className="rounded-2xl bg-[#f5f8f6] px-2 py-2.5">
              <BookOpen className="mx-auto size-4 text-[#1f6f4a]" />
              <p className="mt-1.5 text-[10px] font-semibold text-[#30483c]">Latihan</p>
            </div>
            <div className="rounded-2xl bg-[#f5f8f6] px-2 py-2.5">
              <Trophy className="mx-auto size-4 text-[#1f6f4a]" />
              <p className="mt-1.5 text-[10px] font-semibold text-[#30483c]">JLPT</p>
            </div>
          </div>
        </div>
        <div className="mt-7 space-y-3">
          {!isForgot && (
            <div className="grid grid-cols-2 rounded-xl bg-[#f3f7f4] p-1">
              <button
                type="button"
                onClick={() => {
                  setMode("signin");
                  setError(null);
                  setNotice(null);
                  setAlreadyRegistered(false);
                }}
                className={`rounded-lg py-2 text-xs font-bold transition ${!isSignUp ? "bg-white text-[#1f6f4a] shadow-sm" : "text-[#718078]"}`}
              >
                Masuk
              </button>
              <button
                type="button"
                onClick={() => {
                  setMode("signup");
                  setError(null);
                  setNotice(null);
                  setAlreadyRegistered(false);
                }}
                className={`rounded-lg py-2 text-xs font-bold transition ${isSignUp ? "bg-white text-[#1f6f4a] shadow-sm" : "text-[#718078]"}`}
              >
                Daftar
              </button>
            </div>
          )}
          {error && (
            <p
              role="alert"
              className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-[11px] leading-4 text-red-700"
            >
              {error}
              {!isSignUp && !isForgot && error === INVALID_CREDENTIALS_MESSAGE && (
                <span className="mt-1 block text-red-600/90">
                  Mendaftar dengan Google? Gunakan tombol Lanjutkan dengan Google.
                </span>
              )}
              {isSignUp && alreadyRegistered && (
                <button
                  type="button"
                  onClick={goToSignIn}
                  className="mt-1.5 block font-bold text-red-800 underline underline-offset-2"
                >
                  Masuk
                </button>
              )}
            </p>
          )}
          {notice && (
            <p
              role="status"
              className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-[11px] leading-4 text-emerald-800"
            >
              {notice}
              {isSignUp && (
                <button
                  type="button"
                  onClick={goToSignIn}
                  className="mt-1.5 block font-bold text-emerald-900 underline underline-offset-2"
                >
                  Masuk
                </button>
              )}
            </p>
          )}
          {isForgot ? (
            <form className="space-y-2.5" onSubmit={requestRecovery} noValidate>
              <label className="block">
                <span className="sr-only">Email</span>
                <span className="flex h-11 items-center gap-2 rounded-xl border border-[#dbe5df] bg-white px-3 focus-within:border-[#1f6f4a] focus-within:ring-2 focus-within:ring-[#1f6f4a]/10">
                  <Mail className="size-4 text-[#6d8177]" />
                  <input
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    autoComplete="email"
                    inputMode="email"
                    type="email"
                    placeholder="Email"
                    className="h-full min-w-0 flex-1 bg-transparent text-sm text-[#263b31] outline-none placeholder:text-[#92a199]"
                    disabled={busy}
                  />
                </span>
              </label>
              <Button
                type="submit"
                disabled={busy}
                className="h-11 w-full rounded-full bg-[#1f6f4a] text-sm font-bold text-white shadow-lg shadow-[#1f6f4a]/20 hover:bg-[#164c35]"
              >
                {loading === "recovery" ? (
                  <Loader2 className="mr-2 size-4 animate-spin" />
                ) : (
                  <Mail className="mr-2 size-4" />
                )}
                {loading === "recovery" ? "Mengirim…" : "Kirim tautan atur ulang"}
              </Button>
              <button
                type="button"
                onClick={goToSignIn}
                disabled={busy}
                className="block w-full pt-1 text-center text-[12px] font-bold text-[#1f6f4a]"
              >
                Kembali ke Masuk
              </button>
            </form>
          ) : (
            <>
              <form className="space-y-2.5" onSubmit={submitEmail}>
                <label className="block">
                  <span className="sr-only">Email</span>
                  <span className="flex h-11 items-center gap-2 rounded-xl border border-[#dbe5df] bg-white px-3 focus-within:border-[#1f6f4a] focus-within:ring-2 focus-within:ring-[#1f6f4a]/10">
                    <Mail className="size-4 text-[#6d8177]" />
                    <input
                      value={email}
                      onChange={(event) => setEmail(event.target.value)}
                      autoComplete="email"
                      inputMode="email"
                      type="email"
                      placeholder="Email"
                      className="h-full min-w-0 flex-1 bg-transparent text-sm text-[#263b31] outline-none placeholder:text-[#92a199]"
                      disabled={busy}
                      required
                    />
                  </span>
                </label>
                <label className="block">
                  <span className="sr-only">Kata sandi</span>
                  <span className="flex h-11 items-center gap-2 rounded-xl border border-[#dbe5df] bg-white px-3 focus-within:border-[#1f6f4a] focus-within:ring-2 focus-within:ring-[#1f6f4a]/10">
                    <LockKeyhole className="size-4 text-[#6d8177]" />
                    <input
                      ref={passwordRef}
                      value={password}
                      onChange={(event) => setPassword(event.target.value)}
                      autoComplete={isSignUp ? "new-password" : "current-password"}
                      type="password"
                      placeholder="Kata sandi (minimal 8 karakter)"
                      className="h-full min-w-0 flex-1 bg-transparent text-sm text-[#263b31] outline-none placeholder:text-[#92a199]"
                      disabled={busy}
                      required
                    />
                  </span>
                </label>
                {!isSignUp && (
                  <div className="flex justify-end">
                    <button
                      type="button"
                      onClick={() => {
                        setMode("forgot");
                        setError(null);
                        setNotice(null);
                      }}
                      disabled={busy}
                      className="py-0.5 text-[11px] font-bold text-[#1f6f4a] underline-offset-2 hover:underline"
                    >
                      Lupa kata sandi?
                    </button>
                  </div>
                )}
                <Button
                  type="submit"
                  disabled={busy}
                  className="h-11 w-full rounded-full bg-[#1f6f4a] text-sm font-bold text-white shadow-lg shadow-[#1f6f4a]/20 hover:bg-[#164c35]"
                >
                  {loading === "email" ? (
                    <Loader2 className="mr-2 size-4 animate-spin" />
                  ) : isSignUp ? (
                    <UserPlus className="mr-2 size-4" />
                  ) : (
                    <LogIn className="mr-2 size-4" />
                  )}
                  {loading === "email"
                    ? "Memproses…"
                    : isSignUp
                      ? "Buat akun dengan Email"
                      : "Masuk dengan Email"}
                  <ArrowRight className="ml-1 size-4" />
                </Button>
              </form>
              <div className="flex items-center gap-3 py-1">
                <span className="h-px flex-1 bg-[#e2e9e5]" />
                <span className="text-[10px] font-medium text-[#87958e]">atau</span>
                <span className="h-px flex-1 bg-[#e2e9e5]" />
              </div>
              <Button
                type="button"
                variant="outline"
                onClick={signInWithGoogle}
                disabled={busy}
                className="h-11 w-full rounded-full border-[#dbe5df] text-sm font-bold text-[#30483c] hover:bg-[#f5f8f6]"
              >
                {loading === "google" ? (
                  <Loader2 className="mr-2 size-4 animate-spin" />
                ) : (
                  <span className="mr-2 grid size-5 place-items-center rounded-full bg-[#4285f4] text-[11px] font-black text-white">
                    G
                  </span>
                )}
                {loading === "google" ? "Menghubungkan Google…" : "Lanjutkan dengan Google"}
              </Button>
            </>
          )}
          <p className="text-center text-[10px] leading-4 text-[#7f9189]">
            {isSignUp
              ? "Kami mengirim email konfirmasi untuk menjaga akun tetap aman."
              : "Gunakan metode yang sama seperti saat pertama mendaftar."}
          </p>
          <p className="pt-1 text-center text-[9px] leading-4 text-[#a0afa9]">
            © {new Date().getFullYear()} enonihongo · Belajar Jepang bersama-sama
          </p>
        </div>
      </section>
    </main>
  );
}
