import { supabase } from "@/integrations/supabase/client";
import type {
  DmConversation,
  DmMessage,
  GlobalMessage,
  ProfileCardData,
  SearchResult,
  SocialMe,
  SocialOverview,
  UnreadSummary,
} from "./social-types";

/**
 * Semua penulisan Social/Chat lewat RPC database (identitas dari auth.uid() di server).
 * Galat database berisi kode (mis. `username_taken`); pesan untuk pengguna ada di social-validation.
 */
async function rpc<T>(name: string, args?: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.rpc(name as never, (args ?? {}) as never);
  if (error) throw new Error(error.message);
  return data as T;
}

export const PAGE_SIZE = 30;

export const socialApi = {
  me: () => rpc<SocialMe | null>("social_me"),
  setUsername: (username: string, displayName: string | null) =>
    rpc<SocialMe>("social_set_username", { p_username: username, p_display_name: displayName }),
  changeUsername: (username: string) =>
    rpc<SocialMe>("social_change_username", { p_username: username }),
  setPrivacy: (allowFriendRequests: boolean) =>
    rpc<SocialMe>("social_set_privacy", { p_allow_friend_requests: allowFriendRequests }),
  setSound: (enabled: boolean) => rpc<SocialMe>("social_set_sound", { p_enabled: enabled }),
  profileCard: (userId: string) => rpc<ProfileCardData>("social_profile_card", { p_user: userId }),
  reportUser: (userId: string, reason: string | null) =>
    rpc<{ status: string }>("social_report_user", { p_user: userId, p_reason: reason }),
  overview: () => rpc<SocialOverview>("social_overview"),
  search: (query: string) => rpc<SearchResult[]>("social_search_users", { p_query: query }),
  unread: () => rpc<UnreadSummary>("social_unread_summary"),

  sendRequest: (username: string) =>
    rpc<{ status: string }>("friend_request_send", { p_username: username }),
  respondRequest: (userId: string, accept: boolean) =>
    rpc<{ status: string }>("friend_request_respond", { p_user: userId, p_accept: accept }),
  cancelRequest: (userId: string) =>
    rpc<{ status: string }>("friend_request_cancel", { p_user: userId }),
  removeFriend: (userId: string) => rpc<{ status: string }>("friend_remove", { p_user: userId }),
  block: (userId: string) => rpc<{ status: string }>("social_block", { p_user: userId }),
  unblock: (userId: string) => rpc<{ status: string }>("social_unblock", { p_user: userId }),

  globalHistory: (before?: { at: string; id: string } | null, limit = PAGE_SIZE) =>
    rpc<GlobalMessage[]>("global_history", {
      p_limit: limit,
      p_before_at: before?.at ?? null,
      p_before_id: before?.id ?? null,
    }),
  globalSend: (body: string, replyTo: string | null) =>
    rpc<{ id: string }>("global_send_message", { p_body: body, p_reply_to: replyTo }),
  globalDelete: (id: string) => rpc<{ status: string }>("global_delete_message", { p_id: id }),
  globalMarkRead: () => rpc<{ status: string }>("global_mark_read"),

  dmList: () => rpc<DmConversation[]>("dm_conversation_list"),
  dmHistory: (withUser: string, before?: { at: string; id: string } | null, limit = PAGE_SIZE) =>
    rpc<DmMessage[]>("dm_history", {
      p_with: withUser,
      p_limit: limit,
      p_before_at: before?.at ?? null,
      p_before_id: before?.id ?? null,
    }),
  dmSend: (to: string, body: string, replyTo: string | null) =>
    rpc<{ id: string; conversation_id: string }>("dm_send", {
      p_to: to,
      p_body: body,
      p_reply_to: replyTo,
    }),
  dmDelete: (id: string) => rpc<{ status: string }>("dm_delete_message", { p_id: id }),
  dmMarkRead: (withUser: string) => rpc<{ status: string }>("dm_mark_read", { p_with: withUser }),

  report: (scope: "global" | "dm", messageId: string, reason: string | null) =>
    rpc<{ status: string }>("social_report_message", {
      p_scope: scope,
      p_message_id: messageId,
      p_reason: reason,
    }),
};
