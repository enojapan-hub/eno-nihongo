import { dock } from "./dock-state";
import { profileCard } from "./profile-card-state";
import { socialApi } from "./social-api";

/** action_url notifikasi sosial: "chat:friends" | "chat:profile:<userId>" | "chat:dm:<userId>". */
export type ChatLink =
  { kind: "friends" } | { kind: "profile"; userId: string } | { kind: "dm"; userId: string };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function parseChatLink(url: string | null | undefined): ChatLink | null {
  if (!url || !url.startsWith("chat:")) return null;
  const [, kind, id] = url.split(":");
  if (kind === "friends") return { kind: "friends" };
  if ((kind === "profile" || kind === "dm") && id && UUID.test(id)) return { kind, userId: id };
  return null;
}

/** Buka area yang sesuai tanpa pindah route. */
export async function openChatLink(link: ChatLink): Promise<void> {
  if (link.kind === "friends") {
    dock.open("friends");
    return;
  }
  if (link.kind === "profile") {
    profileCard.open(link.userId);
    return;
  }
  const card = await socialApi.profileCard(link.userId);
  if (card.has_username && card.username) {
    dock.openDm({
      user_id: link.userId,
      username: card.username,
      display_name: card.display_name,
      avatar_id: card.avatar_id,
    });
  } else {
    dock.open("chat");
  }
}
