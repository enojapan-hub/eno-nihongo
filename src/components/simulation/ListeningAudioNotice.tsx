import { Info } from "lucide-react";

type Props = {
  scope: "session" | "mondai" | "question";
};

export function ListeningAudioNotice({ scope }: Props) {
  const copy = scope === "session"
    ? {
        title: "Audio sesi penuh",
        body: "Audio ini berlanjut untuk beberapa bagian Chōkai. Saat pindah soal, audio tidak diulang atau diputus.",
      }
    : scope === "mondai"
      ? {
          title: "Audio per bagian",
          body: "Audio ini dipakai bersama untuk beberapa soal dalam mondai ini. Posisi audio tetap berjalan saat Anda berpindah soal.",
        }
      : {
          title: "Audio per soal",
          body: "Audio ini hanya digunakan untuk soal yang sedang tampil.",
        };

  return (
    <div role="note" className="rounded-xl border border-primary/20 bg-primary/[.06] p-3 text-left">
      <div className="flex gap-2">
        <Info className="mt-0.5 size-4 shrink-0 text-primary" />
        <div>
          <p className="text-xs font-bold text-primary">{copy.title}</p>
          <p className="mt-1 text-[11px] leading-5 text-muted-foreground">{copy.body}</p>
        </div>
      </div>
    </div>
  );
}
