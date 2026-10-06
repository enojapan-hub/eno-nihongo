import type { QueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { invalidateIdentityCaches } from "@/lib/identity-cache";
import {
  AVATAR_MAX_BYTES,
  AVATAR_SAVE_FAILED,
  AVATAR_TOO_LARGE,
  avatarObjectPath,
  avatarStorageErrorMessage,
} from "@/lib/avatar-upload";

export type AvatarSaveResult = { ok: true; url: string } | { ok: false; message: string };

/**
 * Unggah foto hasil crop ke folder milik sendiri (avatars/<uid>/…), lalu simpan URL ke profil.
 * Bila penyimpanan profil gagal, berkas yang baru diunggah dibersihkan dan sukses TIDAK diklaim.
 * Pesan galat selalu Indonesia; detail storage/SQL hanya masuk konsol.
 */
export async function saveAvatarFile(userId: string, file: File): Promise<AvatarSaveResult> {
  if (file.size > AVATAR_MAX_BYTES) return { ok: false, message: AVATAR_TOO_LARGE };
  const path = avatarObjectPath(userId, file.name.split(".").pop() || "jpg");
  const { error: uploadError } = await supabase.storage
    .from("avatars")
    .upload(path, file, { upsert: true, contentType: file.type, cacheControl: "3600" });
  if (uploadError) {
    console.error("[avatar] upload", uploadError.message);
    return { ok: false, message: avatarStorageErrorMessage(uploadError) };
  }
  const { data: publicUrl } = supabase.storage.from("avatars").getPublicUrl(path);
  const { error: profileError } = await supabase
    .from("profiles")
    .update({ avatar_url: publicUrl.publicUrl })
    .eq("id", userId);
  if (profileError) {
    console.error("[avatar] simpan", profileError.code);
    await supabase.storage
      .from("avatars")
      .remove([path])
      .catch(() => undefined);
    return { ok: false, message: AVATAR_SAVE_FAILED };
  }
  return { ok: true, url: publicUrl.publicUrl };
}

export async function restoreGoogleAvatar(
  userId: string,
  googleUrl: string,
): Promise<AvatarSaveResult> {
  const { error } = await supabase
    .from("profiles")
    .update({ avatar_url: googleUrl })
    .eq("id", userId);
  if (error) {
    console.error("[avatar] pulihkan Google", error.code);
    return { ok: false, message: "Foto Google belum berhasil dipulihkan. Silakan coba lagi." };
  }
  return { ok: true, url: googleUrl };
}

export async function refreshAvatarCaches(qc: QueryClient): Promise<void> {
  await Promise.all([
    qc.invalidateQueries({ queryKey: ["my-account"] }),
    qc.invalidateQueries({ queryKey: ["my-account-direct"] }),
    qc.invalidateQueries({ queryKey: ["my-account-edit"] }),
    qc.invalidateQueries({ queryKey: ["my-account-profile"] }),
    invalidateIdentityCaches(qc),
  ]);
}
