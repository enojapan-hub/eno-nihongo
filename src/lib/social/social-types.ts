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
