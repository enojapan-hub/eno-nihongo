import { Send, X } from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { socialErrorMessage } from "@/lib/social/social-validation";

/** Kotak kirim pesan. Enter mengirim, Shift+Enter baris baru. Panjang dibatasi juga di database. */
export function Composer({
  max,
  disabledReason,
  replyLabel,
  onCancelReply,
  onSend,
}: {
  max: number;
  disabledReason?: string | null | undefined;
  replyLabel?: string | null | undefined;
  onCancelReply?: (() => void) | undefined;
  onSend: (body: string) => Promise<void>;
}) {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const ref = useRef<HTMLTextAreaElement>(null);
  const trimmed = text.trim();

  async function submit() {
    if (!trimmed || busy || disabledReason) return;
    setBusy(true);
    try {
      await onSend(trimmed);
      setText("");
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
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              void submit();
            }
          }}
          className="max-h-24 min-h-10 flex-1 resize-none rounded-2xl border bg-background px-3 py-2 text-[16px] leading-5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary md:text-[14px]"
        />
        <button
          type="button"
          aria-label="Kirim"
          disabled={!trimmed || busy}
          onClick={() => void submit()}
          className="grid size-10 shrink-0 place-items-center rounded-full bg-primary text-primary-foreground disabled:opacity-40"
        >
          <Send className="size-4" />
        </button>
      </div>
    </div>
  );
}
