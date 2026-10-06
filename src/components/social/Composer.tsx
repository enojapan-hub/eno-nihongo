import { Send, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { getDraft, setDraft } from "@/lib/social/chat-drafts";
import { isEffectivelyEmpty, socialErrorMessage } from "@/lib/social/social-validation";

/**
 * Kotak kirim pesan. Enter mengirim, Shift+Enter baris baru; Enter yang menutup komposisi IME
 * (Jepang/Mandarin) TIDAK mengirim. Pesan berisi hanya spasi/zero-width/kontrol ditolak di klien dan
 * di server. Draf disimpan di memori per `draftKey` (bukan database) dan dibuang saat logout/ganti akun.
 */
export function Composer({
  max,
  disabledReason,
  replyLabel,
  onCancelReply,
  onSend,
  draftKey,
}: {
  max: number;
  disabledReason?: string | null | undefined;
  replyLabel?: string | null | undefined;
  onCancelReply?: (() => void) | undefined;
  onSend: (body: string) => Promise<void>;
  draftKey?: string | undefined;
}) {
  const [text, setText] = useState(() => getDraft(draftKey));
  const [busy, setBusy] = useState(false);
  const ref = useRef<HTMLTextAreaElement>(null);
  const composing = useRef(false);
  const trimmed = text.trim();
  const sendable = trimmed !== "" && !isEffectivelyEmpty(trimmed);
  const remaining = max - text.length;

  useEffect(() => {
    setText(getDraft(draftKey));
  }, [draftKey]);

  function change(v: string) {
    setText(v);
    setDraft(draftKey, v);
  }

  async function submit() {
    if (!sendable || busy || disabledReason) return;
    setBusy(true);
    try {
      await onSend(trimmed);
      change("");
      ref.current?.focus();
    } catch (e) {
      toast.error(socialErrorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  if (disabledReason)
    return (
      <p className="border-t px-3 py-3 text-center text-[12px] text-muted-foreground">
        {disabledReason}
      </p>
    );
  return (
    <div className="border-t bg-background px-2 pb-2 pt-1.5">
      {replyLabel && (
        <div className="mb-1 flex items-center gap-1 rounded-lg bg-muted/60 px-2 py-1 text-[11px] text-muted-foreground">
          <span className="min-w-0 flex-1 truncate">Membalas {replyLabel}</span>
          <button
            type="button"
            aria-label="Batalkan balasan"
            onClick={onCancelReply}
            className="grid size-6 place-items-center"
          >
            <X className="size-3.5" />
          </button>
        </div>
      )}
      <div className="flex items-end gap-1.5">
        <textarea
          ref={ref}
          value={text}
          rows={1}
          maxLength={max}
          aria-label="Tulis pesan"
          placeholder="Tulis pesan…"
          onChange={(e) => change(e.target.value)}
          onCompositionStart={() => {
            composing.current = true;
          }}
          onCompositionEnd={() => {
            composing.current = false;
          }}
          onKeyDown={(e) => {
            if (e.key !== "Enter" || e.shiftKey) return;
            // IME: Enter yang mengonfirmasi konversi (isComposing / keyCode 229) bukan perintah kirim.
            if (composing.current || e.nativeEvent.isComposing || e.keyCode === 229) return;
            e.preventDefault();
            void submit();
          }}
          className="max-h-24 min-h-10 flex-1 resize-none rounded-2xl border bg-background px-3 py-2 text-[16px] leading-5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary md:text-[14px]"
        />
        <button
          type="button"
          aria-label="Kirim"
          disabled={!sendable || busy}
          onClick={() => void submit()}
          className="grid size-10 shrink-0 place-items-center rounded-full bg-primary text-primary-foreground disabled:opacity-40"
        >
          <Send className="size-4" />
        </button>
      </div>
      {remaining <= Math.ceil(max * 0.15) && (
        <p
          data-testid="composer-counter"
          className={`mt-0.5 text-right text-[10px] ${remaining <= 0 ? "text-destructive" : "text-muted-foreground"}`}
          aria-live="polite"
        >
          {text.length}/{max}
        </p>
      )}
    </div>
  );
}
