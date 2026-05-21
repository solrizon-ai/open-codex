import { Composer } from "./Composer";
import {
  ArrowDown,
  Box,
  Check,
  CheckSquare,
  ChevronDown,
  Code2,
  Copy,
  FileText,
  FolderOpen,
  Globe2,
  ImageIcon,
  Sparkles,
  TerminalSquare,
  Wrench,
  WrapText,
} from "lucide-react";
import {
  useCallback,
  useEffect,
  memo,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { cn } from "../../lib/cn";
import {
  isLikelyImagePath,
  localPathFromImageSource,
  resolveImageSource,
} from "../../lib/localImages";
import {
  countChange,
  diffFilesFromChanges,
  extractFileChanges,
  type FileChangeRecord,
} from "../review/diffModel";
import type { DiffLine } from "../review/types";
import { useReviewDiffStore } from "../../state/reviewDiff";
import { useReviewTabsStore } from "../../state/reviewTabs";
import { BACKEND_LABEL, useBackendStore } from "../../state/backend";
import { useThreadStore, type TurnItem } from "../../state/thread";
import { useUiStore } from "../../state/ui";

/**
 * Live conversation: items streamed from the codex-rs sidecar through
 * the thread store. User-typed text appears immediately; assistant items
 * are appended/updated as `item/*` notifications arrive.
 */
export const MessageList = memo(function MessageList() {
  const items = useThreadStore((s) => s.items);
  const cwd = useThreadStore((s) => s.cwd);
  const status = useThreadStore((s) => s.status);
  const reviewVisible = useUiStore((s) => s.reviewVisible);
  const renderItems = useMemo(() => groupFileChanges(items), [items]);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const atBottomRef = useRef(true);
  const [showScrollToBottom, setShowScrollToBottom] = useState(false);

  const updateScrollState = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const distance = el.scrollHeight - el.scrollTop - el.clientHeight;
    const atBottom = distance < 96;
    atBottomRef.current = atBottom;
    setShowScrollToBottom(!atBottom && items.length > 0);
  }, [items.length]);

  const scrollToBottom = useCallback((behavior: ScrollBehavior = "smooth") => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior });
  }, []);

  useEffect(() => {
    if (!reviewVisible) return;
    const currentReview = useReviewDiffStore.getState();
    if (
      currentReview.loading ||
      currentReview.sticky ||
      (currentReview.source === "git" && currentReview.files.length > 0)
    ) {
      return;
    }
    const latest = [...renderItems]
      .reverse()
      .find((entry): entry is { items: TurnItem[] } => "items" in entry);
    if (!latest) return;
    const changes = latest.items.flatMap((item) => extractFileChanges(item));
    if (changes.length === 0) return;
    useReviewDiffStore.getState().setFromChanges(changes, cwd);
  }, [cwd, renderItems, reviewVisible]);

  useEffect(() => {
    updateScrollState();
  }, [items.length, status, updateScrollState]);

  useEffect(() => {
    if (!atBottomRef.current) return;
    const frame = requestAnimationFrame(() => scrollToBottom("auto"));
    return () => cancelAnimationFrame(frame);
  }, [renderItems.length, scrollToBottom, status]);

  return (
    <div className="relative flex h-full min-h-0 flex-col overflow-hidden">
      <div
        ref={scrollRef}
        onScroll={updateScrollState}
        className="min-h-0 flex-1 overflow-y-auto overscroll-contain"
      >
        <div className="mx-auto w-full max-w-[760px] px-6 pb-[230px] pt-6">
          {renderItems.map((entry, i) => {
            if ("items" in entry) {
              return <FileChangeCard key={`files-${i}`} items={entry.items} />;
            }
            if (entry.role === "user") {
              return <UserReply key={entry.id ?? i} item={entry} />;
            }
            return <AgentItem key={entry.id ?? i} item={entry} />;
          })}
          {status === "running" && <RunningIndicator />}
        </div>
      </div>

      {showScrollToBottom && (
        <button
          type="button"
          aria-label="回到底部"
          title="回到底部"
          onClick={() => scrollToBottom()}
          className={cn(
            "absolute bottom-[196px] left-1/2 z-30 flex h-10 w-10 -translate-x-1/2 items-center justify-center rounded-full",
            "border border-border bg-surface-elevated/95 text-foreground shadow-popover backdrop-blur",
            "transition hover:bg-black/[0.04] active:scale-95 dark:border-white/[0.1] dark:hover:bg-white/[0.08]",
          )}
        >
          <ArrowDown size={20} strokeWidth={1.85} />
        </button>
      )}

      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-20 flex justify-center px-6 pb-6">
        <div className="pointer-events-auto w-full max-w-[760px]">
          <Composer />
        </div>
      </div>
    </div>
  );
});

function UserReply({ item }: { item: TurnItem }) {
  const text = item.text ?? "";
  const images = extractImageAttachments(item.raw);
  if (!text && images.length === 0) return null;
  return (
    <div className="mb-4 mt-2 flex justify-end">
      <div className="max-w-[80%] rounded-2xl bg-black/[0.05] px-3.5 py-2 text-[13px] leading-[1.55] text-foreground dark:bg-white/[0.08]">
        {text && <RichText text={text} compact />}
        {images.length > 0 && <MessageImages images={images} />}
      </div>
    </div>
  );
}

function AgentItem({ item }: { item: TurnItem }) {
  const type = item.type;
  const text = item.text ?? "";
  const imageGeneration = imageGenerationFromItem(item);
  if (imageGeneration) {
    return <ImageGenerationActivity activity={imageGeneration} />;
  }
  const toolActivity = toolActivityFromItem(item);
  if (toolActivity) {
    return <ToolActivityRow activity={toolActivity} />;
  }
  const images = extractImageAttachments(item.raw);
  if (type === "fileChange") return <FileChangeCard items={[item]} />;
  if (type === "commandExecution") return <CommandCard item={item} />;
  if (!text && images.length === 0) {
    return (
      <div className="mb-3 text-[11.5px] text-foreground-subtle">
        {type ?? "..."}
      </div>
    );
  }
  return (
    <div className="mb-5 text-[13.5px] leading-[1.72] text-foreground">
      {text && <RichText text={text} />}
      {images.length > 0 && <MessageImages images={images} />}
    </div>
  );
}

function RichText({
  text,
  compact = false,
}: {
  text: string;
  compact?: boolean;
}) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
        p: ({ children }) => (
          <p
            className={cn(
              compact ? "mb-2 last:mb-0" : "mb-4",
              "whitespace-pre-wrap",
            )}
          >
            {children}
          </p>
        ),
        strong: ({ children }) => (
          <strong className="font-semibold text-foreground">{children}</strong>
        ),
        ul: ({ children }) => (
          <ul className="mb-4 list-disc space-y-1.5 pl-5">{children}</ul>
        ),
        ol: ({ children }) => (
          <ol className="mb-4 list-decimal space-y-1.5 pl-5">{children}</ol>
        ),
        li: ({ children }) => <li className="pl-1">{children}</li>,
        a: ({ href, children }) => (
          <button
            type="button"
            onClick={() => href && openPathInReview(href)}
            className="inline-flex items-center gap-1 rounded text-accent hover:underline"
          >
            {iconForPath(nodeText(children))}
            {children}
          </button>
        ),
        img: ({ src, alt }) => (
          <MessageImage src={String(src ?? "")} alt={alt ?? ""} />
        ),
        h1: ({ children }) => (
          <h1 className="mb-4 mt-6 text-[18px] font-semibold leading-tight text-foreground first:mt-0">
            {children}
          </h1>
        ),
        h2: ({ children }) => (
          <h2 className="mb-3 mt-5 text-[16px] font-semibold leading-tight text-foreground first:mt-0">
            {children}
          </h2>
        ),
        h3: ({ children }) => (
          <h3 className="mb-2.5 mt-4 text-[14.5px] font-semibold leading-tight text-foreground first:mt-0">
            {children}
          </h3>
        ),
        code: ({ className, children, node }) => {
          const match = /language-([A-Za-z0-9_-]+)/.exec(className ?? "");
          const value = String(children).replace(/\n$/, "");
          const position = (
            node as {
              position?: {
                end?: { line?: number };
                start?: { line?: number };
              };
            }
          ).position;
          const isFencedBlock =
            position?.start?.line !== undefined &&
            position?.end?.line !== undefined &&
            position.start.line !== position.end.line;
          if (match || isFencedBlock || value.includes("\n")) {
            return (
              <MarkdownCodeBlock language={match?.[1] ?? "text"} code={value} />
            );
          }
          return (
            <code className="rounded-md bg-black/[0.06] px-1.5 py-0.5 font-mono text-[0.92em] dark:bg-white/[0.09]">
              {children}
            </code>
          );
        },
        pre: ({ children }) => <>{children}</>,
        table: ({ children }) => (
          <div className="mb-5 overflow-x-auto">
            <table className="w-full border-collapse text-left text-[13px] leading-[1.55]">
              {children}
            </table>
          </div>
        ),
        thead: ({ children }) => (
          <thead className="border-b border-border/80 text-foreground dark:border-white/[0.12]">
            {children}
          </thead>
        ),
        tbody: ({ children }) => <tbody>{children}</tbody>,
        tr: ({ children }) => (
          <tr className="border-b border-border/70 last:border-0 dark:border-white/[0.09]">
            {children}
          </tr>
        ),
        th: ({ children }) => (
          <th className="px-1.5 py-2 pr-6 align-top font-semibold text-foreground">
            {children}
          </th>
        ),
        td: ({ children }) => (
          <td className="px-1.5 py-2 pr-6 align-top text-foreground">
            {children}
          </td>
        ),
      }}
    >
      {text}
    </ReactMarkdown>
  );
}

interface ImageAttachment {
  src: string;
  alt?: string;
}

function MessageImages({ images }: { images: ImageAttachment[] }) {
  return (
    <div className="mb-4 grid gap-3">
      {images.map((image, index) => (
        <MessageImage
          key={`${image.src}-${index}`}
          src={image.src}
          alt={image.alt ?? "image"}
        />
      ))}
    </div>
  );
}

function MessageImage({ src, alt }: { src: string; alt: string }) {
  const [failed, setFailed] = useState(false);
  const [resolved, setResolved] = useState<string | null>(null);
  const cwd = useThreadStore((s) => s.cwd);

  useEffect(() => {
    let alive = true;
    setFailed(false);
    setResolved(null);
    void resolveImageSource(src, cwd)
      .then((next) => {
        if (!alive) return;
        if (next) setResolved(next);
        else setFailed(true);
      })
      .catch(() => {
        if (alive) setFailed(true);
      });
    return () => {
      alive = false;
    };
  }, [cwd, src]);

  if (!resolved && !failed) {
    return (
      <div className="my-3 h-[180px] max-w-[320px] rounded-xl border border-border bg-black/[0.035] dark:border-white/[0.1] dark:bg-white/[0.045]" />
    );
  }
  if (failed) {
    return (
      <button
        type="button"
        onClick={() => openPathInReview(src)}
        className="my-2 rounded-lg border border-border bg-black/[0.03] px-3 py-2 text-left text-[12.5px] text-foreground-subtle dark:border-white/[0.1] dark:bg-white/[0.04]"
      >
        图片加载失败：{src}
      </button>
    );
  }
  if (!resolved) return null;
  return (
    <img
      src={resolved}
      alt={alt}
      loading="lazy"
      onError={() => setFailed(true)}
      className="my-3 max-h-[460px] max-w-full rounded-xl border border-border bg-black/[0.035] object-contain shadow-sm dark:border-white/[0.1] dark:bg-white/[0.045]"
    />
  );
}

function extractImageAttachments(
  raw: Record<string, unknown>,
): ImageAttachment[] {
  const images: ImageAttachment[] = [];
  const seen = new Set<string>();

  const add = (src: string, alt?: string) => {
    if (!looksLikeImageSource(src) || seen.has(src)) return;
    seen.add(src);
    images.push({ src, alt });
  };

  const visit = (value: unknown, key = "", imageContext = false) => {
    if (!value) return;
    if (typeof value === "string") {
      if (isImageKey(key) || imageContext) add(value);
      return;
    }
    if (Array.isArray(value)) {
      for (const entry of value) visit(entry, key, imageContext);
      return;
    }
    if (typeof value !== "object") return;
    const record = value as Record<string, unknown>;
    const type =
      typeof record.type === "string" ? record.type.toLowerCase() : "";
    const mime =
      typeof record.mimeType === "string"
        ? record.mimeType.toLowerCase()
        : typeof record.mime_type === "string"
          ? record.mime_type.toLowerCase()
          : "";
    const nextContext =
      imageContext || type.includes("image") || mime.startsWith("image/");
    const alt =
      typeof record.alt === "string"
        ? record.alt
        : typeof record.name === "string"
          ? record.name
          : undefined;

    for (const [childKey, childValue] of Object.entries(record)) {
      if (childKey === "text") continue;
      if (
        typeof childValue === "string" &&
        (isImageKey(childKey) || nextContext)
      ) {
        add(childValue, alt);
        continue;
      }
      visit(childValue, childKey, nextContext);
    }
  };

  visit(raw);
  return images;
}

function isImageKey(key: string): boolean {
  return /^(image|image_url|imageUrl|url|src|path|file_path|filePath|local_path|localPath|saved_path|savedPath|data)$/i.test(
    key,
  );
}

function looksLikeImageSource(value: string): boolean {
  const src = value.trim();
  return (
    /^data:image\//i.test(src) ||
    /^blob:/i.test(src) ||
    (/^https?:\/\//i.test(src) && isLikelyImagePath(src)) ||
    (/^file:\/\//i.test(src) && isLikelyImagePath(src)) ||
    isLikelyImagePath(src)
  );
}

function nodeText(node: ReactNode): string {
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(nodeText).join("");
  return "";
}

function MarkdownCodeBlock({
  language,
  code,
}: {
  language?: string;
  code: string;
}) {
  const [wrap, setWrap] = useState(false);
  const [copied, setCopied] = useState(false);
  const label = language?.trim() || "text";

  async function copyCode() {
    await navigator.clipboard.writeText(code);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1100);
  }

  return (
    <div className="mb-5 overflow-hidden rounded-xl bg-black/[0.055] text-foreground shadow-sm ring-1 ring-black/[0.04] dark:bg-white/[0.095] dark:ring-white/[0.06]">
      <div className="flex h-9 items-center justify-between px-3 text-[12px] text-foreground-subtle">
        <span className="font-mono">{label}</span>
        <div className="flex items-center gap-1 opacity-80 transition-opacity hover:opacity-100">
          <button
            type="button"
            title={wrap ? "关闭自动换行" : "启用自动换行"}
            onClick={() => setWrap((value) => !value)}
            className={cn(
              "flex h-7 w-7 items-center justify-center rounded-full hover:bg-black/[0.06] dark:hover:bg-white/[0.1]",
              wrap && "bg-black/[0.06] text-foreground dark:bg-white/[0.12]",
            )}
          >
            <WrapText size={14} />
          </button>
          <button
            type="button"
            title="复制"
            onClick={() => void copyCode()}
            className="flex h-7 w-7 items-center justify-center rounded-full hover:bg-black/[0.06] dark:hover:bg-white/[0.1]"
          >
            {copied ? <Check size={14} /> : <Copy size={14} />}
          </button>
        </div>
      </div>
      <pre
        className={cn(
          "overflow-x-auto px-3 pb-3 font-mono text-[13px] leading-[1.65]",
          wrap ? "whitespace-pre-wrap break-words" : "whitespace-pre",
        )}
      >
        {code}
      </pre>
    </div>
  );
}

function CommandCard({ item }: { item: TurnItem }) {
  const raw = unwrapItem(item.raw);
  const command =
    typeof raw.command === "string" ? raw.command : (item.text ?? "");
  const output =
    typeof raw.aggregatedOutput === "string" ? raw.aggregatedOutput : "";
  return (
    <div className="mb-4 overflow-hidden rounded-lg border border-border bg-black/[0.025] text-[12.5px] dark:bg-white/[0.035] dark:border-white/[0.08]">
      <div className="flex h-9 items-center gap-2 border-b border-border px-3 text-foreground-muted dark:border-white/[0.08]">
        <TerminalSquare size={14} />
        <code className="truncate font-mono">{command}</code>
      </div>
      {output && (
        <pre className="max-h-[240px] overflow-auto p-3 font-mono text-[11.5px] leading-relaxed text-foreground-muted">
          {output}
        </pre>
      )}
    </div>
  );
}

interface ToolActivity {
  kind: "tool" | "search" | "image" | "review" | "agent";
  label: string;
  status?: string;
  detail?: string;
  duration?: string;
  path?: string;
  images?: ImageAttachment[];
}

function ToolActivityRow({ activity }: { activity: ToolActivity }) {
  const images = activity.images ?? [];
  return (
    <div className="mb-2.5 flex items-start gap-2 text-[13px] leading-[1.5] text-foreground-subtle">
      <div className="mt-[3px] flex h-4 w-4 shrink-0 items-center justify-center">
        {activityIcon(activity.kind)}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-0.5">
          <span className="text-foreground-muted">{activity.label}</span>
          {activity.status && (
            <span className="text-[11.5px] text-foreground-subtle">
              {activity.status}
            </span>
          )}
          {activity.duration && (
            <span className="text-[11.5px] text-foreground-subtle">
              {activity.duration}
            </span>
          )}
        </div>
        {activity.detail && (
          <div className="mt-0.5 max-w-full truncate font-mono text-[11.5px] text-foreground-subtle">
            {activity.detail}
          </div>
        )}
        {activity.path && (
          <button
            type="button"
            onClick={() => void window.codex.file.showInFolder(activity.path!)}
            className="mt-1 inline-flex max-w-full items-center gap-1 rounded-md bg-black/[0.04] px-2 py-1 text-[11.5px] text-foreground-muted hover:bg-black/[0.07] dark:bg-white/[0.07] dark:hover:bg-white/[0.1]"
          >
            <FolderOpen size={12} />
            <span className="truncate">{activity.path}</span>
          </button>
        )}
        {images.length > 0 && <MessageImages images={images} />}
      </div>
    </div>
  );
}

function ImageGenerationActivity({
  activity,
}: {
  activity: ToolActivity & { prompt?: string; imageSrc?: string };
}) {
  return (
    <div className="mb-5 text-[13px] leading-[1.55] text-foreground">
      <ToolActivityRow activity={activity} />
      {activity.imageSrc && (
        <div className="ml-6">
          <MessageImage src={activity.imageSrc} alt={activity.label} />
        </div>
      )}
      {activity.prompt && (
        <div className="ml-6 mt-1 max-w-[520px] text-[12px] leading-[1.55] text-foreground-subtle">
          {activity.prompt}
        </div>
      )}
    </div>
  );
}

function activityIcon(kind: ToolActivity["kind"]) {
  switch (kind) {
    case "search":
      return <Globe2 size={14} />;
    case "image":
      return <ImageIcon size={14} />;
    case "review":
      return <Sparkles size={14} />;
    case "agent":
      return <Box size={14} />;
    default:
      return <Wrench size={14} />;
  }
}

function imageGenerationFromItem(
  item: TurnItem,
): (ToolActivity & { prompt?: string; imageSrc?: string }) | null {
  const raw = unwrapItem(item.raw);
  if (typeKey(item.type ?? stringField(raw, "type")) !== "imagegeneration") {
    return null;
  }
  const status = statusLabel(stringField(raw, "status"));
  const savedPath =
    stringField(raw, "savedPath") ?? stringField(raw, "saved_path");
  const result = stringField(raw, "result");
  const imageSrc =
    savedPath ??
    (result && result.startsWith("data:image/")
      ? result
      : base64ImageSrc(result));
  return {
    kind: "image",
    label: status === "进行中" ? "正在生成图片" : "已生成图片",
    status,
    path: savedPath,
    imageSrc,
    prompt:
      stringField(raw, "revisedPrompt") ?? stringField(raw, "revised_prompt"),
  };
}

function toolActivityFromItem(item: TurnItem): ToolActivity | null {
  const raw = unwrapItem(item.raw);
  const key = typeKey(item.type ?? stringField(raw, "type"));
  const status = statusLabel(stringField(raw, "status"));
  const duration = formatDuration(
    numberField(raw, "durationMs") ?? numberField(raw, "duration_ms"),
  );
  if (key === "mcptoolcall") {
    const server = stringField(raw, "server");
    const tool = stringField(raw, "tool") ?? "tool";
    const argumentsValue = raw.arguments;
    return {
      kind: "tool",
      label: readableToolLabel(
        "调用",
        [server, tool].filter(Boolean).join("/"),
        argumentsValue,
      ),
      status,
      duration,
      detail: argumentPreview(argumentsValue),
      images: extractImageAttachments(raw),
    };
  }
  if (key === "dynamictoolcall") {
    const namespace = stringField(raw, "namespace");
    const tool = stringField(raw, "tool") ?? "tool";
    const argumentsValue = raw.arguments;
    return {
      kind: "tool",
      label: readableToolLabel(
        "使用",
        [namespace, tool].filter(Boolean).join("."),
        argumentsValue,
      ),
      status,
      duration,
      detail: argumentPreview(argumentsValue),
      images: extractImageAttachments(raw),
    };
  }
  if (key === "collabagenttoolcall") {
    return {
      kind: "agent",
      label: `协作代理 ${toolLabel(stringField(raw, "tool") ?? "任务")}`,
      status,
      detail: stringField(raw, "prompt"),
    };
  }
  if (key === "websearch") {
    return {
      kind: "search",
      label: "网页搜索",
      detail: stringField(raw, "query"),
    };
  }
  if (key === "imageview") {
    const path = stringField(raw, "path");
    return {
      kind: "image",
      label: "查看图片",
      path,
      images: path ? [{ src: path, alt: "image" }] : undefined,
    };
  }
  if (key === "enteredreviewmode") {
    return {
      kind: "review",
      label: "进入审查模式",
      detail: stringField(raw, "review"),
    };
  }
  if (key === "exitedreviewmode") {
    return {
      kind: "review",
      label: "退出审查模式",
      detail: stringField(raw, "review"),
    };
  }
  if (key === "contextcompaction") {
    return { kind: "tool", label: "压缩上下文" };
  }
  if (key === "hookprompt") {
    const fragments = Array.isArray(raw.fragments) ? raw.fragments.length : 0;
    return {
      kind: "tool",
      label: fragments > 0 ? `读取 ${fragments} 个提示片段` : "读取提示片段",
    };
  }
  if (key === "claudetooluse") {
    return {
      kind: "tool",
      label: stringField(raw, "label") ?? "使用 Claude Code 工具",
      detail: stringField(raw, "detail") ?? item.text,
    };
  }
  if (key === "claudetoolresult") {
    return {
      kind: "tool",
      label: stringField(raw, "label") ?? "Claude Code 工具结果",
      detail: stringField(raw, "detail") ?? item.text,
    };
  }
  return null;
}

function FileChangeCard({ items }: { items: TurnItem[] }) {
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set());
  const changes = useMemo(
    () => items.flatMap((item) => extractFileChanges(item)),
    [items],
  );
  const cwd = useThreadStore((s) => s.cwd);
  if (changes.length === 0) return null;
  const summaries = useMemo(
    () =>
      changes.map((change) => ({
        change,
        displayPath: displayChangePath(cwd, change.path),
        stats: countChange(change),
      })),
    [changes, cwd],
  );
  const totals = summaries.reduce<ChangeStats>(
    (acc, summary) => addStats(acc, summary.stats),
    { added: 0, removed: 0 },
  );
  const visible = summaries.slice(0, 3);

  const toggle = (path: string) => {
    setExpanded((current) => {
      const next = new Set(current);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  };

  return (
    <div className="mb-5 overflow-hidden rounded-xl border border-border bg-black/[0.025] shadow-sm dark:border-white/[0.09] dark:bg-white/[0.035]">
      <button
        type="button"
        onClick={() => openChangesInReview(changes)}
        className="flex w-full items-center gap-3 border-b border-border p-3 text-left hover:bg-black/[0.025] dark:border-white/[0.08] dark:hover:bg-white/[0.035]"
      >
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-black/[0.06] text-foreground-muted dark:bg-white/[0.08]">
          <CheckSquare size={18} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-[13.5px] font-medium text-foreground">
            已编辑 {changes.length} 个文件
          </div>
          <div className="mt-0.5 font-mono text-[12px]">
            <span className="text-emerald-500">+{totals.added}</span>{" "}
            <span className="text-rose-500">-{totals.removed}</span>
          </div>
        </div>
        <span className="rounded-lg border border-border px-3 py-1.5 text-[12.5px] font-medium text-foreground-muted dark:border-white/[0.1]">
          审查
        </span>
      </button>
      <div className="divide-y divide-border/70 dark:divide-white/[0.07]">
        {visible.map((summary) => (
          <MiniDiffFile
            key={`${summary.change.path}-${summary.change.status ?? ""}`}
            change={summary.change}
            cwd={cwd}
            displayPath={summary.displayPath}
            stats={summary.stats}
            expanded={expanded.has(summary.change.path)}
            onOpen={() => openChangesInReview(changes, summary.change.path)}
            onToggle={() => toggle(summary.change.path)}
          />
        ))}
        {changes.length > visible.length ? (
          <button
            type="button"
            onClick={() => openChangesInReview(changes)}
            className="flex h-10 w-full items-center gap-2 bg-black/[0.025] px-3 text-left text-[13px] text-foreground hover:bg-black/[0.04] dark:bg-white/[0.03] dark:hover:bg-white/[0.055]"
          >
            再显示 {changes.length - visible.length} 个文件
            <ChevronDown size={14} className="text-foreground-subtle" />
          </button>
        ) : null}
      </div>
    </div>
  );
}

function MiniDiffFile({
  change,
  cwd,
  displayPath,
  stats,
  expanded,
  onOpen,
  onToggle,
}: {
  change: FileChangeRecord;
  cwd?: string | null;
  displayPath: string;
  stats: ChangeStats;
  expanded: boolean;
  onOpen: () => void;
  onToggle: () => void;
}) {
  const file = useMemo(
    () => (expanded ? diffFilesFromChanges([change], cwd)[0] : null),
    [change, cwd, expanded],
  );
  return (
    <div>
      <div className="flex h-11 w-full items-center gap-2 bg-black/[0.03] px-3 text-left hover:bg-black/[0.045] dark:bg-white/[0.04] dark:hover:bg-white/[0.06]">
        <button
          type="button"
          onClick={onToggle}
          className="flex min-w-0 flex-1 items-center gap-2 text-left"
        >
          {iconForPath(displayPath)}
          <span className="min-w-0 flex-1 truncate text-[13.5px] text-foreground">
            {displayPath}
          </span>
          <span className="font-mono text-[12.5px]">
            <span className="text-emerald-500">+{stats.added}</span>{" "}
            <span className="text-rose-500">-{stats.removed}</span>
          </span>
          <ChevronDown
            size={14}
            className={cn(
              "text-foreground-subtle transition-transform",
              expanded && "rotate-180",
            )}
          />
        </button>
        <button
          type="button"
          onClick={onOpen}
          className="rounded-md px-2 py-1 text-[12px] text-foreground-subtle hover:bg-black/[0.05] dark:hover:bg-white/[0.08]"
        >
          审查
        </button>
      </div>
      {expanded && file && file.lines.length > 0 ? (
        <div className="max-h-[260px] overflow-hidden bg-[var(--code-bg)] font-mono text-[12px] leading-[1.55] text-[var(--code-fg)]">
          {miniLines(file.lines).map((line, index) => (
            <MiniDiffLine key={index} line={line} />
          ))}
        </div>
      ) : expanded ? (
        <div className="bg-[var(--code-bg)] px-3 py-3 text-[12.5px] font-medium text-[var(--code-muted)]">
          完整文件内容加载失败
        </div>
      ) : null}
    </div>
  );
}

function miniLines(lines: DiffLine[]): DiffLine[] {
  const changedIndex = lines.findIndex(
    (line) => line.kind === "add" || line.kind === "del",
  );
  if (changedIndex < 0) return lines.slice(0, 12);
  return lines.slice(Math.max(0, changedIndex - 4), changedIndex + 12);
}

function MiniDiffLine({ line }: { line: DiffLine }) {
  if (line.kind === "hunk") {
    return (
      <div className="mx-1 my-1.5 rounded bg-[var(--diff-hunk-bg)] px-3 py-1 text-[var(--code-muted)]">
        {line.hunkInfo}
      </div>
    );
  }
  if (line.kind === "spacer") return <div className="h-2" />;
  const isAdd = line.kind === "add";
  const isDel = line.kind === "del";
  return (
    <div
      className={cn(
        "flex min-h-[22px] items-stretch",
        isAdd && "bg-[var(--diff-add-bg)]",
        isDel && "bg-[var(--diff-del-bg)]",
      )}
    >
      <div className="w-[44px] shrink-0 select-none pr-2 text-right text-[var(--code-muted)]">
        {line.oldNo ?? line.newNo ?? ""}
      </div>
      <div
        className={cn(
          "w-[20px] shrink-0 text-center",
          isAdd
            ? "text-[var(--diff-add-fg)]"
            : isDel
              ? "text-[var(--diff-del-fg)]"
              : "text-[var(--code-muted)]",
        )}
      >
        {isAdd ? "+" : isDel ? "-" : " "}
      </div>
      <pre className="min-w-0 flex-1 overflow-hidden text-ellipsis whitespace-pre pr-3">
        {line.text ?? ""}
      </pre>
    </div>
  );
}

function groupFileChanges(
  items: TurnItem[],
): Array<TurnItem | { items: TurnItem[] }> {
  const grouped: Array<TurnItem | { items: TurnItem[] }> = [];
  let pending: TurnItem[] = [];
  const flush = () => {
    if (pending.length > 0) {
      grouped.push({ items: pending });
      pending = [];
    }
  };

  for (const item of items) {
    if (item.type === "fileChange") {
      pending.push(item);
      continue;
    }
    flush();
    grouped.push(item);
  }
  flush();
  return grouped;
}

interface ChangeStats {
  added: number;
  removed: number;
}

function addStats(a: ChangeStats, b: ChangeStats): ChangeStats {
  return { added: a.added + b.added, removed: a.removed + b.removed };
}

function displayChangePath(
  cwd: string | null | undefined,
  filePath: string,
): string {
  if (!cwd || !filePath.startsWith("/")) return filePath;
  const normalizedCwd = cwd.replace(/\/+$/, "");
  if (filePath.startsWith(`${normalizedCwd}/`)) {
    return filePath.slice(normalizedCwd.length + 1);
  }
  return filePath;
}

function typeKey(type?: string): string {
  return (type ?? "").replace(/[_-]/g, "").toLowerCase();
}

function stringField(
  raw: Record<string, unknown>,
  key: string,
): string | undefined {
  const value = raw[key];
  return typeof value === "string" && value.trim() ? value : undefined;
}

function numberField(
  raw: Record<string, unknown>,
  key: string,
): number | undefined {
  const value = raw[key];
  return typeof value === "number" && Number.isFinite(value)
    ? value
    : undefined;
}

function statusLabel(status?: string): string | undefined {
  switch (typeKey(status)) {
    case "inprogress":
      return "进行中";
    case "completed":
    case "success":
    case "succeeded":
      return "完成";
    case "failed":
    case "error":
      return "失败";
    default:
      return status;
  }
}

function formatDuration(ms?: number): string | undefined {
  if (ms == null) return undefined;
  if (ms < 1000) return `${Math.max(1, Math.round(ms))}ms`;
  return `${(ms / 1000).toFixed(ms < 10_000 ? 1 : 0)}s`;
}

function argumentPreview(value: unknown): string | undefined {
  if (value == null) return undefined;
  if (typeof value === "string")
    return value.length > 160 ? `${value.slice(0, 157)}...` : value;
  if (typeof value !== "object") return String(value);
  const record = value as Record<string, unknown>;
  const primary =
    stringField(record, "q") ??
    stringField(record, "query") ??
    stringField(record, "path") ??
    stringField(record, "uri") ??
    stringField(record, "url") ??
    stringField(record, "name");
  if (primary) return primary;
  try {
    const text = JSON.stringify(value);
    return text.length > 180 ? `${text.slice(0, 177)}...` : text;
  } catch {
    return undefined;
  }
}

function readableToolLabel(
  verb: string,
  toolName: string,
  argumentsValue: unknown,
): string {
  const hint = argumentPreview(argumentsValue);
  if (/skill/i.test(toolName) || /\/SKILL\.md$/i.test(hint ?? "")) {
    const skillName = hint?.split("/").filter(Boolean).at(-2) ?? toolName;
    return `读取 ${toolLabel(skillName)} 技能`;
  }
  if (/imagegen/i.test(toolName) || /image_generation/i.test(toolName)) {
    return `${verb} Imagegen`;
  }
  return `${verb} ${toolLabel(toolName)}`;
}

function toolLabel(value: string): string {
  return value.replace(/^functions\./, "").replace(/_/g, " ");
}

function base64ImageSrc(value?: string): string | undefined {
  if (!value) return undefined;
  const clean = value.trim();
  if (/^iVBORw0KGgo/i.test(clean)) return `data:image/png;base64,${clean}`;
  if (/^\/9j\//.test(clean)) return `data:image/jpeg;base64,${clean}`;
  if (/^UklGR/i.test(clean)) return `data:image/webp;base64,${clean}`;
  return undefined;
}

function unwrapItem(raw: Record<string, unknown>): Record<string, unknown> {
  return raw.item && typeof raw.item === "object"
    ? (raw.item as Record<string, unknown>)
    : raw;
}

function openPathInReview(pathWithLine: string) {
  const clean = pathWithLine.replace(/:\d+(:\d+)?$/, "");
  const cwd = useThreadStore.getState().cwd;
  const path =
    localPathFromImageSource(clean, cwd) ??
    (clean.startsWith("/") ? clean : cwd ? `${cwd}/${clean}` : clean);
  const title = path.split("/").filter(Boolean).at(-1) ?? path;
  useReviewTabsStore.getState().add({
    id: `file:${path}`,
    kind: "file",
    title,
    path,
  });
  useUiStore.getState().setReviewVisible(true);
}

function openChangesInReview(changes: FileChangeRecord[], activePath?: string) {
  const cwd = useThreadStore.getState().cwd;
  useReviewDiffStore
    .getState()
    .setFromChanges(changes, cwd, activePath ?? null, { sticky: true });
  useReviewTabsStore.getState().setActive("review");
  useUiStore.getState().setReviewVisible(true);
}

function iconForPath(path: string) {
  const ext = path.split(".").pop()?.toLowerCase();
  if (ext === "ts" || ext === "tsx" || ext === "js" || ext === "jsx") {
    return <Code2 size={14} className="inline shrink-0 text-accent" />;
  }
  return <FileText size={14} className="inline shrink-0 text-accent" />;
}

function RunningIndicator() {
  const backend = useBackendStore((s) => s.backend);
  return (
    <div className="mb-3 flex items-center gap-2 text-[12px] text-foreground-subtle">
      <span className="relative flex h-2 w-2">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-500 opacity-60" />
        <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
      </span>
      {BACKEND_LABEL[backend]} 思考中…
    </div>
  );
}
