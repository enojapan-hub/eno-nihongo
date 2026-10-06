import { useQuery } from "@tanstack/react-query";
import { Ban, Check, MessageCircle, Search, UserMinus, UserPlus, X } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { dock } from "@/lib/social/dock-state";
import { profileCard } from "@/lib/social/profile-card-state";
import { onSocialEvent } from "@/lib/social/social-bus";
import { socialApi } from "@/lib/social/social-api";
import { useSocialIdentity } from "@/lib/social/social-badges";
import { socialErrorMessage } from "@/lib/social/social-validation";
import type { SocialIdentity } from "@/lib/social/social-types";
import { IdentityBadges } from "./IdentityBadges";
import { SocialAvatar } from "./SocialAvatar";
import { useSocialInvalidate, useSocialOverview } from "./social-queries";

const pill =
  "flex min-h-9 items-center gap-1 rounded-full border bg-background px-3 text-[12px] font-semibold disabled:opacity-50";

function Row({ who, children }: { who: SocialIdentity; children: ReactNode }) {
  return (
    <li className="flex items-center gap-2 px-3 py-2">
      <button
        type="button"
        aria-label={`Lihat profil @${who.username}`}
        onClick={() => profileCard.open(who.user_id)}
        className="flex min-w-0 flex-1 items-center gap-2 rounded-xl text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
      >
        <SocialAvatar avatarId={who.avatar_id} userId={who.user_id} size={36} />
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-1">
            <span className="truncate text-[14px] font-semibold">
              {who.display_name ?? who.username}
            </span>
            <IdentityBadges userId={who.user_id} />
          </span>
          <span className="block truncate text-[12px] text-muted-foreground">@{who.username}</span>
        </span>
      </button>
      <div className="flex shrink-0 flex-wrap justify-end gap-1">{children}</div>
    </li>
  );
}

/** Pertemanan dengan akun resmi (Owner) bersifat otomatis: tidak ada tombol hapus. */
function RemoveFriendButton({
  who,
  busy,
  onRemove,
}: {
  who: SocialIdentity;
  busy: boolean;
  onRemove: () => void;
}) {
  const identity = useSocialIdentity(who.user_id);
  if (!identity.loaded || identity.badges.verified) return null;
  return (
    <button
      type="button"
      aria-label={`Hapus teman ${who.username}`}
      className={pill}
      disabled={busy}
      onClick={onRemove}
    >
      <UserMinus className="size-3.5" />
    </button>
  );
}

/** Owner/Admin tidak bisa diblokir: tombol disembunyikan (server juga menolak). */
function BlockFriendButton({
  who,
  busy,
  onBlock,
}: {
  who: SocialIdentity;
  busy: boolean;
  onBlock: () => void;
}) {
  const identity = useSocialIdentity(who.user_id);
  if (!identity.loaded || identity.badges.verified || identity.badges.admin) return null;
  return (
    <button
      type="button"
      aria-label={`Blokir ${who.username}`}
      className={pill}
      disabled={busy}
      onClick={onBlock}
    >
      <Ban className="size-3.5" />
    </button>
  );
}

function Section({
  title,
  count,
  children,
}: {
  title: string;
  count: number;
  children: ReactNode;
}) {
  if (count === 0) return null;
  return (
    <section className="border-b pb-1">
      <h4 className="px-3 pb-0.5 pt-3 text-[12px] font-bold uppercase tracking-wide text-muted-foreground">
        {title} ({count})
      </h4>
      <ul>{children}</ul>
    </section>
  );
}

export function FriendsPanel({ active }: { active: boolean }) {
  const overview = useSocialOverview(true);
  const invalidate = useSocialInvalidate();
  const [query, setQuery] = useState("");
  const [debounced, setDebounced] = useState("");
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    const t = window.setTimeout(() => setDebounced(query.trim()), 350);
    return () => window.clearTimeout(t);
  }, [query]);

  useEffect(() => {
    return onSocialEvent((e) => {
      if (e.type === "friends") invalidate("overview", "unread");
    });
  }, [invalidate]);

  const search = useQuery({
    queryKey: ["social", "search", debounced],
    queryFn: () => socialApi.search(debounced),
    enabled: active && debounced.length >= 2,
    staleTime: 10_000,
  });

  async function act(key: string, fn: () => Promise<unknown>, okMsg?: string) {
    setBusy(key);
    try {
      await fn();
      if (okMsg) toast.success(okMsg);
      invalidate("overview", "unread", "dmList");
      void search.refetch();
    } catch (e) {
      toast.error(socialErrorMessage(e));
    } finally {
      setBusy(null);
    }
  }

  const o = overview.data;
  const searching = debounced.length >= 2;
  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-contain">
      <div className="sticky top-0 z-10 border-b bg-background p-2">
        <label className="relative block">
          <span className="sr-only">Cari username</span>
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            placeholder="Cari username…"
            className="h-10 w-full rounded-full border bg-background pl-9 pr-3 text-[16px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary md:text-[14px]"
          />
        </label>
      </div>

      {searching ? (
        <section>
          {search.isLoading && (
            <p className="p-4 text-center text-[13px] text-muted-foreground">Mencari…</p>
          )}
          {search.data && search.data.length === 0 && (
            <p className="p-4 text-center text-[13px] text-muted-foreground">
              Tidak ada pengguna dengan username itu.
            </p>
          )}
          <ul>
            {(search.data ?? []).map((r) => (
              <Row key={r.user_id} who={r}>
                {r.relation === "friend" && (
                  <span className="text-[12px] text-muted-foreground">Teman</span>
                )}
                {r.relation === "outgoing" && (
                  <span className="text-[12px] text-muted-foreground">Menunggu</span>
                )}
                {r.relation === "incoming" && (
                  <button
                    type="button"
                    className={pill}
                    disabled={busy === r.user_id}
                    onClick={() =>
                      void act(
                        r.user_id,
                        () => socialApi.respondRequest(r.user_id, true),
                        "Pertemanan diterima.",
                      )
                    }
                  >
                    <Check className="size-3.5" /> Terima
                  </button>
                )}
                {r.relation === "none" && (
                  <button
                    type="button"
                    className={pill}
                    disabled={busy === r.user_id}
                    onClick={() =>
                      void act(
                        r.user_id,
                        () => socialApi.sendRequest(r.username),
                        "Permintaan dikirim.",
                      )
                    }
                  >
                    <UserPlus className="size-3.5" /> Tambah
                  </button>
                )}
              </Row>
            ))}
          </ul>
        </section>
      ) : (
        <>
          {overview.isLoading && (
            <p className="p-4 text-center text-[13px] text-muted-foreground">Memuat…</p>
          )}
          {overview.error && (
            <p className="p-4 text-center text-[13px] text-destructive">
              Gagal memuat daftar teman.
            </p>
          )}
          {o && (
            <>
              <Section title="Permintaan masuk" count={o.incoming.length}>
                {o.incoming.map((w) => (
                  <Row key={w.user_id} who={w}>
                    <button
                      type="button"
                      aria-label={`Terima ${w.username}`}
                      className={pill}
                      disabled={busy === w.user_id}
                      onClick={() =>
                        void act(
                          w.user_id,
                          () => socialApi.respondRequest(w.user_id, true),
                          "Pertemanan diterima.",
                        )
                      }
                    >
                      <Check className="size-3.5" /> Terima
                    </button>
                    <button
                      type="button"
                      aria-label={`Tolak ${w.username}`}
                      className={pill}
                      disabled={busy === w.user_id}
                      onClick={() =>
                        void act(w.user_id, () => socialApi.respondRequest(w.user_id, false))
                      }
                    >
                      <X className="size-3.5" /> Tolak
                    </button>
                  </Row>
                ))}
              </Section>
              <Section title="Permintaan terkirim" count={o.outgoing.length}>
                {o.outgoing.map((w) => (
                  <Row key={w.user_id} who={w}>
                    <button
                      type="button"
                      className={pill}
                      disabled={busy === w.user_id}
                      onClick={() => void act(w.user_id, () => socialApi.cancelRequest(w.user_id))}
                    >
                      Batalkan
                    </button>
                  </Row>
                ))}
              </Section>
              <Section title="Teman" count={o.friends.length}>
                {o.friends.map((w) => (
                  <Row key={w.user_id} who={w}>
                    <button
                      type="button"
                      aria-label={`Chat dengan ${w.username}`}
                      className={pill}
                      onClick={() => dock.openDm(w)}
                    >
                      <MessageCircle className="size-3.5" /> Chat
                    </button>
                    <RemoveFriendButton
                      who={w}
                      busy={busy === w.user_id}
                      onRemove={() =>
                        void act(
                          w.user_id,
                          () => socialApi.removeFriend(w.user_id),
                          "Teman dihapus.",
                        )
                      }
                    />
                    <BlockFriendButton
                      who={w}
                      busy={busy === w.user_id}
                      onBlock={() =>
                        void act(w.user_id, () => socialApi.block(w.user_id), "Pengguna diblokir.")
                      }
                    />
                  </Row>
                ))}
              </Section>
              <Section title="Diblokir" count={o.blocked.length}>
                {o.blocked.map((w) => (
                  <Row key={w.user_id} who={w}>
                    <button
                      type="button"
                      className={pill}
                      disabled={busy === w.user_id}
                      onClick={() =>
                        void act(w.user_id, () => socialApi.unblock(w.user_id), "Blokir dibuka.")
                      }
                    >
                      Buka blokir
                    </button>
                  </Row>
                ))}
              </Section>
              {o.friends.length + o.incoming.length + o.outgoing.length + o.blocked.length ===
                0 && (
                <p className="p-6 text-center text-[13px] leading-5 text-muted-foreground">
                  Belum ada teman. Cari username temanmu di kolom di atas.
                </p>
              )}
            </>
          )}
        </>
      )}
    </div>
  );
}
