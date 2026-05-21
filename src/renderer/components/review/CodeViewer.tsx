import { useEffect, useMemo, useState } from "react";
import {
  currentCodeTheme,
  tokenizeLines,
  type ShikiToken,
} from "./highlighter";
import { cn } from "../../lib/cn";

interface CodeViewerProps {
  text: string;
  path?: string;
  className?: string;
  wrap?: boolean;
}

export function CodeViewer({
  text,
  path,
  className,
  wrap = false,
}: CodeViewerProps) {
  const lines = useMemo(() => text.replace(/\n$/, "").split("\n"), [text]);
  const language = useMemo(() => languageFromPath(path), [path]);
  const [tokens, setTokens] = useState<ShikiToken[][] | null>(null);

  useEffect(() => {
    let cancelled = false;
    void tokenizeLines(lines, language, currentCodeTheme()).then((next) => {
      if (!cancelled) setTokens(next);
    });
    return () => {
      cancelled = true;
    };
  }, [language, lines]);

  return (
    <div
      className={cn(
        "h-full overflow-auto bg-[var(--code-bg)] font-mono text-[13px] leading-[1.55] text-[var(--code-fg)]",
        className,
      )}
    >
      <div className="min-w-max py-3">
        {lines.map((line, i) => (
          <div
            key={i}
            className={cn(
              "flex min-h-[25px] items-start pr-5",
              i === 0 && "bg-[var(--code-active-line)]",
            )}
          >
            <div className="sticky left-0 w-[46px] shrink-0 select-none bg-inherit pr-3 text-right text-[var(--code-muted)]">
              {i + 1}
            </div>
            <pre
              className={cn(
                "min-w-0 flex-1",
                wrap ? "whitespace-pre-wrap break-words" : "whitespace-pre",
              )}
            >
              <LineText text={line} tokens={tokens?.[i]} />
            </pre>
          </div>
        ))}
      </div>
    </div>
  );
}

export function languageFromPath(path?: string): string {
  const ext = path?.split(".").pop()?.toLowerCase();
  switch (ext) {
    case "ts":
      return "ts";
    case "tsx":
      return "tsx";
    case "js":
    case "mjs":
    case "cjs":
      return "js";
    case "json":
      return "json";
    case "rs":
      return "rust";
    case "py":
      return "python";
    case "md":
    case "markdown":
      return "md";
    default:
      return "ts";
  }
}

function LineText({ text, tokens }: { text: string; tokens?: ShikiToken[] }) {
  if (!tokens || tokens.length === 0) return <span>{text || " "}</span>;
  return (
    <>
      {tokens.map((token, i) => (
        <span key={i} style={token.color ? { color: token.color } : undefined}>
          {token.text}
        </span>
      ))}
    </>
  );
}
