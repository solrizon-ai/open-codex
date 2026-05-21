import { useEffect, useMemo, useState } from "react";
import { MessageCircle, Plus, X } from "lucide-react";
import { cn } from "../../lib/cn";
import type { DiffFile, DiffLine } from "./types";
import {
  currentCodeTheme,
  tokenizeLines,
  type ShikiToken,
} from "./highlighter";
import { useComposerStore } from "../../state/composer";

interface DiffViewerProps {
  file: DiffFile;
  mode: "unified" | "split";
  highlightSyntax: boolean;
  wrapLines: boolean;
  emphasizeChanges: boolean;
  hideWhitespace: boolean;
}

export function DiffViewer({
  file,
  mode,
  highlightSyntax,
  wrapLines,
  emphasizeChanges,
  hideWhitespace,
}: DiffViewerProps) {
  // Pre-tokenize every visible line with shiki. The diff itself is plain text,
  // but we feed each line to shiki one at a time so that +/- markers don't
  // pollute the grammar.
  const [tokensByLine, setTokensByLine] = useState<ShikiToken[][] | null>(null);

  const allLines = useMemo(
    () =>
      file.lines.map((l) => {
        const t = l.text ?? "";
        return hideWhitespace ? t.replace(/\s+$/g, "") : t;
      }),
    [file.lines, hideWhitespace],
  );

  useEffect(() => {
    let cancelled = false;
    if (!highlightSyntax) {
      setTokensByLine(null);
      return () => {
        cancelled = true;
      };
    }
    tokenizeLines(allLines, file.language, currentCodeTheme()).then(
      (tokens) => {
        if (!cancelled) setTokensByLine(tokens);
      },
    );
    return () => {
      cancelled = true;
    };
  }, [allLines, file.language, highlightSyntax]);

  if (mode === "split") {
    return (
      <SplitView
        file={file}
        tokensByLine={tokensByLine}
        wrapLines={wrapLines}
        emphasizeChanges={emphasizeChanges}
      />
    );
  }

  return (
    <UnifiedView
      file={file}
      tokensByLine={tokensByLine}
      wrapLines={wrapLines}
      emphasizeChanges={emphasizeChanges}
    />
  );
}

// ---------------------------------------------------------------------------
// Unified (single-column) view
// ---------------------------------------------------------------------------

interface ViewProps {
  file: DiffFile;
  tokensByLine: ShikiToken[][] | null;
  wrapLines: boolean;
  emphasizeChanges: boolean;
}

function UnifiedView({
  file,
  tokensByLine,
  wrapLines,
  emphasizeChanges,
}: ViewProps) {
  const comments = useLineComments(file.path);
  return (
    <div className="bg-[var(--code-bg)] font-mono text-[13px] leading-[1.55] text-[var(--code-fg)]">
      {file.lines.map((line, i) => (
        <UnifiedRow
          key={i}
          filePath={file.path}
          line={line}
          tokens={tokensByLine?.[i]}
          wrapLines={wrapLines}
          emphasize={emphasizeChanges}
          commentState={comments.state(line, "unified")}
          onStartComment={() => comments.start(line, "unified")}
          onCancelComment={() => comments.cancel(line, "unified")}
          onSubmitComment={(text) => comments.submit(line, "unified", text)}
        />
      ))}
    </div>
  );
}

function UnifiedRow({
  filePath,
  line,
  tokens,
  wrapLines,
  emphasize,
  commentState,
  onStartComment,
  onCancelComment,
  onSubmitComment,
}: {
  filePath: string;
  line: DiffLine;
  tokens?: ShikiToken[];
  wrapLines: boolean;
  emphasize: boolean;
  commentState?: LineCommentState;
  onStartComment: () => void;
  onCancelComment: () => void;
  onSubmitComment: (text: string) => void;
}) {
  if (line.kind === "hunk") {
    return (
      <div className="mx-1 my-2 flex h-[32px] items-center rounded-md bg-[var(--diff-hunk-bg)] text-[12.5px] text-[var(--code-muted)]">
        <div className="w-[78px] shrink-0" />
        <div className="truncate px-2">{line.hunkInfo}</div>
      </div>
    );
  }
  if (line.kind === "spacer") {
    return <div className="h-[10px]" />;
  }

  const bg =
    line.kind === "add"
      ? cn(
          "bg-[var(--diff-add-bg)]",
          emphasize && "bg-[var(--diff-add-emphasis-bg)]",
        )
      : line.kind === "del"
        ? cn(
            "bg-[var(--diff-del-bg)]",
            emphasize && "bg-[var(--diff-del-emphasis-bg)]",
          )
        : "";
  const sign = line.kind === "add" ? "+" : line.kind === "del" ? "-" : " ";
  const signColor =
    line.kind === "add"
      ? "text-[var(--diff-add-fg)]"
      : line.kind === "del"
        ? "text-[var(--diff-del-fg)]"
        : "text-[var(--code-muted)]";

  return (
    <div>
      <div className={cn("group/diffline flex min-h-[22px] items-stretch", bg)}>
        <LineNoCell value={line.oldNo} onComment={onStartComment} />
        <LineNoCell value={line.newNo} onComment={onStartComment} />
        <div
          className={cn("w-[18px] shrink-0 text-center text-[12px]", signColor)}
        >
          {sign}
        </div>
        <div
          className={cn(
            "min-w-0 flex-1 overflow-hidden pr-3",
            wrapLines
              ? "whitespace-pre-wrap break-words [overflow-wrap:anywhere]"
              : "whitespace-pre",
          )}
        >
          <LineText text={line.text ?? ""} tokens={tokens} />
        </div>
      </div>
      {commentState && (
        <LineCommentBox
          filePath={filePath}
          line={line}
          side="unified"
          state={commentState}
          onCancel={onCancelComment}
          onSubmit={onSubmitComment}
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Split (two-column) view
// ---------------------------------------------------------------------------

function SplitView({
  file,
  tokensByLine,
  wrapLines,
  emphasizeChanges,
}: ViewProps) {
  // Walk the line list and assemble paired rows. Add/del runs are zipped;
  // context lines repeat on both sides.
  const rows = useMemo(() => buildSplitRows(file.lines), [file.lines]);
  const comments = useLineComments(file.path);

  return (
    <div className="bg-[var(--code-bg)] font-mono text-[13px] leading-[1.55] text-[var(--code-fg)]">
      {rows.map((row, i) => {
        if (row.kind === "hunk") {
          return (
            <div
              key={i}
              className="mx-1 my-2 flex h-[32px] items-center rounded-md bg-[var(--diff-hunk-bg)] text-[12.5px] text-[var(--code-muted)]"
            >
              <div className="w-[34px] shrink-0" />
              <div className="flex-1 truncate px-2">{row.info}</div>
              <div className="w-[34px] shrink-0" />
              <div className="flex-1 truncate px-2">{row.info}</div>
            </div>
          );
        }
        if (row.kind === "spacer") {
          return <div key={i} className="h-[10px]" />;
        }
        return (
          <div key={i} className="flex items-stretch">
            <SplitSide
              filePath={file.path}
              line={row.left}
              tokens={
                row.leftIndex != null
                  ? tokensByLine?.[row.leftIndex]
                  : undefined
              }
              side="left"
              wrapLines={wrapLines}
              emphasize={emphasizeChanges}
              commentState={
                row.left ? comments.state(row.left, "left") : undefined
              }
              onStartComment={
                row.left ? () => comments.start(row.left!, "left") : undefined
              }
              onCancelComment={
                row.left ? () => comments.cancel(row.left!, "left") : undefined
              }
              onSubmitComment={
                row.left
                  ? (text) => comments.submit(row.left!, "left", text)
                  : undefined
              }
            />
            <SplitSide
              filePath={file.path}
              line={row.right}
              tokens={
                row.rightIndex != null
                  ? tokensByLine?.[row.rightIndex]
                  : undefined
              }
              side="right"
              wrapLines={wrapLines}
              emphasize={emphasizeChanges}
              commentState={
                row.right ? comments.state(row.right, "right") : undefined
              }
              onStartComment={
                row.right
                  ? () => comments.start(row.right!, "right")
                  : undefined
              }
              onCancelComment={
                row.right
                  ? () => comments.cancel(row.right!, "right")
                  : undefined
              }
              onSubmitComment={
                row.right
                  ? (text) => comments.submit(row.right!, "right", text)
                  : undefined
              }
            />
          </div>
        );
      })}
    </div>
  );
}

type SplitRow =
  | { kind: "hunk"; info: string }
  | { kind: "spacer" }
  | {
      kind: "pair";
      left: DiffLine | null;
      right: DiffLine | null;
      leftIndex: number | null;
      rightIndex: number | null;
    };

function buildSplitRows(lines: DiffLine[]): SplitRow[] {
  const rows: SplitRow[] = [];
  let i = 0;
  while (i < lines.length) {
    const l = lines[i];
    if (!l) {
      i++;
      continue;
    }
    if (l.kind === "hunk") {
      rows.push({ kind: "hunk", info: l.hunkInfo ?? "" });
      i++;
      continue;
    }
    if (l.kind === "spacer") {
      rows.push({ kind: "spacer" });
      i++;
      continue;
    }
    if (l.kind === "context") {
      rows.push({
        kind: "pair",
        left: l,
        right: l,
        leftIndex: i,
        rightIndex: i,
      });
      i++;
      continue;
    }
    // accumulate consecutive del/add into two parallel arrays
    const dels: { line: DiffLine; index: number }[] = [];
    const adds: { line: DiffLine; index: number }[] = [];
    while (i < lines.length) {
      const cur = lines[i];
      if (!cur || (cur.kind !== "del" && cur.kind !== "add")) break;
      if (cur.kind === "del") dels.push({ line: cur, index: i });
      else adds.push({ line: cur, index: i });
      i++;
    }
    const n = Math.max(dels.length, adds.length);
    for (let k = 0; k < n; k++) {
      const d = dels[k];
      const a = adds[k];
      rows.push({
        kind: "pair",
        left: d?.line ?? null,
        right: a?.line ?? null,
        leftIndex: d?.index ?? null,
        rightIndex: a?.index ?? null,
      });
    }
  }
  return rows;
}

function SplitSide({
  filePath,
  line,
  tokens,
  side,
  wrapLines,
  emphasize,
  commentState,
  onStartComment,
  onCancelComment,
  onSubmitComment,
}: {
  filePath: string;
  line: DiffLine | null;
  tokens?: ShikiToken[];
  side: "left" | "right";
  wrapLines: boolean;
  emphasize: boolean;
  commentState?: LineCommentState;
  onStartComment?: () => void;
  onCancelComment?: () => void;
  onSubmitComment?: (text: string) => void;
}) {
  if (!line) {
    return (
      <div
        className={cn(
          "flex min-h-[25px] min-w-0 flex-1 items-stretch overflow-hidden bg-[var(--code-bg)]",
          side === "left" ? "border-r border-border" : "",
        )}
      >
        <div className="w-[34px] shrink-0" />
        <div className="w-[16px] shrink-0" />
        <div className="min-w-0 flex-1" />
      </div>
    );
  }

  const isAdd = line.kind === "add";
  const isDel = line.kind === "del";
  const bg = isAdd
    ? cn(
        "bg-[var(--diff-add-bg)]",
        emphasize && "bg-[var(--diff-add-emphasis-bg)]",
      )
    : isDel
      ? cn(
          "bg-[var(--diff-del-bg)]",
          emphasize && "bg-[var(--diff-del-emphasis-bg)]",
        )
      : "";
  const sign = isAdd ? "+" : isDel ? "-" : " ";
  const signColor = isAdd
    ? "text-[var(--diff-add-fg)]"
    : isDel
      ? "text-[var(--diff-del-fg)]"
      : "text-[var(--code-muted)]";
  const num = side === "left" ? line.oldNo : line.newNo;

  return (
    <div
      className={cn(
        "min-w-0 flex-1",
        side === "left" ? "border-r border-border" : "",
      )}
    >
      <div
        className={cn(
          "group/diffline flex min-h-[25px] min-w-0 items-stretch overflow-hidden",
          bg,
        )}
      >
        <LineNoCell value={num} compact onComment={onStartComment} />
        <div
          className={cn("w-[18px] shrink-0 text-center text-[12px]", signColor)}
        >
          {sign}
        </div>
        <div
          className={cn(
            "min-w-0 flex-1 overflow-hidden pr-2",
            wrapLines
              ? "whitespace-pre-wrap break-words [overflow-wrap:anywhere]"
              : "whitespace-pre",
          )}
        >
          <LineText text={line.text ?? ""} tokens={tokens} />
        </div>
      </div>
      {commentState && onCancelComment && onSubmitComment && (
        <LineCommentBox
          filePath={filePath}
          line={line}
          side={side}
          state={commentState}
          onCancel={onCancelComment}
          onSubmit={onSubmitComment}
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Shared cells
// ---------------------------------------------------------------------------

type CommentSide = "unified" | "left" | "right";

interface LineCommentState {
  mode: "editing" | "submitted";
  text: string;
}

function useLineComments(filePath: string) {
  const insertText = useComposerStore((s) => s.insertText);
  const [comments, setComments] = useState<Record<string, LineCommentState>>(
    {},
  );

  const keyFor = (line: DiffLine, side: CommentSide) =>
    `${side}:${line.oldNo ?? "-"}:${line.newNo ?? "-"}`;

  const referenceFor = (line: DiffLine, side: CommentSide) => {
    const lineNo =
      side === "left"
        ? line.oldNo
        : side === "right"
          ? line.newNo
          : (line.newNo ?? line.oldNo);
    const label =
      side === "left"
        ? "左"
        : side === "right"
          ? "右"
          : line.kind === "del"
            ? "左"
            : "右";
    return { lineNo, label };
  };

  return {
    state: (line: DiffLine, side: CommentSide) => comments[keyFor(line, side)],
    start: (line: DiffLine, side: CommentSide) => {
      const key = keyFor(line, side);
      setComments((current) => ({
        ...current,
        [key]: current[key] ?? { mode: "editing", text: "" },
      }));
    },
    cancel: (line: DiffLine, side: CommentSide) => {
      const key = keyFor(line, side);
      setComments((current) => {
        const next = { ...current };
        delete next[key];
        return next;
      });
    },
    submit: (line: DiffLine, side: CommentSide, text: string) => {
      const trimmed = text.trim();
      if (!trimmed) return;
      const key = keyFor(line, side);
      const ref = referenceFor(line, side);
      setComments((current) => ({
        ...current,
        [key]: { mode: "submitted", text: trimmed },
      }));
      insertText(
        [
          `请根据这条审查评论修改代码：`,
          ``,
          `文件：${filePath}`,
          `位置：${ref.label}${ref.lineNo != null ? ` ${ref.lineNo}` : ""}`,
          `代码：${line.text ?? ""}`,
          `评论：${trimmed}`,
        ].join("\n"),
      );
    },
  };
}

function LineCommentBox({
  filePath,
  line,
  side,
  state,
  onCancel,
  onSubmit,
}: {
  filePath: string;
  line: DiffLine;
  side: CommentSide;
  state: LineCommentState;
  onCancel: () => void;
  onSubmit: (text: string) => void;
}) {
  const [draft, setDraft] = useState(state.text);
  const lineNo = side === "left" ? line.oldNo : (line.newNo ?? line.oldNo);

  if (state.mode === "submitted") {
    return (
      <div className="ml-[58px] mr-3 my-2 rounded-lg bg-black/[0.08] p-3 font-sans text-[12.5px] text-foreground dark:bg-white/[0.08]">
        <div className="mb-1 flex items-center gap-2 text-foreground-muted">
          <MessageCircle size={14} />
          <span className="truncate">
            {filePath} {side !== "unified" ? side : ""} {lineNo ?? ""}
          </span>
        </div>
        <div className="whitespace-pre-wrap">{state.text}</div>
      </div>
    );
  }

  return (
    <div className="mx-3 my-2 ml-[58px] overflow-hidden rounded-xl bg-black/[0.08] font-sans text-foreground ring-1 ring-black/[0.08] dark:bg-white/[0.08] dark:ring-white/[0.08]">
      <div className="flex h-[38px] items-center justify-between border-b border-black/[0.08] px-3 dark:border-white/[0.08]">
        <div className="flex items-center gap-2 text-[13px] font-medium">
          <MessageCircle size={15} />
          本地评论
        </div>
        <div className="text-[12px] text-foreground-subtle">
          对第 {lineNo ?? "-"} 行发布评论
        </div>
      </div>
      <textarea
        autoFocus
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        placeholder="请求更改"
        className="block min-h-[76px] w-full resize-none bg-transparent px-3 py-3 text-[13px] outline-none placeholder:text-foreground-subtle"
      />
      <div className="flex items-center justify-end gap-2 px-3 pb-3">
        <button
          type="button"
          onClick={onCancel}
          className="flex h-7 items-center gap-1 rounded-md px-2 text-[12.5px] text-foreground-muted hover:bg-black/[0.06] dark:hover:bg-white/[0.08]"
        >
          <X size={13} />
          取消
        </button>
        <button
          type="button"
          onClick={() => onSubmit(draft)}
          disabled={!draft.trim()}
          className="h-7 rounded-md bg-foreground px-3 text-[12.5px] font-medium text-white disabled:opacity-50 dark:bg-white dark:text-black"
        >
          注释
        </button>
      </div>
    </div>
  );
}

function LineNoCell({
  value,
  compact = false,
  onComment,
}: {
  value?: number;
  compact?: boolean;
  onComment?: () => void;
}) {
  return (
    <div
      className={cn(
        "relative shrink-0 select-none pr-2 text-right text-[13px] leading-[25px] text-[var(--code-muted)]",
        compact ? "w-[42px]" : "w-[39px]",
      )}
    >
      <span className="group-hover/diffline:opacity-0">{value ?? ""}</span>
      {value != null && onComment && (
        <button
          type="button"
          aria-label="添加行评论"
          onClick={onComment}
          className="absolute right-1 top-1/2 hidden h-[18px] w-[18px] -translate-y-1/2 items-center justify-center rounded bg-surface-elevated text-foreground shadow-sm ring-1 ring-border hover:bg-black/[0.06] group-hover/diffline:flex dark:hover:bg-white/[0.1]"
        >
          <Plus size={13} strokeWidth={2} />
        </button>
      )}
    </div>
  );
}

function LineText({ text, tokens }: { text: string; tokens?: ShikiToken[] }) {
  if (!tokens || tokens.length === 0) {
    return <span>{text || " "}</span>;
  }
  return (
    <>
      {tokens.map((t, i) => (
        <span key={i} style={t.color ? { color: t.color } : undefined}>
          {t.text}
        </span>
      ))}
    </>
  );
}
