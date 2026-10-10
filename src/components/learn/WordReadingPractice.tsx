import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, CheckCircle2, RotateCcw, XCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

const TOTAL = 10;
const OPTIONS = 4;
const LETTERS = ["A", "B", "C", "D"] as const;
type Script = "hiragana" | "katakana";
// Words written entirely in one script; readings come from the published vocabulary data.
const PATTERN: Record<Script, string> = {
  hiragana: "^[ぁ-ゖー]+$",
  katakana: "^[ァ-ヺー]+$",
};

type Word = { id: string; term: string; romaji: string; meaning: string };
type Question = { word: Word; options: string[] };

async function fetchWords(script: Script): Promise<Word[]> {
  const { data, error } = await supabase
    .from("vocabulary")
    .select("id,term,romaji,meaning_id")
    .eq("is_published", true)
    .not("romaji", "is", null)
    .filter("term", "match", PATTERN[script])
    .limit(300);
  if (error) throw error;
  const seen = new Set<string>();
  const words: Word[] = [];
  for (const row of data ?? []) {
    const romaji = String(row.romaji ?? "").trim().toLowerCase();
    // Short words keep this a kana reading drill rather than a vocabulary test.
    if (!romaji || row.term.length > 6 || seen.has(row.term)) continue;
    seen.add(row.term);
    words.push({ id: row.id, term: row.term, romaji, meaning: row.meaning_id });
  }
  return words;
}

function shuffle<T>(items: T[]): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j] as T, copy[i] as T];
  }
  return copy;
}

/** Builds 10 questions; distractors are readings of other real words, never invented spellings. */
function buildQuestions(words: Word[]): Question[] {
  const readings = [...new Set(words.map((w) => w.romaji))];
  if (readings.length < OPTIONS) return [];
  return shuffle(words)
    .slice(0, TOTAL)
    .map((word) => ({
      word,
      options: shuffle([
        word.romaji,
        ...shuffle(readings.filter((r) => r !== word.romaji)).slice(0, OPTIONS - 1),
      ]),
    }));
}

export function WordReadingPractice() {
  const [script, setScript] = useState<Script>("hiragana");
  const [round, setRound] = useState(0);
  const [index, setIndex] = useState(0);
  const [picked, setPicked] = useState<string | null>(null);
  const [correct, setCorrect] = useState(0);
  const words = useQuery({
    queryKey: ["word-reading-practice", script],
    queryFn: () => fetchWords(script),
    staleTime: 10 * 60_000,
  });
  // eslint-disable-next-line react-hooks/exhaustive-deps -- `round` reshuffles a new set on purpose.
  const questions = useMemo(() => buildQuestions(words.data ?? []), [words.data, round]);
  const q = questions[index];
  const finished = questions.length > 0 && index >= questions.length;

  const restart = (next: Script = script) => {
    setScript(next);
    setRound((r) => r + 1);
    setIndex(0);
    setPicked(null);
    setCorrect(0);
  };
  const choose = (option: string) => {
    if (!q || picked) return;
    setPicked(option);
    if (option === q.word.romaji) setCorrect((c) => c + 1);
  };
  const next = () => {
    setPicked(null);
    setIndex((i) => i + 1);
  };

  return (
    <section className="rounded-3xl border bg-card p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-[16px] font-black">Latihan Baca Kata</h2>
          <p className="mt-0.5 text-[10px] text-muted-foreground">Pilih bacaan yang benar.</p>
        </div>
        <span className="rounded-full bg-muted px-2.5 py-1 text-[10px] font-semibold">Gratis</span>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-1 rounded-full bg-muted/50 p-1">
        {(["hiragana", "katakana"] as const).map((value) => (
          <button
            key={value}
            type="button"
            onClick={() => restart(value)}
            className={`min-h-9 rounded-full text-[11px] font-bold ${script === value ? "bg-background shadow-sm" : "text-muted-foreground"}`}
          >
            {value === "hiragana" ? "Hiragana" : "Katakana"}
          </button>
        ))}
      </div>
      {words.isLoading ? (
        <div className="mt-3 h-40 animate-pulse rounded-2xl bg-muted/40" />
      ) : words.isError ? (
        <p className="mt-3 text-center text-[10px] text-destructive">Kata gagal dimuat. Coba lagi.</p>
      ) : questions.length === 0 ? (
        <p className="mt-3 rounded-2xl border p-3 text-center text-[10px] text-muted-foreground">
          Belum ada cukup kata {script === "hiragana" ? "Hiragana" : "Katakana"} untuk latihan ini.
        </p>
      ) : finished ? (
        <div className="mt-4 text-center">
          <p className="text-[14px] font-bold">Latihan selesai</p>
          <p className="mt-1 text-[11px] text-muted-foreground">
            Benar {correct} dari {questions.length}
          </p>
          <button
            type="button"
            onClick={() => restart()}
            className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-primary px-4 py-2.5 text-[11px] font-bold text-primary-foreground"
          >
            <RotateCcw className="size-3.5" /> Ulangi dengan kata lain
          </button>
        </div>
      ) : q ? (
        <>
          <div className="mt-3 flex items-center justify-between text-[10px] text-muted-foreground">
            <span>
              Soal {index + 1} dari {questions.length}
            </span>
            <span>Benar: {correct}</span>
          </div>
          <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-primary"
              style={{ width: `${(index / questions.length) * 100}%` }}
            />
          </div>
          <div className="mt-3 rounded-2xl bg-muted/50 p-4 text-center">
            <p className="text-[10px] text-muted-foreground">Bagaimana cara membaca kata ini?</p>
            <p lang="ja" className="mt-2 font-jp text-[34px] font-bold">
              {q.word.term}
            </p>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2">
            {q.options.map((option, i) => {
              const isAnswer = option === q.word.romaji;
              const state = picked
                ? isAnswer
                  ? "border-primary bg-primary/10"
                  : option === picked
                    ? "border-destructive/50 bg-destructive/5"
                    : "opacity-60"
                : "";
              return (
                <button
                  key={option}
                  type="button"
                  disabled={Boolean(picked)}
                  onClick={() => choose(option)}
                  className={`min-h-14 rounded-2xl border p-2 text-center ${state}`}
                >
                  <span className="block text-[9px] text-muted-foreground">{LETTERS[i]}</span>
                  <span className="block text-[14px] font-semibold">{option}</span>
                </button>
              );
            })}
          </div>
          {picked && (
            <div className="mt-3 text-center">
              <p
                className={`flex items-center justify-center gap-1.5 text-[12px] font-bold ${picked === q.word.romaji ? "text-primary" : "text-destructive"}`}
              >
                {picked === q.word.romaji ? (
                  <CheckCircle2 className="size-4" />
                ) : (
                  <XCircle className="size-4" />
                )}
                {picked === q.word.romaji ? "Benar" : `Jawaban benar: ${q.word.romaji}`}
              </p>
              <p className="mt-1 text-[10px] text-muted-foreground">Arti: {q.word.meaning}</p>
              <button
                type="button"
                onClick={next}
                className="mt-3 inline-flex w-full items-center justify-center gap-1.5 rounded-full bg-primary py-3 text-[12px] font-bold text-primary-foreground"
              >
                {index + 1 < questions.length ? "Soal Berikutnya" : "Lihat Hasil"}{" "}
                <ArrowRight className="size-4" />
              </button>
            </div>
          )}
        </>
      ) : null}
    </section>
  );
}
