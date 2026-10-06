import { useQueryClient } from "@tanstack/react-query";
import { useRouterState } from "@tanstack/react-router";
import { MessageCircle, Minus } from "lucide-react";
import { useEffect, useRef } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useGooglePhotoSync } from "@/hooks/useGooglePhotoSync";
import { supabase } from "@/integrations/supabase/client";
import { dock, useDock, type DockTab } from "@/lib/social/dock-state";
import { dockHiddenOn, unreadBadge } from "@/lib/social/message-merge";
import { profileCard, useProfileCard } from "@/lib/social/profile-card-state";
import { armChatSound, handleIncomingMessage, resetChatSound } from "@/lib/social/chat-sound";
import { resetSocialBadges } from "@/lib/social/social-badges";
import { usePresenceTracking } from "@/lib/social/social-presence";
import { emitSocialEvent } from "@/lib/social/social-bus";
import { cn } from "@/lib/utils";
import { DmPanel } from "./DmPanel";
import { FriendsPanel } from "./FriendsPanel";
import { GlobalChatPanel } from "./GlobalChatPanel";
import { SocialProfileHost } from "./SocialProfileCard";
import { UsernameSetup } from "./UsernameSetup";
import { invalidate, useSocialMe, useUnread } from "./social-queries";

const TABS: ReadonlyArray<{ id: DockTab; label: string }> = [
  { id: "global", label: "Global" },
  { id: "friends", label: "Teman" },
  { id: "chat", label: "Chat" },
];

/**
 * Satu langganan Realtime untuk seluruh fitur sosial. RLS tetap berlaku pada setiap event
 * (penerima hanya menerima baris yang boleh dibacanya); event hanya memicu muat ulang halaman terbaru.
 */
function useSocialRealtime(userId: string | null, enabled: boolean, soundEnabled: boolean) {
  const qc = useQueryClient();
  const soundRef = useRef(soundEnabled);
  soundRef.current = soundEnabled;
  const timer = useRef<number | undefined>(undefined);
  useEffect(() => {
    if (!userId || !enabled) return;
    const refreshBadges = () => {
      window.clearTimeout(timer.current);
      timer.current = window.setTimeout(() => invalidate(qc, ["unread", "dmList"]), 250);
    };
    const channel = supabase
      .channel(`social:${userId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "global_messages" },
        (p) => {
          emitSocialEvent({
            type: "global",
            kind: "insert",
            id: String((p.new as { id?: string }).id ?? ""),
          });
          refreshBadges();
        },
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "global_messages" },
        (p) => {
          emitSocialEvent({
            type: "global",
            kind: "update",
            id: String((p.new as { id?: string }).id ?? ""),
          });
        },
      )
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "dm_messages" }, (p) => {
        const row = p.new as { id?: string; conversation_id?: string; sender_id?: string };
        // Realtime hanya mengirim baris baru setelah berlangganan (riwayat/paginasi/refetch tidak lewat sini);
        // gate menolak id ganda, pesan sendiri, dan burst. Global Chat sengaja tanpa suara.
        handleIncomingMessage({
          id: row.id,
          senderId: row.sender_id,
          meId: userId,
          enabled: soundRef.current,
        });
        emitSocialEvent({
          type: "dm",
          kind: "insert",
          id: String(row.id ?? ""),
          conversationId: String(row.conversation_id ?? ""),
        });
        refreshBadges();
      })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "dm_messages" }, (p) => {
        const row = p.new as { id?: string; conversation_id?: string };
        emitSocialEvent({
          type: "dm",
          kind: "update",
          id: String(row.id ?? ""),
          conversationId: String(row.conversation_id ?? ""),
        });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "social_friendships" }, () => {
        emitSocialEvent({ type: "friends" });
        invalidate(qc, ["overview", "unread"]);
      })
      .subscribe();
    return () => {
      window.clearTimeout(timer.current);
      void supabase.removeChannel(channel);
    };
  }, [userId, enabled, qc]);
}

export function ChatDock() {
  const { user } = useAuth();
  const userId = user?.id ?? null;
  useGooglePhotoSync(user);
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const state = useDock();
  const cardOpen = useProfileCard() !== null;
  const qc = useQueryClient();
  const hidden = dockHiddenOn(pathname);

  // Ganti akun / logout: buang state panel dan cache sosial milik user sebelumnya.
  const lastUser = useRef<string | null>(null);
  useEffect(() => {
    if (lastUser.current !== null && lastUser.current !== userId) {
      dock.reset();
      resetSocialBadges();
      resetChatSound();
      qc.removeQueries({ queryKey: ["social"] });
    }
    lastUser.current = userId;
  }, [userId, qc]);

  const meQuery = useSocialMe(!!userId && !hidden);
  const me = meQuery.data ?? null;
  const ready = !!me?.has_username;
  const unread = useUnread(ready && !hidden);
  useSocialRealtime(userId, ready && !hidden, me?.sound_enabled !== false);
  usePresenceTracking(userId);
  useEffect(() => (userId ? armChatSound() : undefined), [userId]);

  const visible = !!userId && !hidden;

  // Rute yang menyembunyikan ChatDock (ujian/login) tidak boleh meninggalkan panel atau scroll lock.
  useEffect(() => {
    if (!visible) {
      dock.close();
      profileCard.close();
    }
  }, [visible]);

  useEffect(() => {
    if (!state.open || !visible) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !profileCard.get()) dock.close();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [state.open, visible]);

  // Kunci scroll halaman belakang selama panel terbuka; selalu dipulihkan (termasuk saat unmount).
  useEffect(() => {
    if (!state.open || !visible) return;
    const body = document.body;
    const html = document.documentElement;
    const prev = {
      bodyOverflow: body.style.overflow,
      bodyPadding: body.style.paddingRight,
      htmlOverflow: html.style.overflow,
    };
    const scrollbar = window.innerWidth - html.clientWidth;
    body.style.overflow = "hidden";
    html.style.overflow = "hidden";
    if (scrollbar > 0) body.style.paddingRight = `${scrollbar}px`;
    return () => {
      body.style.overflow = prev.bodyOverflow;
      body.style.paddingRight = prev.bodyPadding;
      html.style.overflow = prev.htmlOverflow;
    };
  }, [state.open, visible]);

  if (!userId || hidden) return null;

  const badge = unreadBadge(unread.data);
  const tabBadge = (id: DockTab): number =>
    id === "global"
      ? (unread.data?.global ?? 0)
      : id === "chat"
        ? (unread.data?.dm ?? 0)
        : (unread.data?.requests ?? 0);

  return (
    <>
      {!state.open && (
        <button
          type="button"
          aria-label={badge.label ? `Buka obrolan, ${badge.label} belum dibaca` : "Buka obrolan"}
          aria-expanded={false}
          onClick={() => dock.open()}
          className="fixed bottom-[calc(4.15rem+env(safe-area-inset-bottom)+0.625rem)] left-3 z-40 grid size-[52px] place-items-center rounded-full bg-primary text-primary-foreground shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 md:bottom-5 md:left-5 md:size-12"
        >
          <MessageCircle className="size-6" />
          {badge.label && (
            <span className="absolute -right-1 -top-1 grid h-5 min-w-5 place-items-center rounded-full bg-red-600 px-1 text-[11px] font-bold leading-none text-white">
              {badge.label}
            </span>
          )}
        </button>
      )}

      {state.open && (
        <div
          aria-hidden
          data-testid="chat-backdrop"
          onClick={() => dock.close()}
          className={cn(
            "fixed inset-0 z-[45] touch-none bg-black/40",
            // Saat Profile Card terbuka, lapisan kartu yang mengaburkan semuanya (satu lapis blur).
            !cardOpen && "backdrop-blur-[6px]",
          )}
        />
      )}

      {state.everOpened && (
        <div
          role="dialog"
          aria-label="Obrolan"
          aria-hidden={!state.open}
          className={cn(
            "fixed bottom-[calc(4.15rem+env(safe-area-inset-bottom)+0.5rem)] left-2 right-2 z-50 h-[min(70dvh,34rem)] flex-col overflow-hidden rounded-2xl border bg-background text-foreground shadow-2xl md:bottom-5 md:left-5 md:right-auto md:h-[34rem] md:w-[24rem]",
            state.open ? "flex" : "hidden",
          )}
        >
          <div className="flex items-center justify-between border-b px-3 py-2">
            <h2 className="text-[15px] font-bold">Obrolan</h2>
            <button
              type="button"
              aria-label="Kecilkan obrolan"
              onClick={() => dock.close()}
              className="grid size-9 place-items-center rounded-full hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              <Minus className="size-[18px]" />
            </button>
          </div>

          {ready && me ? (
            <>
              <div role="tablist" aria-label="Bagian obrolan" className="grid grid-cols-3 border-b">
                {TABS.map((t) => {
                  const n = tabBadge(t.id);
                  const selected = state.tab === t.id;
                  return (
                    <button
                      key={t.id}
                      type="button"
                      role="tab"
                      aria-selected={selected}
                      onClick={() => dock.setTab(t.id)}
                      className={cn(
                        "relative min-h-11 text-[13px] font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary",
                        selected ? "text-primary" : "text-muted-foreground",
                      )}
                    >
                      {t.label}
                      {n > 0 && (
                        <span className="ml-1 inline-grid h-4 min-w-4 place-items-center rounded-full bg-red-600 px-1 text-[10px] font-bold text-white">
                          {n > 99 ? "99+" : n}
                        </span>
                      )}
                      {selected && (
                        <span className="absolute inset-x-4 bottom-0 h-0.5 rounded-full bg-primary" />
                      )}
                    </button>
                  );
                })}
              </div>
              <div
                role="tabpanel"
                className={cn(
                  "min-h-0 flex-1 flex-col",
                  state.tab === "global" ? "flex" : "hidden",
                )}
              >
                <GlobalChatPanel me={me} active={state.open && state.tab === "global"} />
              </div>
              <div
                role="tabpanel"
                className={cn(
                  "min-h-0 flex-1 flex-col",
                  state.tab === "friends" ? "flex" : "hidden",
                )}
              >
                <FriendsPanel active={state.open && state.tab === "friends"} />
              </div>
              <div
                role="tabpanel"
                className={cn("min-h-0 flex-1 flex-col", state.tab === "chat" ? "flex" : "hidden")}
              >
                <DmPanel me={me} active={state.open && state.tab === "chat"} />
              </div>
            </>
          ) : meQuery.isLoading ? (
            <div className="flex-1 animate-pulse bg-muted/30" aria-label="Memuat" />
          ) : meQuery.error ? (
            <div className="grid flex-1 place-items-center p-6 text-center">
              <div>
                <p className="text-[13px] text-destructive">Obrolan gagal dimuat.</p>
                <button
                  type="button"
                  onClick={() => void meQuery.refetch()}
                  className="mt-2 min-h-11 rounded-full border px-4 text-[12px] font-semibold"
                >
                  Coba Lagi
                </button>
              </div>
            </div>
          ) : (
            <UsernameSetup />
          )}
        </div>
      )}
      <SocialProfileHost />
    </>
  );
}
