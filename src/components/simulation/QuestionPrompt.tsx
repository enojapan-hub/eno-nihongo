import { Fragment, type ReactNode } from "react";

type Props = {
  text: string;
  className?: string | undefined;
  /** Exact substring being asked about (kanji, kana, word or grammar part). */
  target?: string | null | undefined;
  /** 1-based occurrence of `target` to mark when it appears more than once. */
  occurrence?: number | null | undefined;
};

// Only structural markers (blank, ordering slots, star) are rendered specially.
// Quoted text (「…」 dialogue or quotations) is never highlighted: use `target` for the tested part.
const tokenPattern = /[（(]\s*[）)]|[_＿]{2,}|★/g;
const speakerPattern = /\s*([A-ZＡ-Ｚ]|[一-龥ァ-ヶぁ-んー]{1,8})「/y;

const wrap = "[overflow-wrap:anywhere]";

function Target({ children }: { children: ReactNode }) {
  return <span className="font-bold text-primary underline decoration-2 decoration-primary underline-offset-[6px]">{children}</span>;
}

/** One answer slot of a sentence-ordering question; wraps as a single unit. */
function Slot({ star }: { star: boolean }) {
  return <span aria-hidden={!star} className={`mx-1 inline-block min-w-[2.75em] whitespace-nowrap border-b-2 text-center align-baseline ${star ? "border-primary font-bold text-primary" : "border-foreground/40"}`}>{star ? "★" : " "}</span>;
}

function renderTokens(text: string, keyPrefix: string) {
  const parts = text.split(tokenPattern);
  const tokens = text.match(tokenPattern) ?? [];

  return parts.map((part, index) => {
    const token = tokens[index];

    return <Fragment key={`${keyPrefix}-${index}`}>
      {part}
      {token && (token === "★" ? <Slot star /> : /^[_＿]/.test(token) ? <Slot star={false} /> : <Target>{token}</Target>)}
    </Fragment>;
  });
}

/** Index of the n-th (1-based) occurrence of `target` in `text`, or -1. */
function nthIndexOf(text: string, target: string, occurrence: number) {
  let from = 0;
  for (let n = 1; ; n++) {
    const at = text.indexOf(target, from);
    if (at < 0 || n === occurrence) return at;
    from = at + target.length;
  }
}

type Line = { speaker: string; start: number; end: number };

/** Splits `A「…」B「…」` / `田中「…」山田「…」` text into speaker lines (offsets keep the 「」). */
function splitDialogue(text: string): { lines: Line[]; tail: [number, number] | null } | null {
  const lines: Line[] = [];
  let pos = 0;
  for (;;) {
    speakerPattern.lastIndex = pos;
    const m = speakerPattern.exec(text);
    if (!m) break;
    const open = m.index + m[0].length - 1;
    const close = text.indexOf("」", open);
    if (close < 0) break;
    lines.push({ speaker: m[1] ?? "", start: open, end: close + 1 });
    pos = close + 1;
  }
  if (lines.length < 2) return null;
  const tail = text.slice(pos).trim() ? ([pos, text.length] as [number, number]) : null;
  return { lines, tail };
}

/** Renders text[from, to) with the explicit target range (if it overlaps) marked. */
function renderRange(text: string, from: number, to: number, mark: [number, number] | null, keyPrefix: string) {
  if (!mark || mark[1] <= from || mark[0] >= to) return renderTokens(text.slice(from, to), keyPrefix);
  const a = Math.max(from, mark[0]);
  const b = Math.min(to, mark[1]);
  return <>
    {renderTokens(text.slice(from, a), `${keyPrefix}-a`)}
    <Target>{text.slice(a, b)}</Target>
    {renderTokens(text.slice(b, to), `${keyPrefix}-b`)}
  </>;
}

/** Renders the tested part explicitly, keeps dialogue readable, and never alters the question text. */
export function QuestionPrompt({ text, className, target, occurrence }: Props) {
  const at = target ? nthIndexOf(text, target, Math.max(1, occurrence ?? 1)) : -1;
  const mark: [number, number] | null = target && at >= 0 ? [at, at + target.length] : null;
  const dialogue = splitDialogue(text);

  if (dialogue) {
    return <span className={`${className ?? ""} ${wrap} grid grid-cols-[auto_minmax(0,1fr)] items-baseline gap-x-2 gap-y-2`} lang="ja">
      {dialogue.lines.map((line, i) => <Fragment key={i}>
        <span className="text-xs font-bold text-muted-foreground">{line.speaker}</span>
        <span className="min-w-0">{renderRange(text, line.start, line.end, mark, `l${i}`)}</span>
      </Fragment>)}
      {dialogue.tail && <span className="col-span-2">{renderRange(text, dialogue.tail[0], dialogue.tail[1], mark, "tail")}</span>}
    </span>;
  }

  return <span className={`${className ?? ""} ${wrap}`} lang="ja">{renderRange(text, 0, text.length, mark, "all")}</span>;
}
