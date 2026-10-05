import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Ban, Flag, MessageCircle, UserCheck, UserMinus, UserPlus, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { dock, useDock } from "@/lib/social/dock-state";
import { profileCard, useProfileCard } from "@/lib/social/profile-card-state";
import { socialApi } from "@/lib/social/social-api";
import type { CardRelation } from "@/lib/social/social-types";
import { socialErrorMessage } from "@/lib/social/social-validation";
import { cn } from "@/lib/utils";
import { IdentityBadges } from "./IdentityBadges";
import { SocialAvatar } from "./SocialAvatar";
import { invalidate } from "./social-queries";

const RELATION_LABEL: Partial<Record<CardRelation, string>> = {
  friend: "Berteman",
  outgoing: "Permintaan terkirim",
  incoming: "Mengirim permintaan",
  blocked: "Diblokir",
};

const btn =
  "flex min-h-11 flex-1 items-center justify-center gap-1.5 rounded-full border px-3 text-[13px] font-semibold disabled:opacity-50";
const primary = "border-primary bg-primary text-primary-foreground";

/**
 * Profile Card tunggal. Hanya data sosial aman: avatar, nama, @username, level, status pertemanan.
 * Aksi memakai RPC friendship/block/report yang sudah ada (tidak ada INSERT langsung dari klien).
 */
export function SocialProfileHost() {
  const open = useProfileCard();
  const { open: dockOpen } = useDock();
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState<"unfriend" | "block" | null>(null);
  const userId = open?.userId ?? null;

  useEffect(() => {
    setConfirm(null);
  }, [userId]);

  useEffect(() => {
    if (!userId) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      e.stopPropagation();
      profileCard.close();
    };
    // capture: Escape menutup kartu lebih dulu, bukan ChatDock di belakangnya.
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [userId]);

  // Fokus masuk ke kartu saat dibuka, terjebak di dalamnya, dan kembali ke pemicu saat ditutup.
  const dialogRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!userId) return;
    const trigger = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    dialogRef.current?.focus();
    const onTab = (e: KeyboardEvent) => {
      if (e.key !== "Tab" || !dialogRef.current) return;
      const items = Array.from(
        dialogRef.current.querySelectorAll<HTMLElement>("button:not([disabled]), [tabindex='0']"),
      ).filter((el) => el.offsetParent !== null);
      if (items.length === 0) return;
      const first = items[0] as HTMLElement;
      const last = items[items.length - 1] as HTMLElement;
      const active = document.activeElement;
      if (e.shiftKey && (active === first || active === dialogRef.current)) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && active === last) {
        e.preventDefault();
        first.focus();
      }
    };
    window.addEventListener("keydown", onTab);
    return () => {
      window.removeEventListener("keydown", onTab);
      if (trigger?.isConnected) trigger.focus({ preventScroll: true });
    };
  }, [userId]);

  const card = useQuery({
    queryKey: ["social", "card", userId],
    queryFn: () => socialApi.profileCard(userId as string),
    enabled: !!userId,
    staleTime: 10_000,
  });

  if (!open || !userId) return null;
  const c = card.data;
  const ctx = open.context;
  const name = c ? (c.display_name ?? c.username ?? "Pengguna ENO NIHONGO") : "";

  async function act(fn: () => Promise<unknown>, ok?: string) {
    setBusy(true);
    try {
      await fn();
      if (ok) toast.success(ok);
      await qc.invalidateQueries({ queryKey: ["social", "card", userId] });
      invalidate(qc, ["overview", "unread", "dmList"]);
    } catch (e) {
      toast.error(socialErrorMessage(e));
    } finally {
      setBusy(false);
      setConfirm(null);
    }
  }

  const uid = userId;
  const shownName = c ? (c.display_name ?? c.username ?? "Pengguna ENO NIHONGO") : "";
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Profil pengguna"
      className="fixed inset-0 z-[60] flex items-center justify-center px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-[max(1rem,env(safe-area-inset-top))]"
    >
      {/* Lapisan di atas ChatDock: meredupkan + mengaburkan semuanya di belakang kartu (satu lapis blur;
          backdrop ChatDock melepas blurnya saat kartu terbuka agar tidak dobel). */}
      <button
        type="button"
        data-testid="profile-backdrop"
        aria-label="Tutup profil"
        tabIndex={-1}
        onClick={() => profileCard.close()}
        className={cn(
          "absolute inset-0 cursor-default backdrop-blur-[6px] motion-safe:animate-in motion-safe:fade-in-0 motion-safe:duration-150",
          dockOpen ? "bg-black/25" : "bg-black/40",
        )}
      />
      <div
        ref={dialogRef}
        tabIndex={-1}
        data-testid="profile-card"
        className="relative max-h-[min(34rem,calc(100dvh-2rem))] w-[min(86vw,21rem)] overflow-y-auto overscroll-contain rounded-3xl border bg-background p-4 shadow-2xl outline-none motion-safe:animate-in motion-safe:fade-in-0 motion-safe:zoom-in-95 motion-safe:duration-150 md:w-[22.5rem] md:p-5"
      >
        <button
          type="button"
          aria-label="Tutup"
          onClick={() => profileCard.close()}
          className="absolute right-2 top-2 grid size-9 place-items-center rounded-full text-muted-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        >
          <X className="size-[18px]" />
        </button>

        {card.isLoading && (
          <div className="h-44 animate-pulse rounded-2xl bg-muted/50" aria-label="Memuat profil" />
        )}
        {card.error && (
          <div className="py-8 text-center">
            <p className="text-[13px] text-destructive">Profil gagal dimuat.</p>
            <button
              type="button"
              onClick={() => void card.refetch()}
              className="mt-2 min-h-11 rounded-full border px-4 text-[12px] font-semibold"
            >
              Coba Lagi
            </button>
          </div>
        )}

        {c && (
          <>
            <div className="flex flex-col items-center px-1 pt-1 text-center">
              <SocialAvatar
                avatarId={c.avatar_id}
                size={72}
                className="ring-4 ring-primary/10 max-[340px]:!size-14"
              />
              <h3 className="mt-2.5 max-w-full break-words text-[17px] font-bold leading-tight [overflow-wrap:anywhere]">
                {shownName}
              </h3>
              <div className="mt-1 flex max-w-full flex-wrap items-center justify-center gap-x-1.5 gap-y-1">
                <span className="max-w-full truncate text-[13px] text-muted-foreground">
                  {c.username ? `@${c.username}` : "Belum mengatur username"}
                </span>
                <IdentityBadges userId={uid} size="md" />
              </div>
              <div className="mt-2 flex flex-wrap items-center justify-center gap-1.5">
                {(c.level ?? ctx?.level) && (
                  <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-[11px] font-semibold text-primary">
                    {c.level ?? ctx?.level}
                  </span>
                )}
                {RELATION_LABEL[c.relation] && (
                  <span className="rounded-full bg-muted px-2.5 py-0.5 text-[11px] font-semibold text-muted-foreground">
                    {RELATION_LABEL[c.relation]}
                  </span>
                )}
              </div>
            </div>

            {ctx && (ctx.rank !== undefined || ctx.points !== undefined) && (
              <p className="mt-3 rounded-xl bg-muted/50 px-3 py-2 text-center text-[13px]">
                {ctx.rank !== undefined && <b>Peringkat #{ctx.rank}</b>}
                {ctx.rank !== undefined && ctx.points !== undefined && " · "}
                {ctx.points !== undefined && (
                  <span>
                    {ctx.points.toLocaleString("id-ID")} {ctx.pointsLabel ?? "Poin"}
                  </span>
                )}
              </p>
            )}

            <div className="mt-3.5 space-y-2">
              {c.relation === "self" && (
                <p className="text-center text-[13px] text-muted-foreground">Ini profilmu.</p>
              )}

              {c.relation === "none" && c.can_request && c.username && (
                <button
                  type="button"
                  disabled={busy}
                  className={cn(btn, primary, "w-full")}
                  onClick={() =>
                    void act(
                      () => socialApi.sendRequest(c.username as string),
                      "Permintaan dikirim.",
                    )
                  }
                >
                  <UserPlus className="size-4" /> Tambah Teman
                </button>
              )}
              {c.relation === "none" && !c.can_request && (
                <p className="text-center text-[12px] leading-5 text-muted-foreground">
                  {!c.has_username
                    ? "Pengguna ini belum mengatur username, jadi belum bisa ditambahkan."
                    : !c.viewer_has_username
                      ? "Atur username di Edit Profil untuk menambah teman."
                      : "Pengguna ini tidak menerima permintaan pertemanan."}
                </p>
              )}

              {c.relation === "outgoing" && (
                <div className="flex gap-2">
                  <button type="button" disabled className={btn}>
                    <UserCheck className="size-4" /> Permintaan Terkirim
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    className={btn}
                    onClick={() => void act(() => socialApi.cancelRequest(uid))}
                  >
                    Batalkan
                  </button>
                </div>
              )}

              {c.relation === "incoming" && (
                <div className="flex gap-2">
                  <button
                    type="button"
                    disabled={busy}
                    className={cn(btn, primary)}
                    onClick={() =>
                      void act(() => socialApi.respondRequest(uid, true), "Pertemanan diterima.")
                    }
                  >
                    Terima
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    className={btn}
                    onClick={() => void act(() => socialApi.respondRequest(uid, false))}
                  >
                    Tolak
                  </button>
                </div>
              )}

              {c.relation === "friend" && c.username && (
                <div className="flex gap-2">
                  <button
                    type="button"
                    className={cn(btn, primary)}
                    onClick={() => {
                      dock.openDm({
                        user_id: uid,
                        username: c.username as string,
                        display_name: c.display_name,
                        avatar_id: c.avatar_id,
                      });
                      profileCard.close();
                    }}
                  >
                    <MessageCircle className="size-4" /> Kirim Pesan
                  </button>
                  {confirm === "unfriend" ? (
                    <button
                      type="button"
                      disabled={busy}
                      className={cn(btn, "border-destructive text-destructive")}
                      onClick={() =>
                        void act(() => socialApi.removeFriend(uid), "Pertemanan dihapus.")
                      }
                    >
                      Ya, hapus
                    </button>
                  ) : (
                    <button type="button" className={btn} onClick={() => setConfirm("unfriend")}>
                      <UserMinus className="size-4" /> Hapus Pertemanan
                    </button>
                  )}
                </div>
              )}

              {c.relation === "blocked" && (
                <button
                  type="button"
                  disabled={busy}
                  className={cn(btn, "w-full")}
                  onClick={() => void act(() => socialApi.unblock(uid), "Blokir dibuka.")}
                >
                  Buka Blokir
                </button>
              )}

              {(c.relation === "friend" ||
                c.relation === "outgoing" ||
                c.relation === "incoming" ||
                c.relation === "none") &&
                c.has_username && (
                  <div className="flex gap-2 pt-1">
                    <button
                      type="button"
                      disabled={busy}
                      className={cn(btn, "min-h-10 text-[12px]")}
                      onClick={() =>
                        void act(async () => {
                          const r = await socialApi.reportUser(uid, null);
                          toast.success(
                            r.status === "already_reported"
                              ? "Pengguna ini sudah kamu laporkan."
                              : "Laporan terkirim. Terima kasih.",
                          );
                        })
                      }
                    >
                      <Flag className="size-3.5" /> Laporkan
                    </button>
                    {confirm === "block" ? (
                      <button
                        type="button"
                        disabled={busy}
                        className={cn(
                          btn,
                          "min-h-10 border-destructive text-[12px] text-destructive",
                        )}
                        onClick={() => void act(() => socialApi.block(uid), "Pengguna diblokir.")}
                      >
                        Ya, blokir
                      </button>
                    ) : (
                      <button
                        type="button"
                        className={cn(btn, "min-h-10 text-[12px]")}
                        onClick={() => setConfirm("block")}
                      >
                        <Ban className="size-3.5" /> Blokir
                      </button>
                    )}
                  </div>
                )}
              {confirm && (
                <p className="text-center text-[11px] text-muted-foreground">
                  {confirm === "block"
                    ? "Memblokir menghentikan permintaan dan pesan baru dari pengguna ini. Riwayat DM tidak dihapus."
                    : "Pertemanan akan berakhir dan pesan baru tidak bisa dikirim sampai berteman lagi."}{" "}
                  <button
                    type="button"
                    className="font-semibold underline"
                    onClick={() => setConfirm(null)}
                  >
                    Batal
                  </button>
                </p>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
