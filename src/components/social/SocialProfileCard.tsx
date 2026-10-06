import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Ban, Flag, MapPin, MessageCircle, UserCheck, UserMinus, UserPlus, X } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import { toast } from "sonner";
import { dock, useDock } from "@/lib/social/dock-state";
import { profileCard, useProfileCard } from "@/lib/social/profile-card-state";
import { socialApi } from "@/lib/social/social-api";
import type { CardRelation } from "@/lib/social/social-types";
import { useIsOnline } from "@/lib/social/social-presence";
import { formatJoined, socialErrorCode, socialErrorMessage } from "@/lib/social/social-validation";
import { getAccountLevel } from "@/lib/progression";
import { cn } from "@/lib/utils";
import { IdentityBadges } from "./IdentityBadges";
import { ProfilePhoto } from "./SocialAvatar";
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
  const [reported, setReported] = useState<string | null>(null);
  const titleId = useId();
  const userId = open?.userId ?? null;
  const online = useIsOnline(userId);

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

  const preview = open?.context?.preview === true;
  const card = useQuery({
    queryKey: ["social", "card", userId, preview],
    queryFn: () => socialApi.profileCard(userId as string, preview),
    enabled: !!userId,
    staleTime: 10_000,
    retry: (count, err) => socialErrorCode(err) !== "user_not_found" && count < 1,
  });

  if (!open || !userId) return null;
  const c = card.data;
  const ctx = open.context;
  // Akun sudah tidak ada (dihapus): identitas aman + maskot, tanpa aksi sosial.
  const gone = !c && card.error && socialErrorCode(card.error) === "user_not_found";
  const failed = !c && card.error && !gone;

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
  const shownName = gone
    ? "Pengguna tidak tersedia"
    : c
      ? (c.display_name ?? c.username ?? "Pengguna ENO NIHONGO")
      : "";
  const accountLevel = c && c.xp !== null ? getAccountLevel(c.xp).level : null;
  const jlpt = c ? (c.level ?? null) : null;
  const showRank = ctx?.rank !== undefined && !c?.official;
  const shownPoints = c ? (ctx?.points ?? c.xp) : null;
  const joined = c?.joined ? formatJoined(c.joined) : null;
  const isReported = reported === uid;
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      aria-busy={card.isLoading}
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
        className="relative max-h-[min(40rem,calc(100dvh-2rem))] w-[min(84vw,20.5rem)] overflow-y-auto overscroll-contain rounded-3xl border bg-background shadow-2xl outline-none motion-safe:animate-in motion-safe:fade-in-0 motion-safe:zoom-in-95 motion-safe:duration-150 md:w-[23rem]"
      >
        <div className="relative aspect-[4/3] w-full overflow-hidden bg-primary/10">
          {c || gone || failed ? (
            <ProfilePhoto userId={uid} photo={c?.photo ?? null} />
          ) : (
            <div className="size-full animate-pulse bg-muted/60" aria-label="Memuat profil" />
          )}
          <button
            type="button"
            aria-label="Tutup"
            onClick={() => profileCard.close()}
            className="absolute right-2 top-2 grid size-11 place-items-center rounded-full text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
          >
            <span className="grid size-9 place-items-center rounded-full bg-black/40 backdrop-blur-sm">
              <X className="size-[18px]" />
            </span>
          </button>
        </div>

        <div className="p-3.5 pt-3">
          {card.isLoading && (
            <div
              aria-hidden
              className="min-h-[17.5rem] animate-pulse space-y-2.5"
              data-testid="profile-skeleton"
            >
              <div className="h-[22px] w-3/5 rounded-md bg-muted/70" />
              <div className="h-4 w-2/5 rounded-md bg-muted/60" />
              <div className="h-5 w-full rounded-md bg-muted/50" />
              <div className="h-5 w-4/5 rounded-md bg-muted/50" />
              <div className="h-4 w-1/2 rounded-md bg-muted/50" />
              <div className="flex gap-1.5">
                <div className="h-5 w-12 rounded-full bg-muted/60" />
                <div className="h-5 w-16 rounded-full bg-muted/60" />
              </div>
              <div className="h-3.5 w-1/3 rounded-md bg-muted/40" />
              <div className="h-11 w-full rounded-full bg-muted/60" />
              <div className="flex gap-2">
                <div className="h-10 flex-1 rounded-full bg-muted/50" />
                <div className="h-10 flex-1 rounded-full bg-muted/50" />
              </div>
            </div>
          )}
          {gone && (
            <div className="py-2">
              <h3 id={titleId} className="text-[18px] font-bold leading-tight">
                {shownName}
              </h3>
              <p className="mt-1 text-[12px] text-muted-foreground">
                Akun ini sudah tidak ada atau tidak dapat dibuka.
              </p>
            </div>
          )}
          {failed && (
            <div className="py-2 text-center">
              <h3 id={titleId} className="sr-only">
                Profil gagal dimuat
              </h3>
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
              <div className="min-w-0">
                <h3
                  id={titleId}
                  className="break-words text-[18px] font-bold leading-tight [overflow-wrap:anywhere]"
                >
                  {shownName}
                </h3>
                <div className="mt-1 flex max-w-full flex-wrap items-center gap-x-1.5 gap-y-1">
                  <span className="max-w-full truncate text-[13px] text-muted-foreground">
                    {c.username ? `@${c.username}` : "Belum mengatur username"}
                  </span>
                  <IdentityBadges userId={uid} size="md" />
                </div>
                {online && c.show_online && (
                  <p className="mt-1.5 flex items-center gap-1.5 text-[12px] font-medium text-emerald-600 dark:text-emerald-400">
                    <span aria-hidden className="size-2 rounded-full bg-emerald-500" />
                    Online
                  </p>
                )}
              </div>

              {c.bio && (
                <p className="mt-2 line-clamp-2 break-words text-[13px] leading-5 text-foreground/80 [overflow-wrap:anywhere]">
                  {c.bio}
                </p>
              )}

              <div className="mt-2.5 space-y-1.5 text-[12px] text-muted-foreground">
                {(c.country || shownPoints !== null) && (
                  <p className="flex min-w-0 items-center gap-1.5">
                    {c.country && (
                      <>
                        <MapPin aria-hidden className="size-3.5 shrink-0" />
                        <span className="truncate">{c.country}</span>
                      </>
                    )}
                    {c.country && shownPoints !== null && <span aria-hidden>·</span>}
                    {shownPoints !== null && (
                      <span className="shrink-0 font-medium text-foreground/80">
                        {showRank && <b>#{ctx?.rank}</b>}
                        {showRank && " · "}
                        {shownPoints.toLocaleString("id-ID")}{" "}
                        {ctx?.points !== undefined ? (ctx.pointsLabel ?? "Poin") : "XP"}
                      </span>
                    )}
                  </p>
                )}
                {(accountLevel !== null || jlpt || RELATION_LABEL[c.relation]) && (
                  <div className="flex flex-wrap items-center gap-1.5">
                    {accountLevel !== null && (
                      <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-[11px] font-semibold text-primary">
                        Lv. {accountLevel}
                      </span>
                    )}
                    {jlpt && (
                      <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-[11px] font-semibold text-primary">
                        JLPT {jlpt}
                      </span>
                    )}
                    {RELATION_LABEL[c.relation] && (
                      <span className="rounded-full bg-muted px-2.5 py-0.5 text-[11px] font-semibold">
                        {RELATION_LABEL[c.relation]}
                      </span>
                    )}
                  </div>
                )}
                <p className="text-[11px]" data-testid="profile-meta">
                  {c.friends.toLocaleString("id-ID")} Teman
                  {c.official ? " · Akun Resmi" : joined ? ` · Bergabung ${joined}` : ""}
                </p>
              </div>

              <div className="mt-3 space-y-2">
                {c.relation === "unavailable" && (
                  <p className="text-center text-[12px] text-muted-foreground">
                    Pengguna tidak tersedia.
                  </p>
                )}
                {c.relation === "self" && (
                  <p className="text-center text-[12px] text-muted-foreground">
                    {preview ? "Beginilah profilmu terlihat oleh pengguna lain." : "Ini profilmu."}
                  </p>
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
                  <div className="space-y-1.5">
                    <div className="flex gap-2">
                      <button
                        type="button"
                        disabled={!!c.dm_blocked}
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
                      {!c.official &&
                        (confirm === "unfriend" ? (
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
                          <button
                            type="button"
                            className={btn}
                            onClick={() => setConfirm("unfriend")}
                          >
                            <UserMinus className="size-4" /> Hapus Pertemanan
                          </button>
                        ))}
                    </div>
                    {c.dm_blocked && (
                      <p className="text-center text-[11px] text-muted-foreground" role="status">
                        {socialErrorMessage(c.dm_blocked)}
                      </p>
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
                        disabled={busy || isReported}
                        className={cn(btn, "min-h-10 text-[12px]")}
                        onClick={() =>
                          void act(async () => {
                            const r = await socialApi.reportUser(uid, null);
                            setReported(uid);
                            toast.success(
                              r.status === "already_reported"
                                ? "Pengguna ini sudah kamu laporkan."
                                : "Laporan terkirim. Terima kasih.",
                            );
                          })
                        }
                      >
                        <Flag className="size-3.5" /> {isReported ? "Dilaporkan" : "Laporkan"}
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
    </div>
  );
}
