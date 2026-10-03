import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Image, Music, Search, Trash2, Upload } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
export const Route = createFileRoute("/_authenticated/admin-media")({ component: Page });
function Page() {
  const qc = useQueryClient(),
    [search, setSearch] = useState(""),
    [title, setTitle] = useState(""),
    [file, setFile] = useState<File | null>(null),
    [busy, setBusy] = useState(false),
    [msg, setMsg] = useState("");
  const q = useQuery({
    queryKey: ["admin-media-library"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("media_library")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(500);
      if (error) throw error;
      return data || [];
    },
    retry: false,
  });
  const rows = useMemo(
    () =>
      (q.data || []).filter(
        (x) =>
          !search ||
          String(x.title || "")
            .toLowerCase()
            .includes(search.toLowerCase()) ||
          String(x.media_type || "").includes(search.toLowerCase()),
      ),
    [q.data, search],
  );
  async function upload() {
    if (!file || !title.trim()) return;
    setBusy(true);
    setMsg("");
    const ext = file.name.split(".").pop()?.toLowerCase() || "bin",
      path =
        (file.type.startsWith("audio/") ? "audio/" : "image/") + crypto.randomUUID() + "." + ext;
    const { error: u } = await supabase.storage
      .from("admin-media")
      .upload(path, file, { contentType: file.type, upsert: false });
    if (u) {
      setBusy(false);
      setMsg(u.message);
      return;
    }
    const { data: url } = supabase.storage.from("admin-media").getPublicUrl(path);
    const type = file.type.startsWith("audio/") ? "audio" : "image";
    const { error: r } = await supabase.rpc("admin_register_media", {
      p_title: title.trim(),
      p_url: url.publicUrl,
      p_media_type: type,
      // p_mime_type bernilai NULL secara default di database; cukup dihilangkan bila kosong.
      ...(file.type ? { p_mime_type: file.type } : {}),
    });
    if (r) {
      await supabase.storage.from("admin-media").remove([path]);
      setBusy(false);
      setMsg(r.message);
      return;
    }
    setFile(null);
    setTitle("");
    setBusy(false);
    setMsg("Media berhasil diunggah.");
    qc.invalidateQueries({ queryKey: ["admin-media-library"] });
  }
  async function del(x: { id: string; url: string }) {
    if (!confirm("Hapus media ini? Sistem akan menolak jika masih digunakan konten.")) return;
    setBusy(true);
    setMsg("");
    const { error } = await supabase.rpc("admin_delete_media", { p_id: x.id });
    if (error) {
      setBusy(false);
      setMsg(error.message);
      return;
    }
    try {
      const u = new URL(x.url),
        marker = "/storage/v1/object/public/admin-media/",
        i = u.pathname.indexOf(marker);
      if (i >= 0) {
        const p = decodeURIComponent(u.pathname.slice(i + marker.length));
        await supabase.storage.from("admin-media").remove([p]);
      }
    } catch {
      setMsg(
        "Media dihapus dari library, tetapi pembersihan file storage tidak dapat diverifikasi.",
      );
    }
    setBusy(false);
    setMsg("Media dihapus dari library.");
    qc.invalidateQueries({ queryKey: ["admin-media-library"] });
  }
  return (
    <AppShell title="Media Manager" backTo="/admin">
      <div className="mx-auto max-w-5xl space-y-4 pb-10">
        <section className="rounded-[2rem] bg-gradient-to-br from-primary to-emerald-800 p-5 text-white">
          <Upload className="size-6" />
          <h1 className="mt-2 text-2xl font-black">Media Manager</h1>
          <p className="text-xs text-white/75">
            Upload, preview, pencarian dan safe-delete gambar/audio.
          </p>
        </section>
        {msg && <p className="rounded-xl bg-muted p-3 text-xs">{msg}</p>}
        <Card>
          <CardContent className="grid gap-3 p-4 sm:grid-cols-[1fr_1fr_auto]">
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Judul media"
            />
            <Input
              type="file"
              accept="image/jpeg,image/png,image/webp,audio/mpeg,audio/wav,audio/webm"
              onChange={(e) => setFile(e.target.files?.[0] || null)}
            />
            <Button disabled={busy || !file || !title.trim()} onClick={upload}>
              <Upload className="mr-1 size-4" />
              Upload
            </Button>
            <p className="sm:col-span-3 text-[10px] text-muted-foreground">
              Gambar JPG/PNG/WebP atau audio MP3/WAV/WebM · maksimum bucket 50 MB.
            </p>
          </CardContent>
        </Card>
        <div className="relative">
          <Search className="absolute left-3 top-2.5 size-4 text-muted-foreground" />
          <Input
            className="pl-9"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Cari media…"
          />
        </div>
        <div className="grid gap-2 sm:grid-cols-2">
          {rows.map((x) => (
            <Card key={x.id}>
              <CardContent className="p-3">
                <div className="flex gap-3">
                  {x.media_type === "image" ? (
                    <div className="size-20 shrink-0 overflow-hidden rounded-xl bg-muted">
                      <img src={x.url} alt="" className="size-full object-cover" />
                    </div>
                  ) : (
                    <div className="grid size-20 shrink-0 place-items-center rounded-xl bg-primary/10">
                      <Music className="size-6 text-primary" />
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-black">{x.title}</p>
                    <p className="text-[9px] text-muted-foreground">
                      {x.mime_type || x.media_type}
                    </p>
                    {x.media_type === "audio" && (
                      <audio className="mt-2 h-8 w-full" controls preload="none" src={x.url} />
                    )}
                    <div className="mt-2 flex gap-2">
                      <a
                        href={x.url}
                        target="_blank"
                        rel="noreferrer"
                        className="text-[10px] font-bold text-primary"
                      >
                        Buka
                      </a>
                      <button
                        disabled={busy}
                        onClick={() => del(x)}
                        className="flex items-center gap-1 text-[10px] font-bold text-destructive"
                      >
                        <Trash2 className="size-3" />
                        Hapus aman
                      </button>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
        {!q.isLoading && !rows.length && (
          <p className="rounded-xl bg-muted p-4 text-xs text-muted-foreground">
            Tidak ada media yang cocok.
          </p>
        )}
      </div>
    </AppShell>
  );
}
