import { useCallback, useEffect, useRef, useState } from "react";
import { mergeMessages, olderCursor } from "@/lib/social/message-merge";
import { PAGE_SIZE } from "@/lib/social/social-api";

type Timed = { id: string; created_at: string };

/**
 * Riwayat pesan dengan paginasi kursor + penggabungan hasil realtime tanpa duplikat.
 * `key` berubah -> mulai ulang. Pesan terbaru di indeks 0.
 */
export function useThread<T extends Timed>(
  key: string | null,
  fetchPage: (before: { at: string; id: string } | null) => Promise<T[]>,
) {
  const [messages, setMessages] = useState<T[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fetchRef = useRef(fetchPage);
  fetchRef.current = fetchPage;
  const messagesRef = useRef<T[]>([]);
  messagesRef.current = messages;
  const keyRef = useRef(key);
  keyRef.current = key;

  useEffect(() => {
    setMessages([]);
    setHasMore(false);
    setError(null);
    if (!key) return;
    let active = true;
    setLoading(true);
    fetchRef
      .current(null)
      .then((page) => {
        if (!active) return;
        setMessages(mergeMessages([], page));
        setHasMore(page.length >= PAGE_SIZE);
      })
      .catch((e: unknown) => {
        if (active) setError(e instanceof Error ? e.message : "error");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [key]);

  /** Ambil halaman terbaru lagi dan gabungkan (dipakai event realtime). */
  const refreshLatest = useCallback(async () => {
    const k = keyRef.current;
    if (!k) return;
    try {
      const page = await fetchRef.current(null);
      if (keyRef.current !== k) return;
      setMessages((cur) => mergeMessages(cur, page));
    } catch {
      /* realtime hanya pemicu; kegagalan tidak perlu mengganggu pengguna */
    }
  }, []);

  const loadOlder = useCallback(async () => {
    const k = keyRef.current;
    const cursor = olderCursor(messagesRef.current);
    if (!k || !cursor) return;
    setLoadingMore(true);
    try {
      const page = await fetchRef.current(cursor);
      if (keyRef.current !== k) return;
      setMessages((cur) => mergeMessages(cur, page));
      setHasMore(page.length >= PAGE_SIZE);
    } catch (e) {
      setError(e instanceof Error ? e.message : "error");
    } finally {
      setLoadingMore(false);
    }
  }, []);

  return { messages, loading, loadingMore, hasMore, error, refreshLatest, loadOlder, setMessages };
}
