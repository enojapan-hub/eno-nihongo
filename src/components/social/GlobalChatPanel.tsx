import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { onSocialEvent } from "@/lib/social/social-bus";
import { socialApi } from "@/lib/social/social-api";
import { socialErrorMessage } from "@/lib/social/social-validation";
import { GLOBAL_MESSAGE_MAX } from "@/lib/social/social-validation";
import type { GlobalMessage, SocialMe } from "@/lib/social/social-types";
import { Composer } from "./Composer";
import { MessageList, type ListMessage } from "./MessageList";
import { useSocialInvalidate } from "./social-queries";
import { useThread } from "./use-thread";

function toListMessage(m: GlobalMessage, meId: string): ListMessage {
  return {
    id: m.id,
    mine: m.sender_id === meId,
    author: {
      userId: m.sender_id,
      name: m.display_name ?? m.username,
      username: m.username,
      avatarId: m.avatar_id,
    },
    body: m.body,
    deleted: m.deleted,
    createdAt: m.created_at,
    reply: m.reply
      ? { author: `@${m.reply.username ?? "?"}`, body: m.reply.body, deleted: m.reply.deleted }
      : null,
  };
}

export function GlobalChatPanel({ me, active }: { me: SocialMe; active: boolean }) {
  const meId = me.user_id as string;
  const thread = useThread<GlobalMessage>("global", (before) => socialApi.globalHistory(before));
  const [replyTo, setReplyTo] = useState<ListMessage | null>(null);
  const invalidate = useSocialInvalidate();
  const { refreshLatest, setMessages } = thread;

  // Realtime: pemicu dari satu channel di ChatDock; digabung dengan debounce agar burst tidak membanjiri RPC.
  const timer = useRef<number | undefined>(undefined);
  useEffect(() => {
    const off = onSocialEvent((e) => {
      if (e.type !== "global") return;
      window.clearTimeout(timer.current);
      timer.current = window.setTimeout(() => void refreshLatest(), 150);
    });
    return () => {
      off();
      window.clearTimeout(timer.current);
    };
  }, [refreshLatest]);

  // Tandai terbaca hanya saat tab Global terlihat.
  const newestId = thread.messages[0]?.id ?? null;
  useEffect(() => {
    if (!active || !newestId) return;
    void socialApi
      .globalMarkRead()
      .then(() => invalidate("unread"))
      .catch(() => undefined);
  }, [active, newestId, invalidate]);

  const items = useMemo(
    () => thread.messages.map((m) => toListMessage(m, meId)),
    [thread.messages, meId],
  );
  const byId = useMemo(() => new Map(thread.messages.map((m) => [m.id, m])), [thread.messages]);

  const actions = useMemo(
    () => ({
      onReply: (m: ListMessage) => setReplyTo(m),
      canDelete: (m: ListMessage) => m.mine || me.is_moderator,
      onDelete: async (m: ListMessage) => {
        try {
          await socialApi.globalDelete(m.id);
          await refreshLatest();
        } catch (e) {
          toast.error(socialErrorMessage(e));
        }
      },
      onReport: async (m: ListMessage) => {
        try {
          const r = await socialApi.report("global", m.id, null);
          toast.success(
            r.status === "already_reported"
              ? "Pesan ini sudah kamu laporkan."
              : "Laporan terkirim. Terima kasih.",
          );
        } catch (e) {
          toast.error(socialErrorMessage(e));
        }
      },
      onBlock: async (m: ListMessage) => {
        const sender = byId.get(m.id)?.sender_id;
        if (!sender) return;
        try {
          await socialApi.block(sender);
          setMessages((cur) => cur.filter((x) => x.sender_id !== sender));
          invalidate("overview", "dmList", "unread");
          toast.success("Pengguna diblokir.");
        } catch (e) {
          toast.error(socialErrorMessage(e));
        }
      },
    }),
    [me.is_moderator, byId, refreshLatest, setMessages, invalidate],
  );

  const send = useCallback(
    async (body: string) => {
      await socialApi.globalSend(body, replyTo?.id ?? null);
      setReplyTo(null);
      await refreshLatest();
    },
    [replyTo, refreshLatest],
  );

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <MessageList
        messages={items}
        actions={actions}
        loading={thread.loading}
        hasMore={thread.hasMore}
        loadingMore={thread.loadingMore}
        onLoadOlder={() => void thread.loadOlder()}
        empty={<p>Belum ada pesan. Sapa semua orang di ruang global!</p>}
      />
      <Composer
        max={GLOBAL_MESSAGE_MAX}
        replyLabel={replyTo ? `@${replyTo.author?.username ?? ""}` : null}
        onCancelReply={() => setReplyTo(null)}
        onSend={send}
      />
    </div>
  );
}
