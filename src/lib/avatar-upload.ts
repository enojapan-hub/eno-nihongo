/** Aturan unggah foto profil (bucket avatars: jpeg/png/webp/gif, maks 5 MB, folder = id pengguna). */
export const AVATAR_MAX_BYTES = 5 * 1024 * 1024;
export const AVATAR_ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"] as const;
export const AVATAR_MAX_DIMENSION = 1024;

export const AVATAR_NOT_IMAGE = "Pilih file gambar (JPG, PNG, atau WebP).";
export const AVATAR_PROCESS_FAILED =
  "Foto tidak dapat diproses. Coba foto lain dengan format JPG, PNG, atau WebP.";
export const AVATAR_TOO_LARGE = "Ukuran foto terlalu besar. Pilih foto lain.";
export const AVATAR_UPLOAD_FAILED = "Foto belum berhasil diunggah. Silakan coba lagi.";
export const AVATAR_SAVE_FAILED =
  "Foto terunggah tetapi belum berhasil disimpan ke profil. Silakan coba lagi.";

export const isImageFile = (file: { type: string }) => file.type.startsWith("image/");

export const isAllowedAvatarType = (type: string) =>
  (AVATAR_ALLOWED_TYPES as readonly string[]).includes(type);

/** Foto iPhone/kamera sering >5 MB atau HEIC: dikecilkan/dikonversi ke JPEG sebelum diunggah. */
export const needsReencode = (file: { type: string; size: number }) =>
  !isAllowedAvatarType(file.type) || file.size > AVATAR_MAX_BYTES;

export function avatarObjectPath(userId: string, extension: string, now = Date.now()): string {
  const ext = extension.toLowerCase().replace(/[^a-z0-9]/g, "") || "jpg";
  return `${userId}/profile-${now}.${ext}`;
}

/** Ukuran akhir (sisi terpanjang tidak melebihi batas, rasio tetap). */
export function fitWithin(width: number, height: number, max = AVATAR_MAX_DIMENSION) {
  const scale = Math.min(1, max / Math.max(width, height));
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}

/** Pesan Indonesia untuk kegagalan storage; pesan mentah tidak ditampilkan. */
export function avatarStorageErrorMessage(error: unknown): string {
  const text = String(
    (error && typeof error === "object" && "message" in error
      ? (error as { message?: unknown }).message
      : error) ?? "",
  );
  if (/exceeded the maximum|too large|payload too large|413/i.test(text)) return AVATAR_TOO_LARGE;
  if (/mime|not supported|invalid.*type/i.test(text)) return AVATAR_NOT_IMAGE;
  return AVATAR_UPLOAD_FAILED;
}

/** Decode + skala + JPEG di browser (Safari dapat mendecode HEIC). Melempar bila tidak dapat diproses. */
export async function reencodeToJpeg(file: File, quality = 0.86): Promise<File> {
  let bitmap: ImageBitmap | HTMLImageElement;
  let width: number;
  let height: number;
  if (typeof createImageBitmap === "function") {
    bitmap = await createImageBitmap(file);
    width = bitmap.width;
    height = bitmap.height;
  } else {
    const url = URL.createObjectURL(file);
    try {
      const img = new Image();
      img.src = url;
      await img.decode();
      bitmap = img;
      width = img.naturalWidth;
      height = img.naturalHeight;
    } finally {
      URL.revokeObjectURL(url);
    }
  }
  const size = fitWithin(width, height);
  const canvas = document.createElement("canvas");
  canvas.width = size.width;
  canvas.height = size.height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("canvas_unavailable");
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, size.width, size.height);
  ctx.drawImage(bitmap, 0, 0, size.width, size.height);
  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, "image/jpeg", quality),
  );
  if (!blob) throw new Error("encode_failed");
  const base = file.name.replace(/\.[^.]+$/, "") || "foto";
  return new File([blob], `${base}.jpg`, { type: "image/jpeg" });
}
