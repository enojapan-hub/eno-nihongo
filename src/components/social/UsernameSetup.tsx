import { useState } from "react";
import { toast } from "sonner";
import { socialApi } from "@/lib/social/social-api";
import {
  displayNameIssue,
  normalizeUsername,
  socialErrorMessage,
  usernameIssue,
} from "@/lib/social/social-validation";
import { useSocialInvalidate } from "./social-queries";

/** Muncul sekali bagi pengguna yang belum punya username (tidak ada username acak untuk akun lama). */
export function UsernameSetup() {
  const [username, setUsername] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [busy, setBusy] = useState(false);
  const [touched, setTouched] = useState(false);
  const invalidate = useSocialInvalidate();
  const uIssue = username ? usernameIssue(username) : null;
  const dIssue = displayNameIssue(displayName);
  const canSubmit = !!username && !uIssue && !dIssue && !busy;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setTouched(true);
    if (!canSubmit) return;
    setBusy(true);
    try {
      await socialApi.setUsername(normalizeUsername(username), displayName.trim() || null);
      invalidate("me", "overview", "unread");
    } catch (err) {
      toast.error(socialErrorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="flex flex-1 flex-col gap-3 overflow-y-auto p-4">
      <div>
        <h3 className="text-[16px] font-bold">Buat username</h3>
        <p className="mt-1 text-[13px] leading-5 text-muted-foreground">
          Teman mencarimu lewat username. Username tidak bisa diganti setelah dibuat, dan emailmu
          tidak pernah ditampilkan.
        </p>
      </div>
      <label className="block text-[13px] font-semibold">
        Username
        <input
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          maxLength={20}
          aria-invalid={touched && !!uIssue}
          placeholder="mis. sakura_01"
          className="mt-1 h-11 w-full rounded-xl border bg-background px-3 text-[16px] font-normal focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        />
        <span
          className={`mt-1 block text-[11px] font-normal ${uIssue ? "text-destructive" : "text-muted-foreground"}`}
        >
          3–20 karakter: huruf kecil, angka, dan garis bawah (_).
        </span>
      </label>
      <label className="block text-[13px] font-semibold">
        Nama tampilan <span className="font-normal text-muted-foreground">(opsional)</span>
        <input
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          maxLength={40}
          aria-invalid={!!dIssue}
          className="mt-1 h-11 w-full rounded-xl border bg-background px-3 text-[16px] font-normal focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        />
        {dIssue && (
          <span className="mt-1 block text-[11px] font-normal text-destructive">
            Maksimal 40 karakter, tanpa @.
          </span>
        )}
      </label>
      <button
        type="submit"
        disabled={!canSubmit}
        className="mt-1 min-h-11 rounded-full bg-primary text-[14px] font-semibold text-primary-foreground disabled:opacity-50"
      >
        {busy ? "Menyimpan…" : "Simpan username"}
      </button>
    </form>
  );
}
