import { useState } from "react";
import { useSocialIdentity } from "@/lib/social/social-badges";
import {
  DEFAULT_PHOTO,
  DEFAULT_PHOTO_SMALL,
  isGooglePhotoUrl,
  sizedPhoto,
} from "@/lib/social/profile-photo";
import { cn } from "@/lib/utils";

/**
 * Avatar kecil bulat. Urutan: foto profil (Google/unggahan) → maskot ENO NIHONGO. Foto gagal dimuat
 * jatuh ke maskot (tidak pernah gambar rusak). `userId` hanya untuk mencari foto; tidak tampil di UI.
 */
export function SocialAvatar({
  size = 32,
  className,
  userId,
  photo,
}: {
  /** Dipertahankan untuk kompatibilitas data (`avatar_id`); belum ada avatar pilihan selain maskot. */
  avatarId?: number | null | undefined;
  size?: number;
  className?: string;
  userId?: string | null | undefined;
  photo?: string | null | undefined;
}) {
  const identity = useSocialIdentity(userId);
  const [failed, setFailed] = useState<string | null>(null);
  const url = photo ?? identity.photo;
  const useFallback = !url || failed === url;
  return (
    <img
      aria-hidden
      alt=""
      src={useFallback ? DEFAULT_PHOTO_SMALL : sizedPhoto(url, size * 2)}
      width={size}
      height={size}
      loading="lazy"
      decoding="async"
      referrerPolicy={isGooglePhotoUrl(url) ? "no-referrer" : undefined}
      onError={() => url && setFailed(url)}
      style={{ width: size, height: size }}
      className={cn("shrink-0 rounded-full bg-primary/10 object-cover", className)}
    />
  );
}

/** Foto besar untuk Profile Card (potret, `object-cover`, tanpa peregangan). */
export function ProfilePhoto({
  userId,
  photo,
  className,
}: {
  userId: string;
  photo?: string | null | undefined;
  className?: string;
}) {
  const identity = useSocialIdentity(userId);
  const [failed, setFailed] = useState<string | null>(null);
  const url = photo ?? identity.photo;
  const useFallback = !url || failed === url;
  return (
    <img
      alt=""
      aria-hidden
      src={useFallback ? DEFAULT_PHOTO : sizedPhoto(url, 640)}
      decoding="async"
      referrerPolicy={isGooglePhotoUrl(url) ? "no-referrer" : undefined}
      onError={() => url && setFailed(url)}
      data-testid="profile-photo"
      data-fallback={useFallback ? "true" : "false"}
      className={cn("size-full bg-primary/10 object-cover", className)}
    />
  );
}
