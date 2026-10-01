import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Camera, ImagePlus, RefreshCcw, UserRound } from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { AppShell } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/profil-foto")({ component: ProfilePhotoPage });

type PhotoData = { userId: string; name: string; current: string; google: string };

async function fetchPhotoData(): Promise<PhotoData> {
  const { data: auth, error } = await supabase.auth.getUser();
  if (error || !auth.user) throw new Error("Sesi akun tidak ditemukan.");
  const metadata = auth.user.user_metadata ?? {};
  const google = String(metadata.avatar_url ?? metadata.picture ?? "");
  const { data: profile, error: profileError } = await supabase.from("profiles").select("display_name,avatar_url").eq("id", auth.user.id).maybeSingle();
  if (profileError) throw new Error(profileError.message);
  return {
    userId: auth.user.id,
    name: profile?.display_name?.trim() || String(metadata.full_name ?? metadata.name ?? "Pengguna ENO NIHONGO"),
    current: profile?.avatar_url || google,
    google,
  };
}

function ProfilePhotoPage() {
  const qc = useQueryClient();
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const query = useQuery({ queryKey: ["profile-photo"], queryFn: fetchPhotoData, staleTime: 0 });

  const restoreGoogle = useMutation({
    mutationFn: async () => {
      if (!query.data?.google) throw new Error("Foto Google tidak tersedia.");
      const { error } = await supabase.from("profiles").update({ avatar_url: query.data.google }).eq("id", query.data.userId);
      if (error) throw new Error(error.message);
    },
    onSuccess: async () => {
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["profile-photo"] }),
        qc.invalidateQueries({ queryKey: ["my-account"] }),
        qc.invalidateQueries({ queryKey: ["my-account-direct"] }),
        qc.invalidateQueries({ queryKey: ["leaderboard"] }),
      ]);
      toast.success("Foto profil disinkronkan kembali dengan akun Google.");
    },
    onError: e => toast.error(e instanceof Error ? e.message : "Foto Google gagal dipulihkan."),
  });

  async function upload(file?: File) {
    if (!file || !query.data) return;
    if (!file.type.startsWith("image/")) { toast.error("Pilih file gambar."); return; }
    if (file.size > 5 * 1024 * 1024) { toast.error("Ukuran foto maksimal 5 MB."); return; }
    setUploading(true);
    try {
      const ext = (file.name.split(".").pop() || "jpg").toLowerCase().replace(/[^a-z0-9]/g, "") || "jpg";
      const path = `${query.data.userId}/profile-${Date.now()}.${ext}`;
      const { error: uploadError } = await supabase.storage.from("avatars").upload(path, file, { upsert: true, contentType: file.type, cacheControl: "3600" });
      if (uploadError) throw uploadError;
      const { data: publicUrl } = supabase.storage.from("avatars").getPublicUrl(path);
      const { error: profileError } = await supabase.from("profiles").update({ avatar_url: publicUrl.publicUrl }).eq("id", query.data.userId);
      if (profileError) throw profileError;
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["profile-photo"] }),
        qc.invalidateQueries({ queryKey: ["my-account"] }),
        qc.invalidateQueries({ queryKey: ["my-account-direct"] }),
        qc.invalidateQueries({ queryKey: ["leaderboard"] }),
      ]);
      toast.success("Foto profil berhasil diganti.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Foto profil gagal diunggah.");
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return <AppShell title="Foto Profil" backTo="/profil" backLabel="Profil" compact>
    <div className="mx-auto max-w-md space-y-4">
      <div><h1 className="text-[20px] font-bold">Foto Profil</h1><p className="mt-1 text-[10px] leading-4 text-muted-foreground">Saat pertama login, foto mengikuti akun Google. Kamu dapat menggantinya kapan saja tanpa mengubah foto di Google.</p></div>
      {query.isLoading ? <Card><CardContent className="py-12 text-center text-xs text-muted-foreground">Memuat foto profil…</CardContent></Card> : query.isError || !query.data ? <Card><CardContent className="py-10 text-center text-xs text-destructive">Foto profil gagal dimuat.</CardContent></Card> : <>
        <Card className="rounded-3xl"><CardContent className="p-6 text-center">
          <div className="relative mx-auto size-28">
            {query.data.current ? <img src={query.data.current} alt={query.data.name} className="size-28 rounded-full border-4 border-background object-cover shadow-lg" /> : <div className="grid size-28 place-items-center rounded-full bg-primary/10 text-primary"><UserRound className="size-10"/></div>}
            <span className="absolute bottom-0 right-0 grid size-9 place-items-center rounded-full border-4 border-background bg-primary text-primary-foreground"><Camera className="size-4"/></span>
          </div>
          <h2 className="mt-4 text-[16px] font-bold">{query.data.name}</h2>
          <p className="mt-1 text-[10px] text-muted-foreground">Foto ini digunakan di Home, Profil, dan Leaderboard.</p>
          <input ref={inputRef} type="file" accept="image/jpeg,image/png,image/webp,image/gif" className="hidden" onChange={e => void upload(e.target.files?.[0])}/>
          <Button className="mt-5 w-full rounded-xl" disabled={uploading} onClick={() => inputRef.current?.click()}><ImagePlus className="mr-2 size-4"/>{uploading ? "Mengunggah…" : "Pilih Foto Baru"}</Button>
          {query.data.google && <Button variant="outline" className="mt-2 w-full rounded-xl" disabled={restoreGoogle.isPending} onClick={() => restoreGoogle.mutate()}><RefreshCcw className="mr-2 size-4"/>Gunakan Foto Google</Button>}
        </CardContent></Card>
        <Link to="/profil" className="block text-center text-[11px] font-semibold text-primary">Kembali ke Profil</Link>
      </>}
    </div>
  </AppShell>;
}
