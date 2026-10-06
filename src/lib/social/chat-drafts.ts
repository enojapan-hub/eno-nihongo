/**
 * Draf pesan di memori (bukan database, bukan localStorage): bertahan saat panel ditutup/dibuka,
 * hilang saat logout atau ganti akun (`resetDrafts`) dan saat tab ditutup.
 */
const drafts = new Map<string, string>();

export function getDraft(key: string | null | undefined): string {
  return key ? (drafts.get(key) ?? "") : "";
}

export function setDraft(key: string | null | undefined, text: string) {
  if (!key) return;
  if (text === "") drafts.delete(key);
  else drafts.set(key, text);
}

export function resetDrafts() {
  drafts.clear();
}
