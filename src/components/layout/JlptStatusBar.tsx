import { useEffect, useMemo, useState } from "react";
import { Bell, Clock3, ExternalLink, Sparkles } from "lucide-react";

const JLPT_DATE = new Date("2026-12-06T09:00:00+09:00").getTime();

function remaining() {
  const diff = Math.max(0, JLPT_DATE - Date.now());
  const days = Math.floor(diff / 86_400_000);
  const hours = Math.floor((diff % 86_400_000) / 3_600_000);
  const minutes = Math.floor((diff % 3_600_000) / 60_000);
  const seconds = Math.floor((diff % 60_000) / 1_000);
  return { days, hours, minutes, seconds };
}

export function JlptStatusBar() {
  const [time, setTime] = useState(remaining);
  useEffect(() => {
    const id = window.setInterval(() => setTime(remaining()), 1000);
    return () => window.clearInterval(id);
  }, []);

  const parts = useMemo(() => [
    [time.days, "hari"],
    [time.hours, "jam"],
    [time.minutes, "mnt"],
    [time.seconds, "dtk"],
  ] as const, [time]);

  return (
    <section className="mb-6 overflow-hidden rounded-2xl border border-primary/20 bg-gradient-to-r from-primary/10 via-background to-accent/10 shadow-sm">
      <div className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <div className="mt-0.5 rounded-xl bg-primary/15 p-2 text-primary"><Sparkles className="size-4" /></div>
          <div>
            <div className="flex items-center gap-2 text-sm font-semibold"><Bell className="size-3.5 text-primary" /> JLPT Update</div>
            <p className="mt-1 text-xs text-muted-foreground">JLPT 2026 tes kedua: Minggu, 6 Desember 2026. Pendaftaran Jepang dilakukan melalui MyJLPT/JEES.</p>
            <a className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline" href="https://www.jlpt.jp/e/" target="_blank" rel="noreferrer">Sumber resmi JLPT <ExternalLink className="size-3" /></a>
          </div>
        </div>
        <div className="flex items-center gap-2 rounded-xl border border-border/70 bg-background/70 px-3 py-2 shadow-sm">
          <Clock3 className="size-4 text-primary" />
          <div className="flex gap-2 text-center tabular-nums">
            {parts.map(([value, label]) => <div key={label}><div className="text-sm font-bold">{String(value).padStart(2, "0")}</div><div className="text-[9px] text-muted-foreground">{label}</div></div>)}
          </div>
        </div>
      </div>
    </section>
  );
}
