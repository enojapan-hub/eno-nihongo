import { useState } from "react";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { socialApi } from "@/lib/social/social-api";
import {
  formatCooldownDate,
  normalizeUsername,
  socialErrorMessage,
  usernameIssue,
} from "@/lib/social/social-validation";
import { useSocialInvalidate, useSocialMe } from "./social-queries";

/** Username dan privasi sosial di Edit Profil. Server menentukan cooldown 30 hari (UI hanya menampilkan). */
export function SocialAccountCard() {
  const me = useSocialMe(true);
  const invalidate = useSocialInvalidate();
  const [value, setValue] = useState("");
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const data = me.data;
  if (me.isLoading)
    return (
      <div className="h-24 animate-pulse rounded-3xl bg-muted/40" aria-label="Memuat username" />
    );
  if (!data) return null;

  const cooldown = formatCooldownDate(data.next_username_change_at);
  const hasName = data.has_username;
  const issue = value ? usernameIssue(value) : null;
  const same = hasName && normalizeUsername(value) === data.username;
  const canSubmit = !!value && !issue && !same && !busy;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    setBusy(true);
    try {
      const name = normalizeUsername(value);
      if (hasName) await socialApi.changeUsername(name);
      else await socialApi.setUsername(name, null);
      toast.success(hasName ? "Username diubah." : "Username diatur.");
      setEditing(false);
      setValue("");
      invalidate("me", "overview", "unread", "dmList");
    } catch (err) {
      toast.error(socialErrorMessage(err));
      invalidate("me");
    } finally {
      setBusy(false);
    }
  }

  async function toggleSound(next: boolean) {
    try {
      await socialApi.setSound(next);
      invalidate("me");
    } catch (err) {
      toast.error(socialErrorMessage(err));
    }
  }

  async function togglePrivacy(next: boolean) {
    try {
      await socialApi.setPrivacy(next);
      invalidate("me");
    } catch (err) {
      toast.error(socialErrorMessage(err));
    }
  }

  return (
    <Card className="rounded-3xl shadow-none">
      <CardContent className="space-y-4 p-5">
        <div>
          <h2 className="text-sm font-bold">Username &amp; Privasi Sosial</h2>
          <p className="text-[10px] text-muted-foreground">
            Dipakai teman untuk mencarimu di Obrolan. Emailmu tidak pernah ditampilkan.
          </p>
        </div>

        <div className="rounded-2xl bg-muted/40 px-3 py-3">
          <p className="text-[10px] text-muted-foreground">Username</p>
          <p className="mt-0.5 text-sm font-semibold">
            {hasName ? `@${data.username}` : "Belum diatur"}
          </p>
          {hasName && cooldown && (
            <p className="mt-1 text-[11px] text-muted-foreground">
              Username dapat diubah lagi pada {cooldown}.
            </p>
          )}
        </div>

        {!editing ? (
          <button
            type="button"
            disabled={hasName && !!cooldown}
            onClick={() => setEditing(true)}
            className="min-h-11 w-full rounded-full border text-[13px] font-semibold disabled:opacity-50"
          >
            {hasName ? "Ubah Username" : "Atur Username"}
          </button>
        ) : (
          <form onSubmit={submit} className="space-y-2">
            <label className="block text-xs font-semibold">
              {hasName ? "Username baru" : "Username"}
              <input
                value={value}
                onChange={(e) => setValue(e.target.value)}
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                maxLength={20}
                aria-invalid={!!issue}
                placeholder="mis. sakura_01"
                className="mt-1.5 h-11 w-full rounded-xl border bg-background px-3 text-[16px] font-normal focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              />
            </label>
            <p className={`text-[11px] ${issue ? "text-destructive" : "text-muted-foreground"}`}>
              3–20 karakter: huruf kecil, angka, dan garis bawah (_).
              {hasName && " Setelah diubah, kamu baru bisa mengubahnya lagi setelah 30 hari."}
            </p>
            <div className="flex gap-2">
              <button
                type="submit"
                disabled={!canSubmit}
                className="min-h-11 flex-1 rounded-full bg-primary text-[13px] font-semibold text-primary-foreground disabled:opacity-50"
              >
                {busy ? "Menyimpan…" : "Simpan"}
              </button>
              <button
                type="button"
                onClick={() => {
                  setEditing(false);
                  setValue("");
                }}
                className="min-h-11 rounded-full border px-4 text-[13px] font-semibold"
              >
                Batal
              </button>
            </div>
          </form>
        )}

        {hasName && (
          <label className="flex items-center justify-between gap-3 rounded-2xl bg-muted/40 px-3 py-3">
            <span>
              <span className="block text-xs font-semibold">Terima permintaan teman</span>
              <span className="block text-[10px] text-muted-foreground">
                {data.allow_friend_requests === false ? "Tidak seorang pun" : "Semua orang"}
              </span>
            </span>
            <input
              type="checkbox"
              role="switch"
              aria-label="Terima permintaan teman"
              checked={data.allow_friend_requests !== false}
              onChange={(e) => void togglePrivacy(e.target.checked)}
              className="size-5 accent-[var(--color-primary,#087d48)]"
            />
          </label>
        )}

        {hasName && (
          <label className="flex items-center justify-between gap-3 rounded-2xl bg-muted/40 px-3 py-3">
            <span>
              <span className="block text-xs font-semibold">Suara pesan</span>
              <span className="block text-[10px] text-muted-foreground">
                Bunyi singkat saat ada pesan pribadi baru
              </span>
            </span>
            <input
              type="checkbox"
              role="switch"
              aria-label="Suara pesan"
              checked={data.sound_enabled !== false}
              onChange={(e) => void toggleSound(e.target.checked)}
              className="size-5 accent-[var(--color-primary,#087d48)]"
            />
          </label>
        )}
      </CardContent>
    </Card>
  );
}
