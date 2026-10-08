import { useEffect, useState } from "react";
import { HelpCircle, X } from "lucide-react";

type FeatureGuideProps = {
  storageKey: string;
  title: string;
  intro: string;
  steps: Array<{ title: string; body: string }>;
};

export function FeatureGuide({ storageKey, title, intro, steps }: FeatureGuideProps) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    try {
      setOpen(window.localStorage.getItem(storageKey) !== "1");
    } catch {
      setOpen(false);
    }
  }, [storageKey]);

  const close = () => {
    try {
      window.localStorage.setItem(storageKey, "1");
    } catch {
      // Panduan tetap dapat ditutup walau penyimpanan browser tidak tersedia.
    }
    setOpen(false);
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex min-h-9 items-center gap-1.5 rounded-xl border bg-card px-3 text-[10px] font-bold"
      >
        <HelpCircle className="size-3.5" />
        Cara menggunakan
      </button>
      {open && (
        <div
          className="fixed inset-0 z-[90] grid place-items-center bg-black/45 p-4"
          role="presentation"
          onMouseDown={(e) => {
            if (e.currentTarget === e.target) close();
          }}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby={`${storageKey}-title`}
            className="w-full max-w-md rounded-[28px] border bg-background p-5 shadow-2xl"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[9px] font-black uppercase tracking-[.16em] text-primary">
                  Panduan singkat
                </p>
                <h2 id={`${storageKey}-title`} className="mt-1 text-[19px] font-black">
                  {title}
                </h2>
                <p className="mt-1 text-[11px] leading-5 text-muted-foreground">{intro}</p>
              </div>
              <button
                type="button"
                aria-label="Tutup panduan"
                onClick={close}
                className="grid size-9 shrink-0 place-items-center rounded-full border bg-card"
              >
                <X className="size-4" />
              </button>
            </div>
            <div className="mt-4 space-y-2">
              {steps.map((step, index) => (
                <div key={step.title} className="flex gap-3 rounded-2xl bg-muted/45 p-3">
                  <span className="grid size-7 shrink-0 place-items-center rounded-full bg-primary text-[10px] font-black text-primary-foreground">
                    {index + 1}
                  </span>
                  <div>
                    <p className="text-[11px] font-bold">{step.title}</p>
                    <p className="mt-0.5 text-[10px] leading-4 text-muted-foreground">{step.body}</p>
                  </div>
                </div>
              ))}
            </div>
            <button
              type="button"
              onClick={close}
              className="mt-4 w-full rounded-2xl bg-primary py-3 text-[11px] font-bold text-primary-foreground"
            >
              Mengerti, mulai
            </button>
          </section>
        </div>
      )}
    </>
  );
}
