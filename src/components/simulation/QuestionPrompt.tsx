import { Fragment, type ReactNode } from "react";

type Props = {
  text: string;
  className?: string | undefined;
  /** Exact substring being asked about (kanji, kana, word or grammar part). */
  target?: string | null | undefined;
  /** 1-based occurrence of `target` to mark when it appears more than once. */
  occurrence?: number | null | undefined;
};

const tokenPattern = /[『「][^』」]+[』」]|[（(]\s*[）)]|[_＿]{2,}|★/g;

function Target({ children }: { children: ReactNode }) {
  return <span className="font-bold text-primary underline decoration-2 decoration-primary underline-offset-[6px]">{children}</span>;
}

function renderTokens(text: string, keyPrefix: string) {
  const parts = text.split(tokenPattern);
  const tokens = text.match(tokenPattern) ?? [];

  return parts.map((part, index) => {
    const token = tokens[index];
    const quoted = token?.match(/^([『「])(.+)[』」]$/);

    return <Fragment key={`${keyPrefix}-${part}-${index}`}>
      {part}
      {token && (quoted ? <><span>{quoted[1]}</span><Target>{quoted[2]}</Target><span>{token[token.length - 1]}</span></> : <Target>{token}</Target>)}
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

/** Renders the part explicitly being tested without altering the question text. */
export function QuestionPrompt({ text, className, target, occurrence }: Props) {
  const at = target ? nthIndexOf(text, target, Math.max(1, occurrence ?? 1)) : -1;

  if (target && at >= 0) {
    return <span className={className} lang="ja">
      {renderTokens(text.slice(0, at), "before")}
      <Target>{target}</Target>
      {renderTokens(text.slice(at + target.length), "after")}
    </span>;
  }

  return <span className={className} lang="ja">{renderTokens(text, "all")}</span>;
}
