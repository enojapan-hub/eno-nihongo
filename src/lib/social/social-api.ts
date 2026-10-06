import { supabase } from "@/integrations/supabase/client";
import type {
  AdminChatReport,
  DmConversation,
  GlobalConfig,
  ReportCategory,
  DmPolicy,
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

/** Isolasi fitur: respons daftar yang bukan array (server bermasalah/format tak terduga) menjadi daftar kosong, bukan error render. */
async function rpcList<T>(name: string, args?: Record<string, unknown>): Promise<T[]> {
  const data = await rpc<unknown>(name, args);
  return Array.isArray(data) ? (data as T[]) : [];
}

export const socialApi = {
  me: () => rpc<SocialMe | null>("social_me"),
  setUsername: (username: string, displayName: string | null) =>
    rpc<SocialMe>("social_set_username", { p_username: username, p_display_name: displayName }),
  changeUsername: (username: string) =>
    rpc<SocialMe>("social_change_username", { p_username: username }),
  setPrivacy: (allowFriendRequests: boolean) =>
    rpc<SocialMe>("social_set_privacy", { p_allow_friend_requests: allowFriendRequests }),
  setSound: (enabled: boolean) => rpc<SocialMe>("social_set_sound", { p_enabled: enabled }),
  profileCard: (userId: string, publicView = false) =>
    publicView
      ? rpc<ProfileCardData>("social_profile_card", { p_user: userId, p_public: true })
      : rpc<ProfileCardData>("social_profile_card", { p_user: userId }),
  updateSettings: (s: {
    show_online?: boolean;
    show_country?: boolean;
    show_jlpt?: boolean;
    show_xp?: boolean;
    dm_policy?: DmPolicy;
  }) =>
    rpc<SocialMe>("social_update_settings", {
      p_show_online: s.show_online ?? null,
      p_show_country: s.show_country ?? null,
      p_show_jlpt: s.show_jlpt ?? null,
      p_show_xp: s.show_xp ?? null,
      p_dm_policy: s.dm_policy ?? null,
    }),
  dmMute: (userId: string, muted: boolean) =>
    rpc<{ muted: boolean }>("dm_set_mute", { p_user: userId, p_muted: muted }),
  reportUser: (userId: string, reason: string | null, category: ReportCategory = "other") =>
    rpc<{ status: string }>("social_report_submit", {
      p_scope: "user",
      p_target: userId,
      p_category: category,
      p_reason: reason,
    }),
  userByUsername: (username: string) =>
    rpc<{ user_id: string } | null>("social_user_by_username", { p_username: username }),
  overview: () => rpc<SocialOverview>("social_overview"),
  search: (query: string) => rpcList<SearchResult>("social_search_users", { p_query: query }),
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
    rpcList<GlobalMessage>("global_history", {
      p_limit: limit,
      p_before_at: before?.at ?? null,
      p_before_id: before?.id ?? null,
    }),
  globalSend: (body: string, replyTo: string | null) =>
    rpc<{ id: string }>("global_send_message", { p_body: body, p_reply_to: replyTo }),
  globalDelete: (id: string) => rpc<{ status: string }>("global_delete_message", { p_id: id }),
  globalMarkRead: () => rpc<{ status: string }>("global_mark_read"),

  dmList: () => rpcList<DmConversation>("dm_conversation_list"),
  dmHistory: (withUser: string, before?: { at: string; id: string } | null, limit = PAGE_SIZE) =>
    rpcList<DmMessage>("dm_history", {
      p_with: withUser,
      p_limit: limit,
      p_before_at: before?.at ?? null,
      p_before_id: before?.id ?? null,
    }),
  dmSend: (to: string, body: string, replyTo: string | null, clientId?: string) =>
    rpc<{ id: string; conversation_id: string; duplicate?: boolean }>("dm_send_message", {
      p_to: to,
      p_body: body,
      p_reply_to: replyTo,
      p_client_id: clientId ?? null,
    }),
  dmDelete: (id: string) => rpc<{ status: string }>("dm_delete_message", { p_id: id }),
  dmMarkRead: (withUser: string) => rpc<{ status: string }>("dm_mark_read", { p_with: withUser }),

  report: (
    scope: "global" | "dm",
    messageId: string,
    reason: string | null,
    category: ReportCategory = "other",
  ) =>
    rpc<{ status: string }>("social_report_submit", {
      p_scope: scope,
      p_target: messageId,
      p_category: category,
      p_reason: reason,
    }),

  globalEdit: (id: string, body: string) =>
    rpc<{ status: string }>("global_edit_message", { p_id: id, p_body: body }),
  dmEdit: (id: string, body: string) =>
    rpc<{ status: string }>("dm_edit_message", { p_id: id, p_body: body }),
  dmHide: (withUser: string) =>
    rpc<{ status: string }>("dm_conversation_hide", { p_with: withUser }),

  globalConfig: () => rpc<GlobalConfig>("global_config"),
  setSlowMode: (seconds: number) =>
    rpc<GlobalConfig>("global_set_slow_mode", { p_seconds: seconds }),
  setPin: (text: string | null) => rpc<GlobalConfig>("global_set_pin", { p_text: text ?? "" }),

  adminReports: (status: string) =>
    rpc<AdminChatReport[]>("social_admin_reports", { p_status: status, p_limit: 50 }),
  adminResolveReport: (
    id: string,
    action: "reviewing" | "resolve" | "reject" | "suspend",
    note: string | null,
  ) =>
    rpc<{ status: string }>("social_admin_report_resolve", {
      p_id: id,
      p_action: action,
      p_note: note,
    }),
  adminSocialSuspend: (userId: string, suspend: boolean, reason: string | null) =>
    rpc<{ status: string }>("social_admin_suspend", {
      p_user: userId,
      p_suspend: suspend,
      p_reason: reason,
    }),
};
