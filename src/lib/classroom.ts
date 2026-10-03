import { supabase } from "@/integrations/supabase/client";
export const classroom = supabase;
export const categories = ["Umum", "Kosakata", "Kanji", "Tata bahasa", "Membaca", "Menyimak"];
type QueryResponse = { data: unknown; error: { message?: string } | null };
// Tanpa argumen tipe: tipe data diambil dari cabang sukses (error: null) union respons PostgREST, sehingga
// akurat untuk list, single, dan maybeSingle. Dengan argumen tipe eksplisit (RPC yang mengembalikan JSON),
// pemanggil menyatakan bentuk datanya.
export async function result<R extends QueryResponse>(
  request: PromiseLike<R>,
): Promise<Extract<R, { error: null }>["data"]>;
export async function result<T>(request: PromiseLike<QueryResponse>): Promise<T>;
export async function result(request: PromiseLike<QueryResponse>): Promise<unknown> {
  const response = await request;
  if (response.error) throw new Error(response.error.message || "Data kelas gagal diproses.");
  return response.data;
}
export type ClassContentTable =
  | "class_materials"
  | "class_assignments"
  | "class_quizzes"
  | "class_announcements"
  | "class_schedule";
export type ClassRecord = Record<string, unknown>;
type ClassContentQuery = PromiseLike<
  { data: ClassRecord[]; error: null } | { data: null; error: { message?: string } }
> & {
  eq(column: string, value: unknown): ClassContentQuery;
  order(column: string, options?: { ascending?: boolean }): ClassContentQuery;
};
type ClassContentTableApi = {
  select(columns?: string): ClassContentQuery;
  insert(row: ClassRecord): ClassContentQuery;
  update(row: ClassRecord): ClassContentQuery;
  delete(): ClassContentQuery;
};
// Halaman konten guru memilih tabel saat runtime (tab). Union nama tabel membuat tipe PostgREST terlalu dalam,
// jadi permukaan yang dipakai dinyatakan secara eksplisit di sini (bukan any).
export function classContentTable(name: ClassContentTable): ClassContentTableApi {
  return supabase.from(name) as unknown as ClassContentTableApi;
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
