import { memo, useEffect, useMemo, useRef, useState } from "react";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import {
  Copy,
  ExternalLink,
  FolderOpen,
  Globe,
  ImageIcon,
  Maximize2,
  MessageCirclePlus,
  MoreHorizontal,
  PanelRightClose,
  Plus,
  WrapText,
  X,
  FilePlus,
} from "lucide-react";
import { cn } from "../../lib/cn";
import { isLikelyImagePath, resolveImageSource } from "../../lib/localImages";
import { useReviewDiffStore } from "../../state/reviewDiff";
import { useReviewTabsStore, type ReviewTab } from "../../state/reviewTabs";
import { REVIEW_BOUNDS, useUiStore } from "../../state/ui";
import { useProjectStore } from "../../state/project";
import { useThreadStore } from "../../state/thread";
import { ResizeHandle } from "../ResizeHandle";
import { ReviewHeader } from "./ReviewHeader";
import { FileHeader } from "./FileHeader";
import { DiffViewer } from "./DiffViewer";
import type { SettingsMenuState } from "./menus/SettingsMenu";
import { CodeViewer } from "./CodeViewer";
import { PromptDialog } from "../common/PromptDialog";

interface ResizeBinding {
  getWidth: () => number;
  onWidth: (width: number) => void;
  onCommit: (width: number) => void;
}

export const ReviewPane = memo(function ReviewPane({
  collapsed = false,
  resize,
}: {
  collapsed?: boolean;
  resize?: ResizeBinding;
}) {
  return (
    <aside
      className={cn(
        "review-pane relative flex h-full min-h-0 min-w-0 flex-col overflow-hidden border-l border-border bg-surface-elevated dark:border-white/[0.08]",
        collapsed && "pointer-events-none",
      )}
      aria-hidden={collapsed}
    >
      {!collapsed && (
        <ResizeHandle
          side="left"
          getWidth={
            resize?.getWidth ?? (() => useUiStore.getState().reviewWidth)
          }
          onWidth={
            resize?.onWidth ?? ((w) => useUiStore.getState().setReviewWidth(w))
          }
          onCommit={resize?.onCommit}
        />
      )}
      <TabStrip />
      <TabContent />
    </aside>
  );
});

function TabStrip() {
  const tabs = useReviewTabsStore((s) => s.tabs);
  const activeId = useReviewTabsStore((s) => s.activeId);
  const setActive = useReviewTabsStore((s) => s.setActive);
  const close = useReviewTabsStore((s) => s.close);
  const add = useReviewTabsStore((s) => s.add);
  const toggleReview = useUiStore((s) => s.toggleReview);

  return (
    <div className="flex h-[44px] items-center gap-px border-b border-border px-2 [app-region:drag] dark:border-white/[0.08]">
      <div className="flex flex-1 items-center gap-px overflow-x-auto [app-region:drag]">
        {tabs.map((t) => (
          <TabButton
            key={t.id}
            tab={t}
            active={t.id === activeId}
            onClick={() => setActive(t.id)}
            onClose={t.id !== "review" ? () => close(t.id) : undefined}
          />
        ))}

        <DropdownMenu.Root>
          <DropdownMenu.Trigger asChild>
            <button
              type="button"
              title="新增标签"
              className="flex h-[26px] w-[28px] items-center justify-center rounded-md text-foreground-muted hover:bg-black/[0.05] dark:hover:bg-white/[0.08]"
            >
              <Plus size={14} strokeWidth={1.8} />
            </button>
          </DropdownMenu.Trigger>
          <DropdownMenu.Portal>
            <DropdownMenu.Content
              align="start"
              sideOffset={6}
              className="z-50 min-w-[220px] rounded-lg bg-white p-1 text-[12.5px] text-foreground shadow-popover ring-1 ring-black/[0.06]"
            >
              <AddItem
                icon={<FilePlus size={13} strokeWidth={1.8} />}
                label="打开文件"
                hint="⌘P"
                onSelect={() => useUiStore.getState().setPaletteOpen(true)}
              />
              <DropdownMenu.Separator className="my-1 h-px bg-black/[0.06]" />
              <AddItem
                icon={<MessageCirclePlus size={13} strokeWidth={1.8} />}
                label="侧边聊天"
                onSelect={() => add({ kind: "chat", title: "侧边聊天" })}
              />
              <AddItem
                icon={<Globe size={13} strokeWidth={1.8} />}
                label="浏览器"
                hint="⌘T"
                onSelect={() =>
                  add({
                    kind: "browser",
                    title: "新标签页",
                    url: "about:blank",
                  })
                }
              />
            </DropdownMenu.Content>
          </DropdownMenu.Portal>
        </DropdownMenu.Root>
      </div>

      <div className="flex items-center gap-1 [app-region:drag]">
        <button
          type="button"
          title="最大化"
          onClick={() => {
            const { reviewWidth, setReviewWidth } = useUiStore.getState();
            setReviewWidth(
              reviewWidth >= REVIEW_BOUNDS.max - 8 ? 420 : REVIEW_BOUNDS.max,
            );
          }}
          className="flex h-[26px] w-[28px] items-center justify-center rounded-md text-foreground-muted hover:bg-black/[0.05] dark:hover:bg-white/[0.08]"
        >
          <Maximize2 size={13} strokeWidth={1.8} />
        </button>
        <button
          type="button"
          title="关闭审查"
          onClick={toggleReview}
          className="flex h-[26px] w-[28px] items-center justify-center rounded-md text-foreground-muted hover:bg-black/[0.05] dark:hover:bg-white/[0.08]"
        >
          <PanelRightClose size={13} strokeWidth={1.8} />
        </button>
      </div>
    </div>
  );
}

function TabButton({
  tab,
  active,
  onClick,
  onClose,
}: {
  tab: ReviewTab;
  active: boolean;
  onClick: () => void;
  onClose?: () => void;
}) {
  const Icon =
    tab.kind === "browser"
      ? Globe
      : tab.kind === "chat"
        ? MessageCirclePlus
        : FilePlus;
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "group flex h-[26px] min-w-[80px] max-w-[180px] shrink-0 items-center gap-1 rounded-md px-2 text-[12px]",
        active
          ? "bg-black/[0.06] text-foreground dark:bg-white/[0.08]"
          : "text-foreground-muted hover:bg-black/[0.04] dark:hover:bg-white/[0.05]",
      )}
    >
      <Icon size={11} strokeWidth={1.8} className="shrink-0 opacity-80" />
      <span className="flex-1 truncate text-left">{tab.title}</span>
      {onClose && (
        <span
          role="button"
          onClick={(e) => {
            e.stopPropagation();
            onClose();
          }}
          className={cn(
            "ml-1 flex h-[18px] w-[18px] items-center justify-center rounded text-foreground-subtle opacity-0 transition-opacity hover:bg-black/[0.06] hover:text-foreground group-hover:opacity-100 dark:hover:bg-white/[0.1]",
            active && "opacity-70",
          )}
        >
          <X size={11} strokeWidth={1.8} />
        </span>
      )}
    </button>
  );
}

function AddItem({
  icon,
  label,
  hint,
  onSelect,
}: {
  icon: React.ReactNode;
  label: string;
  hint?: string;
  onSelect?: () => void;
}) {
  return (
    <DropdownMenu.Item
      onSelect={onSelect}
      className="flex h-[28px] cursor-pointer items-center gap-2 rounded-md px-2 outline-none data-[highlighted]:bg-black/[0.05]"
    >
      <span className="flex h-4 w-4 items-center justify-center text-foreground-subtle">
        {icon}
      </span>
      <span className="flex-1">{label}</span>
      {hint && (
        <span className="text-[11px] text-foreground-subtle">{hint}</span>
      )}
    </DropdownMenu.Item>
  );
}

function TabContent() {
  const tabs = useReviewTabsStore((s) => s.tabs);
  const activeId = useReviewTabsStore((s) => s.activeId);
  const tab = tabs.find((t) => t.id === activeId) ?? tabs[0];
  if (!tab) return null;

  switch (tab.kind) {
    case "review":
      return <ReviewTabContent />;
    case "chat":
      return <SideChatContent />;
    case "browser":
      return <BrowserTabContent url={tab.url ?? "about:blank"} />;
    case "file":
      return <FilePreviewContent path={tab.path ?? ""} />;
  }
}

function ReviewTabContent() {
  const [settings, setSettings] = useState<SettingsMenuState>({
    splitView: false,
    wrapLines: true,
    emphasizeChanges: false,
    hideWhitespace: false,
    highlightSyntax: true,
  });
  const [fileScope, setFileScope] = useState<"all" | "modified">("modified");
  const [dialog, setDialog] = useState<
    | { kind: "commit" }
    | { kind: "newBranch" }
    | { kind: "checkout"; branch: string }
    | null
  >(null);
  const [commitMessage, setCommitMessage] = useState("");
  const [commitGenerating, setCommitGenerating] = useState(false);
  const files = useReviewDiffStore((s) => s.files);
  const activePath = useReviewDiffStore((s) => s.activePath);
  const setActivePath = useReviewDiffStore((s) => s.setActivePath);
  const refreshFromGit = useReviewDiffStore((s) => s.refreshFromGit);
  const source = useReviewDiffStore((s) => s.source);
  const diffCwd = useReviewDiffStore((s) => s.cwd);
  const loading = useReviewDiffStore((s) => s.loading);
  const error = useReviewDiffStore((s) => s.error);
  const project = useProjectStore((s) => s.current);
  const reloadProject = useProjectStore((s) => s.load);
  const cwd = project?.cwd ?? null;

  useEffect(() => {
    if (!cwd) return;
    if (diffCwd !== cwd) {
      void refreshFromGit(cwd);
    }
  }, [cwd, diffCwd, refreshFromGit]);

  const file =
    (activePath && files.find((candidate) => candidate.path === activePath)) ||
    files[0] ||
    null;
  const fileList = useMemo(
    () =>
      files.map((candidate) => ({
        path: candidate.path,
        added: candidate.added,
        removed: candidate.removed,
        status: candidate.status === "renamed" ? "modified" : candidate.status,
      })),
    [files],
  );
  const hasDiff = !!file && file.lines.length > 0;
  const total = files.reduce(
    (acc, candidate) => ({
      added: acc.added + candidate.added,
      removed: acc.removed + candidate.removed,
    }),
    { added: 0, removed: 0 },
  );
  const currentIndex = file
    ? Math.max(
        0,
        files.findIndex((candidate) => candidate.path === file.path),
      )
    : 0;

  const pickOffset = (offset: number) => {
    if (files.length === 0) return;
    const next = files[(currentIndex + offset + files.length) % files.length];
    if (next) setActivePath(next.path);
  };

  const activeOpenPath = file?.absolutePath ?? file?.path ?? "";

  const refresh = () => {
    if (cwd) void refreshFromGit(cwd);
  };

  const handleGitOp = async (
    op: () => Promise<unknown>,
    options: { reloadBranches?: boolean } = {},
  ) => {
    try {
      await op();
    } catch (err) {
      console.error("git op failed", err);
      return;
    }
    if (options.reloadBranches) void reloadProject();
    refresh();
  };

  const onGitStage = () => {
    if (!cwd || !file) return;
    void handleGitOp(() => window.codex.git.stage(cwd, [file.path]));
  };
  const onGitUnstage = () => {
    if (!cwd || !file) return;
    void handleGitOp(() => window.codex.git.unstage(cwd, [file.path]));
  };
  const onGitDiscard = () => {
    if (!cwd || !file) return;
    void handleGitOp(() => window.codex.git.discard(cwd, [file.path]));
  };
  const onGitPush = () => {
    if (!cwd) return;
    void handleGitOp(() => window.codex.git.push(cwd));
  };
  const onGitCommit = async () => {
    if (!cwd) return;
    setCommitMessage("");
    setCommitGenerating(true);
    setDialog({ kind: "commit" });
    try {
      const message = await window.codex.git.suggestCommitMessage(cwd);
      setCommitMessage(message);
    } catch {
      setCommitMessage("update workspace changes");
    } finally {
      setCommitGenerating(false);
    }
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <ReviewHeader
        title={
          loading
            ? "正在读取改动…"
            : source === "thread"
              ? "上轮对话"
              : "工作区改动"
        }
        added={total.added}
        removed={total.removed}
        settings={settings}
        onSettingsChange={setSettings}
        files={fileList}
        activePath={activePath ?? undefined}
        onPickFile={setActivePath}
        fileScope={fileScope}
        onFileScopeChange={setFileScope}
        onSearch={() => useUiStore.getState().setPaletteOpen(true)}
        onPrevFile={() => pickOffset(-1)}
        onNextFile={() => pickOffset(1)}
        onOpenFile={
          activeOpenPath
            ? () => void window.codex.file.open(activeOpenPath)
            : undefined
        }
        onRevealFile={
          activeOpenPath
            ? () => void window.codex.file.showInFolder(activeOpenPath)
            : undefined
        }
        onCopyPath={
          activeOpenPath
            ? () => void window.codex.file.copyPath(activeOpenPath)
            : undefined
        }
        hasActiveFile={!!file}
        onGitStage={onGitStage}
        onGitUnstage={onGitUnstage}
        onGitCommit={() => void onGitCommit()}
        onGitPush={onGitPush}
        onGitCheckout={() => setDialog({ kind: "newBranch" })}
        onGitDiscard={onGitDiscard}
        onGitRefresh={refresh}
      />
      {file && <FileHeader file={file} />}
      <div className="min-h-0 flex-1 overflow-auto">
        {hasDiff && file ? (
          <DiffViewer
            file={file}
            mode={settings.splitView ? "split" : "unified"}
            highlightSyntax={settings.highlightSyntax}
            wrapLines={settings.wrapLines}
            emphasizeChanges={settings.emphasizeChanges}
            hideWhitespace={settings.hideWhitespace}
          />
        ) : files.length === 0 ? (
          <EmptyDiff
            label={
              error
                ? `读取 Git 改动失败：${error}`
                : cwd
                  ? "工作区无改动"
                  : "请先选择一个项目"
            }
            actionLabel={cwd ? "重试" : undefined}
            onAction={refresh}
          />
        ) : (
          <MissingDiffFile onRetry={refresh} />
        )}
      </div>
      <PromptDialog
        open={dialog?.kind === "commit"}
        title="提交改动"
        description={
          commitGenerating
            ? "正在调用 Codex 根据当前 diff 生成提交信息。"
            : "提交前会自动暂存全部改动（git add -A），提交信息可先确认和修改。"
        }
        placeholder={
          commitGenerating ? "Codex 正在生成提交信息…" : "commit message"
        }
        defaultValue={commitMessage}
        multiline
        confirmLabel="提交"
        inputDisabled={commitGenerating}
        confirmDisabled={commitGenerating}
        onCancel={() => setDialog(null)}
        onConfirm={async (msg) => {
          if (!cwd) return;
          await window.codex.git.commit(cwd, msg, { stageAll: true });
          setDialog(null);
          refresh();
        }}
      />
      <PromptDialog
        open={dialog?.kind === "newBranch"}
        title="创建并检出新分支"
        placeholder="分支名"
        confirmLabel="检出"
        onCancel={() => setDialog(null)}
        onConfirm={async (name) => {
          if (!cwd) return;
          await window.codex.git.checkout(cwd, name, { create: true });
          setDialog(null);
          void reloadProject();
          refresh();
        }}
      />
    </div>
  );
}

function EmptyDiff({
  label,
  actionLabel,
  onAction,
}: {
  label?: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center p-8 text-center">
      <DiffIcon />
      <div className="mt-3 text-[14px] font-medium text-foreground">
        {label ?? "尚无文件更改"}
      </div>
      {actionLabel && onAction && (
        <button
          type="button"
          onClick={onAction}
          className="mt-3 rounded-md border border-border bg-white px-3 py-1 text-[12px] text-foreground hover:bg-black/[0.04]"
        >
          {actionLabel}
        </button>
      )}
    </div>
  );
}

function MissingDiffFile({ onRetry }: { onRetry?: () => void }) {
  return (
    <div className="flex h-full flex-col bg-[var(--code-bg)]">
      <div className="flex items-center gap-2 px-3 py-4 text-[14px] font-medium text-[var(--code-muted)]">
        完整文件内容加载失败
        <button
          type="button"
          onClick={onRetry}
          className="rounded-full border border-white/[0.16] px-3 py-1 text-[13px] text-foreground hover:bg-white/[0.08]"
        >
          重试
        </button>
      </div>
    </div>
  );
}

function DiffIcon() {
  return (
    <svg
      width="56"
      height="56"
      viewBox="0 0 64 64"
      className="text-foreground-subtle/60"
      fill="none"
    >
      <path
        d="M16 8 h24 l12 12 v36 a4 4 0 0 1 -4 4 H16 a4 4 0 0 1 -4 -4 V12 a4 4 0 0 1 4 -4z"
        stroke="currentColor"
        strokeWidth="2"
      />
      <path d="M40 8 v12 h12" stroke="currentColor" strokeWidth="2" />
      <path
        d="M22 32 h20 M22 40 h20"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <path
        d="M32 28 v8 M32 40 h8"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

function SideChatContent() {
  // The side-chat tab mirrors the main thread's items so users can keep
  // an eye on the conversation while reviewing diffs. New turns still
  // have to come from the main chat composer.
  const items = useThreadStore((s) => s.items);
  if (items.length === 0) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center p-8 text-center text-[12.5px] text-foreground-subtle">
        <MessageCirclePlus size={32} className="mb-2 opacity-50" />
        当前没有对话内容
      </div>
    );
  }
  return (
    <div className="min-h-0 flex-1 overflow-y-auto p-4">
      {items.map((item, i) => (
        <div
          key={item.id ?? i}
          className={cn(
            "mb-3 text-[12.5px] leading-[1.55]",
            item.role === "user"
              ? "rounded-md bg-black/[0.04] px-3 py-2 text-foreground"
              : "text-foreground-muted",
          )}
        >
          <div className="mb-0.5 text-[10.5px] uppercase tracking-wide text-foreground-subtle">
            {item.role ?? item.type ?? "tool"}
          </div>
          <div className="whitespace-pre-wrap">{item.text ?? ""}</div>
        </div>
      ))}
    </div>
  );
}

function BrowserTabContent({ url }: { url: string }) {
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const webviewRef = useRef<BrowserWebviewElement | null>(null);
  const webviewReadyRef = useRef(false);
  const [draft, setDraft] = useState(url);
  const [current, setCurrent] = useState(url);
  const [settings, setSettings] = useState<BrowserSettings>({
    enabled: true,
    blockedDomains: [],
    allowedDomains: [],
    warnPolicy: "always-ask",
  });
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setDraft(url);
    setCurrent(url);
  }, [url]);

  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;

    const applyZoom = () => {
      if (!webviewReadyRef.current) return;
      const width = viewport.clientWidth;
      if (width <= 0) return;
      const zoom = Math.max(0.55, Math.min(1, width / 1180));
      try {
        webviewRef.current?.setZoomFactor?.(zoom);
      } catch {
        // Electron throws if a webview is not fully attached yet. The
        // dom-ready listener below will retry once the guest page is ready.
      }
    };

    webviewReadyRef.current = false;
    const observer = new ResizeObserver(applyZoom);
    observer.observe(viewport);
    const webview = webviewRef.current;
    const onReady = () => {
      webviewReadyRef.current = true;
      applyZoom();
    };
    webview?.addEventListener("dom-ready", onReady);
    return () => {
      observer.disconnect();
      webview?.removeEventListener("dom-ready", onReady);
    };
  }, [current]);

  useEffect(() => {
    let alive = true;
    void (async () => {
      const [enabled, blocked, allowed, warnPolicy] = await Promise.all([
        window.codex.config.get(["desktop", "browser", "enabled"]),
        window.codex.config.get(["desktop", "browser", "blocked_domains"]),
        window.codex.config.get(["desktop", "browser", "allowed_domains"]),
        window.codex.config.get(["desktop", "browser", "warn_policy"]),
      ]);
      if (!alive) return;
      setSettings({
        enabled: typeof enabled === "boolean" ? enabled : true,
        blockedDomains: normalizeDomains(blocked),
        allowedDomains: normalizeDomains(allowed),
        warnPolicy: isBrowserWarnPolicy(warnPolicy) ? warnPolicy : "always-ask",
      });
    })().catch((e) => {
      setError(e instanceof Error ? e.message : String(e));
    });
    return () => {
      alive = false;
    };
  }, []);

  function navigate() {
    const trimmed = draft.trim();
    if (!trimmed) return;
    const normalized = /^[a-z][a-z0-9+.-]*:/i.test(trimmed)
      ? trimmed
      : `https://${trimmed}`;
    if (normalized === current) return;
    const verdict = canOpenBrowserUrl(normalized, settings);
    if (!verdict.ok) {
      setError(verdict.reason);
      return;
    }
    if (verdict.confirmMessage && !window.confirm(verdict.confirmMessage)) {
      setDraft(current);
      return;
    }
    setError(null);
    setCurrent(normalized);
    setDraft(normalized);
  }

  const disabled = !settings.enabled;

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex h-[34px] items-center gap-2 border-b border-border px-3 text-[12px] text-foreground-muted dark:border-white/[0.08]">
        <Globe size={12} className="opacity-70" />
        <input
          type="text"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") navigate();
          }}
          onBlur={navigate}
          disabled={disabled}
          className="min-w-0 flex-1 truncate bg-transparent focus:outline-none"
        />
      </div>
      {(disabled || error) && (
        <div className="border-b border-border bg-amber-50 px-3 py-2 text-[12px] text-amber-800">
          {disabled ? "内置浏览器已在设置中关闭" : error}
        </div>
      )}
      {disabled ? (
        <div className="flex flex-1 items-center justify-center p-8 text-center text-[12.5px] text-foreground-subtle">
          打开设置中的浏览器开关后即可使用网页标签
        </div>
      ) : (
        (() => {
          const Webview = "webview" as unknown as React.ElementType;
          return (
            <div
              ref={viewportRef}
              className="min-h-0 flex-1 overflow-hidden bg-white"
            >
              <Webview
                ref={webviewRef}
                src={current}
                partition="persist:codex-browser"
                autosize="on"
                className="block h-full w-full bg-white"
              />
            </div>
          );
        })()
      )}
    </div>
  );
}

type BrowserWebviewElement = HTMLElement & {
  setZoomFactor?: (factor: number) => void;
};

type BrowserWarnPolicy = "always-ask" | "trusted-only" | "never";

interface BrowserSettings {
  enabled: boolean;
  blockedDomains: string[];
  allowedDomains: string[];
  warnPolicy: BrowserWarnPolicy;
}

function isBrowserWarnPolicy(value: unknown): value is BrowserWarnPolicy {
  return (
    value === "always-ask" || value === "trusted-only" || value === "never"
  );
}

function normalizeDomains(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((domain) =>
      typeof domain === "string" ? domain.trim().toLowerCase() : "",
    )
    .filter(Boolean);
}

function canOpenBrowserUrl(
  rawUrl: string,
  settings: BrowserSettings,
): { ok: true; confirmMessage?: string } | { ok: false; reason: string } {
  if (!settings.enabled) {
    return { ok: false, reason: "内置浏览器已在设置中关闭" };
  }

  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    return { ok: false, reason: "网址格式无效" };
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    return { ok: true };
  }

  const host = parsed.hostname.toLowerCase();
  if (domainMatches(host, settings.blockedDomains)) {
    return { ok: false, reason: `${host} 已被浏览器设置屏蔽` };
  }

  const trusted = domainMatches(host, settings.allowedDomains);
  if (settings.warnPolicy === "never" || trusted) {
    return { ok: true };
  }
  if (
    settings.warnPolicy === "trusted-only" ||
    settings.warnPolicy === "always-ask"
  ) {
    return { ok: true, confirmMessage: `打开 ${host}？` };
  }
  return { ok: true };
}

function domainMatches(host: string, domains: string[]) {
  return domains.some(
    (domain) => host === domain || host.endsWith(`.${domain}`),
  );
}

function FilePreviewContent({ path }: { path: string }) {
  if (isLikelyImagePath(path)) return <ImageFilePreview path={path} />;
  return <TextFilePreview path={path} />;
}

function TextFilePreview({ path }: { path: string }) {
  const [wrap, setWrap] = useState(false);
  const [state, setState] = useState<{
    loading: boolean;
    error: string | null;
    text: string;
  }>({ loading: true, error: null, text: "" });

  useEffect(() => {
    let alive = true;
    setState({ loading: true, error: null, text: "" });
    void (async () => {
      try {
        const res = (await window.codex.codex.request("fs/readFile", {
          path,
        })) as { dataBase64?: string };
        const bytes = Uint8Array.from(atob(res.dataBase64 ?? ""), (c) =>
          c.charCodeAt(0),
        );
        const text = new TextDecoder("utf-8", { fatal: false }).decode(bytes);
        if (alive) setState({ loading: false, error: null, text });
      } catch (e) {
        const error = e instanceof Error ? e.message : String(e);
        if (alive) setState({ loading: false, error, text: "" });
      }
    })();
    return () => {
      alive = false;
    };
  }, [path]);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <FilePreviewToolbar
        path={path}
        wrap={wrap}
        onToggleWrap={() => setWrap((value) => !value)}
      />
      {state.loading ? (
        <div className="flex flex-1 items-center justify-center text-[12px] text-foreground-subtle">
          正在读取文件…
        </div>
      ) : state.error ? (
        <div className="flex flex-1 items-center justify-center p-6 text-center text-[12px] text-rose-500">
          {state.error}
        </div>
      ) : (
        <CodeViewer
          text={state.text}
          path={path}
          className="min-h-0 flex-1"
          wrap={wrap}
        />
      )}
    </div>
  );
}

function ImageFilePreview({ path }: { path: string }) {
  const [state, setState] = useState<{
    loading: boolean;
    error: string | null;
    src: string | null;
  }>({ loading: true, error: null, src: null });

  useEffect(() => {
    let alive = true;
    setState({ loading: true, error: null, src: null });
    void resolveImageSource(path)
      .then((src) => {
        if (!alive) return;
        if (src) setState({ loading: false, error: null, src });
        else setState({ loading: false, error: "图片路径无效", src: null });
      })
      .catch((e) => {
        if (!alive) return;
        setState({
          loading: false,
          error: e instanceof Error ? e.message : String(e),
          src: null,
        });
      });
    return () => {
      alive = false;
    };
  }, [path]);

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-[var(--code-bg)]">
      <FilePreviewToolbar path={path} image />
      {state.loading ? (
        <div className="flex flex-1 items-center justify-center text-[12px] text-foreground-subtle">
          正在读取图片…
        </div>
      ) : state.error ? (
        <div className="flex flex-1 items-center justify-center p-6 text-center text-[12px] text-rose-500">
          图片加载失败：{state.error}
        </div>
      ) : (
        <div className="flex min-h-0 flex-1 items-center justify-center overflow-auto p-6">
          <img
            src={state.src ?? undefined}
            alt={path}
            className="max-h-full max-w-full rounded-xl border border-border bg-white object-contain shadow-sm dark:border-white/[0.1] dark:bg-white/[0.04]"
          />
        </div>
      )}
    </div>
  );
}

function FilePreviewToolbar({
  path,
  wrap,
  onToggleWrap,
  image = false,
}: {
  path: string;
  wrap?: boolean;
  onToggleWrap?: () => void;
  image?: boolean;
}) {
  return (
    <div className="flex h-[52px] shrink-0 items-center gap-2 border-b border-border bg-[var(--code-bg)] px-3 text-[13px]">
      {image && (
        <ImageIcon size={15} className="shrink-0 text-[var(--code-muted)]" />
      )}
      <Breadcrumbs path={path} />
      <div className="ml-auto flex items-center gap-1">
        {!image && onToggleWrap && (
          <FileActionsMenu
            path={path}
            wrap={!!wrap}
            onToggleWrap={onToggleWrap}
          />
        )}
        <FileActionButton
          title="在编辑器中打开"
          onClick={() => void window.codex.file.open(path)}
        >
          <ExternalLink size={15} />
        </FileActionButton>
        <FileActionButton
          title="在文件管理器中打开"
          onClick={() => void window.codex.file.showInFolder(path)}
        >
          <FolderOpen size={16} />
        </FileActionButton>
      </div>
    </div>
  );
}

function Breadcrumbs({ path }: { path: string }) {
  const parts = path.split("/").filter(Boolean);
  const visible = parts.slice(-7);
  return (
    <div className="flex min-w-0 flex-1 items-center gap-1 overflow-hidden text-[var(--code-muted)]">
      {parts.length > visible.length && <span className="shrink-0">…</span>}
      {visible.map((part, index) => {
        const last = index === visible.length - 1;
        return (
          <span
            key={`${part}-${index}`}
            className="flex min-w-0 items-center gap-1"
          >
            {index > 0 && (
              <span className="shrink-0 text-[var(--code-muted)]">›</span>
            )}
            <span
              className={cn(
                "truncate",
                last
                  ? "font-medium text-foreground"
                  : "max-w-[120px] text-[var(--code-muted)]",
              )}
            >
              {part}
            </span>
          </span>
        );
      })}
    </div>
  );
}

function FileActionButton({
  title,
  onClick,
  children,
}: {
  title: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      className="flex h-8 w-8 items-center justify-center rounded-lg text-[var(--code-muted)] hover:bg-black/[0.05] hover:text-foreground dark:hover:bg-white/[0.08]"
    >
      {children}
    </button>
  );
}

function FileActionsMenu({
  path,
  wrap,
  onToggleWrap,
}: {
  path: string;
  wrap: boolean;
  onToggleWrap: () => void;
}) {
  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <button
          type="button"
          title="更多"
          className="flex h-8 w-8 items-center justify-center rounded-lg text-[var(--code-muted)] hover:bg-black/[0.05] hover:text-foreground data-[state=open]:bg-black/[0.06] data-[state=open]:text-foreground dark:hover:bg-white/[0.08] dark:data-[state=open]:bg-white/[0.12]"
        >
          <MoreHorizontal size={17} />
        </button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align="end"
          sideOffset={8}
          className="z-50 min-w-[228px] rounded-2xl border border-white/[0.08] bg-[var(--diff-hunk-bg)] p-1.5 text-[15px] font-medium text-foreground shadow-[0_16px_40px_rgba(0,0,0,0.45)]"
        >
          <MenuAction
            icon={<Copy size={15} />}
            label="复制路径"
            onSelect={() => void window.codex.file.copyPath(path)}
          />
          <MenuAction
            icon={<WrapText size={15} />}
            label={wrap ? "关闭自动换行" : "启用自动换行"}
            onSelect={onToggleWrap}
          />
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}

function MenuAction({
  icon,
  label,
  onSelect,
}: {
  icon: React.ReactNode;
  label: string;
  onSelect?: () => void;
}) {
  return (
    <DropdownMenu.Item
      onSelect={onSelect}
      className="flex h-10 cursor-default items-center gap-3 rounded-xl px-3 outline-none data-[highlighted]:bg-white/[0.1]"
    >
      <span className="text-white/75">{icon}</span>
      <span>{label}</span>
    </DropdownMenu.Item>
  );
}
