import { ArrowLeft } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { dock, useDock } from "@/lib/social/dock-state";
import { onSocialEvent } from "@/lib/social/social-bus";
import { socialApi } from "@/lib/social/social-api";
import { DM_MESSAGE_MAX, socialErrorMessage } from "@/lib/social/social-validation";
import type { DmMessage, SocialIdentity, SocialMe } from "@/lib/social/social-types";
import { Composer } from "./Composer";
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
        <li key={c.user_id}>
          <button
            type="button"
            onClick={() => dock.openDm(c)}
            className="flex w-full items-center gap-2 border-b px-3 py-2.5 text-left hover:bg-muted/50"
          >
            <SocialAvatar avatarId={c.avatar_id} size={40} />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[14px] font-semibold">
                {c.display_name ?? c.username}
              </span>
              <span className="block truncate text-[12px] text-muted-foreground">
                {c.last_deleted ? "Pesan dihapus" : (c.last_body ?? "")}
              </span>
            </span>
            {c.unread > 0 && (
              <span className="grid h-5 min-w-5 place-items-center rounded-full bg-primary px-1.5 text-[11px] font-bold text-primary-foreground">
                {c.unread > 99 ? "99+" : c.unread}
              </span>
            )}
          </button>
        </li>
      ))}
    </ul>
  );
}

function toListMessage(m: DmMessage, meId: string, other: SocialIdentity): ListMessage {
  const name = (id: string) => (id === meId ? "Kamu" : `@${other.username}`);
  return {
    id: m.id,
    mine: m.sender_id === meId,
    author: null,
    body: m.body,
    deleted: m.deleted,
    createdAt: m.created_at,
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
  const { refreshLatest } = thread;
  const isFriend = overview.data
    ? overview.data.friends.some((f) => f.user_id === other.user_id)
    : true;

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

  const items = useMemo(
    () => thread.messages.map((m) => toListMessage(m, meId, other)),
    [thread.messages, meId, other],
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
      onReport: async (m: ListMessage) => {
        try {
          const r = await socialApi.report("dm", m.id, null);
          toast.success(
            r.status === "already_reported"
              ? "Pesan ini sudah kamu laporkan."
              : "Laporan terkirim. Terima kasih.",
          );
        } catch (e) {
          toast.error(socialErrorMessage(e));
        }
      },
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
    [other.user_id, refreshLatest, invalidate],
  );

  const send = useCallback(
    async (body: string) => {
      await socialApi.dmSend(other.user_id, body, replyTo?.id ?? null);
      setReplyTo(null);
      await refreshLatest();
      invalidate("dmList");
    },
    [other.user_id, replyTo, refreshLatest, invalidate],
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
        <SocialAvatar avatarId={other.avatar_id} size={30} />
        <div className="min-w-0">
          <p className="truncate text-[14px] font-semibold">
            {other.display_name ?? other.username}
          </p>
          <p className="truncate text-[11px] text-muted-foreground">@{other.username}</p>
        </div>
      </div>
      <MessageList
        messages={items}
        actions={actions}
        loading={thread.loading}
        hasMore={thread.hasMore}
        loadingMore={thread.loadingMore}
        onLoadOlder={() => void thread.loadOlder()}
        empty={<p>Belum ada pesan. Mulai percakapan dengan @{other.username}.</p>}
      />
      <Composer
        max={DM_MESSAGE_MAX}
        disabledReason={
          isFriend ? null : "Kalian tidak lagi berteman. Pesan baru tidak bisa dikirim."
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
