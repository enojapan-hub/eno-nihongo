import { ArrowRight, Layers } from "lucide-react";

/**
 * Shown only after "Pelajari" has been saved successfully for the current item.
 * The learner chooses to move on; nothing redirects automatically.
 */
export function ContinueToFlashcard() {
  return (
    <a
      href="/hafalan"
      className="mt-3 flex items-center gap-3 rounded-2xl border border-primary/25 bg-primary/[.06] p-3 transition-colors hover:border-primary/40"
    >
      <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
        <Layers className="size-4" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[12px] font-bold">Progres tersimpan</span>
        <span className="block text-[10px] text-muted-foreground">
          Hafalkan materi ini di Flashcard.
        </span>
      </span>
      <span className="flex items-center gap-1 text-[11px] font-bold text-primary">
        Lanjut ke Flashcard <ArrowRight className="size-3.5" />
      </span>
    </a>
  );
}
