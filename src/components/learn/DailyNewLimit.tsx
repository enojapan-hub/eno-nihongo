import { useState } from "react";
import { dailyNewLimit } from "@/lib/kioku/selector";

const OPTIONS = [5, 10, 20] as const;

export function DailyNewLimit() {
  const [value, setValue] = useState<5 | 10 | 20>(() => dailyNewLimit());
  return (
    <section className="rounded-2xl border bg-card p-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-bold">Target materi baru</p>
          <p className="mt-0.5 text-[9px] leading-relaxed text-muted-foreground">
            Batas rekomendasi harian. Tidak mengunci materi yang ingin kamu buka sendiri.
          </p>
        </div>
        <span className="rounded-full bg-primary/10 px-2 py-1 text-[9px] font-bold text-primary">
          {value}/hari
        </span>
      </div>
      <div className="mt-3 grid grid-cols-3 gap-1.5">
        {OPTIONS.map((n) => (
          <button
            key={n}
            type="button"
            aria-pressed={value === n}
            onClick={() => {
              window.localStorage.setItem("eno:daily-new-limit", String(n));
              setValue(n);
            }}
            className={`rounded-xl border px-3 py-2 text-[10px] font-bold ${value === n ? "border-primary bg-primary text-primary-foreground" : "bg-background"}`}
          >
            {n}
          </button>
        ))}
      </div>
    </section>
  );
}
