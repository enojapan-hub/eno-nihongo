import { Clock3, Pause, X } from "lucide-react";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { formatExamTime } from "@/lib/exam-focus";

/** Sticky exam header replacing the ENO app header while an exam is active (single timer, passed in). */
export function ExamHeader({
  title,
  remaining,
  onExit,
  children,
}: {
  title: string;
  remaining: number;
  onExit: () => void;
  children?: ReactNode;
}) {
  const low = remaining <= 300;
  return (
    <div className="sticky top-0 z-40 -mx-3 border-b bg-background/95 px-3 pt-[env(safe-area-inset-top)] backdrop-blur-xl">
      <div className="mx-auto flex h-14 max-w-2xl items-center md:max-w-3xl lg:max-w-4xl justify-between gap-2">
        <button
          type="button"
          onClick={onExit}
          className="inline-flex h-10 shrink-0 items-center gap-1.5 rounded-xl border px-3 text-xs font-semibold"
        >
          <X className="size-4" />
          Keluar
        </button>
        <span className="hidden min-w-0 flex-1 truncate text-center font-jp text-[11px] font-semibold text-muted-foreground min-[420px]:block">
          {title}
        </span>
        <span
          role="timer"
          aria-label="Sisa waktu"
          className={`inline-flex shrink-0 items-center gap-1.5 rounded-xl px-3 py-1.5 font-mono text-2xl font-black leading-none tabular-nums ${low ? "bg-destructive/10 text-destructive" : "bg-primary/10 text-primary"}`}
        >
          <Clock3 className="size-5" />
          {formatExamTime(remaining)}
        </span>
      </div>
      {children && (
        <div className="mx-auto max-w-2xl pb-2 md:max-w-3xl lg:max-w-4xl">{children}</div>
      )}
    </div>
  );
}

type DialogProps = {
  open: boolean;
  finishing: boolean;
  finishHint: string;
  onContinue: () => void;
  onFinish: () => void;
  onPause?: (() => void) | undefined;
};

/** Confirmation shown before leaving the exam: a single tap on Keluar never ends it. */
export function ExamExitDialog({
  open,
  finishing,
  finishHint,
  onContinue,
  onFinish,
  onPause,
}: DialogProps) {
  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] pt-[calc(1rem+env(safe-area-inset-top))]"
      role="dialog"
      aria-modal="true"
      aria-labelledby="exam-exit-title"
    >
      <Card className="w-full max-w-sm rounded-2xl">
        <CardContent className="p-5">
          <h2 id="exam-exit-title" className="font-bold">
            Keluar dari ujian?
          </h2>
          <p className="mt-2 text-xs leading-5 text-muted-foreground">
            Jawaban Anda tersimpan. {finishHint}
          </p>
          <div className="mt-5 grid gap-2">
            <Button onClick={onContinue} disabled={finishing}>
              Lanjutkan Ujian
            </Button>
            {onPause && (
              <Button variant="outline" onClick={onPause} disabled={finishing}>
                <Pause className="mr-1 size-4" />
                Jeda
              </Button>
            )}
            <Button
              variant="outline"
              className="border-destructive/40 text-destructive"
              onClick={onFinish}
              disabled={finishing}
            >
              {finishing ? "Mengirim…" : "Akhiri Ujian"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

/** Shown instead of the questions while paused; the timer is stopped and shifted on resume by the runner. */
export function ExamPausedScreen({
  remaining,
  onResume,
  onExit,
}: {
  remaining: number;
  onResume: () => void;
  onExit: () => void;
}) {
  return (
    <Card className="mt-6 rounded-2xl">
      <CardContent className="p-6 text-center">
        <Pause className="mx-auto size-8 text-primary" />
        <h1 className="mt-3 text-xl font-bold">Ujian Dijeda</h1>
        <p className="mt-2 text-xs text-muted-foreground">
          Soal disembunyikan dan timer berhenti. Sisa waktu{" "}
          <b className="tabular-nums">{formatExamTime(remaining)}</b>.
        </p>
        <div className="mt-5 grid gap-2">
          <Button onClick={onResume}>Lanjutkan Ujian</Button>
          <Button variant="outline" onClick={onExit}>
            Keluar
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
