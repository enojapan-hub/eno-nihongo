export type SocialIdentity = {
  user_id: string;
  username: string;
  display_name: string | null;
  avatar_id: number;
};

export type SocialMe = {
  has_username: boolean;
  user_id?: string;
  username?: string;
  display_name?: string | null;
  avatar_id?: number;
  is_moderator: boolean;
  allow_friend_requests?: boolean;
  /** Suara pesan masuk (default aktif). */
  sound_enabled?: boolean;
  /** ISO; null bila username boleh diubah sekarang (ditentukan server). */
  next_username_change_at?: string | null;
};

export type ReplyPreview = {
  id: string;
  username?: string;
  sender_id?: string;
  body: string;
  deleted: boolean;
};

export type GlobalMessage = {
  id: string;
  sender_id: string;
  username: string;
  display_name: string | null;
  avatar_id: number;
  body: string;
  deleted: boolean;
  created_at: string;
  reply_to: string | null;
  reply: ReplyPreview | null;
};

export type DmMessage = {
  id: string;
  sender_id: string;
  body: string;
  deleted: boolean;
  created_at: string;
  reply_to: string | null;
  reply: ReplyPreview | null;
};

export type DmConversation = SocialIdentity & {
  last_message_at: string;
  last_body: string | null;
  last_deleted: boolean;
  last_sender_id: string;
  unread: number;
  is_friend: boolean;
};

export type SearchResult = SocialIdentity & {
  relation: "friend" | "incoming" | "outgoing" | "none";
};

export type SocialOverview = {
  friends: SocialIdentity[];
  incoming: SocialIdentity[];
  outgoing: SocialIdentity[];
  blocked: SocialIdentity[];
};

export type UnreadSummary = { global: number; dm: number; requests: number };

export type CardRelation =
  "self" | "friend" | "incoming" | "outgoing" | "none" | "blocked" | "unavailable";

/** Data sosial aman untuk Profile Card: tanpa email, UUID render, role, atau izin. */
export type ProfileCardData = {
  has_username: boolean;
  username: string | null;
  display_name: string | null;
  avatar_id: number;
  /** URL foto yang sudah disaring server (Google / bucket avatars), atau null. */
  photo: string | null;
  bio: string | null;
  country: string | null;
  xp: number;
  /** Level JLPT (N5–N1). Level Akun dihitung dari `xp` (lib/progression). */
  level: string | null;
  relation: CardRelation;
  viewer_has_username: boolean;
  can_request: boolean;
};
