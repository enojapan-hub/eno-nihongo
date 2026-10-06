import { FormEvent, useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { toast } from "sonner";
import { KeyRound, Loader2, LockKeyhole } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { BrandMark } from "@/components/layout/BrandMark";
import { AuthLoader } from "@/components/layout/AuthLoader";
import {
  classifyRecoveryFailure,
  clearRecoverySession,
  initialAuthCallback,
  isRecoverySession,
  markRecoverySession,
  readRecoveryHashTokens,
  resolveAuth,
  type RecoveryFailure,
} from "@/lib/auth-flow";
import { authErrorMessage, RECOVERY_LINK_INVALID_MESSAGE } from "@/lib/auth-errors";
import { PASSWORD_MIN_LENGTH, validateNewPassword } from "@/lib/password-policy";

export const Route = createFileRoute("/reset-password")({
  head: () => ({
    meta: [
      { title: "Atur ulang kata sandi — enonihongo" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: ResetPasswordPage,
});

type Phase = "checking" | "ready" | "invalid";

const FAILURE_COPY: Record<RecoveryFailure, string> = {
  expired:
    "Tautan ini sudah kedaluwarsa atau sudah pernah dipakai. Minta tautan baru lalu buka tautan terbaru dari email.",
  wrong_browser:
    "Tautan ini tidak dapat diselesaikan di browser ini. Minta tautan baru dari halaman Masuk, lalu buka tautan terbaru dari email.",
  exchange_failed:
    "Tautan tidak dapat diverifikasi. Minta tautan baru lalu buka tautan terbaru dari email.",
  no_callback:
    "Halaman ini hanya dapat dibuka dari tautan atur ulang kata sandi di email. Minta tautan baru bila diperlukan.",
  not_recovery:
    "Halaman ini hanya dapat dibuka dari tautan atur ulang kata sandi di email. Minta tautan baru bila diperlukan.",
};

function ResetPasswordPage() {
  const [phase, setPhase] = useState<Phase>("checking");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [failure, setFailure] = useState<RecoveryFailure | null>(null);

  useEffect(() => {
    let active = true;
    const check = async () => {
      // Mekanisme tunggal: tautan implicit (fragment type=recovery) dipasang lewat API resmi setSession.
      // Token tidak dicatat dan segera dihapus dari URL.
      const hashTokens = readRecoveryHashTokens(window.location.hash);
      if (hashTokens) {
        const { error: sessionError } = await supabase.auth.setSession(hashTokens);
        window.history.replaceState(
          window.history.state,
          "",
          window.location.pathname + window.location.search,
        );
        if (!active) return;
        if (!sessionError) {
          markRecoverySession();
          setPhase("ready");
          return;
        }
        setFailure(classifyRecoveryFailure(initialAuthCallback, sessionError, false));
        setPhase("invalid");
        return;
      }
      // 1) Tanpa fragment: muat ulang halaman ini setelah sesi pemulihan terpasang (penanda tab + sesi tersimpan).
      const { data } = await supabase.auth.getSession();
      if (!active) return;
      if (data.session && isRecoverySession()) {
        setPhase("ready");
        return;
      }
      // 2) Definitif: tidak ada tautan valid (kedaluwarsa/sudah dipakai/dibuka tanpa tautan).
      setFailure(classifyRecoveryFailure(initialAuthCallback, null, Boolean(data.session)));
      setPhase("invalid");
    };
    void check();
    return () => {
      active = false;
    };
  }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setError(null);
    const invalid = validateNewPassword(password, confirm);
    if (invalid) {
      setError(invalid);
      return;
    }
    setBusy(true);
    try {
      const { error: updateError } = await supabase.auth.updateUser({ password });
      if (updateError) throw updateError;
      // Kata sandi lama yang mungkin bocor tidak boleh tetap berlaku di perangkat lain (best effort).
      await supabase.auth.signOut({ scope: "others" }).catch(() => undefined);
      clearRecoverySession();
      setPassword("");
      setConfirm("");
      toast.success("Kata sandi berhasil diubah.");
      const result = await resolveAuth();
      window.location.replace(result.authenticated ? result.destination : "/auth");
    } catch (caught) {
      const message = authErrorMessage(caught, "password-update");
      setError(message);
      if (message === RECOVERY_LINK_INVALID_MESSAGE) {
        setFailure("expired");
        setPhase("invalid");
      }
      setBusy(false);
    }
  }

  if (phase === "checking") return <AuthLoader />;
  return (
    <main className="flex min-h-screen items-start justify-center bg-[#f7f7f4] sm:items-center sm:px-5 sm:py-4">
      <section className="relative flex min-h-screen w-full max-w-[390px] flex-col bg-white px-6 pb-6 pt-8 shadow-xl shadow-[#1f6f4a]/15 sm:min-h-0 sm:rounded-[34px] sm:px-7 sm:py-9">
        <header className="text-center">
          <Link to="/" aria-label="enonihongo" className="inline-flex items-center">
            <BrandMark size="lg" />
          </Link>
        </header>
        {phase === "invalid" ? (
          <div className="mt-10 text-center">
            <h1 className="text-[24px] font-black leading-[1.1] tracking-[-0.04em] text-[#263b31]">
              Tautan tidak berlaku
            </h1>
            <p role="alert" className="mt-3 text-[13px] leading-5 text-[#63756d]">
              {FAILURE_COPY[failure ?? "exchange_failed"]}
            </p>
            <p className="mt-2 text-[10px] leading-4 text-[#87958e]">
              Meminta tautan berulang dalam waktu singkat dapat dibatasi sementara oleh sistem.
              {failure && <span className="ml-1">Kode: {failure}</span>}
            </p>
            <a
              href="/auth?mode=lupa"
              className="mt-6 inline-flex h-11 w-full items-center justify-center rounded-full bg-[#1f6f4a] text-sm font-bold text-white shadow-lg shadow-[#1f6f4a]/20 hover:bg-[#164c35]"
            >
              Minta tautan baru
            </a>
            <a href="/auth" className="mt-3 block text-[12px] font-bold text-[#1f6f4a]">
              Kembali ke Masuk
            </a>
          </div>
        ) : (
          <div className="mt-8">
            <div className="text-center">
              <h1 className="text-[26px] font-black leading-[1.1] tracking-[-0.04em] text-[#263b31]">
                Atur kata sandi baru
              </h1>
              <p className="mt-3 text-[13px] leading-5 text-[#63756d]">
                Pilih kata sandi baru untuk akun Anda (minimal {PASSWORD_MIN_LENGTH} karakter).
              </p>
            </div>
            {error && (
              <p
                role="alert"
                className="mt-5 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-[11px] leading-4 text-red-700"
              >
                {error}
              </p>
            )}
            <form className="mt-5 space-y-2.5" onSubmit={submit} noValidate>
              <label className="block">
                <span className="sr-only">Kata sandi baru</span>
                <span className="flex h-11 items-center gap-2 rounded-xl border border-[#dbe5df] bg-white px-3 focus-within:border-[#1f6f4a] focus-within:ring-2 focus-within:ring-[#1f6f4a]/10">
                  <LockKeyhole className="size-4 text-[#6d8177]" />
                  <input
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    autoComplete="new-password"
                    type="password"
                    placeholder="Kata sandi baru"
                    className="h-full min-w-0 flex-1 bg-transparent text-sm text-[#263b31] outline-none placeholder:text-[#92a199]"
                    disabled={busy}
                  />
                </span>
              </label>
              <label className="block">
                <span className="sr-only">Konfirmasi kata sandi baru</span>
                <span className="flex h-11 items-center gap-2 rounded-xl border border-[#dbe5df] bg-white px-3 focus-within:border-[#1f6f4a] focus-within:ring-2 focus-within:ring-[#1f6f4a]/10">
                  <LockKeyhole className="size-4 text-[#6d8177]" />
                  <input
                    value={confirm}
                    onChange={(event) => setConfirm(event.target.value)}
                    autoComplete="new-password"
                    type="password"
                    placeholder="Ulangi kata sandi baru"
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
                {busy ? (
                  <Loader2 className="mr-2 size-4 animate-spin" />
                ) : (
                  <KeyRound className="mr-2 size-4" />
                )}
                {busy ? "Menyimpan…" : "Simpan kata sandi baru"}
              </Button>
            </form>
          </div>
        )}
      </section>
    </main>
  );
}
