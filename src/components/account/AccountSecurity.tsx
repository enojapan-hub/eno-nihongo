import { FormEvent, useEffect, useState } from "react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { KeyRound, Loader2, LogOut, ShieldCheck, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { getAuthUser } from "@/lib/auth-user";
import { signOutEverywhere } from "@/lib/auth-actions";
import {
  accountProviders,
  isGoogleOnly,
  providerLabel,
  type AccountProviders,
} from "@/lib/auth-account";
import { authErrorMessage } from "@/lib/auth-errors";
import { PASSWORD_MIN_LENGTH, validateNewPassword } from "@/lib/password-policy";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

const rowClass =
  "group flex w-full items-center gap-3 rounded-2xl p-3 text-left transition hover:bg-primary/[.04] active:scale-[.99] disabled:opacity-60";

function SecurityRow({
  icon: I,
  title,
  desc,
  onClick,
  disabled,
}: {
  icon: typeof KeyRound;
  title: string;
  desc: string;
  onClick?: () => void;
  disabled?: boolean;
}) {
  const content = (
    <>
      <span className="grid size-10 shrink-0 place-items-center rounded-2xl bg-primary/10 text-primary">
        <I className="size-[18px]" />
      </span>
      <span className="min-w-0 flex-1">
        <b className="block text-[12px]">{title}</b>
        <span className="mt-0.5 block text-[9px] leading-4 text-muted-foreground">{desc}</span>
      </span>
    </>
  );
  if (!onClick)
    return <div className={rowClass.replace("hover:bg-primary/[.04]", "")}>{content}</div>;
  return (
    <button type="button" onClick={onClick} disabled={disabled} className={rowClass}>
      {content}
    </button>
  );
}

type Step = "form" | "code";

function ChangePasswordDialog({ onClose }: { onClose: () => void }) {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [code, setCode] = useState("");
  const [step, setStep] = useState<Step>("form");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  async function finish() {
    // Cabut sesi di perangkat lain setelah kata sandi berubah (best effort; sesi ini tetap aktif).
    await supabase.auth.signOut({ scope: "others" }).catch(() => undefined);
    setPassword("");
    setConfirm("");
    setCode("");
    toast.success("Kata sandi berhasil diubah.");
    onClose();
  }

  async function sendCode() {
    const { error: reauthError } = await supabase.auth.reauthenticate();
    if (reauthError) throw reauthError;
    setStep("code");
    setNotice(
      "Kami mengirim kode verifikasi ke email Anda. Masukkan kode tersebut untuk melanjutkan.",
    );
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setError(null);
    const invalid = validateNewPassword(password, confirm);
    if (invalid) {
      setError(invalid);
      return;
    }
    if (step === "code" && !code.trim()) {
      setError("Masukkan kode verifikasi dari email Anda.");
      return;
    }
    setBusy(true);
    try {
      const attempt =
        step === "code"
          ? await supabase.auth.updateUser({ password, nonce: code.trim() })
          : await supabase.auth.updateUser({ password });
      if (attempt.error) {
        // Mekanisme resmi Supabase: bila diwajibkan, verifikasi ulang lewat kode (nonce) yang dikirim ke email.
        if (step === "form" && attempt.error.code === "reauthentication_needed") {
          await sendCode();
          return;
        }
        throw attempt.error;
      }
      await finish();
    } catch (caught) {
      setError(authErrorMessage(caught, step === "code" ? "password-update" : "reauth"));
    } finally {
      setBusy(false);
    }
  }

  async function resend() {
    if (busy) return;
    setError(null);
    setBusy(true);
    try {
      await sendCode();
    } catch (caught) {
      setError(authErrorMessage(caught, "reauth"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-[100] grid place-items-center bg-black/40 p-4"
      onClick={onClose}
    >
      <form
        onSubmit={submit}
        noValidate
        role="dialog"
        aria-label="Ubah kata sandi"
        className="w-full max-w-sm space-y-3 rounded-[1.7rem] border bg-background p-5 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start gap-3">
          <span className="grid size-9 place-items-center rounded-xl bg-primary/10 text-primary">
            <KeyRound className="size-4" />
          </span>
          <div className="flex-1">
            <h2 className="text-sm font-black">Ubah kata sandi</h2>
            <p className="mt-1 text-[10px] leading-5 text-muted-foreground">
              Minimal {PASSWORD_MIN_LENGTH} karakter.
            </p>
          </div>
          <button type="button" onClick={onClose} aria-label="Tutup" disabled={busy}>
            <X className="size-4" />
          </button>
        </div>
        {error && (
          <p
            role="alert"
            className="rounded-xl bg-destructive/10 p-2.5 text-[10px] text-destructive"
          >
            {error}
          </p>
        )}
        {notice && step === "code" && (
          <p role="status" className="rounded-xl bg-primary/10 p-2.5 text-[10px] text-primary">
            {notice}
          </p>
        )}
        <Input
          type="password"
          autoComplete="new-password"
          placeholder="Kata sandi baru"
          aria-label="Kata sandi baru"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          disabled={busy}
        />
        <Input
          type="password"
          autoComplete="new-password"
          placeholder="Ulangi kata sandi baru"
          aria-label="Konfirmasi kata sandi baru"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          disabled={busy}
        />
        {step === "code" && (
          <>
            <Input
              inputMode="numeric"
              autoComplete="one-time-code"
              placeholder="Kode verifikasi dari email"
              aria-label="Kode verifikasi"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              disabled={busy}
            />
            <button
              type="button"
              onClick={resend}
              disabled={busy}
              className="text-[10px] font-bold text-primary"
            >
              Kirim ulang kode
            </button>
          </>
        )}
        <Button type="submit" disabled={busy} className="w-full rounded-full">
          {busy && <Loader2 className="mr-2 size-4 animate-spin" />}
          {busy ? "Memproses…" : step === "code" ? "Verifikasi & simpan" : "Simpan kata sandi"}
        </Button>
      </form>
    </div>
  );
}

/** Bagian "Keamanan Akun" di Pengaturan. Provider ditentukan dari identitas Auth sesi, bukan tebakan email. */
export function AccountSecurity() {
  const qc = useQueryClient();
  const [providers, setProviders] = useState<AccountProviders | null>(null);
  const [dialog, setDialog] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;
    void getAuthUser().then(({ data }) => {
      if (active) setProviders(accountProviders(data.user));
    });
    return () => {
      active = false;
    };
  }, []);

  async function signOutAll() {
    if (busy) return;
    if (
      !confirm(
        "Keluar dari semua perangkat? Anda perlu masuk kembali di setiap perangkat, termasuk perangkat ini.",
      )
    )
      return;
    setBusy(true);
    try {
      await signOutEverywhere(qc);
      window.location.href = "/auth";
    } catch (caught) {
      toast.error(authErrorMessage(caught, "signout"));
      setBusy(false);
    }
  }

  if (!providers) return null;
  return (
    <section aria-label="Keamanan Akun">
      <p className="mb-2 px-2 text-[10px] font-black uppercase tracking-[.14em] text-muted-foreground">
        Keamanan Akun
      </p>
      <Card className="rounded-[1.6rem] shadow-sm">
        <CardContent className="divide-y p-1.5">
          <SecurityRow icon={ShieldCheck} title="Metode masuk" desc={providerLabel(providers)} />
          {providers.email && (
            <SecurityRow
              icon={KeyRound}
              title="Ubah kata sandi"
              desc="Perbarui kata sandi akun Email Anda."
              onClick={() => setDialog(true)}
            />
          )}
          {isGoogleOnly(providers) && (
            <p className="p-3 text-[10px] leading-5 text-muted-foreground">
              Anda masuk menggunakan Google. Kata sandi dikelola oleh akun Google Anda, jadi tidak
              perlu membuat kata sandi di ENO NIHONGO.
            </p>
          )}
          <SecurityRow
            icon={LogOut}
            title="Keluar dari semua perangkat"
            desc="Akhiri semua sesi login akun ini."
            onClick={signOutAll}
            disabled={busy}
          />
        </CardContent>
      </Card>
      {dialog && <ChangePasswordDialog onClose={() => setDialog(false)} />}
    </section>
  );
}
