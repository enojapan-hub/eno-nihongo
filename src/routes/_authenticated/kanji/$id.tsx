import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { BookmarkPlus, Check, ChevronLeft, ChevronRight, Play, Star } from "lucide-react";
import { Fragment, useRef, useState } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { fetchKanjiList, fetchKanjiStudy, markItemLearned, type Level } from "@/lib/learn-queries";

export const Route = createFileRoute("/_authenticated/kanji/$id")({ component: KanjiDetailPage });

function HighlightKanji({ text, target }: { text: string; target: string }) {
  if (!target || !text.includes(target)) return <>{text}</>;
  return <>{text.split(target).map((part, index, parts) => <Fragment key={`${part}-${index}`}><span>{part}</span>{index < parts.length - 1 && <span className="font-semibold text-primary">{target}</span>}</Fragment>)}</>;
}

function KanjiDetailPage() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [done, setDone] = useState(false);
  const [review, setReview] = useState(false);
  const [furigana, setFurigana] = useState(true);
  const [favorite, setFavorite] = useState(false);
  const touchStart = useRef<number | null>(null);

  const { data, isLoading, error } = useQuery({ queryKey: ["kanji-study", id], queryFn: () => fetchKanjiStudy(id) });
  const level = (data?.kanji?.level ?? "N5") as Level;
  const list = useQuery({ queryKey: ["kanji-list", level], queryFn: () => fetchKanjiList(level), enabled: Boolean(data?.kanji) });
  const k = data?.kanji;

  const currentIndex = list.data?.findIndex((item) => item.id === id) ?? -1;
  const previous = currentIndex > 0 ? list.data?.[currentIndex - 1] : undefined;
  const next = currentIndex >= 0 && currentIndex < (list.data?.length ?? 0) - 1 ? list.data?.[currentIndex + 1] : undefined;

  const mutation = useMutation({
    mutationFn: () => markItemLearned({ itemType: "kanji", itemId: id, level }),
    onSuccess: () => { setDone(true); void qc.invalidateQueries({ queryKey: ["my-progress"] }); },
  });

  function goTo(nextId?: string) {
    if (!nextId) return;
    setDone(false); setReview(false); setFavorite(false);
    navigate({ to: "/kanji/$id", params: { id: nextId } });
  }

  function onTouchEnd(endX: number) {
    if (touchStart.current === null) return;
    const delta = endX - touchStart.current;
    touchStart.current = null;
    if (Math.abs(delta) < 55) return;
    if (delta < 0) goTo(next?.id); else goTo(previous?.id);
  }

  function playAudio() {
    if (typeof window === "undefined" || !("speechSynthesis" in window) || !k) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(String(k.character));
    utterance.lang = "ja-JP";
    window.speechSynthesis.speak(utterance);
  }

  if (isLoading) return <AppShell compact title="Kanji"><p className="text-[11px] text-muted-foreground">Memuat materi…</p></AppShell>;
  if (error || !k) return <AppShell compact title="Kanji"><Card><CardContent className="py-8 text-center text-[11px] text-destructive">Kanji tidak ditemukan.</CardContent></Card></AppShell>;

  const readings = [...(k.onyomi ?? []), ...(k.kunyomi ?? [])].filter(Boolean).join("・");
  const relatedWords = (data.relatedWords ?? []).slice(0, 5);
  const examples = data.examples?.slice(0, 3) ?? [];

  return (
    <AppShell compact title={`Kanji ${level}`} backTo="/kanji" backLabel="Daftar Kanji">
      <div className="mx-auto max-w-xl space-y-3 pb-3">
        <div className="flex items-center justify-end px-1 text-[11px] text-muted-foreground"><span>{currentIndex >= 0 ? `${currentIndex + 1} / ${list.data?.length ?? 0}` : level}</span></div>
        <Card className="overflow-hidden rounded-[22px] border-border/70 bg-card shadow-sm touch-pan-y" onTouchStart={(event) => { touchStart.current = event.touches[0]?.clientX ?? null; }} onTouchEnd={(event) => onTouchEnd(event.changedTouches[0]?.clientX ?? 0)}>
          <CardContent className="p-4 sm:p-5">
            <div className="flex justify-end"><button type="button" onClick={() => setFurigana(value => !value)} className={`inline-flex h-7 items-center rounded-full px-1 text-[9px] font-semibold transition ${furigana ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}><span className="px-1.5">Furigana</span><span className="size-5 rounded-full bg-background" /></button></div>
            <div className="mt-1 grid grid-cols-[42px_1fr_42px] items-center gap-2">
              <Button variant="ghost" size="icon" className="size-10 rounded-full bg-primary/5" disabled={!previous} onClick={() => goTo(previous?.id)}><ChevronLeft className="size-5" /></Button>
              <div className="min-w-0 text-center"><div lang="ja" className="font-jp text-[92px] font-medium leading-none text-foreground">{k.character}</div>{furigana && <p lang="ja" className="mt-2 font-jp text-[14px] font-semibold text-muted-foreground">{readings || "—"}</p>}<h1 className="mt-1 text-[16px] font-semibold leading-tight">{k.meaning_id || "Arti Indonesia belum tersedia"}</h1></div>
              <Button variant="ghost" size="icon" className="size-10 rounded-full bg-primary/5" disabled={!next} onClick={() => goTo(next?.id)}><ChevronRight className="size-5" /></Button>
            </div>
            <div className="mt-3 flex items-center justify-center gap-6"><button type="button" onClick={playAudio} className="grid size-11 place-items-center rounded-full bg-primary text-primary-foreground shadow-sm"><Play className="ml-0.5 size-5 fill-current" /></button><button type="button" onClick={() => setFavorite(value => !value)} className={`grid size-10 place-items-center rounded-full border ${favorite ? "border-primary bg-primary/10 text-primary" : "border-border/70 bg-background text-muted-foreground"}`}><Star className={`size-4 ${favorite ? "fill-current" : ""}`} /></button></div>
            <div className="mt-4 grid grid-cols-3 gap-2"><div className="rounded-xl bg-primary/[.06] p-3"><p className="text-[9px] text-muted-foreground">Onyomi</p><p lang="ja" className="mt-1 truncate font-jp text-[13px] font-semibold">{(k.onyomi ?? []).join("・") || "—"}</p></div><div className="rounded-xl bg-primary/[.06] p-3"><p className="text-[9px] text-muted-foreground">Kunyomi</p><p lang="ja" className="mt-1 truncate font-jp text-[13px] font-semibold">{(k.kunyomi ?? []).join("・") || "—"}</p></div><div className="rounded-xl bg-primary/[.06] p-3"><p className="text-[9px] text-muted-foreground">Jumlah Coretan</p><p className="mt-1 text-[15px] font-semibold">{k.stroke_count ?? "—"}</p></div></div>
          </CardContent>
        </Card>
        <Card className="rounded-2xl border-border/70 shadow-none"><CardContent className="p-4"><h2 className="text-[13px] font-bold">Contoh Kosakata {level}</h2>{relatedWords.length ? <div className="mt-3 space-y-2.5">{relatedWords.map((word, index) => <div key={`${word.term}-${index}`} className="grid grid-cols-[1fr_auto] items-baseline gap-3 text-[12px]"><div className="min-w-0"><span lang="ja" className="font-jp font-semibold"><HighlightKanji text={word.term} target={String(k.character)} /></span>{furigana && word.reading && <span lang="ja" className="ml-1.5 font-jp text-[10px] text-muted-foreground">（{word.reading}）</span>}</div><span className="text-right text-[10px] text-muted-foreground">{word.meaning || "Arti Indonesia belum tersedia"}</span></div>)}</div> : <p className="mt-2 text-[10px] text-muted-foreground">Contoh kosakata {level} belum tersedia.</p>}</CardContent></Card>
        <Card className="rounded-2xl border-border/70 shadow-none"><CardContent className="p-4"><h2 className="text-[13px] font-bold">Contoh Kalimat</h2>{examples.length ? <div className="mt-3 space-y-4">{examples.map((example, index) => <div key={`${example.jp}-${index}`}>{example.jp && <p lang="ja" className="font-jp text-[14px] font-semibold leading-6"><HighlightKanji text={example.jp} target={String(k.character)} /></p>}{furigana && example.reading && <p lang="ja" className="mt-0.5 font-jp text-[10px] leading-5 text-muted-foreground">{example.reading}</p>}<p className="mt-1 text-[11px] leading-5 text-muted-foreground">{example.id || "Arti Indonesia belum tersedia"}</p></div>)}</div> : <p className="mt-2 text-[10px] text-muted-foreground">Contoh kalimat belum tersedia.</p>}</CardContent></Card>
        <div className="grid grid-cols-2 gap-2"><Button variant="outline" className={`h-10 rounded-full text-[10px] ${review ? "border-primary bg-primary/5 text-primary" : ""}`} onClick={() => setReview(value => !value)}><BookmarkPlus className="mr-1.5 size-3.5" />{review ? "Masuk Review" : "Tambah ke Review"}</Button><Button className="h-10 rounded-full text-[10px]" disabled={mutation.isPending || done} onClick={() => mutation.mutate()}><Check className="mr-1.5 size-3.5" />{done ? "Sudah Hafal" : mutation.isPending ? "Menyimpan…" : "Sudah Hafal"}</Button></div>
        {mutation.error && <p className="text-center text-[9px] text-destructive">Gagal menyimpan progress.</p>}
        <div className="grid grid-cols-2 gap-2 pb-1"><Button variant="outline" className="h-10 rounded-full text-[10px]" disabled={!previous} onClick={() => goTo(previous?.id)}><ChevronLeft className="mr-1 size-3.5" />Sebelumnya</Button><Button variant="outline" className="h-10 rounded-full text-[10px]" disabled={!next} onClick={() => goTo(next?.id)}>Selanjutnya<ChevronRight className="ml-1 size-3.5" /></Button></div>
      </div>
    </AppShell>
  );
}
