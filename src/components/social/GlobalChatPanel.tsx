import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { onSocialEvent } from "@/lib/social/social-bus";
import { socialApi } from "@/lib/social/social-api";
import { socialErrorMessage } from "@/lib/social/social-validation";
import { GLOBAL_MESSAGE_MAX } from "@/lib/social/social-validation";
import type { GlobalMessage, ReportCategory, SocialMe } from "@/lib/social/social-types";
import { useQuery } from "@tanstack/react-query";
import { Pin } from "lucide-react";
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
      name: m.display_name ?? m.username ?? "Pengguna tidak tersedia",
      username: m.username ?? "",
      avatarId: m.avatar_id ?? 0,
      unavailable: !m.username,
    },
    body: m.body,
    deleted: m.deleted,
    createdAt: m.created_at,
    editedAt: m.edited_at ?? null,
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
      onEdit: async (m: ListMessage, body: string) => {
        await socialApi.globalEdit(m.id, body);
        await refreshLatest();
      },
      onReport: async (m: ListMessage, category: ReportCategory) => {
        try {
          const r = await socialApi.report("global", m.id, null, category);
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

  const config = useQuery({
    queryKey: ["social", "global-config"],
    queryFn: socialApi.globalConfig,
    enabled: active,
    staleTime: 30_000,
  });
  const slow = config.data?.slow_mode_seconds ?? 0;
  const pinned = config.data?.pinned ?? null;
  const refreshConfig = () => void config.refetch();
  const onSlow = async (seconds: number) => {
    try {
      await socialApi.setSlowMode(seconds);
      refreshConfig();
      toast.success(seconds === 0 ? "Mode lambat dimatikan." : `Mode lambat ${seconds} detik.`);
    } catch (e) {
      toast.error(socialErrorMessage(e));
    }
  };
  const onPin = async () => {
    const text = window.prompt(
      "Pengumuman tersemat (kosongkan untuk melepas):",
      pinned?.text ?? "",
    );
    if (text === null) return;
    try {
      await socialApi.setPin(text);
      refreshConfig();
    } catch (e) {
      toast.error(socialErrorMessage(e));
    }
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {pinned && (
        <div
          data-testid="global-pinned"
          className="flex items-start gap-1.5 border-b bg-amber-50 px-3 py-1.5 text-[12px] leading-4 text-amber-900 dark:bg-amber-400/10 dark:text-amber-200"
        >
          <Pin aria-hidden className="mt-0.5 size-3.5 shrink-0" />
          <span className="min-w-0 break-words [overflow-wrap:anywhere]">{pinned.text}</span>
        </div>
      )}
      {me.is_moderator && (
        <div className="flex flex-wrap items-center gap-1.5 border-b px-3 py-1 text-[11px]">
          <label className="flex items-center gap-1">
            Mode lambat
            <select
              aria-label="Mode lambat"
              value={slow}
              onChange={(e) => void onSlow(Number(e.target.value))}
              className="h-7 rounded-md border bg-background px-1"
            >
              {[0, 5, 10, 30].map((v) => (
                <option key={v} value={v}>
                  {v === 0 ? "Off" : `${v} dtk`}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            className="min-h-7 rounded-md border px-2 font-semibold"
            onClick={() => void onPin()}
          >
            {pinned ? "Ubah sematan" : "Sematkan"}
          </button>
        </div>
      )}
      {slow > 0 && !me.is_moderator && (
        <p
          className="border-b px-3 py-1 text-center text-[11px] text-muted-foreground"
          role="status"
        >
          Mode lambat aktif: 1 pesan setiap {slow} detik.
        </p>
      )}
      <MessageList
        messages={items}
        peerId={undefined}
        meUsername={me.username}
        colorize
        actions={actions}
        loading={thread.loading}
        hasMore={thread.hasMore}
        loadingMore={thread.loadingMore}
        onLoadOlder={() => void thread.loadOlder()}
        error={thread.error}
        onRetryLoad={() => void thread.refreshLatest()}
        empty={<p>Belum ada pesan. Sapa semua orang di ruang global!</p>}
      />
      <Composer
        max={GLOBAL_MESSAGE_MAX}
        draftKey="global"
        disabledReason={
          me.social_suspended
            ? "Fitur sosial akunmu sedang dibatasi. Belajar tetap bisa dilakukan."
            : null
        }
        replyLabel={replyTo ? `@${replyTo.author?.username ?? ""}` : null}
        onCancelReply={() => setReplyTo(null)}
        onSend={send}
      />
    </div>
  );
}
