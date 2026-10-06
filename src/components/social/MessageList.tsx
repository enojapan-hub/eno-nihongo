import { Ban, Flag, Reply, Trash2 } from "lucide-react";
import { useState, type ReactNode } from "react";
import { profileCard } from "@/lib/social/profile-card-state";
import { usernameColorClass } from "@/lib/social/username-color";
import { IdentityBadges } from "./IdentityBadges";
import { SocialAvatar } from "./SocialAvatar";
import { cn } from "@/lib/utils";

export type ListMessage = {
  id: string;
  mine: boolean;
  /** Nama tampilan + @username (null pada DM, pengirimnya sudah jelas). */
  author: { userId: string; name: string; username: string; avatarId: number } | null;
  body: string;
  deleted: boolean;
  createdAt: string;
  reply: { author: string; body: string; deleted: boolean } | null;
};

export type MessageActions = {
  onReply: (m: ListMessage) => void;
  onDelete?: ((m: ListMessage) => void) | undefined;
  onReport?: ((m: ListMessage) => void) | undefined;
  onBlock?: ((m: ListMessage) => void) | undefined;
  /** Boleh menghapus pesan ini (pemilik atau moderator). */
  canDelete: (m: ListMessage) => boolean;
};

function formatTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const time = d.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" });
  const today = new Date();
  return d.toDateString() === today.toDateString()
    ? time
    : `${d.toLocaleDateString("id-ID", { day: "numeric", month: "short" })} ${time}`;
}

function Item({
  m,
  actions,
  colorize,
}: {
  m: ListMessage;
  actions: MessageActions;
  colorize: boolean;
}) {
  const [showActions, setShowActions] = useState(false);
  const btn =
    "flex min-h-8 items-center gap-1 rounded-full border bg-background px-2.5 text-[11px] font-semibold";
  return (
    <li className={cn("flex gap-2 px-3 py-1", m.mine ? "flex-row-reverse" : "")}>
      {!m.mine && m.author && (
        <button
          type="button"
          aria-label={`Lihat profil @${m.author.username}`}
          onClick={() => profileCard.open((m.author as { userId: string }).userId)}
          className="mt-0.5 h-fit shrink-0 rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        >
          <SocialAvatar avatarId={m.author.avatarId} userId={m.author.userId} size={28} />
        </button>
      )}
      <div
        className={cn("flex min-w-0 max-w-[82%] flex-col", m.mine ? "items-end" : "items-start")}
      >
        {!m.mine && m.author && (
          <span className="mb-0.5 flex max-w-full items-center gap-1">
            <button
              type="button"
              onClick={() => profileCard.open((m.author as { userId: string }).userId)}
              className={cn(
                "min-w-0 truncate text-left text-[11px] font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
                colorize ? usernameColorClass(m.author.userId) : "text-muted-foreground",
              )}
            >
              {m.author.name !== m.author.username && <span>{m.author.name} </span>}
              <span className={m.author.name !== m.author.username ? "font-normal" : ""}>
                @{m.author.username}
              </span>
            </button>
            <IdentityBadges userId={m.author.userId} />
          </span>
        )}
        <button
          type="button"
          onClick={() => !m.deleted && setShowActions((v) => !v)}
          aria-expanded={showActions}
          className={cn(
            "max-w-full rounded-2xl px-3 py-1.5 text-left text-[14px] leading-5",
            m.deleted
              ? "border border-dashed text-muted-foreground italic"
              : m.mine
                ? "bg-primary text-primary-foreground"
                : "bg-muted",
          )}
        >
          {m.reply && (
            <span className="mb-1 block truncate rounded-lg border-l-2 border-current/40 bg-black/5 px-2 py-0.5 text-[11px] opacity-80 dark:bg-white/10">
              {m.reply.author}: {m.reply.deleted ? "pesan dihapus" : m.reply.body}
            </span>
          )}
          <span className="break-words [overflow-wrap:anywhere]">
            {m.deleted ? "Pesan dihapus" : m.body}
          </span>
        </button>
        <span className="mt-0.5 text-[10px] text-muted-foreground">{formatTime(m.createdAt)}</span>
        {showActions && !m.deleted && (
          <div className="mt-1 flex flex-wrap gap-1">
            <button
              type="button"
              className={btn}
              onClick={() => {
                actions.onReply(m);
                setShowActions(false);
              }}
            >
              <Reply className="size-3.5" /> Balas
            </button>
            {actions.canDelete(m) && actions.onDelete && (
              <button
                type="button"
                className={btn}
                onClick={() => {
                  actions.onDelete?.(m);
                  setShowActions(false);
                }}
              >
                <Trash2 className="size-3.5" /> Hapus
              </button>
            )}
            {!m.mine && actions.onReport && (
              <button
                type="button"
                className={btn}
                onClick={() => {
                  actions.onReport?.(m);
                  setShowActions(false);
                }}
              >
                <Flag className="size-3.5" /> Laporkan
              </button>
            )}
            {!m.mine && actions.onBlock && (
              <button
                type="button"
                className={btn}
                onClick={() => {
                  actions.onBlock?.(m);
                  setShowActions(false);
                }}
              >
                <Ban className="size-3.5" /> Blokir
              </button>
            )}
          </div>
        )}
      </div>
    </li>
  );
}

/** Pesan terbaru di indeks 0; `flex-col-reverse` menaruhnya di bawah tanpa skrip scroll tambahan. */
export function MessageList({
  messages,
  actions,
  loading,
  hasMore,
  loadingMore,
  onLoadOlder,
  empty,
  colorize = false,
}: {
  messages: readonly ListMessage[];
  actions: MessageActions;
  loading: boolean;
  hasMore: boolean;
  loadingMore: boolean;
  onLoadOlder: () => void;
  empty: ReactNode;
  /** Warna username deterministik per akun (khusus Global Chat). */
  colorize?: boolean;
}) {
  if (loading && messages.length === 0)
    return <div className="flex-1 animate-pulse bg-muted/30" aria-label="Memuat pesan" />;
  if (messages.length === 0)
    return (
      <div className="grid flex-1 place-items-center px-6 text-center text-[13px] text-muted-foreground">
        {empty}
      </div>
    );
  return (
    <ul
      className="flex min-h-0 flex-1 flex-col-reverse overflow-y-auto overscroll-contain py-1"
      aria-label="Daftar pesan"
    >
      {messages.map((m) => (
        <Item key={m.id} m={m} actions={actions} colorize={colorize} />
      ))}
      {hasMore && (
        <li className="px-3 py-2 text-center">
          <button
            type="button"
            disabled={loadingMore}
            onClick={onLoadOlder}
            className="min-h-9 rounded-full border px-4 text-[12px] font-semibold disabled:opacity-50"
          >
            {loadingMore ? "Memuat…" : "Muat pesan lama"}
          </button>
        </li>
      )}
    </ul>
  );
}
