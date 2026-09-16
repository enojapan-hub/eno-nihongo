import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  BrainCircuit,
  ChevronRight,
  Link2,
  RotateCcw,
  TriangleAlert,
} from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { fetchKanjiList, fetchGrammarList, type Level } from "@/lib/learn-queries";
import { fetchVocabListResilient } from "@/lib/vocab-resilient";
import { fetchTargetLevel } from "@/lib/target-level";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/rantai-ingatan")({
  head: () => ({ meta: [{ title: "Rantai Ingatan — ENO NIHONGO" }] }),
  component: MemoryChainPage,
});

type Kind = "kanji" | "vocabulary" | "grammar";
type Step = {
  label: string;
  front: string;
  back: string;
  sub?: string;
  itemId: string;
  itemType: Kind;
  aspect: "meaning_reading" | "meaning_usage" | "function_context";
};
type Chain = { key: string; title: string; steps: Step[] };

async function saveChainReview(step: Step, level: Level, correct: boolean, responseMs: number) {
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return;

  const rating = correct ? 2 : 0;
  const { error } = await (supabase as any).from("flashcard_reviews").insert({
    user_id: userData.user.id,
    item_type: step.itemType,
    item_id: step.itemId,
    level,
    rating,
    direction: "chain",
    aspect: step.aspect,
    used_hint: false,
    response_ms: responseMs,
  });
  if (error) throw error;

  await (supabase as any).rpc("record_learning_activity", {
    p_activity_type: "flashcard_reviewed",
    p_content_type: step.itemType,
    p_content_id: step.itemId,
    p_points: correct ? 5 : 1,
    p_xp: correct ? 5 : 1,
    p_correct: correct,
    p_duration_seconds: Math.max(1, Math.round(responseMs / 1000)),
    p_metadata: { level, rating, direction: "chain", mode: "memory_chain", aspect: step.aspect },
  });
}

function MemoryChainPage() {
  const queryClient = useQueryClient();
  const target = useQuery({ queryKey: ["target-level"], queryFn: fetchTargetLevel });
  const level = target.data as Level | undefined;
  const ready = !!level;
  const kanji = useQuery({
    queryKey: ["chain-kanji", level],
    queryFn: () => fetchKanjiList(level!),
    enabled: ready,
  });
  const vocab = useQuery({
    queryKey: ["chain-vocab", level],
    queryFn: () => fetchVocabListResilient(level!),
    enabled: ready,
  });
  const grammar = useQuery({
    queryKey: ["chain-grammar", level],
    queryFn: () => fetchGrammarList(level!),
    enabled: ready,
  });

  const chains = useMemo<Chain[]>(() => {
    const kanjiRows = (kanji.data ?? []) as any[];
    const vocabRows = (vocab.data ?? []) as any[];
    const grammarRows = (grammar.data ?? []) as any[];

    return kanjiRows
      .map((kanjiItem) => {
        const related = vocabRows
          .filter((item) => String(item.term ?? "").includes(String(kanjiItem.character ?? "")))
          .slice(0, 2);
        if (!related.length) return null;
        const word = related[0];
        const example = Array.isArray(word.examples) ? word.examples[0] : word.examples;
        const exampleText =
          typeof example === "string"
            ? example
            : String(example?.jp ?? example?.japanese ?? example?.sentence ?? "");
        const grammarHit = grammarRows.find(
          (item) => exampleText && String(exampleText).includes(String(item.pattern ?? "")),
        );
        const steps: Step[] = [
          {
            label: "1 · Kanji",
            front: kanjiItem.character,
            back: kanjiItem.meaning_id,
            sub: [
              kanjiItem.onyomi && `On: ${kanjiItem.onyomi}`,
              kanjiItem.kunyomi && `Kun: ${kanjiItem.kunyomi}`,
            ]
              .filter(Boolean)
              .join(" · "),
            itemId: kanjiItem.id,
            itemType: "kanji",
            aspect: "meaning_reading",
          },
          {
            label: "2 · Kotoba",
            front: word.term,
            back: word.meaning_id,
            sub: word.reading,
            itemId: word.id,
            itemType: "vocabulary",
            aspect: "meaning_usage",
          },
        ];
        if (related[1])
          steps.push({
            label: "3 · Hubungan",
            front: related[1].term,
            back: related[1].meaning_id,
            sub: related[1].reading,
            itemId: related[1].id,
            itemType: "vocabulary",
            aspect: "meaning_usage",
          });
        if (exampleText)
          steps.push({
            label: `${steps.length + 1} · Konteks`,
            front: exampleText,
            back: word.meaning_id,
            sub: "Temukan kembali kata yang baru dipelajari di dalam konteks.",
            itemId: word.id,
            itemType: "vocabulary",
            aspect: "meaning_usage",
          });
        if (grammarHit)
          steps.push({
            label: `${steps.length + 1} · Bunpou`,
            front: grammarHit.pattern,
            back: grammarHit.meaning_id,
            sub: grammarHit.structure,
            itemId: grammarHit.id,
            itemType: "grammar",
            aspect: "function_context",
          });
        return { key: kanjiItem.id, title: kanjiItem.character, steps };
      })
      .filter(Boolean)
      .slice(0, 40) as Chain[];
  }, [kanji.data, vocab.data, grammar.data]);

  const [chainIndex, setChainIndex] = useState(0);
  const [stepIndex, setStepIndex] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [saving, setSaving] = useState(false);
  const startedAt = useRef(Date.now());
  const chain = chains[chainIndex];
  const step = chain?.steps[stepIndex];

  function next() {
    if (!chain) return;
    if (stepIndex < chain.steps.length - 1) setStepIndex((value) => value + 1);
    else {
      setChainIndex((value) => (value + 1) % chains.length);
      setStepIndex(0);
    }
    setRevealed(false);
    startedAt.current = Date.now();
  }

  async function answer(correct: boolean) {
    if (!step || !level || saving) return;
    setSaving(true);
    try {
      await saveChainReview(step, level, correct, Date.now() - startedAt.current);
      void queryClient.invalidateQueries({ queryKey: ["target-weakness-v2", level] });
      void queryClient.invalidateQueries({ queryKey: ["weakness-map", level] });
      void queryClient.invalidateQueries({ queryKey: ["adaptive-plan"] });
      next();
    } catch (error) {
      console.error("Gagal menyimpan hasil Rantai Ingatan", error);
    } finally {
      setSaving(false);
    }
  }

  function reset() {
    setChainIndex(0);
    setStepIndex(0);
    setRevealed(false);
    startedAt.current = Date.now();
  }
  if (!level)
    return (
      <AppShell compact title="Rantai Ingatan">
        <p className="p-6 text-center text-xs text-muted-foreground">Memuat level profil…</p>
      </AppShell>
    );

  return (
    <AppShell compact title="Rantai Ingatan">
      <div className="mx-auto w-full max-w-md space-y-3 pb-4">
        <a
          href="/belajar"
          className="inline-flex items-center gap-1.5 rounded-xl border bg-card px-3 py-2 text-[10px] font-bold"
        >
          <ArrowLeft className="size-4" /> Kembali ke Materi
        </a>
        <section className="rounded-3xl border bg-gradient-to-b from-emerald-50 to-card p-4">
          <div className="flex items-center gap-3">
            <span className="grid size-11 place-items-center rounded-2xl bg-primary/10">
              <BrainCircuit className="size-6 text-primary" />
            </span>
            <div>
              <p className="text-[9px] font-bold uppercase tracking-widest text-primary">
                Fitur ENO
              </p>
              <h1 className="text-[18px] font-bold">Rantai Ingatan</h1>
              <p className="text-[9px] text-muted-foreground">
                Kanji → Kotoba → Konteks → Bunpou terkait
              </p>
            </div>
          </div>
        </section>
        <a
          href="/jebakan-ingatan"
          className="flex items-center gap-3 rounded-2xl border border-amber-200 bg-amber-50/70 p-3"
        >
          <span className="grid size-9 place-items-center rounded-xl bg-amber-100 text-amber-700">
            <TriangleAlert className="size-4" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-bold text-amber-900">Jebakan Ingatan</p>
            <p className="text-[8px] text-amber-800/70">
              Pasangan membingungkan + deteksi “merasa hafal”
            </p>
          </div>
          <ChevronRight className="size-4 text-amber-700" />
        </a>
        {!chain || !step ? (
          <section className="rounded-2xl border bg-card p-5 text-center text-[10px] text-muted-foreground">
            Belum ditemukan rantai materi yang cukup untuk {level}.
          </section>
        ) : (
          <>
            <div className="flex items-center justify-between text-[9px] text-muted-foreground">
              <span>
                Rantai {chainIndex + 1}/{chains.length}
              </span>
              <span className="inline-flex items-center gap-1 font-bold text-primary">
                <Link2 className="size-3" />
                {stepIndex + 1}/{chain.steps.length}
              </span>
            </div>
            <div className="flex gap-1">
              {chain.steps.map((_, index) => (
                <span
                  key={index}
                  className={`h-1.5 flex-1 rounded-full ${index <= stepIndex ? "bg-primary" : "bg-muted"}`}
                />
              ))}
            </div>
            <button
              onClick={() => setRevealed((value) => !value)}
              className="min-h-[270px] w-full rounded-[28px] border bg-card p-6 text-center shadow-[0_18px_45px_-24px_rgba(0,0,0,.45)] transition-transform active:scale-[.99]"
            >
              <span className="rounded-full bg-primary/10 px-3 py-1 text-[8px] font-bold uppercase tracking-widest text-primary">
                {step.label}
              </span>
              <p className="mt-8 font-jp text-[30px] font-bold leading-relaxed">{step.front}</p>
              {revealed ? (
                <div className="mt-6 border-t pt-5">
                  <p className="text-[15px] font-semibold">{step.back}</p>
                  {step.sub && (
                    <p className="mt-2 font-jp text-[10px] leading-5 text-muted-foreground">
                      {step.sub}
                    </p>
                  )}
                </div>
              ) : (
                <p className="mt-8 text-[10px] text-muted-foreground">
                  Ingat jawabannya, lalu ketuk kartu
                </p>
              )}
            </button>
            {revealed ? (
              <div className="grid grid-cols-2 gap-2">
                <button
                  disabled={saving}
                  onClick={() => void answer(false)}
                  className="rounded-2xl border border-red-200 bg-red-50 py-3 text-[10px] font-bold text-red-700 disabled:opacity-60"
                >
                  Belum ingat
                </button>
                <button
                  disabled={saving}
                  onClick={() => void answer(true)}
                  className="rounded-2xl bg-primary py-3 text-[10px] font-bold text-primary-foreground disabled:opacity-60"
                >
                  {saving ? "Menyimpan…" : "Masih ingat"}
                </button>
              </div>
            ) : (
              <button
                onClick={() => setRevealed(true)}
                className="w-full rounded-2xl border bg-card py-3 text-[10px] font-bold"
              >
                Buka Jawaban
              </button>
            )}
            <button
              onClick={reset}
              className="mx-auto flex items-center gap-1 text-[9px] text-muted-foreground"
            >
              <RotateCcw className="size-3" /> Mulai ulang rantai
            </button>
          </>
        )}
      </div>
    </AppShell>
  );
}
