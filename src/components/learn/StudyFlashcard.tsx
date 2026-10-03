import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, ArrowRight, Check, ChevronDown, ChevronUp, Volume2, Star } from "lucide-react";

type Example = { jp?: string; id?: string; reading?: string; note?: string };
type RelatedWord = {
  term: string;
  reading?: string | null;
  meaning?: string | null;
  example?: string | null;
};
type RelatedKanji = {
  character: string;
  meaning?: string | null;
  level?: string | null;
  reading?: string | null;
};
type Props = {
  index: number;
  total: number;
  level: string;
  title: string;
  reading?: string | null;
  romaji?: string | null;
  meaning: string;
  secondary?: string | null;
  structure?: string | null;
  explanation?: string | null;
  examples?: Example[];
  relatedWords?: RelatedWord[];
  relatedKanji?: RelatedKanji[];
  onyomi?: string[];
  kunyomi?: string[];
  usageNotes?: string[];
  commonMistakes?: string[];
  question?: {
    prompt: string;
    choices: string[];
    correctIndex: number;
    explanation?: string;
  } | null;
  furiganaEnabled?: boolean;
  kotobaMode?: boolean;
  kanjiMode?: boolean;
  radical?: string | null;
  onPrev: () => void;
  onNext: () => void;
  onLearned?: () => void;
  learned?: boolean;
};
const sectionTitle = "text-xs font-bold tracking-wide text-muted-foreground";

export function StudyFlashcard({
  index,
  total,
  level,
  title,
  reading,
  romaji,
  meaning,
  secondary,
  explanation,
  examples,
  relatedWords,
  onyomi,
  kunyomi,
  usageNotes,
  commonMistakes,
  question,
  furiganaEnabled = true,
  kotobaMode = false,
  kanjiMode = false,
  onPrev,
  onNext,
  onLearned,
  learned,
}: Props) {
  const [showDetails, setShowDetails] = useState(true);
  const [quizChoice, setQuizChoice] = useState<number | null>(null);
  const [favorite, setFavorite] = useState(false);
  const progress = total ? Math.round(((index + 1) / total) * 100) : 0;
  const usableExamples = useMemo(
    () => (examples ?? []).filter((x) => x.jp || x.id).slice(0, 6),
    [examples],
  );
  const kanjiQuiz = useMemo(() => {
    if (!kanjiMode) return null;
    const words = (relatedWords ?? []).filter((w) => w.term && w.meaning).slice(0, 8);
    const target = words[0];
    if (target && words.length >= 2) {
      const choices = Array.from(new Set(words.map((w) => w.meaning!).filter(Boolean))).slice(0, 4);
      if (choices.length >= 2)
        return {
          prompt: `Apa arti dari ${target.term}?`,
          choices,
          correctIndex: choices.indexOf(target.meaning!),
        };
    }
    const readings = Array.from(new Set([...(kunyomi ?? []), ...(onyomi ?? [])].filter(Boolean)));
    if (readings.length >= 2)
      return {
        prompt: `Pilih bacaan yang benar untuk kanji ${title}.`,
        choices: readings.slice(0, 4),
        correctIndex: 0,
      };
    return null;
  }, [kanjiMode, relatedWords, kunyomi, onyomi, title]);
  const activeQuestion = kanjiMode ? kanjiQuiz : question;
  useEffect(() => {
    setShowDetails(false);
    setQuizChoice(null);
    setFavorite(false);
    window.speechSynthesis?.cancel();
  }, [index, title]);
  const speak = (text: string) => {
    if (!window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = "ja-JP";
    u.rate = 0.85;
    window.speechSynthesis.speak(u);
  };
  const answered = quizChoice !== null;
  return (
    <div className="mx-auto w-full max-w-md">
      {!kanjiMode && (
        <div className="mb-3 flex items-center justify-between text-xs text-muted-foreground">
          <span>
            Materi {index + 1} dari {total}
          </span>
          <span>{progress}% selesai</span>
        </div>
      )}
      {!kanjiMode && (
        <div className="mb-5 h-1.5 overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full bg-primary transition-all"
            style={{ width: `${progress}%` }}
          />
        </div>
      )}
      <Card className="overflow-hidden rounded-3xl border-border/80 bg-background shadow-lg">
        {kanjiMode ? (
          <>
            <CardHeader className="space-y-6 p-6 pb-5">
              <div className="flex items-center justify-between">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="size-9 rounded-full text-foreground hover:bg-muted"
                  onClick={onPrev}
                  aria-label="Kembali"
                >
                  <ArrowLeft className="size-5" />
                </Button>
                <h1 className="text-xl font-bold text-foreground">Kanji</h1>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className={`size-9 rounded-full hover:bg-muted ${favorite ? "text-amber-500" : "text-foreground"}`}
                  onClick={() => setFavorite((v) => !v)}
                  aria-label={favorite ? "Hapus favorit" : "Tambah favorit"}
                >
                  <Star className="size-5" fill={favorite ? "currentColor" : "none"} />
                </Button>
              </div>
              <div className="rounded-2xl border border-border/80 p-5">
                <div className="flex items-center gap-6">
                  <div
                    lang="ja"
                    className="font-jp text-6xl font-bold leading-none text-primary sm:text-7xl"
                  >
                    {title}
                  </div>
                  <div className="min-w-0 space-y-2">
                    <div
                      lang="ja"
                      className="font-jp text-lg font-medium leading-7 text-foreground"
                    >
                      {reading || "—"}
                    </div>
                    <div className="flex flex-wrap items-center gap-2 text-xs">
                      <Badge
                        variant="secondary"
                        className="rounded-full px-2.5 py-0.5 font-semibold"
                      >
                        {level}
                      </Badge>
                      <span className="font-medium text-muted-foreground">
                        {(title.match(/[\u4e00-\u9fff]/g) || []).length
                          ? `${Math.max(1, (title.match(/[\u4e00-\u9fff]/g) || []).length)} kanji`
                          : "Kanji"}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="my-5 border-t border-border/70" />
                <section>
                  <h2 className="mb-1 text-sm font-bold text-foreground">Arti</h2>
                  <p className="text-sm leading-6 text-muted-foreground">{meaning}</p>
                </section>
                <div className="my-5 border-t border-border/70" />
                <section className="space-y-4">
                  <h2 className="text-sm font-bold text-foreground">Contoh</h2>
                  {usableExamples.length ? (
                    <div className="space-y-4">
                      {usableExamples.slice(0, 3).map((example, i) => (
                        <div key={`${example.jp ?? "contoh"}-${i}`} className="space-y-1">
                          <div className="flex items-start gap-2">
                            <div className="min-w-0 flex-1">
                              {example.jp && (
                                <p
                                  lang="ja"
                                  className="font-jp text-base leading-8 text-foreground"
                                >
                                  {example.jp}
                                </p>
                              )}
                              {example.reading && furiganaEnabled && (
                                <p
                                  lang="ja"
                                  className="font-jp text-xs leading-5 text-muted-foreground"
                                >
                                  {example.reading}
                                </p>
                              )}
                              {example.id && (
                                <p className="text-xs leading-5 text-muted-foreground">
                                  {example.id}
                                </p>
                              )}
                            </div>
                            {example.jp && (
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="size-8 shrink-0 rounded-full"
                                aria-label={`Dengarkan contoh ${i + 1}`}
                                onClick={() => speak(example.jp!)}
                              >
                                <Volume2 className="size-4" />
                              </Button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">Belum ada contoh kalimat.</p>
                  )}
                </section>
                <div className="my-5 border-t border-border/70" />
                <div className="grid grid-cols-2 gap-3 pt-0">
                  <Button
                    type="button"
                    variant="outline"
                    className="h-11 w-full rounded-xl border-border bg-muted/30 text-primary font-bold"
                    onClick={() => speak(title)}
                  >
                    <Volume2 className="mr-2 size-4" />
                    Dengarkan
                  </Button>
                  <Button
                    type="button"
                    variant={learned ? "secondary" : "default"}
                    className="h-11 w-full rounded-xl font-bold"
                    onClick={onLearned}
                    disabled={!onLearned || !!learned}
                  >
                    {learned ? (
                      <>
                        <Check className="mr-2 size-4" />
                        Sudah hafal
                      </>
                    ) : (
                      "Sudah hafal"
                    )}
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4 px-6 pb-6 pt-0">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="w-full rounded-xl text-muted-foreground"
                onClick={() => setShowDetails((v) => !v)}
              >
                {showDetails ? (
                  <>
                    <ChevronUp className="mr-2 size-4" />
                    Sembunyikan detail
                  </>
                ) : (
                  <>
                    <ChevronDown className="mr-2 size-4" />
                    Tampilkan detail
                  </>
                )}
              </Button>
              {showDetails && (
                <div className="space-y-4">
                  <section className="rounded-2xl border bg-muted/30 p-4">
                    <p className={sectionTitle}>KUNYOMI</p>
                    <p lang="ja" className="mt-2 font-jp text-base leading-7">
                      {kunyomi?.length ? kunyomi.join("・") : "—"}
                    </p>
                  </section>
                  <section className="rounded-2xl border bg-muted/30 p-4">
                    <p className={sectionTitle}>ONYOMI</p>
                    <p lang="ja" className="mt-2 font-jp text-base leading-7">
                      {onyomi?.length ? onyomi.join("・") : "—"}
                    </p>
                  </section>
                  <section className="rounded-2xl border bg-muted/30 p-4">
                    <p className={sectionTitle}>KOTOBA TERKAIT</p>
                    {relatedWords?.length ? (
                      <div className="mt-3 space-y-3">
                        {relatedWords.slice(0, 8).map((w, i) => (
                          <div
                            key={`${w.term}-${i}`}
                            className="rounded-xl border bg-background p-3"
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div>
                                <p lang="ja" className="font-jp text-xl font-semibold">
                                  {w.term}
                                </p>
                                {furiganaEnabled && w.reading && (
                                  <p
                                    lang="ja"
                                    className="mt-1 font-jp text-xs text-muted-foreground"
                                  >
                                    {w.reading}
                                  </p>
                                )}
                                <p className="mt-1 text-sm leading-6">
                                  <span className="font-medium">Arti:</span>{" "}
                                  {w.meaning || "Arti belum tersedia"}
                                </p>
                                {w.example && (
                                  <p
                                    lang="ja"
                                    className="mt-2 border-t pt-2 font-jp text-sm leading-6"
                                  >
                                    {w.example}
                                  </p>
                                )}
                              </div>
                              <Button
                                type="button"
                                size="icon"
                                variant="ghost"
                                className="size-8 shrink-0"
                                aria-label={`Dengarkan ${w.term}`}
                                onClick={() => speak(w.term)}
                              >
                                <Volume2 className="size-4" />
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="mt-2 text-sm text-muted-foreground">
                        Belum ada Kotoba yang menggunakan kanji ini.
                      </p>
                    )}
                  </section>
                  {activeQuestion && (
                    <section className="rounded-2xl border-2 border-primary/20 bg-primary/5 p-4">
                      <p className="text-xs font-bold tracking-wide text-primary">QUIZ KANJI</p>
                      <p className="mt-2 font-medium leading-7">{activeQuestion.prompt}</p>
                      <div className="mt-3 grid gap-2">
                        {activeQuestion.choices.map((choice, i) => {
                          const selected = quizChoice === i;
                          const correct = answered && i === activeQuestion.correctIndex;
                          const wrong = selected && !correct;
                          return (
                            <Button
                              key={`${choice}-${i}`}
                              type="button"
                              variant={
                                correct
                                  ? "default"
                                  : wrong
                                    ? "destructive"
                                    : selected
                                      ? "secondary"
                                      : "outline"
                              }
                              className="h-auto min-h-11 justify-start whitespace-normal py-2.5 text-left"
                              onClick={() => !answered && setQuizChoice(i)}
                              disabled={answered}
                            >
                              {String.fromCharCode(65 + i)}. {choice}
                            </Button>
                          );
                        })}
                      </div>
                      {answered && (
                        <div className="mt-3 rounded-xl border bg-background p-3 text-sm">
                          {quizChoice === activeQuestion.correctIndex ? (
                            <span className="font-semibold text-emerald-600">
                              Benar! Jawabanmu tepat.
                            </span>
                          ) : (
                            <span className="font-semibold text-destructive">
                              Belum tepat. Perhatikan kembali bacaan dan Kotoba terkait.
                            </span>
                          )}
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="mt-1 w-full"
                            onClick={() => setQuizChoice(null)}
                          >
                            Coba lagi
                          </Button>
                        </div>
                      )}
                    </section>
                  )}
                </div>
              )}
              <div className="grid grid-cols-2 gap-2 pt-1">
                <Button
                  type="button"
                  variant="outline"
                  onClick={onPrev}
                  disabled={index === 0}
                  className="h-11 rounded-xl"
                >
                  <ArrowLeft className="mr-2 size-4" />
                  Sebelumnya
                </Button>
                <Button
                  type="button"
                  onClick={onNext}
                  disabled={index === total - 1}
                  className="h-11 rounded-xl"
                >
                  Berikutnya
                  <ArrowRight className="ml-2 size-4" />
                </Button>
              </div>
            </CardContent>
          </>
        ) : (
          <>
            <CardHeader className="space-y-4 bg-gradient-to-br from-primary/10 via-background to-secondary/20 px-6 py-8 text-center sm:px-8">
              <div className="flex items-center justify-center gap-2">
                <Badge variant="secondary">{level}</Badge>
                <Badge variant="outline">{kotobaMode ? "KOTOBA" : "Pelajaran"}</Badge>
              </div>
              <div lang="ja" className="font-jp text-5xl font-bold tracking-wide sm:text-6xl">
                {title}
                {kotobaMode && reading && (
                  <span className="ml-3 text-2xl font-normal text-muted-foreground sm:text-3xl">
                    — {reading}
                  </span>
                )}
              </div>
              {!kotobaMode && !kanjiMode && reading && furiganaEnabled && (
                <div lang="ja" className="text-base text-muted-foreground">
                  {reading}
                </div>
              )}
              {kotobaMode && romaji && (
                <div className="text-base italic text-muted-foreground">{romaji}</div>
              )}
              <div className="text-xl font-semibold leading-relaxed">
                <span className="text-sm font-medium text-muted-foreground">Arti :</span>
                <div className="mt-1">{meaning}</div>
              </div>
              <div className="flex flex-wrap justify-center gap-2">
                <Button type="button" variant="outline" size="sm" onClick={() => speak(title)}>
                  <Volume2 className="mr-2 size-4" />
                  Dengarkan
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowDetails((v) => !v)}
                >
                  {showDetails ? (
                    <ChevronUp className="mr-2 size-4" />
                  ) : (
                    <ChevronDown className="mr-2 size-4" />
                  )}
                  {showDetails ? "Sembunyikan penjelasan" : "Tampilkan penjelasan lengkap"}
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-6 p-5 sm:p-7">
              {showDetails && (
                <div className="space-y-6">
                  {explanation && (
                    <section className="rounded-2xl border bg-muted/30 p-5">
                      <p className={sectionTitle}>PENJELASAN</p>
                      <p className="mt-3 whitespace-pre-line leading-7">{explanation}</p>
                    </section>
                  )}
                  {!!usageNotes?.length && (
                    <section className="rounded-2xl border bg-muted/30 p-5">
                      <p className={sectionTitle}>COCOK DIGUNAKAN DALAM KONTEKS</p>
                      <ul className="mt-3 list-disc space-y-2 pl-5 leading-7">
                        {usageNotes.map((n, i) => (
                          <li key={`${n}-${i}`}>{n}</li>
                        ))}
                      </ul>
                    </section>
                  )}
                  {!!usableExamples.length && (
                    <section className="rounded-2xl border bg-muted/30 p-5">
                      <p className={sectionTitle}>CONTOH KALIMAT</p>
                      <div className="mt-4 space-y-4">
                        {usableExamples.map((example, i) => (
                          <div
                            key={`${example.jp ?? "contoh"}-${i}`}
                            className="rounded-xl border bg-background p-4"
                          >
                            <div className="flex items-start gap-2">
                              <div className="flex-1">
                                {example.jp && (
                                  <p lang="ja" className="font-jp text-lg leading-8">
                                    {example.jp}
                                  </p>
                                )}
                                {example.reading && furiganaEnabled && (
                                  <p lang="ja" className="mt-1 text-sm text-muted-foreground">
                                    {example.reading}
                                  </p>
                                )}
                                {example.id && (
                                  <p className="mt-2 text-sm leading-6">{example.id}</p>
                                )}
                                {example.note && (
                                  <p className="mt-2 text-xs leading-5 text-muted-foreground">
                                    Catatan: {example.note}
                                  </p>
                                )}
                              </div>
                              {example.jp && (
                                <Button
                                  type="button"
                                  size="icon"
                                  variant="ghost"
                                  aria-label="Dengarkan contoh kalimat"
                                  onClick={() => speak(example.jp!)}
                                >
                                  <Volume2 className="size-4" />
                                </Button>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </section>
                  )}
                  {!!commonMistakes?.length && (
                    <section className="rounded-2xl border border-destructive/20 bg-destructive/5 p-5">
                      <p className="text-xs font-bold tracking-wide text-destructive">
                        KESALAHAN YANG SERING TERJADI
                      </p>
                      <div className="mt-3 space-y-3">
                        {commonMistakes.map((n, i) => (
                          <div key={`${n}-${i}`} className="rounded-xl bg-background p-4 leading-7">
                            {n}
                          </div>
                        ))}
                      </div>
                    </section>
                  )}
                  {!!relatedWords?.length && (
                    <section className="rounded-2xl border bg-muted/30 p-5">
                      <p className={sectionTitle}>KOSAKATA TERKAIT</p>
                      <div className="mt-4 grid gap-3 sm:grid-cols-2">
                        {relatedWords.slice(0, 10).map((w, i) => (
                          <div
                            key={`${w.term}-${i}`}
                            className="rounded-xl border bg-background p-4"
                          >
                            <p lang="ja" className="font-jp text-xl">
                              {w.term}
                            </p>
                            {furiganaEnabled && w.reading && (
                              <p lang="ja" className="mt-1 text-sm text-muted-foreground">
                                {w.reading}
                              </p>
                            )}
                            <p className="mt-2 text-sm leading-6">
                              {w.meaning || "Arti belum tersedia"}
                            </p>
                            {w.example && (
                              <p lang="ja" className="mt-2 border-t pt-2 font-jp text-sm leading-6">
                                {w.example}
                              </p>
                            )}
                          </div>
                        ))}
                      </div>
                    </section>
                  )}
                  {activeQuestion && (
                    <section className="rounded-2xl border-2 border-primary/20 bg-primary/5 p-5">
                      <p className="text-xs font-bold tracking-wide text-primary">
                        LATIHAN PEMAHAMAN
                      </p>
                      <p className="mt-3 font-medium leading-7">{activeQuestion.prompt}</p>
                      <div className="mt-4 grid gap-3">
                        {activeQuestion.choices.map((choice, i) => (
                          <Button
                            key={`${choice}-${i}`}
                            type="button"
                            variant="outline"
                            className="h-auto min-h-12 justify-start whitespace-normal py-3 text-left"
                          >
                            {String.fromCharCode(65 + i)}. {choice}
                          </Button>
                        ))}
                      </div>
                    </section>
                  )}
                </div>
              )}
              {onLearned && (
                <div className="mt-1">
                  <Button
                    type="button"
                    variant={learned ? "secondary" : "outline"}
                    onClick={onLearned}
                    disabled={!!learned}
                    className="h-11 w-full rounded-xl font-semibold"
                  >
                    {learned ? (
                      <>
                        <Check className="mr-2 size-4" />
                        <span>Sudah dipelajari</span>
                      </>
                    ) : (
                      <span>Tandai sudah dipelajari</span>
                    )}
                  </Button>
                </div>
              )}
              <div className="rounded-2xl border bg-muted/30 p-2 sm:p-2.5">
                <div className="grid grid-cols-2 gap-2">
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={onPrev}
                    disabled={index === 0}
                    className="h-12"
                  >
                    <ArrowLeft className="mr-2 size-4" />
                    <span>Sebelumnya</span>
                  </Button>
                  <Button
                    type="button"
                    onClick={onNext}
                    disabled={index === total - 1}
                    className="h-12"
                  >
                    <span>Berikutnya</span>
                    <ArrowRight className="ml-2 size-4" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </>
        )}
      </Card>
    </div>
  );
}
