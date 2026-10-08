import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { ArrowLeft, CheckCircle2, Eye, EyeOff, RotateCcw, Sparkles, Volume2, XCircle } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";

export const Route = createFileRoute("/_authenticated/kana")({
  head: () => ({ meta: [{ title: "Hiragana & Katakana — ENO NIHONGO" }] }),
  component: KanaPage,
});
type K = { h: string; k: string; r: string };
const basic: K[] = [
  ["あ", "ア", "a"],
  ["い", "イ", "i"],
  ["う", "ウ", "u"],
  ["え", "エ", "e"],
  ["お", "オ", "o"],
  ["か", "カ", "ka"],
  ["き", "キ", "ki"],
  ["く", "ク", "ku"],
  ["け", "ケ", "ke"],
  ["こ", "コ", "ko"],
  ["さ", "サ", "sa"],
  ["し", "シ", "shi"],
  ["す", "ス", "su"],
  ["せ", "セ", "se"],
  ["そ", "ソ", "so"],
  ["た", "タ", "ta"],
  ["ち", "チ", "chi"],
  ["つ", "ツ", "tsu"],
  ["て", "テ", "te"],
  ["と", "ト", "to"],
  ["な", "ナ", "na"],
  ["に", "ニ", "ni"],
  ["ぬ", "ヌ", "nu"],
  ["ね", "ネ", "ne"],
  ["の", "ノ", "no"],
  ["は", "ハ", "ha"],
  ["ひ", "ヒ", "hi"],
  ["ふ", "フ", "fu"],
  ["へ", "ヘ", "he"],
  ["ほ", "ホ", "ho"],
  ["ま", "マ", "ma"],
  ["み", "ミ", "mi"],
  ["む", "ム", "mu"],
  ["め", "メ", "me"],
  ["も", "モ", "mo"],
  ["や", "ヤ", "ya"],
  ["ゆ", "ユ", "yu"],
  ["よ", "ヨ", "yo"],
  ["ら", "ラ", "ra"],
  ["り", "リ", "ri"],
  ["る", "ル", "ru"],
  ["れ", "レ", "re"],
  ["ろ", "ロ", "ro"],
  ["わ", "ワ", "wa"],
  ["を", "ヲ", "wo"],
  ["ん", "ン", "n"],
].map(([h = "", k = "", r = ""]) => ({ h, k, r }));
const voiced: K[] = [
  ["が", "ガ", "ga"],
  ["ぎ", "ギ", "gi"],
  ["ぐ", "グ", "gu"],
  ["げ", "ゲ", "ge"],
  ["ご", "ゴ", "go"],
  ["ざ", "ザ", "za"],
  ["じ", "ジ", "ji"],
  ["ず", "ズ", "zu"],
  ["ぜ", "ゼ", "ze"],
  ["ぞ", "ゾ", "zo"],
  ["だ", "ダ", "da"],
  ["ぢ", "ヂ", "ji"],
  ["づ", "ヅ", "zu"],
  ["で", "デ", "de"],
  ["ど", "ド", "do"],
  ["ば", "バ", "ba"],
  ["び", "ビ", "bi"],
  ["ぶ", "ブ", "bu"],
  ["べ", "ベ", "be"],
  ["ぼ", "ボ", "bo"],
  ["ぱ", "パ", "pa"],
  ["ぴ", "ピ", "pi"],
  ["ぷ", "プ", "pu"],
  ["ぺ", "ペ", "pe"],
  ["ぽ", "ポ", "po"],
].map(([h = "", k = "", r = ""]) => ({ h, k, r }));
const yoon: K[] = [
  ["きゃ", "キャ", "kya"],
  ["きゅ", "キュ", "kyu"],
  ["きょ", "キョ", "kyo"],
  ["しゃ", "シャ", "sha"],
  ["しゅ", "シュ", "shu"],
  ["しょ", "ショ", "sho"],
  ["ちゃ", "チャ", "cha"],
  ["ちゅ", "チュ", "chu"],
  ["ちょ", "チョ", "cho"],
  ["にゃ", "ニャ", "nya"],
  ["にゅ", "ニュ", "nyu"],
  ["にょ", "ニョ", "nyo"],
  ["ひゃ", "ヒャ", "hya"],
  ["ひゅ", "ヒュ", "hyu"],
  ["ひょ", "ヒョ", "hyo"],
  ["みゃ", "ミャ", "mya"],
  ["みゅ", "ミュ", "myu"],
  ["みょ", "ミョ", "myo"],
  ["りゃ", "リャ", "rya"],
  ["りゅ", "リュ", "ryu"],
  ["りょ", "リョ", "ryo"],
  ["ぎゃ", "ギャ", "gya"],
  ["ぎゅ", "ギュ", "gyu"],
  ["ぎょ", "ギョ", "gyo"],
  ["じゃ", "ジャ", "ja"],
  ["じゅ", "ジュ", "ju"],
  ["じょ", "ジョ", "jo"],
  ["びゃ", "ビャ", "bya"],
  ["びゅ", "ビュ", "byu"],
  ["びょ", "ビョ", "byo"],
  ["ぴゃ", "ピャ", "pya"],
  ["ぴゅ", "ピュ", "pyu"],
  ["ぴょ", "ピョ", "pyo"],
].map(([h = "", k = "", r = ""]) => ({ h, k, r }));

type PracticeScript = "h" | "k" | "mix";
type PracticeMode = "kana-romaji" | "romaji-kana" | "similar";
type PracticeQuestion = {
  prompt: string;
  answer: string;
  options: string[];
  script: "h" | "k";
};

const confusing: Array<[string, string]> = [
  ["シ", "ツ"],
  ["ソ", "ン"],
  ["ぬ", "め"],
  ["れ", "わ"],
  ["さ", "き"],
  ["ク", "ケ"],
  ["ウ", "ワ"],
];

function shuffle<T>(values: T[]) {
  return [...values].sort(() => Math.random() - 0.5);
}

function buildQuestion(pool: K[], script: PracticeScript, mode: PracticeMode): PracticeQuestion {
  const chosenScript: "h" | "k" = script === "mix" ? (Math.random() < 0.5 ? "h" : "k") : script;
  const source = shuffle(pool)[0]!;
  if (mode === "similar") {
    const pairs = confusing.filter(([a, b]) =>
      chosenScript === "h" ? /[ぁ-ゖ]/.test(a + b) : /[ァ-ヺ]/.test(a + b),
    );
    const pair = shuffle(pairs)[0];
    if (pair) {
      const answer = Math.random() < 0.5 ? pair[0] : pair[1];
      const row = pool.find((x) => x[chosenScript] === answer);
      if (row) {
        const alternatives = shuffle(pool.filter((x) => x !== row)).slice(0, 2).map((x) => x[chosenScript]);
        return { prompt: row.r, answer, options: shuffle([answer, pair.find((x) => x !== answer)!, ...alternatives]).slice(0, 4), script: chosenScript };
      }
    }
  }
  if (mode === "romaji-kana") {
    const answer = source[chosenScript];
    const options = shuffle(pool.filter((x) => x.r !== source.r)).slice(0, 3).map((x) => x[chosenScript]);
    return { prompt: source.r, answer, options: shuffle([answer, ...options]), script: chosenScript };
  }
  const answer = source.r;
  const options = shuffle(pool.filter((x) => x.r !== source.r)).slice(0, 3).map((x) => x.r);
  return { prompt: source[chosenScript], answer, options: shuffle([answer, ...options]), script: chosenScript };
}

function KanaPractice({ pool }: { pool: K[] }) {
  const [script, setScript] = useState<PracticeScript>("h");
  const [mode, setMode] = useState<PracticeMode>("kana-romaji");
  const [active, setActive] = useState(false);
  const [question, setQuestion] = useState<PracticeQuestion | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [correct, setCorrect] = useState(0);
  const [answered, setAnswered] = useState(0);
  const total = 10;

  const next = (nextMode = mode, nextScript = script) => {
    setQuestion(buildQuestion(pool, nextScript, nextMode));
    setSelected(null);
  };
  const start = () => {
    setCorrect(0);
    setAnswered(0);
    setActive(true);
    next();
  };
  const choose = (value: string) => {
    if (!question || selected) return;
    setSelected(value);
    setAnswered((v) => v + 1);
    if (value === question.answer) setCorrect((v) => v + 1);
  };
  const advance = () => {
    if (answered >= total) {
      setActive(false);
      setQuestion(null);
      setSelected(null);
      return;
    }
    next();
  };

  if (!active || !question) {
    return (
      <section className="rounded-2xl border border-primary/20 bg-primary/[.04] p-4 shadow-sm">
        <div className="flex items-start gap-3">
          <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary"><Sparkles className="size-4" /></span>
          <div className="min-w-0 flex-1">
            <h2 className="text-[13px] font-black">Latihan Kana</h2>
            <p className="mt-0.5 text-[9px] leading-4 text-muted-foreground">Kenali huruf dari dua arah dan latih bentuk yang sering tertukar.</p>
          </div>
          {answered > 0 && <span className="text-[9px] font-bold text-primary">{correct}/{answered}</span>}
        </div>
        <div className="mt-3 grid grid-cols-3 gap-1 rounded-xl bg-muted p-1">
          {([["h","Hiragana"],["k","Katakana"],["mix","Campuran"]] as const).map(([value,label]) => (
            <button key={value} type="button" onClick={() => setScript(value)} className={`rounded-lg px-1 py-2 text-[9px] font-bold ${script === value ? "bg-background shadow-sm" : "text-muted-foreground"}`}>{label}</button>
          ))}
        </div>
        <div className="mt-2 grid grid-cols-3 gap-1.5">
          {([["kana-romaji","Kana → Romaji"],["romaji-kana","Romaji → Kana"],["similar","Mirip"]] as const).map(([value,label]) => (
            <button key={value} type="button" onClick={() => setMode(value)} className={`min-h-10 rounded-xl border px-2 text-[9px] font-bold ${mode === value ? "border-primary/30 bg-primary/10 text-primary" : "bg-card"}`}>{label}</button>
          ))}
        </div>
        <button type="button" onClick={start} className="mt-3 min-h-10 w-full rounded-xl bg-primary px-4 text-[10px] font-bold text-primary-foreground">Mulai 10 Soal</button>
      </section>
    );
  }

  const finished = answered >= total && selected;
  return (
    <section className="rounded-2xl border bg-card p-4 shadow-sm">
      <div className="flex items-center justify-between">
        <p className="text-[10px] font-bold text-primary">Latihan Kana</p>
        <span className="text-[9px] text-muted-foreground">{Math.min(answered + (selected ? 0 : 1), total)} / {total}</span>
      </div>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-primary transition-all" style={{ width: `${Math.min(100, (answered / total) * 100)}%` }} /></div>
      <div className="py-6 text-center">
        <p className="text-[9px] text-muted-foreground">{mode === "kana-romaji" ? "Apa bacaan kana ini?" : mode === "romaji-kana" ? "Pilih kana yang benar" : "Pilih bentuk kana yang benar"}</p>
        <p lang={mode === "kana-romaji" ? "ja" : undefined} className={`mt-2 font-black ${mode === "kana-romaji" ? "font-jp text-[48px]" : "text-[24px]"}`}>{question.prompt}</p>
      </div>
      <div className="grid grid-cols-2 gap-2">
        {question.options.map((option) => {
          const isAnswer = option === question.answer;
          const isSelected = option === selected;
          const state = selected ? (isAnswer ? "border-primary bg-primary/10 text-primary" : isSelected ? "border-destructive/40 bg-destructive/5 text-destructive" : "bg-card") : "bg-card hover:bg-muted/50";
          return <button key={option} type="button" disabled={Boolean(selected)} onClick={() => choose(option)} className={`min-h-12 rounded-xl border px-3 text-[13px] font-bold ${state}`}>{option}</button>;
        })}
      </div>
      {selected && (
        <div className="mt-3">
          <p className={`flex items-center justify-center gap-1.5 text-[10px] font-bold ${selected === question.answer ? "text-primary" : "text-destructive"}`}>
            {selected === question.answer ? <CheckCircle2 className="size-4" /> : <XCircle className="size-4" />}
            {selected === question.answer ? "Benar" : `Jawaban: ${question.answer}`}
          </p>
          <button type="button" onClick={advance} className="mt-3 min-h-10 w-full rounded-xl bg-primary text-[10px] font-bold text-primary-foreground">{finished ? `Selesai · ${correct}/${total}` : "Selanjutnya"}</button>
        </div>
      )}
      <button type="button" onClick={() => { setActive(false); setQuestion(null); setSelected(null); }} className="mt-2 flex min-h-9 w-full items-center justify-center gap-1 text-[9px] font-semibold text-muted-foreground"><RotateCcw className="size-3.5" /> Ganti latihan</button>
    </section>
  );
}

function speakKana(text: string, onError: () => void) {
  if (!("speechSynthesis" in window)) {
    onError();
    return;
  }
  window.speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.lang = "ja-JP";
  u.rate = 0.8;
  u.onerror = onError;
  window.speechSynthesis.speak(u);
}
function Grid({
  items,
  script,
  romaji,
  onAudioError,
}: {
  items: K[];
  script: "h" | "k";
  romaji: boolean;
  onAudioError: () => void;
}) {
  return (
    <div className="grid grid-cols-5 gap-1.5">
      {items.map((x, i) => (
        <button
          type="button"
          key={`${x.r}-${i}`}
          onClick={() => speakKana(x[script], onAudioError)}
          aria-label={`Putar bunyi ${x[script]}, ${x.r}`}
          className="group min-h-[68px] rounded-2xl border bg-card px-1 py-2.5 text-center shadow-sm transition-transform hover:-translate-y-0.5 hover:bg-primary/[.05] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary motion-reduce:transition-none motion-reduce:hover:translate-y-0"
        >
          <p lang="ja" className="font-jp text-[26px] font-semibold leading-8">
            {x[script]}
          </p>
          {romaji && <p className="mt-0.5 text-[10px] font-medium text-muted-foreground">{x.r}</p>}
          <Volume2
            aria-hidden="true"
            className="mx-auto mt-1 size-3 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100 motion-reduce:transition-none"
          />
        </button>
      ))}
    </div>
  );
}
function KanaPage() {
  const [script, setScriptState] = useState<"h" | "k">(() =>
    typeof window !== "undefined" &&
    new URLSearchParams(window.location.search).get("script") === "k"
      ? "k"
      : "h",
  );
  const [romaji, setRomaji] = useState(
      () => typeof window === "undefined" || localStorage.getItem("eno:kana:romaji") !== "0",
    ),
    [audioError, setAudioError] = useState(false);
  const setScript = (next: "h" | "k") => {
    setScriptState(next);
    const url = new URL(window.location.href);
    url.searchParams.set("script", next);
    window.history.replaceState(null, "", url);
  };
  const toggleRomaji = () =>
    setRomaji((v) => {
      const next = !v;
      localStorage.setItem("eno:kana:romaji", next ? "1" : "0");
      return next;
    });
  return (
    <AppShell compact title="Hiragana & Katakana">
      <div className="mx-auto w-full max-w-lg space-y-5 pb-[max(1rem,env(safe-area-inset-bottom))]">
        <Link
          to="/belajar"
          className="inline-flex items-center gap-1.5 rounded-xl border bg-card px-3 py-2 text-[10px] font-bold text-foreground"
        >
          <ArrowLeft className="size-4" /> Kembali ke Materi
        </Link>
        <section className="rounded-2xl border bg-card p-4 shadow-sm">
          <h1 className="text-[22px] font-black tracking-tight">Hiragana & Katakana</h1>
          <p className="mt-1 text-[11px] leading-4 text-muted-foreground">
            Tekan setiap huruf untuk mendengar pengucapannya. Dasar kana lengkap dan tidak terikat
            level JLPT.
          </p>
        </section>
        <div className="flex gap-2">
          <div className="grid flex-1 grid-cols-2 rounded-xl bg-muted p-1">
            <button
              type="button"
              onClick={() => setScript("h")}
              className={`rounded-lg py-2 text-[11px] font-bold ${script === "h" ? "bg-background shadow-sm" : "text-muted-foreground"}`}
            >
              Hiragana
            </button>
            <button
              type="button"
              onClick={() => setScript("k")}
              className={`rounded-lg py-2 text-[11px] font-bold ${script === "k" ? "bg-background shadow-sm" : "text-muted-foreground"}`}
            >
              Katakana
            </button>
          </div>
          <button
            type="button"
            onClick={toggleRomaji}
            className="flex min-h-11 items-center gap-1.5 rounded-xl border bg-card px-3 text-[11px] font-semibold shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            {romaji ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
            {romaji ? "Sembunyikan" : "Tampilkan"} romaji
          </button>
        </div>
        <KanaPractice pool={[...basic, ...voiced, ...yoon]} />
        {audioError && (
          <p
            role="alert"
            className="rounded-xl bg-destructive/5 p-3 text-center text-[11px] text-destructive"
          >
            Audio tidak tersedia di perangkat ini.
          </p>
        )}
        <section>
          <h2 className="mb-2 text-[12px] font-bold">Gojūon · Dasar</h2>
          <Grid
            items={basic}
            script={script}
            romaji={romaji}
            onAudioError={() => setAudioError(true)}
          />
        </section>
        <section>
          <h2 className="mb-2 text-[12px] font-bold">Dakuten & Handakuten</h2>
          <Grid
            items={voiced}
            script={script}
            romaji={romaji}
            onAudioError={() => setAudioError(true)}
          />
        </section>
        <section>
          <h2 className="mb-2 text-[12px] font-bold">Yōon · Kombinasi kecil ゃゅょ</h2>
          <Grid
            items={yoon}
            script={script}
            romaji={romaji}
            onAudioError={() => setAudioError(true)}
          />
        </section>
        <p className="rounded-xl bg-primary/5 p-3 text-[10px] leading-4 text-muted-foreground">
          Catatan: っ / ッ menandai konsonan rangkap, sedangkan ー umum dipakai di Katakana untuk
          memanjangkan bunyi vokal.
        </p>
      </div>
    </AppShell>
  );
}
