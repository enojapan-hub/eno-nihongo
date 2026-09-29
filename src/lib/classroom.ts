import { supabase } from "@/integrations/supabase/client";
export const classroom = supabase as any;
export const categories = ["Umum", "Kosakata", "Kanji", "Tata bahasa", "Membaca", "Menyimak"];
export async function result<T = any>(request: PromiseLike<{ data: T; error: any }>): Promise<T> {
  const { data, error } = await request;
  if (error) throw new Error(error.message || "Data kelas gagal diproses.");
  return data;
}
export function localDateTime(value?: string | null) {
  if (!value) return "";
  const date = new Date(value);
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
}
export function isoDate(value: string) {
  return value ? new Date(value).toISOString() : null;
}
export function secureUrl(value?: string | null) {
  if (!value) return null;
  try {
    const url = new URL(value);
    return url.protocol === "https:" ? url.href : null;
  } catch {
    return null;
  }
}
export function sessionTime(start: string, end?: string | null) {
  return ["Asia/Jakarta", "Asia/Tokyo"]
    .map((timeZone, index) => {
      const begin = new Date(start).toLocaleString("id-ID", {
        timeZone,
        dateStyle: "medium",
        timeStyle: "short",
      });
      const finish = end
        ? new Date(end).toLocaleTimeString("id-ID", {
            timeZone,
            hour: "2-digit",
            minute: "2-digit",
          })
        : "";
      return begin + (finish ? "–" + finish : "") + " " + (index === 0 ? "WIB" : "JST");
    })
    .join(" / ");
}
export async function openClassAttachment(path: string) {
  const legacy = secureUrl(path);
  if (legacy) {
    window.open(legacy, "_blank", "noopener,noreferrer");
    return;
  }
  // Open immediately so mobile browsers do not block a window after the async request.
  const tab = window.open("about:blank", "_blank");
  if (tab) tab.opener = null;
  try {
    const data = await result(supabase.storage.from("class-submissions").createSignedUrl(path, 60));
    if (!data?.signedUrl) throw new Error("Lampiran tidak dapat dibuka.");
    if (tab) tab.location.href = data.signedUrl;
    else window.location.assign(data.signedUrl);
  } catch (error) {
    tab?.close();
    throw error;
  }
}
