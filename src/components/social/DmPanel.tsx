import { ArrowLeft, Bell, BellOff, Trash2 } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { setDraft } from "@/lib/social/chat-drafts";
import { dock, useDock } from "@/lib/social/dock-state";
import { profileCard } from "@/lib/social/profile-card-state";
import { onSocialEvent } from "@/lib/social/social-bus";
import { socialApi } from "@/lib/social/social-api";
import {
  DM_MESSAGE_MAX,
  isPermanentSendError,
  socialErrorMessage,
} from "@/lib/social/social-validation";
import type {
  DmMessage,
  ReportCategory,
  SocialIdentity,
  SocialMe,
} from "@/lib/social/social-types";
import { Composer } from "./Composer";
import { IdentityBadges } from "./IdentityBadges";
import { MessageList, type ListMessage } from "./MessageList";
import { SocialAvatar } from "./SocialAvatar";
import { useDmList, useSocialInvalidate, useSocialOverview } from "./social-queries";
import { useThread } from "./use-thread";

function ConversationList({ active }: { active: boolean }) {
  const list = useDmList(active);
  const invalidate = useSocialInvalidate();
  useEffect(
    () =>
      onSocialEvent((e) => {
        if (e.type === "dm") invalidate("dmList");
      }),
    [invalidate],
  );
  if (list.isLoading)
    return <div className="flex-1 animate-pulse bg-muted/30" aria-label="Memuat percakapan" />;
  if (list.error)
    return <p className="p-4 text-center text-[13px] text-destructive">Gagal memuat percakapan.</p>;
  const items = list.data ?? [];
  if (items.length === 0)
    return (
      <div className="grid flex-1 place-items-center px-6 text-center text-[13px] leading-5 text-muted-foreground">
        Belum ada percakapan. Buka tab Teman lalu pilih Chat pada temanmu.
      </div>
    );
  return (
    <ul
      className="min-h-0 flex-1 overflow-y-auto overscroll-contain"
      aria-label="Daftar percakapan"
    >
      {items.map((c) => (
        <li
          key={c.user_id}
          className="flex items-center gap-1 border-b pl-3 pr-1 hover:bg-muted/50"
        >
          <button
            type="button"
            aria-label={`Lihat profil @${c.username}`}
            onClick={() => profileCard.open(c.user_id)}
            className="shrink-0 rounded-full py-2.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            <SocialAvatar avatarId={c.avatar_id} userId={c.user_id} size={40} />
          </button>
          <div className="flex min-w-0 flex-1 items-center gap-2 py-1.5 pl-1 pr-2">
            <div className="min-w-0 flex-1">
              <button
                type="button"
                onClick={() => profileCard.open(c.user_id)}
                className="flex max-w-full items-center gap-1 rounded text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              >
                <span className="truncate text-[14px] font-semibold">
                  {c.display_name ?? c.username}
                </span>
                <IdentityBadges userId={c.user_id} />
                {c.muted && (
                  <BellOff
                    aria-label="Suara dimatikan"
                    role="img"
                    className="size-3 shrink-0 text-muted-foreground"
                  />
                )}
              </button>
              <button
                type="button"
                onClick={() => dock.openDm(c)}
                aria-label={`Buka percakapan dengan @${c.username}`}
                className="block min-h-6 w-full truncate text-left text-[12px] text-muted-foreground"
              >
                {c.last_deleted ? "Pesan dihapus" : (c.last_body ?? "")}
              </button>
            </div>
            {c.unread > 0 && (
              <button
                type="button"
                tabIndex={-1}
                aria-hidden
                onClick={() => dock.openDm(c)}
                className="grid h-5 min-w-5 place-items-center rounded-full bg-primary px-1.5 text-[11px] font-bold text-primary-foreground"
              >
                {c.unread > 99 ? "99+" : c.unread}
              </button>
            )}
          </div>
        </li>
      ))}
    </ul>
  );
}

type PendingDm = {
  clientId: string;
  body: string;
  replyTo: string | null;
  at: number;
  status: "sending" | "failed";
  error?: string;
};

function toListMessage(m: DmMessage, meId: string, other: SocialIdentity): ListMessage {
  const name = (id: string) => (id === meId ? "Kamu" : `@${other.username}`);
  return {
    id: m.id,
    mine: m.sender_id === meId,
    author: null,
    body: m.body,
    deleted: m.deleted,
    createdAt: m.created_at,
    editedAt: m.edited_at ?? null,
    reply: m.reply
      ? { author: name(m.reply.sender_id ?? ""), body: m.reply.body, deleted: m.reply.deleted }
      : null,
  };
}

function Thread({ me, other, active }: { me: SocialMe; other: SocialIdentity; active: boolean }) {
  const meId = me.user_id as string;
  const thread = useThread<DmMessage>(`dm:${other.user_id}`, (before) =>
    socialApi.dmHistory(other.user_id, before),
  );
  const overview = useSocialOverview(true);
  const invalidate = useSocialInvalidate();
  const [replyTo, setReplyTo] = useState<ListMessage | null>(null);
  const [confirmHide, setConfirmHide] = useState(false);
  const [hiding, setHiding] = useState(false);
  const { refreshLatest } = thread;
  // Owner boleh menulis ke setiap anggota valid tanpa pertemanan; server tetap memvalidasi status akun target.
  const isFriend =
    me.unrestricted_dm === true ||
    (overview.data ? overview.data.friends.some((f) => f.user_id === other.user_id) : true);

  const hideConversation = useCallback(async () => {
    setHiding(true);
    try {
      await socialApi.dmHide(other.user_id);
      setDraft(`dm:${other.user_id}`, "");
      invalidate("dmList", "unread");
      dock.openDm(null);
      toast.success("Percakapan dihapus dari daftar chat Anda.");
    } catch (e) {
      toast.error(socialErrorMessage(e));
    } finally {
      setHiding(false);
      setConfirmHide(false);
    }
  }, [other.user_id, invalidate]);

  const timer = useRef<number | undefined>(undefined);
  useEffect(() => {
    const off = onSocialEvent((e) => {
      if (e.type !== "dm" && e.type !== "friends") return;
      window.clearTimeout(timer.current);
      timer.current = window.setTimeout(() => void refreshLatest(), 150);
    });
    return () => {
      off();
      window.clearTimeout(timer.current);
    };
  }, [refreshLatest]);

  const newest = thread.messages[0];
  const newestFromOther = newest && newest.sender_id !== meId ? newest.id : null;
  useEffect(() => {
    if (!active || !newestFromOther) return;
    void socialApi
      .dmMarkRead(other.user_id)
      .then(() => invalidate("unread", "dmList"))
      .catch(() => undefined);
  }, [active, newestFromOther, other.user_id, invalidate]);

  // Kirim optimistik: pesan tampil langsung; gagal sementara -> "Gagal dikirim" + Coba lagi (client_id
  // yang sama membuat server tidak pernah menyimpan dua kali).
  const [pending, setPending] = useState<PendingDm[]>([]);
  const items = useMemo(() => {
    const real = thread.messages.map((m) => toListMessage(m, meId, other));
    const local = pending
      .filter(
        (p) =>
          !thread.messages.some(
            (m) =>
              m.sender_id === meId &&
              m.body === p.body &&
              new Date(m.created_at).getTime() >= p.at - 5000,
          ),
      )
      .map((p): ListMessage => ({
        id: `pending:${p.clientId}`,
        mine: true,
        author: null,
        body: p.body,
        deleted: false,
        createdAt: new Date(p.at).toISOString(),
        reply: null,
        status: p.status,
        ...(p.error ? { errorText: p.error } : {}),
      }));
    return [...local, ...real];
  }, [thread.messages, pending, meId, other]);

  const list = useDmList(true);
  const muted = list.data?.find((c) => c.user_id === other.user_id)?.muted === true;
  const toggleMute = useCallback(async () => {
    try {
      await socialApi.dmMute(other.user_id, !muted);
      invalidate("dmList");
      toast.success(muted ? "Suara percakapan diaktifkan." : "Suara percakapan dimatikan.");
    } catch (e) {
      toast.error(socialErrorMessage(e));
    }
  }, [other.user_id, muted, invalidate]);

  const deliver = useCallback(
    async (p: PendingDm) => {
      setPending((cur) =>
        cur.map((x) => (x.clientId === p.clientId ? { ...x, status: "sending" } : x)),
      );
      try {
        await socialApi.dmSend(other.user_id, p.body, p.replyTo, p.clientId);
        setPending((cur) => cur.filter((x) => x.clientId !== p.clientId));
        await refreshLatest();
        invalidate("dmList");
      } catch (e) {
        if (isPermanentSendError(e)) {
          // Ditolak (kata/link terlarang, kebijakan DM, dll.): bukan kegagalan jaringan, jangan ditawari ulang.
          setPending((cur) => cur.filter((x) => x.clientId !== p.clientId));
          throw e;
        }
        setPending((cur) =>
          cur.map((x) =>
            x.clientId === p.clientId
              ? { ...x, status: "failed", error: socialErrorMessage(e) }
              : x,
          ),
        );
      }
    },
    [other.user_id, refreshLatest, invalidate],
  );

  const send = useCallback(
    async (body: string) => {
      const p: PendingDm = {
        clientId: crypto.randomUUID(),
        body,
        replyTo: replyTo?.id.startsWith("pending:") ? null : (replyTo?.id ?? null),
        at: Date.now(),
        status: "sending",
      };
      setPending((cur) => [p, ...cur]);
      setReplyTo(null);
      await deliver(p);
    },
    [replyTo, deliver],
  );

  const retry = useCallback(
    (m: ListMessage) => {
      const p = pending.find((x) => `pending:${x.clientId}` === m.id);
      if (p) void deliver(p).catch((e) => toast.error(socialErrorMessage(e)));
    },
    [pending, deliver],
  );
  const discard = useCallback(
    (m: ListMessage) => setPending((cur) => cur.filter((x) => `pending:${x.clientId}` !== m.id)),
    [],
  );

  const actions = useMemo(
    () => ({
      onReply: (m: ListMessage) => setReplyTo(m),
      canDelete: (m: ListMessage) => m.mine,
      onDelete: async (m: ListMessage) => {
        try {
          await socialApi.dmDelete(m.id);
          await refreshLatest();
          invalidate("dmList");
        } catch (e) {
          toast.error(socialErrorMessage(e));
        }
      },
      onEdit: async (m: ListMessage, body: string) => {
        await socialApi.dmEdit(m.id, body);
        await refreshLatest();
        invalidate("dmList");
      },
      onReport: async (m: ListMessage, category: ReportCategory) => {
        try {
          const r = await socialApi.report("dm", m.id, null, category);
          toast.success(
            r.status === "already_reported"
              ? "Pesan ini sudah kamu laporkan."
              : "Laporan terkirim. Terima kasih.",
          );
        } catch (e) {
          toast.error(socialErrorMessage(e));
        }
      },
      onRetry: retry,
      onDiscard: discard,
      onBlock: async () => {
        try {
          await socialApi.block(other.user_id);
          invalidate("overview", "dmList", "unread");
          toast.success("Pengguna diblokir.");
          dock.openDm(null);
        } catch (e) {
          toast.error(socialErrorMessage(e));
        }
      },
    }),
    [other.user_id, refreshLatest, invalidate, retry, discard],
  );

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex items-center gap-2 border-b px-2 py-1.5">
        <button
          type="button"
          aria-label="Kembali ke daftar percakapan"
          onClick={() => dock.openDm(null)}
          className="grid size-9 place-items-center rounded-full hover:bg-muted"
        >
          <ArrowLeft className="size-[18px]" />
        </button>
        <button
          type="button"
          aria-label={`Lihat profil @${other.username}`}
          onClick={() => profileCard.open(other.user_id)}
          className="flex min-w-0 items-center gap-2 rounded-xl text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        >
          <SocialAvatar avatarId={other.avatar_id} userId={other.user_id} size={30} />
          <span className="min-w-0">
            <span className="flex items-center gap-1">
              <span className="truncate text-[14px] font-semibold">
                {other.display_name ?? other.username}
              </span>
              <IdentityBadges userId={other.user_id} />
            </span>
            <span className="block truncate text-[11px] text-muted-foreground">
              @{other.username}
            </span>
          </span>
        </button>
        <button
          type="button"
          aria-pressed={muted}
          aria-label={muted ? "Aktifkan suara percakapan" : "Matikan suara percakapan"}
          title={muted ? "Aktifkan suara" : "Matikan suara"}
          onClick={() => void toggleMute()}
          className="ml-auto grid size-11 shrink-0 place-items-center rounded-full text-muted-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        >
          {muted ? <BellOff className="size-[18px]" /> : <Bell className="size-[18px]" />}
        </button>
        <button
          type="button"
          aria-label="Hapus percakapan"
          title="Hapus percakapan"
          onClick={() => setConfirmHide(true)}
          className="grid size-11 shrink-0 place-items-center rounded-full text-muted-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        >
          <Trash2 className="size-[18px]" />
        </button>
      </div>
      {confirmHide && (
        <div
          role="alertdialog"
          aria-label="Hapus percakapan"
          className="border-b bg-muted/40 px-3 py-2 text-[12px]"
        >
          <p className="font-semibold">Hapus percakapan ini dari daftar chat Anda?</p>
          <p className="mt-0.5 text-muted-foreground">Percakapan hanya dihapus dari akun Anda.</p>
          <div className="mt-2 flex justify-end gap-2">
            <button
              type="button"
              className="min-h-9 rounded-full border px-3 font-semibold"
              onClick={() => setConfirmHide(false)}
            >
              Batal
            </button>
            <button
              type="button"
              disabled={hiding}
              className="min-h-9 rounded-full border border-destructive px-3 font-semibold text-destructive disabled:opacity-50"
              onClick={() => void hideConversation()}
            >
              {hiding ? "Menghapus…" : "Hapus"}
            </button>
          </div>
        </div>
      )}
      <MessageList
        messages={items}
        actions={actions}
        loading={thread.loading}
        hasMore={thread.hasMore}
        loadingMore={thread.loadingMore}
        onLoadOlder={() => void thread.loadOlder()}
        error={thread.error}
        onRetryLoad={() => void thread.refreshLatest()}
        peerId={other.user_id}
        meUsername={me.username}
        empty={<p>Belum ada pesan. Mulai percakapan dengan @{other.username}.</p>}
      />
      <Composer
        max={DM_MESSAGE_MAX}
        draftKey={`dm:${other.user_id}`}
        disabledReason={
          me.social_suspended
            ? "Fitur sosial akunmu sedang dibatasi. Belajar tetap bisa dilakukan."
            : isFriend
              ? null
              : "Kalian tidak lagi berteman. Pesan baru tidak bisa dikirim."
        }
        replyLabel={replyTo ? (replyTo.mine ? "pesanmu" : `@${other.username}`) : null}
        onCancelReply={() => setReplyTo(null)}
        onSend={send}
      />
    </div>
  );
}

export function DmPanel({ me, active }: { me: SocialMe; active: boolean }) {
  const { dm } = useDock();
  if (dm) return <Thread key={dm.user_id} me={me} other={dm} active={active} />;
  return <ConversationList active={active} />;
}
