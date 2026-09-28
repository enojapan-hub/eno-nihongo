import { Fragment } from "react";

type Props = {
  text: string;
  className?: string;
};

const tokenPattern = /[『「][^』」]+[』」]|[（(]\s*[）)]|[_＿]{2,}|★/g;

function Target({ children }: { children: string }) {
  return <span className="font-bold text-primary underline decoration-2 decoration-primary underline-offset-[6px]">{children}</span>;
}

/** Renders the part explicitly being tested without altering the question text. */
export function QuestionPrompt({ text, className }: Props) {
  const parts = text.split(tokenPattern);
  const tokens = text.match(tokenPattern) ?? [];

  return <span className={className} lang="ja">
    {parts.map((part, index) => {
      const token = tokens[index];
      const quoted = token?.match(/^([『「])(.+)[』」]$/);

      return <Fragment key={`${part}-${index}`}>
        {part}
        {token && (quoted ? <><span>{quoted[1]}</span><Target>{quoted[2]}</Target><span>{token[token.length - 1]}</span></> : <Target>{token}</Target>)}
      </Fragment>;
    })}
  </span>;
}
