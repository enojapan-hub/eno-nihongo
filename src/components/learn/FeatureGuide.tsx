import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, HelpCircle, X } from "lucide-react";

type FeatureGuideProps = {
  storageKey: string;
  title: string;
  intro: string;
  steps: Array<{ title: string; body: string }>;
};

export function FeatureGuide({ storageKey, title, intro, steps }: FeatureGuideProps) {
  const [open, setOpen] = useState(false);
  const [activeStep, setActiveStep] = useState(0);

  useEffect(() => {
    try {
      setOpen(window.localStorage.getItem(storageKey) !== "1");
    } catch {
      setOpen(false);
    }
  }, [storageKey]);

  const show = () => {
    setActiveStep(0);
    setOpen(true);
  };

  const close = () => {
    try {
      window.localStorage.setItem(storageKey, "1");
    } catch {
      // Panduan tetap dapat ditutup walau penyimpanan browser tidak tersedia.
    }
    setOpen(false);
  };

  const lastStep = activeStep === steps.length - 1;
  const step = steps[activeStep];

  return (
    <>
      <button
        type="button"
        onClick={show}
        className="inline-flex min-h-9 items-center gap-1.5 rounded-xl border border-primary/25 bg-primary/10 px-3 text-[10px] font-black text-primary shadow-sm transition-colors hover:bg-primary/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
      >
        <HelpCircle className="size-3.5" />
        Cara menggunakan
      </button>

      {open && step && (
        <div
          className="fixed inset-0 z-[90] flex items-center justify-center bg-black/45 p-3 sm:p-4"
          role="presentation"
          onMouseDown={(e) => {
            if (e.currentTarget === e.target) close();
          }}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby={`${storageKey}-title`}
            className="relative flex max-h-[72dvh] w-full max-w-sm flex-col overflow-hidden rounded-[24px] border bg-background shadow-2xl sm:max-h-[80vh] sm:max-w-md sm:rounded-[28px]"
          >
            <button
              type="button"
              aria-label="Tutup panduan"
              onClick={close}
              className="absolute right-3 top-3 z-10 grid size-9 place-items-center rounded-full border bg-background/95 shadow-sm backdrop-blur"
            >
              <X className="size-4" />
            </button>

            <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-4 pt-5 sm:px-6 sm:pt-6">
              <div className="pr-10">
                <p className="text-[9px] font-black uppercase tracking-[.16em] text-primary">
                  Panduan singkat · {activeStep + 1}/{steps.length}
                </p>
                <h2 id={`${storageKey}-title`} className="mt-1 text-[18px] font-black leading-tight sm:text-[19px]">
                  {activeStep === 0 ? title : step.title}
                </h2>
                {activeStep === 0 && (
                  <p className="mt-1.5 text-[11px] leading-5 text-muted-foreground">{intro}</p>
                )}
              </div>

              <div className="mt-4 rounded-2xl bg-muted/45 p-4">
                <div className="mb-3 grid size-8 place-items-center rounded-full bg-primary text-[11px] font-black text-primary-foreground">
                  {activeStep + 1}
                </div>
                {activeStep === 0 && <p className="text-[12px] font-bold">{step.title}</p>}
                <p className="mt-1 text-[11px] leading-5 text-muted-foreground">{step.body}</p>
              </div>
            </div>

            <div className="shrink-0 border-t bg-background/95 px-4 py-3 backdrop-blur sm:px-5">
              <div className="mb-3 flex items-center justify-center gap-1.5" aria-label={`Langkah ${activeStep + 1} dari ${steps.length}`}>
                {steps.map((item, index) => (
                  <span
                    key={item.title}
                    className={`h-1.5 rounded-full transition-all ${index === activeStep ? "w-5 bg-primary" : "w-1.5 bg-muted-foreground/25"}`}
                  />
                ))}
              </div>

              <div className="flex items-center gap-2">
                {activeStep === 0 ? (
                  <button
                    type="button"
                    onClick={close}
                    className="min-h-10 flex-1 rounded-xl border bg-card px-3 text-[11px] font-bold"
                  >
                    Lewati
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => setActiveStep((current) => Math.max(0, current - 1))}
                    className="inline-flex min-h-10 flex-1 items-center justify-center gap-1 rounded-xl border bg-card px-3 text-[11px] font-bold"
                  >
                    <ChevronLeft className="size-4" />
                    Kembali
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => {
                    if (lastStep) close();
                    else setActiveStep((current) => Math.min(steps.length - 1, current + 1));
                  }}
                  className="inline-flex min-h-10 flex-1 items-center justify-center gap-1 rounded-xl bg-primary px-3 text-[11px] font-bold text-primary-foreground"
                >
                  {lastStep ? "Mengerti, mulai" : "Selanjutnya"}
                  {!lastStep && <ChevronRight className="size-4" />}
                </button>
              </div>
            </div>
          </section>
        </div>
      )}
    </>
  );
}
