import { BookOpenText } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { QuestionPrompt } from "@/components/simulation/QuestionPrompt";

type QuestionLike = {
  question_type: string;
  prompt_jp: string;
  choices: string[];
  target_text?: string | null | undefined;
  target_occurrence?: number | null | undefined;
};

/** Shared question card (prompt + options) used by every simulation runner. */
export function QuestionCard({
  q,
  number,
  selected,
  onSelect,
}: {
  q: QuestionLike;
  number: number;
  selected: number | undefined;
  onSelect: (i: number) => void;
}) {
  const star = q.question_type === "sentence_composition";
  const framed =
    star ||
    /[A-ZＡ-Ｚ一-龥ぁ-んァ-ヶー]{1,8}「[^」]*」\s*[A-ZＡ-Ｚ一-龥ぁ-んァ-ヶー]{1,8}「/.test(
      q.prompt_jp,
    );
  return (
    <Card className="rounded-2xl">
      <CardContent className="space-y-4 p-4">
        <div className="flex items-center justify-between gap-2">
          <span className="text-[10px] font-semibold text-muted-foreground">問 {number}</span>
          {star && (
            <span className="rounded-md bg-primary/10 px-2 py-1 text-[10px] font-bold text-primary">
              ★ 文の組み立て
            </span>
          )}
        </div>
        {star && (
          <p className="text-[11px] text-muted-foreground">
            文全体が正しくなるように並べたとき、★に入るものを選んでください。
          </p>
        )}
        <div
          className={`font-jp text-[15px] font-semibold leading-9 ${framed ? "rounded-xl border bg-muted/40 p-4" : ""}`}
        >
          <QuestionPrompt
            text={q.prompt_jp}
            target={q.target_text}
            occurrence={q.target_occurrence}
          />
        </div>
        <div className={star ? "grid grid-cols-1 gap-2 min-[380px]:grid-cols-2" : "space-y-2"}>
          {q.choices.map((choice, i) => (
            <button
              key={i}
              type="button"
              onClick={() => onSelect(i)}
              className={`flex w-full min-w-0 items-center gap-3 rounded-xl border p-3 text-left font-jp text-[13px] leading-6 [overflow-wrap:anywhere] ${selected === i ? "border-primary bg-primary/5 ring-1 ring-primary/30" : ""}`}
            >
              <span className="grid size-6 shrink-0 place-items-center rounded-full border font-bold">
                {i + 1}
              </span>
              <span className="min-w-0 flex-1">{choice}</span>
            </button>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

/** Reading area: title, paragraphs (kept separate), and which question of the passage set is shown. */
export function PassagePanel({
  title,
  text,
  position,
}: {
  title?: string | null | undefined;
  text: string;
  position?: { index: number; total: number } | undefined;
}) {
  const paragraphs = text
    .split(/\n+/)
    .map((p) => p.trim())
    .filter(Boolean);
  return (
    <Card className="rounded-2xl border-primary/25 bg-muted/20">
      <CardContent className="p-4">
        <div className="mb-3 flex items-center justify-between gap-2 border-b pb-2 text-primary">
          <span className="flex min-w-0 items-center gap-2">
            <BookOpenText className="size-4 shrink-0" />
            <span className="truncate text-xs font-semibold">{title || "文章"}</span>
          </span>
          {position && position.total > 1 && (
            <span className="shrink-0 text-[10px] font-semibold text-muted-foreground">
              この文章の問 {position.index}/{position.total}
            </span>
          )}
        </div>
        <div
          className="max-h-[46vh] space-y-3 overflow-y-auto overscroll-contain pr-1 font-jp text-[15px] leading-8 [overflow-wrap:anywhere]"
          lang="ja"
        >
          {paragraphs.map((p, i) => (
            <p key={i} className="indent-[1em]">
              {p}
            </p>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

/** Position of `current` within the questions that share its passage (same section, mondai and text). */
export function passagePosition<
  T extends { id: string; section?: string; mondai_no: number; passage_jp?: string | null },
>(questions: T[], current: T) {
  const same = questions.filter(
    (x) =>
      x.section === current.section &&
      x.mondai_no === current.mondai_no &&
      x.passage_jp === current.passage_jp,
  );
  return { index: same.findIndex((x) => x.id === current.id) + 1, total: same.length };
}
