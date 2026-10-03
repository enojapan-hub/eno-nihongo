import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { ArrowLeft, Eye, EyeOff, Volume2 } from "lucide-react";
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
