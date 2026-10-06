import { useState, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { signOutCleanly } from "@/lib/auth-actions";
import { socialApi } from "@/lib/social/social-api";
import {
  normalizeUsername,
  socialErrorMessage,
  usernameHint,
  usernameIssue,
} from "@/lib/social/social-validation";
import { socialKeys, useSocialMe } from "./social-queries";

/**
 * Username wajib untuk SEMUA akun. Dibaca dari server (social_me) setiap sesi dimuat;
 * selama belum ada username, hanya layar "Buat Username" (dan keluar) yang bisa dipakai —
 * URL langsung atau refresh tidak melewatinya. Bila server sosial gagal dibaca, aplikasi belajar
 * tetap berjalan (degradasi), tidak terkunci.
 */
export function UsernameGate({ children }: { children: ReactNode }) {
  const me = useSocialMe(true);
  if (me.isLoading) {
    return (
      <div
        className="flex min-h-screen items-center justify-center text-sm text-muted-foreground"
        role="status"
      >
        Memuat…
      </div>
    );
  }
  if (me.data && !me.data.has_username) return <UsernameOnboarding />;
  return <>{children}</>;
}

export function UsernameOnboarding() {
  const qc = useQueryClient();
  const [username, setUsername] = useState("");
  const [busy, setBusy] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const hint = usernameHint(username);
  const canSubmit = username !== "" && !usernameIssue(username) && !busy;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    setBusy(true);
    setServerError(null);
    try {
      await socialApi.setUsername(normalizeUsername(username), null);
      // Muat ulang data otoritatif dari server; gate otomatis membuka aplikasi tanpa login ulang.
      await qc.invalidateQueries({ queryKey: socialKeys.me });
      void qc.invalidateQueries({ queryKey: ["social"] });
      toast.success("Username disimpan.");
    } catch (err) {
      setServerError(socialErrorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4 py-8">
      <form
        onSubmit={submit}
        className="w-full max-w-sm space-y-4 rounded-2xl border bg-card p-6 shadow-sm"
      >
        <div>
          <h1 className="text-xl font-bold">Buat Username</h1>
          <p className="mt-1 text-sm leading-5 text-muted-foreground">
            Username digunakan sebagai identitas Anda di ENO NIHONGO.
          </p>
        </div>
        <label className="block text-sm font-semibold">
          Username
          <div className="mt-1 flex h-11 items-center rounded-xl border bg-background px-3 focus-within:ring-2 focus-within:ring-primary">
            <span className="text-muted-foreground" aria-hidden>
              @
            </span>
            <input
              value={username}
              onChange={(e) => {
                setUsername(e.target.value);
                setServerError(null);
              }}
              autoFocus
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              maxLength={20}
              inputMode="text"
              autoComplete="off"
              aria-label="Username"
              aria-invalid={!!hint || !!serverError}
              placeholder="username"
              className="h-full min-w-0 flex-1 bg-transparent px-1 text-[16px] font-normal outline-none"
            />
          </div>
          <span
            role={hint || serverError ? "alert" : undefined}
            className={`mt-1 block text-xs font-normal ${hint || serverError ? "text-destructive" : "text-muted-foreground"}`}
          >
            {serverError ?? hint ?? "3–20 karakter: huruf kecil, angka, atau garis bawah."}
          </span>
        </label>
        <Button type="submit" className="w-full" disabled={!canSubmit}>
          {busy ? "Menyimpan…" : "Simpan username"}
        </Button>
        <button
          type="button"
          onClick={() => void signOutCleanly(qc)}
          className="block w-full text-center text-xs text-muted-foreground underline-offset-2 hover:underline"
        >
          Keluar
        </button>
      </form>
    </main>
  );
}
