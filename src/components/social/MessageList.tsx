import { ArrowDown, Ban, Copy, Flag, Pencil, Reply, Trash2 } from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { canEditByAge, splitMentions } from "@/lib/social/mentions";
import { profileCard } from "@/lib/social/profile-card-state";
import { socialApi } from "@/lib/social/social-api";
import { useSocialIdentity } from "@/lib/social/social-badges";
import type { ReportCategory } from "@/lib/social/social-types";
import {
  REPORT_CATEGORIES,
  isEffectivelyEmpty,
  socialErrorMessage,
} from "@/lib/social/social-validation";
import { usernameColorClass } from "@/lib/social/username-color";
import { IdentityBadges } from "./IdentityBadges";
import { SocialAvatar } from "./SocialAvatar";
import { cn } from "@/lib/utils";

export type ListMessage = {
  id: string;
  mine: boolean;
  /** Nama tampilan + @username (null pada DM, pengirimnya sudah jelas). */
  author: {
    userId: string;
    name: string;
    username: string;
    avatarId: number;
    /** Akun sudah tidak ada: identitas aman, tidak bisa dibuka. */
    unavailable?: boolean;
  } | null;
  body: string;
  deleted: boolean;
  createdAt: string;
  editedAt?: string | null | undefined;
  reply: { author: string; body: string; deleted: boolean } | null;
  /** Pesan lokal yang belum/ gagal sampai ke server (kirim optimistik). */
  status?: "sending" | "failed";
  errorText?: string;
};

export type MessageActions = {
  onReply: (m: ListMessage) => void;
  onDelete?: ((m: ListMessage) => void) | undefined;
  onReport?: ((m: ListMessage, category: ReportCategory) => void) | undefined;
  /** Edit pesan sendiri (server menegakkan jendela 15 menit + validasi ulang). */
  onEdit?: ((m: ListMessage, body: string) => Promise<void>) | undefined;
  onBlock?: ((m: ListMessage) => void) | undefined;
  /** Boleh menghapus pesan ini (pemilik atau moderator). */
  canDelete: (m: ListMessage) => boolean;
  onRetry?: ((m: ListMessage) => void) | undefined;
  onDiscard?: ((m: ListMessage) => void) | undefined;
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

/** Teks pesan dengan @mention yang bisa diklik (membuka Profile Card; tanpa autocomplete). */
function Body({ text, meUsername }: { text: string; meUsername?: string | undefined }) {
  const parts = splitMentions(text);
  if (parts.every((p) => p.type === "text")) return <>{text}</>;
  return (
    <>
      {parts.map((p, i) =>
        p.type === "text" ? (
          <span key={i}>{p.text}</span>
        ) : (
          <span
            key={i}
            role="link"
            tabIndex={0}
            data-mention={p.username}
            onClick={(e) => {
              e.stopPropagation();
              void openMention(p.username);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.stopPropagation();
                void openMention(p.username);
              }
            }}
            className={cn(
              "cursor-pointer font-semibold underline decoration-dotted underline-offset-2",
              p.username === meUsername && "rounded bg-amber-300/40 px-0.5",
            )}
          >
            @{p.username}
          </span>
        ),
      )}
    </>
  );
}

async function openMention(username: string) {
  try {
    const r = await socialApi.userByUsername(username);
    if (r?.user_id) profileCard.open(r.user_id);
    else toast.error("Pengguna tidak ditemukan.");
  } catch (e) {
    toast.error(socialErrorMessage(e));
  }
}

function Item({
  m,
  actions,
  colorize,
  peerId,
  meUsername,
}: {
  m: ListMessage;
  actions: MessageActions;
  colorize: boolean;
  peerId?: string | undefined;
  meUsername?: string | undefined;
}) {
  const [showActions, setShowActions] = useState(false);
  const [reporting, setReporting] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [savingEdit, setSavingEdit] = useState(false);
  // Owner/Admin tidak bisa dilaporkan/diblokir (server menolak; UI menyembunyikan tombolnya).
  const targetId = m.author?.userId ?? peerId;
  const ident = useSocialIdentity(targetId);
  const protectedTarget = !ident.loaded || ident.badges.verified || ident.badges.admin === true;
  const canEdit =
    m.mine && !m.deleted && !m.status && !!actions.onEdit && canEditByAge(m.createdAt);
  const btn =
    "flex min-h-8 items-center gap-1 rounded-full border bg-background px-2.5 text-[11px] font-semibold";
  return (
    <li className={cn("flex gap-2 px-3 py-1", m.mine ? "flex-row-reverse" : "")}>
      {!m.mine && m.author?.unavailable && <SocialAvatar size={28} className="mt-0.5 h-fit" />}
      {!m.mine && m.author && !m.author.unavailable && (
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
        {!m.mine && m.author?.unavailable && (
          <span className="mb-0.5 text-[11px] italic text-muted-foreground">
            Pengguna tidak tersedia
          </span>
        )}
        {!m.mine && m.author && !m.author.unavailable && (
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
          disabled={!!m.status}
          onClick={() => !m.deleted && !m.status && setShowActions((v) => !v)}
          aria-expanded={showActions}
          className={cn(
            "max-w-full rounded-2xl px-3 py-1.5 text-left text-[14px] leading-5",
            m.status === "failed" && "ring-1 ring-destructive/60",
            m.status === "sending" && "opacity-70",
            m.deleted
              ? "border border-dashed text-muted-foreground italic"
              : m.mine
                ? "bg-primary text-primary-foreground"
                : "bg-muted",
          )}
        >
          {m.reply && (
            <span className="mb-1 block truncate rounded-lg border-l-2 border-current/40 bg-black/5 px-2 py-0.5 text-[11px] opacity-80 dark:bg-white/10">
              {m.reply.deleted ? "Pesan tidak tersedia." : `${m.reply.author}: ${m.reply.body}`}
            </span>
          )}
          <span className="break-words [overflow-wrap:anywhere]">
            {m.deleted ? "Pesan telah dihapus." : <Body text={m.body} meUsername={meUsername} />}
          </span>
        </button>
        {m.status === "sending" && (
          <span role="status" className="mt-0.5 text-[10px] text-muted-foreground">
            Mengirim…
          </span>
        )}
        {m.status === "failed" && (
          <span
            role="alert"
            className="mt-0.5 flex flex-wrap items-center justify-end gap-x-2 text-[11px]"
          >
            <span className="font-semibold text-destructive">Gagal dikirim</span>
            <button
              type="button"
              className="min-h-8 font-semibold text-primary underline"
              onClick={() => actions.onRetry?.(m)}
            >
              Coba lagi
            </button>
            <button
              type="button"
              className="min-h-8 text-muted-foreground underline"
              onClick={() => actions.onDiscard?.(m)}
            >
              Hapus
            </button>
          </span>
        )}
        {!m.status && (
          <span className="mt-0.5 text-[10px] text-muted-foreground">
            {formatTime(m.createdAt)}
            {m.editedAt && !m.deleted ? " · Diedit" : ""}
            {m.mine && !m.deleted ? " · Terkirim" : ""}
          </span>
        )}
        {editing !== null && (
          <form
            className="mt-1 flex w-full flex-col gap-1"
            onSubmit={async (e) => {
              e.preventDefault();
              if (!actions.onEdit || savingEdit || isEffectivelyEmpty(editing)) return;
              setSavingEdit(true);
              try {
                await actions.onEdit(m, editing.trim());
                setEditing(null);
              } catch (err) {
                toast.error(socialErrorMessage(err));
              } finally {
                setSavingEdit(false);
              }
            }}
          >
            <textarea
              aria-label="Edit pesan"
              value={editing}
              rows={2}
              onChange={(e) => setEditing(e.target.value)}
              className="min-h-12 w-full resize-none rounded-xl border bg-background px-2 py-1 text-[16px] md:text-[13px]"
            />
            <span className="flex justify-end gap-2">
              <button type="button" className={btn} onClick={() => setEditing(null)}>
                Batal
              </button>
              <button
                type="submit"
                className={cn(btn, "border-primary bg-primary text-primary-foreground")}
                disabled={savingEdit || isEffectivelyEmpty(editing)}
              >
                Simpan
              </button>
            </span>
          </form>
        )}
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
            <button
              type="button"
              className={btn}
              onClick={() => {
                void navigator.clipboard
                  ?.writeText(m.body)
                  .then(() => toast.success("Pesan disalin."))
                  .catch(() => toast.error("Tidak bisa menyalin pesan."));
                setShowActions(false);
              }}
            >
              <Copy className="size-3.5" /> Salin pesan
            </button>
            {canEdit && (
              <button
                type="button"
                className={btn}
                onClick={() => {
                  setEditing(m.body);
                  setShowActions(false);
                }}
              >
                <Pencil className="size-3.5" /> Edit
              </button>
            )}
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
            {!m.mine && actions.onReport && !protectedTarget && (
              <button
                type="button"
                className={btn}
                aria-expanded={reporting}
                onClick={() => setReporting((v) => !v)}
              >
                <Flag className="size-3.5" /> Laporkan
              </button>
            )}
            {!m.mine && actions.onBlock && !protectedTarget && (
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
        {showActions && reporting && !m.deleted && (
          <div role="group" aria-label="Kategori laporan" className="mt-1 flex flex-wrap gap-1">
            {REPORT_CATEGORIES.map(([cat, label]) => (
              <button
                key={cat}
                type="button"
                className={btn}
                onClick={() => {
                  actions.onReport?.(m, cat);
                  setReporting(false);
                  setShowActions(false);
                }}
              >
                {label}
              </button>
            ))}
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
  error,
  onRetryLoad,
  peerId,
  meUsername,
}: {
  peerId?: string | undefined;
  meUsername?: string | undefined;
  messages: readonly ListMessage[];
  actions: MessageActions;
  loading: boolean;
  hasMore: boolean;
  loadingMore: boolean;
  onLoadOlder: () => void;
  empty: ReactNode;
  /** Warna username deterministik per akun (khusus Global Chat). */
  colorize?: boolean;
  /** Gagal memuat (dan belum ada pesan): tampilkan status + Coba lagi. */
  error?: string | null | undefined;
  onRetryLoad?: (() => void) | undefined;
}) {
  const listRef = useRef<HTMLUListElement>(null);
  const atBottom = useRef(true);
  const lastNewest = useRef<string | null>(null);
  const [unseen, setUnseen] = useState(false);
  const newest = messages[0];
  const newestId = newest?.id ?? null;
  const newestMine = newest?.mine ?? false;
  // Auto-scroll hanya bila pengguna sedang di dasar (atau pesan itu miliknya); selain itu tampilkan "Pesan baru".
  useEffect(() => {
    if (!newestId) return;
    if (lastNewest.current === null) {
      lastNewest.current = newestId;
      return;
    }
    if (newestId === lastNewest.current) return;
    lastNewest.current = newestId;
    if (newestMine || atBottom.current) {
      listRef.current?.scrollTo({ top: 0 });
      setUnseen(false);
    } else setUnseen(true);
  }, [newestId, newestMine]);

  if (loading && messages.length === 0)
    return <div className="flex-1 animate-pulse bg-muted/30" aria-label="Memuat pesan" />;
  if (messages.length === 0 && error)
    return (
      <div className="grid flex-1 place-items-center px-6 text-center" role="alert">
        <div>
          <p className="text-[13px] text-destructive">Koneksi sosial sedang bermasalah.</p>
          <button
            type="button"
            onClick={onRetryLoad}
            className="mt-2 min-h-11 rounded-full border px-4 text-[12px] font-semibold"
          >
            Coba Lagi
          </button>
        </div>
      </div>
    );
  if (messages.length === 0)
    return (
      <div className="grid flex-1 place-items-center px-6 text-center text-[13px] text-muted-foreground">
        {empty}
      </div>
    );
  return (
    <div className="relative flex min-h-0 flex-1 flex-col">
      <ul
        ref={listRef}
        onScroll={(e) => {
          // flex-col-reverse: dasar = scrollTop 0 (negatif/0 saat menggulir ke atas).
          atBottom.current = Math.abs(e.currentTarget.scrollTop) < 48;
          if (atBottom.current) setUnseen(false);
        }}
        className="flex min-h-0 flex-1 flex-col-reverse overflow-y-auto overscroll-contain py-1"
        aria-label="Daftar pesan"
      >
        {messages.map((m) => (
          <Item
            key={m.id}
            m={m}
            actions={actions}
            colorize={colorize}
            peerId={peerId}
            meUsername={meUsername}
          />
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
      {unseen && (
        <button
          type="button"
          data-testid="new-message-pill"
          onClick={() => {
            listRef.current?.scrollTo({ top: 0, behavior: "smooth" });
            setUnseen(false);
          }}
          className="absolute bottom-2 left-1/2 flex min-h-9 -translate-x-1/2 items-center gap-1 rounded-full bg-primary px-3 text-[12px] font-semibold text-primary-foreground shadow-lg"
        >
          Pesan baru <ArrowDown className="size-3.5" />
        </button>
      )}
    </div>
  );
}
