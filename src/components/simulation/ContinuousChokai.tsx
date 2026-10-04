import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";
import { Headphones } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  activePosition,
  readChokaiProgress,
  writeChokaiProgress,
  type TimelineEntry,
} from "@/lib/chokai-timeline";

/** Layar konfirmasi sebelum audio penuh dimulai. Audio tidak berjalan sebelum CTA ditekan. */
export function ChokaiStartGate({ onStart, resuming }: { onStart: () => void; resuming: boolean }) {
  return (
    <Card>
      <CardContent className="space-y-4 p-5">
        <div className="flex items-center gap-2">
          <Headphones className="size-5 text-primary" />
          <h2 className="text-base font-black">Perhatian — Sesi Chōkai</h2>
        </div>
        <p className="text-sm leading-6">
          Sesi Chōkai menggunakan satu audio penuh yang diputar terus-menerus seperti ujian JLPT
          asli.
        </p>
        <div>
          <p className="text-sm font-semibold">Setelah audio dimulai:</p>
          <ul className="mt-1 list-disc space-y-1 pl-5 text-sm leading-6">
            <li>Audio tidak dapat dijeda.</li>
            <li>Audio tidak dapat diputar ulang.</li>
            <li>Anda tidak dapat kembali ke soal sebelumnya.</li>
            <li>Soal akan berganti mengikuti jalannya audio.</li>
          </ul>
        </div>
        <p className="text-sm leading-6">
          Pastikan volume perangkat sudah sesuai dan gunakan earphone/headphone jika diperlukan.
        </p>
        {resuming && (
          <p className="rounded-lg bg-muted p-2 text-xs text-muted-foreground">
            Audio akan dilanjutkan dari posisi terakhir, bukan diulang dari awal.
          </p>
        )}
        <Button className="h-12 w-full text-sm font-bold" onClick={onStart}>
          Mulai Chōkai
        </Button>
      </CardContent>
    </Card>
  );
}

export type ChokaiAudioHandle = { start: () => Promise<void> };
type Props = {
  url: string;
  timeline: TimelineEntry[];
  progressKey: string;
  onPosition: (position: number) => void;
  onEnded: () => void;
};

/**
 * Satu elemen audio tersembunyi untuk seluruh sesi: tanpa kontrol native, tanpa pause/replay/seek.
 * Elemen ini harus dirender di posisi pohon yang stabil agar tidak remount saat soal berganti.
 */
export const ContinuousChokaiAudio = forwardRef<ChokaiAudioHandle, Props>(
  function ContinuousChokaiAudio({ url, timeline, progressKey, onPosition, onEnded }, handle) {
    const audioRef = useRef<HTMLAudioElement | null>(null);
    const started = useRef(false);
    const ended = useRef(false);
    const goodTime = useRef(0);
    const lastSaved = useRef(0);
    const callbacks = useRef({ onPosition, onEnded });
    callbacks.current = { onPosition, onEnded };

    useImperativeHandle(
      handle,
      () => ({
        start: async () => {
          const audio = audioRef.current;
          if (!audio) return;
          started.current = true;
          const saved = readChokaiProgress(window.localStorage, progressKey);
          if (saved && saved.t > 0 && !saved.finished) audio.currentTime = saved.t;
          goodTime.current = audio.currentTime;
          await audio.play();
        },
      }),
      [progressKey],
    );

    useEffect(() => {
      const audio = audioRef.current;
      if (!audio) return;
      const tryResume = () => {
        if (!started.current || ended.current || audio.ended || !audio.paused) return;
        void audio.play().catch(() => undefined);
      };
      const onTimeUpdate = () => {
        const t = audio.currentTime;
        // Maju sewajarnya (termasuk event timeupdate yang tertunda >1,5 dtk) diterima; lompatan akibat
        // seek ditolak oleh onSeeking dan tidak pernah masuk ke goodTime.
        if (!audio.seeking && t >= goodTime.current - 1.5)
          goodTime.current = Math.max(goodTime.current, t);
        callbacks.current.onPosition(activePosition(timeline, goodTime.current));
        if (started.current && t - lastSaved.current >= 2) {
          lastSaved.current = t;
          writeChokaiProgress(window.localStorage, progressKey, { t, finished: false });
        }
      };
      // Tidak ada kontrol pengguna; seek dari sumber lain (media key, lock screen) dikembalikan.
      const onSeeking = () => {
        if (started.current && Math.abs(audio.currentTime - goodTime.current) > 1.5)
          audio.currentTime = goodTime.current;
      };
      // Pause hanya bisa datang dari sistem (interupsi/lock screen): lanjutkan, bukan ulang.
      const onPause = () => tryResume();
      const onEndedEvent = () => {
        if (ended.current) return;
        ended.current = true;
        writeChokaiProgress(window.localStorage, progressKey, {
          t: audio.duration || 0,
          finished: true,
        });
        callbacks.current.onEnded();
      };
      const onVisible = () => {
        if (document.visibilityState === "visible") tryResume();
      };
      audio.addEventListener("timeupdate", onTimeUpdate);
      audio.addEventListener("seeking", onSeeking);
      audio.addEventListener("pause", onPause);
      audio.addEventListener("ended", onEndedEvent);
      document.addEventListener("visibilitychange", onVisible);
      window.addEventListener("pageshow", onVisible);
      window.addEventListener("focus", onVisible);
      if ("mediaSession" in navigator) {
        const noop = () => undefined;
        for (const action of ["pause", "seekto", "seekbackward", "seekforward", "stop"] as const) {
          try {
            navigator.mediaSession.setActionHandler(action, noop);
          } catch {
            /* aksi tidak didukung browser ini */
          }
        }
      }
      return () => {
        audio.removeEventListener("timeupdate", onTimeUpdate);
        audio.removeEventListener("seeking", onSeeking);
        audio.removeEventListener("pause", onPause);
        audio.removeEventListener("ended", onEndedEvent);
        document.removeEventListener("visibilitychange", onVisible);
        window.removeEventListener("pageshow", onVisible);
        window.removeEventListener("focus", onVisible);
      };
    }, [timeline, progressKey]);

    return (
      <audio
        ref={audioRef}
        src={url}
        preload="auto"
        className="hidden"
        controlsList="nodownload noplaybackrate"
      />
    );
  },
);
