import { useEffect, useState } from "react";
import { Pause, Play, RotateCcw, Volume2 } from "lucide-react";
import { Button } from "@/components/ui/button";

type Props = { audioUrl?: string | null; transcript?: string | null; title?: string | null };

export function ListeningAudio({ audioUrl, transcript, title }: Props) {
  const [speaking, setSpeaking] = useState(false);
  useEffect(() => () => { if (typeof window !== "undefined") window.speechSynthesis?.cancel(); }, []);

  if (audioUrl) {
    return <div className="mb-5 rounded-xl border bg-muted/30 p-4"><div className="mb-2 flex items-center gap-2 text-xs font-semibold"><Volume2 className="size-4" />{title ?? "Audio Choukai"}</div><audio className="w-full" controls preload="metadata" src={audioUrl}>Browser tidak mendukung pemutar audio.</audio></div>;
  }
  if (!transcript) return null;

  const play = () => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(transcript);
    u.lang = "ja-JP";
    u.rate = 0.9;
    u.onstart = () => setSpeaking(true);
    u.onend = () => setSpeaking(false);
    u.onerror = () => setSpeaking(false);
    window.speechSynthesis.speak(u);
  };
  const stop = () => { window.speechSynthesis?.cancel(); setSpeaking(false); };

  return <div className="mb-5 rounded-xl border bg-muted/30 p-4"><div className="mb-3 flex items-center gap-2 text-xs font-semibold"><Volume2 className="size-4" />{title ?? "Audio Choukai"}</div><div className="flex gap-2"><Button type="button" size="sm" onClick={speaking ? stop : play}>{speaking ? <Pause className="mr-1.5 size-4" /> : <Play className="mr-1.5 size-4" />}{speaking ? "Jeda" : "Putar audio"}</Button><Button type="button" size="sm" variant="outline" onClick={play}><RotateCcw className="mr-1.5 size-4" />Ulangi</Button></div></div>;
}
