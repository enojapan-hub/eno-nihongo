/** Latihan Chōkai hanya aktif bila audio sumber yang valid tersedia; TTS bukan pengganti audio. */
export function hasValidChoukaiAudio(item: { audio_url?: string | null }): boolean {
  const url = item.audio_url?.trim();
  if (!url) return false;
  try {
    const parsed = new URL(url, "https://placeholder.invalid");
    return parsed.protocol === "https:" || parsed.protocol === "http:" || url.startsWith("/");
  } catch {
    return false;
  }
}
