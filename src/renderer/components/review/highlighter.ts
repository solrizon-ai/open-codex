// Lazy shiki loader. We deliberately keep the surface tiny — the diff viewer
// only needs syntax-coloured spans per line, not full HTML scaffolding.
//
// If shiki fails to load (e.g. WASM blocked, offline dev), `tokenize` falls
// back to plain text wrapped in a single span so the diff still renders.

import type { Highlighter, ThemedToken } from "shiki";

let highlighterPromise: Promise<Highlighter | null> | null = null;

const PRELOAD_LANGS = ["md", "ts", "tsx", "js", "json", "rust", "python"];
const THEMES = ["github-light", "github-dark", "dark-plus"] as const;
type CodeTheme = (typeof THEMES)[number];

export type ShikiToken = { text: string; color?: string };

async function loadHighlighter(): Promise<Highlighter | null> {
  if (!highlighterPromise) {
    highlighterPromise = (async () => {
      try {
        const shiki = await import("shiki");
        return await shiki.createHighlighter({
          themes: [...THEMES],
          langs: PRELOAD_LANGS,
        });
      } catch (err) {
        console.warn(
          "[review] shiki failed to load, falling back to plain text",
          err,
        );
        return null;
      }
    })();
  }
  return highlighterPromise;
}

export async function tokenizeLines(
  lines: string[],
  language: string,
  theme: CodeTheme = currentCodeTheme(),
): Promise<ShikiToken[][]> {
  const hl = await loadHighlighter();
  if (!hl) return fallbackTokenizeLines(lines, language);

  const langs = hl.getLoadedLanguages();
  const lang = langs.includes(language as never) ? language : "md";

  const source = lines.join("\n");
  try {
    const tokenList: ThemedToken[][] = hl.codeToTokensBase(source, {
      lang: lang as never,
      theme,
    });
    return tokenList.map((row) =>
      row.map((t) => ({ text: t.content, color: t.color })),
    );
  } catch (err) {
    console.warn("[review] shiki tokenize failed", err);
    return fallbackTokenizeLines(lines, language);
  }
}

export function currentCodeTheme(): CodeTheme {
  if (typeof document === "undefined") return "dark-plus";
  return document.documentElement.getAttribute("data-theme") === "dark"
    ? "dark-plus"
    : "github-light";
}

const FALLBACK_COLORS = {
  keyword: "#ff7b72",
  importName: "#ff9d45",
  string: "#7ee787",
  type: "#a371f7",
  functionName: "#d2a8ff",
  property: "#79c0ff",
  number: "#79c0ff",
  comment: "#8b949e",
  tag: "#ff7b72",
  punctuation: "#8b949e",
};

const KEYWORDS = new Set([
  "async",
  "await",
  "catch",
  "class",
  "const",
  "export",
  "extends",
  "false",
  "from",
  "function",
  "if",
  "import",
  "interface",
  "let",
  "new",
  "null",
  "return",
  "true",
  "try",
  "type",
]);

function fallbackTokenizeLines(
  lines: string[],
  language: string,
): ShikiToken[][] {
  if (
    !["ts", "tsx", "js", "jsx", "javascript", "typescript"].includes(language)
  ) {
    return lines.map((line) => [{ text: line }]);
  }
  return lines.map(fallbackTokenizeLine);
}

function fallbackTokenizeLine(line: string): ShikiToken[] {
  const tokens: ShikiToken[] = [];
  const pattern =
    /(\/\/.*$|\/\*.*?\*\/|"(?:\\.|[^"])*"|'(?:\\.|[^'])*'|`(?:\\.|[^`])*`|\b[A-Z][A-Za-z0-9_]*\b|\b[A-Za-z_$][A-Za-z0-9_$]*\b|\b\d+(?:\.\d+)?\b|<\/?[A-Za-z][A-Za-z0-9.]*)/g;
  let last = 0;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(line))) {
    if (match.index > last)
      tokens.push({ text: line.slice(last, match.index) });
    const text = match[0];
    tokens.push({ text, color: fallbackColorFor(text, line, match.index) });
    last = pattern.lastIndex;
  }
  if (last < line.length) tokens.push({ text: line.slice(last) });
  return tokens;
}

function fallbackColorFor(
  text: string,
  line: string,
  index: number,
): string | undefined {
  if (text.startsWith("//") || text.startsWith("/*"))
    return FALLBACK_COLORS.comment;
  if (text.startsWith('"') || text.startsWith("'") || text.startsWith("`")) {
    return FALLBACK_COLORS.string;
  }
  if (text.startsWith("<")) return FALLBACK_COLORS.tag;
  if (/^\d/.test(text)) return FALLBACK_COLORS.number;
  if (KEYWORDS.has(text)) return FALLBACK_COLORS.keyword;
  if (/^[A-Z]/.test(text)) return FALLBACK_COLORS.type;
  const before = line.slice(0, index);
  const after = line.slice(index + text.length);
  if (/\b(import|const|let|function)\s+(?:\{[^}]*,\s*)?$/.test(before)) {
    return FALLBACK_COLORS.importName;
  }
  if (/^\s*\(/.test(after)) return FALLBACK_COLORS.functionName;
  if (/^\s*:/.test(after) || /\.$/.test(before))
    return FALLBACK_COLORS.property;
  return undefined;
}
