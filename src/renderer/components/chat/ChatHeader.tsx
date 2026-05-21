import * as Tooltip from "@radix-ui/react-tooltip";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import {
  Pencil,
  Archive,
  ChevronDown,
  Check,
  Code2,
  Copy,
  FileText,
  Fingerprint,
  FolderOpen,
  GitBranch,
  GitCommit,
  GitPullRequest,
  MessageSquarePlus,
  Monitor,
  PanelRight,
  Pin,
  RefreshCw,
  SquareTerminal,
  Sparkles,
} from "lucide-react";
import type { PropsWithChildren } from "react";
import { useState } from "react";
import { cn } from "../../lib/cn";
import {
  BACKEND_LABEL,
  useBackendStore,
  type AgentBackend,
} from "../../state/backend";
import { useHistoryStore } from "../../state/history";
import { useNavigationStore } from "../../state/navigation";
import { useProjectStore } from "../../state/project";
import type { ProjectInfo } from "../../state/project";
import { useReviewDiffStore } from "../../state/reviewDiff";
import { useReviewTabsStore } from "../../state/reviewTabs";
import { useThreadStore } from "../../state/thread";
import { useUiStore } from "../../state/ui";
import { PromptDialog } from "../common/PromptDialog";
import { CodexStatusDot } from "./CodexStatusDot";

export function ChatHeader({
  conversationTitle,
  titlebarInset = 0,
}: {
  conversationTitle?: string;
  titlebarInset?: number;
}) {
  const toggleReview = useUiStore((s) => s.toggleReview);
  const toggleTerminal = useUiStore((s) => s.toggleTerminal);
  const [renaming, setRenaming] = useState(false);
  const [committing, setCommitting] = useState(false);
  const [commitMessage, setCommitMessage] = useState("");
  const [commitGenerating, setCommitGenerating] = useState(false);
  const threadId = useThreadStore((s) => s.threadId);
  const project = useProjectStore((s) => s.current);
  const refreshDiff = useReviewDiffStore((s) => s.refreshFromGit);

  function startNewConversation() {
    useNavigationStore.getState().startNewConversation();
  }

  function openReviewChanges() {
    if (!project) return;
    useUiStore.getState().setReviewVisible(true);
    useReviewTabsStore.getState().setActive("review");
    void refreshDiff(project.cwd);
  }

  async function beginCommit() {
    if (!project) return;
    setCommitMessage("");
    setCommitGenerating(true);
    setCommitting(true);
    try {
      const message = await window.codex.git.suggestCommitMessage(project.cwd);
      setCommitMessage(message);
    } catch {
      setCommitMessage("update workspace changes");
    } finally {
      setCommitGenerating(false);
    }
  }

  return (
    <header className="relative z-30 flex h-[44px] shrink-0 items-center justify-between pl-2 pr-2 [app-region:no-drag]">
      <div
        className="flex h-full min-w-0 flex-1 items-center gap-1 transition-[margin-left] duration-[420ms] ease-[cubic-bezier(0.22,1,0.36,1)] [app-region:drag]"
        style={{ marginLeft: titlebarInset }}
      >
        {conversationTitle ? (
          <DropdownMenu.Root modal={false}>
            <DropdownMenu.Trigger asChild>
              <button className="flex h-7 min-w-0 max-w-[320px] items-center gap-1 rounded-md px-2 text-[12.5px] text-foreground hover:bg-black/[0.04] dark:hover:bg-white/[0.08] [app-region:no-drag]">
                <span className="truncate">{conversationTitle}</span>
                <ChevronDown size={12} className="shrink-0 opacity-60" />
              </button>
            </DropdownMenu.Trigger>
            <ConversationMenu
              threadId={threadId}
              cwd={project?.cwd}
              currentTitle={conversationTitle}
              onNewConversation={startNewConversation}
              onRename={() => setRenaming(true)}
            />
          </DropdownMenu.Root>
        ) : null}
      </div>

      <div className="flex shrink-0 items-center gap-1.5 [app-region:no-drag]">
        <BackendSwitcher />
        <CodexStatusDot />
        <EditorMenu project={project} />
        <IconButton
          tooltip="切换终端"
          disabled={!project}
          onClick={toggleTerminal}
        >
          <SquareTerminal size={14} strokeWidth={1.8} />
        </IconButton>
        <HeaderGitMenu
          project={project}
          onOpenChanges={openReviewChanges}
          onCommit={() => void beginCommit()}
        />
        <IconButton tooltip="切换审查面板" onClick={toggleReview}>
          <PanelRight size={14} strokeWidth={1.8} />
        </IconButton>
      </div>

      <PromptDialog
        open={renaming}
        title="重命名对话"
        defaultValue={conversationTitle ?? ""}
        confirmLabel="保存"
        onCancel={() => setRenaming(false)}
        onConfirm={async (value) => {
          if (threadId) {
            await useHistoryStore.getState().renameThread(threadId, value);
          }
          setRenaming(false);
        }}
      />
      <PromptDialog
        open={committing}
        title="提交改动"
        description={
          commitGenerating
            ? "正在调用 Codex 根据当前 diff 生成提交信息。"
            : "提交前会自动暂存全部改动（git add -A），提交信息可先确认和修改。"
        }
        placeholder={commitGenerating ? "Codex 正在生成提交信息…" : "commit message"}
        defaultValue={commitMessage}
        multiline
        confirmLabel="提交"
        inputDisabled={commitGenerating}
        confirmDisabled={commitGenerating}
        onCancel={() => setCommitting(false)}
        onConfirm={async (value) => {
          if (!project) return;
          await window.codex.git.commit(project.cwd, value, { stageAll: true });
          setCommitting(false);
          await refreshDiff(project.cwd);
          void useProjectStore.getState().load();
        }}
      />
    </header>
  );
}

function BackendSwitcher() {
  const backend = useBackendStore((s) => s.backend);
  const setBackend = useBackendStore((s) => s.setBackend);

  async function selectBackend(next: AgentBackend) {
    if (next === backend) return;
    await setBackend(next);
    useThreadStore.getState().reset();
    useNavigationStore.getState().setView("chat");
    void useHistoryStore.getState().loadRecent();
  }

  return (
    <DropdownMenu.Root modal={false}>
      <DropdownMenu.Trigger asChild>
        <button
          type="button"
          aria-label="切换后端"
          title="切换后端"
          className="flex h-7 items-center gap-1.5 rounded-full border border-border bg-black/[0.035] px-2.5 text-[12px] font-medium text-foreground hover:bg-black/[0.06] dark:border-white/[0.1] dark:bg-white/[0.07] dark:hover:bg-white/[0.1] [app-region:no-drag]"
        >
          {BACKEND_LABEL[backend]}
          <ChevronDown size={11} className="opacity-65" />
        </button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align="end"
          sideOffset={6}
          className="z-50 min-w-[230px] rounded-lg bg-white p-1 text-[12.5px] text-foreground shadow-popover ring-1 ring-black/[0.06] dark:bg-zinc-900 dark:ring-white/[0.1]"
        >
          <BackendItem
            backend="codex"
            active={backend === "codex"}
            title="Codex"
            description="使用本机 codex app-server、Codex 历史和 Codex skills"
            onSelect={() => void selectBackend("codex")}
          />
          <BackendItem
            backend="ccb"
            active={backend === "ccb"}
            title="Claude Code"
            description="使用本机 claude CLI、~/.claude 历史和 Claude skills"
            onSelect={() => void selectBackend("ccb")}
          />
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}

function BackendItem({
  active,
  title,
  description,
  onSelect,
}: {
  backend: AgentBackend;
  active: boolean;
  title: string;
  description: string;
  onSelect: () => void;
}) {
  return (
    <DropdownMenu.Item
      onSelect={() => {
        onSelect();
      }}
      className="flex cursor-pointer items-start gap-2 rounded-md px-2 py-2 outline-none data-[highlighted]:bg-black/[0.05] dark:data-[highlighted]:bg-white/[0.08]"
    >
      <span className="mt-0.5 flex h-4 w-4 items-center justify-center text-foreground-subtle">
        {active ? <Check size={13} /> : null}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[12.5px] font-medium text-foreground">
          {title}
        </span>
        <span className="mt-0.5 block text-[11.5px] leading-snug text-foreground-subtle">
          {description}
        </span>
      </span>
    </DropdownMenu.Item>
  );
}

function IconButton({
  tooltip,
  children,
  ...props
}: PropsWithChildren<{ tooltip: string }> & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <Tooltip.Provider delayDuration={350}>
      <Tooltip.Root>
        <Tooltip.Trigger asChild>
          <button
            {...props}
            type="button"
            aria-label={props["aria-label"] ?? tooltip}
            title={props.title ?? tooltip}
            className={cn(
              "flex h-7 w-7 items-center justify-center rounded-md text-foreground-muted hover:bg-black/[0.05] disabled:pointer-events-none disabled:opacity-35 [app-region:no-drag]",
              props.className,
            )}
          >
            {children}
          </button>
        </Tooltip.Trigger>
        <Tooltip.Portal>
          <Tooltip.Content
            sideOffset={6}
            className="z-50 rounded-md bg-zinc-900 px-2 py-1 text-[11px] text-white shadow-popover dark:bg-zinc-100 dark:text-zinc-900"
          >
            {tooltip}
            <Tooltip.Arrow className="fill-zinc-900 dark:fill-zinc-100" />
          </Tooltip.Content>
        </Tooltip.Portal>
      </Tooltip.Root>
    </Tooltip.Provider>
  );
}

function EditorMenu({ project }: { project: ProjectInfo | null }) {
  return (
    <DropdownMenu.Root modal={false}>
      <Tooltip.Provider delayDuration={350}>
        <Tooltip.Root>
          <Tooltip.Trigger asChild>
            <DropdownMenu.Trigger asChild>
              <button
                type="button"
                aria-label="打开编辑器"
                title="打开编辑器"
                disabled={!project}
                className="flex h-7 items-center gap-1 rounded-md px-2 text-foreground-muted hover:bg-black/[0.05] disabled:pointer-events-none disabled:opacity-35 [app-region:no-drag]"
              >
                <Code2 size={14} strokeWidth={1.8} />
                <ChevronDown size={11} className="opacity-60" />
              </button>
            </DropdownMenu.Trigger>
          </Tooltip.Trigger>
          <Tooltip.Portal>
            <Tooltip.Content
              sideOffset={6}
              className="z-50 rounded-md bg-zinc-900 px-2 py-1 text-[11px] text-white shadow-popover dark:bg-zinc-100 dark:text-zinc-900"
            >
              打开编辑器
              <Tooltip.Arrow className="fill-zinc-900 dark:fill-zinc-100" />
            </Tooltip.Content>
          </Tooltip.Portal>
        </Tooltip.Root>
      </Tooltip.Provider>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align="end"
          sideOffset={6}
          className="z-50 min-w-[210px] rounded-lg bg-white p-1 text-[12.5px] text-foreground shadow-popover ring-1 ring-black/[0.06]"
        >
          <Item
            icon={<Code2 size={13} />}
            label="在编辑器中打开"
            disabled={!project}
            onSelect={() =>
              project && void window.codex.system.openEditor(project.cwd)
            }
          />
          <Item
            icon={<FolderOpen size={13} />}
            label="在文件管理器中打开"
            disabled={!project}
            onSelect={() => project && void window.codex.file.open(project.cwd)}
          />
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}

interface GitSummary {
  branch: string | null;
  clean: boolean;
  fileCount: number;
  added: number;
  removed: number;
  error: string | null;
}

function HeaderGitMenu({
  project,
  onOpenChanges,
  onCommit,
}: {
  project: ProjectInfo | null;
  onOpenChanges: () => void;
  onCommit: () => void;
}) {
  const [summary, setSummary] = useState<GitSummary>({
    branch: project?.branch ?? null,
    clean: true,
    fileCount: 0,
    added: 0,
    removed: 0,
    error: null,
  });
  const [loading, setLoading] = useState(false);

  async function refresh() {
    if (!project) return;
    setLoading(true);
    try {
      const [status, changes] = await Promise.all([
        window.codex.git.status(project.cwd) as Promise<{
          branch?: string | null;
          clean?: boolean;
          files?: unknown[];
        }>,
        window.codex.git.changes(project.cwd) as Promise<
          Array<{ added?: number; removed?: number }>
        >,
      ]);
      setSummary({
        branch: status.branch ?? project.branch,
        clean: status.clean ?? changes.length === 0,
        fileCount: Array.isArray(status.files)
          ? status.files.length
          : changes.length,
        added: changes.reduce((sum, item) => sum + (item.added ?? 0), 0),
        removed: changes.reduce((sum, item) => sum + (item.removed ?? 0), 0),
        error: null,
      });
    } catch (e) {
      setSummary((current) => ({
        ...current,
        error: e instanceof Error ? e.message : String(e),
      }));
    } finally {
      setLoading(false);
    }
  }

  return (
    <DropdownMenu.Root
      modal={false}
      onOpenChange={(open) => {
        if (open) void refresh();
      }}
    >
      <Tooltip.Provider delayDuration={350}>
        <Tooltip.Root>
          <Tooltip.Trigger asChild>
            <DropdownMenu.Trigger asChild>
              <button
                type="button"
                aria-label="Git"
                title="Git"
                disabled={!project}
                className="flex h-7 w-7 items-center justify-center rounded-md text-foreground-muted hover:bg-black/[0.05] disabled:pointer-events-none disabled:opacity-35 [app-region:no-drag]"
              >
                <GitBranch size={14} strokeWidth={1.8} />
              </button>
            </DropdownMenu.Trigger>
          </Tooltip.Trigger>
          <Tooltip.Portal>
            <Tooltip.Content
              sideOffset={6}
              className="z-50 rounded-md bg-zinc-900 px-2 py-1 text-[11px] text-white shadow-popover dark:bg-zinc-100 dark:text-zinc-900"
            >
              Git
              <Tooltip.Arrow className="fill-zinc-900 dark:fill-zinc-100" />
            </Tooltip.Content>
          </Tooltip.Portal>
        </Tooltip.Root>
      </Tooltip.Provider>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align="end"
          sideOffset={6}
          className="z-50 min-w-[280px] rounded-lg bg-white p-1.5 text-[12.5px] text-foreground shadow-popover ring-1 ring-black/[0.06]"
        >
          <div className="px-2 py-1.5 text-[11.5px] text-foreground-subtle">
            Git
          </div>
          <Item
            icon={<FileText size={13} />}
            label={loading ? "正在读取变更…" : "变更"}
            trailing={
              <span className="font-mono">
                <span className="text-emerald-500">
                  +{summary.added.toLocaleString()}
                </span>{" "}
                <span className="text-rose-500">
                  -{summary.removed.toLocaleString()}
                </span>
              </span>
            }
            disabled={!project}
            onSelect={onOpenChanges}
          />
          <Item
            icon={<Monitor size={13} />}
            label="本地"
            disabled={!project}
            onSelect={() => project && void window.codex.file.open(project.cwd)}
          />
          <Item
            icon={<GitBranch size={13} />}
            label={summary.branch ?? project?.branch ?? "无分支"}
            disabled
          />
          <Item
            icon={<GitCommit size={13} />}
            label="提交"
            disabled={!project || summary.clean}
            onSelect={onCommit}
          />
          <Item
            icon={<GitPullRequest size={13} />}
            label="创建拉取请求"
            disabled={!project || !summary.branch}
            onSelect={() =>
              project && void window.codex.git.openPullRequest(project.cwd)
            }
          />
          <DropdownMenu.Separator className="my-1 h-px bg-black/[0.06]" />
          <Item
            icon={<RefreshCw size={13} />}
            label="刷新"
            disabled={!project}
            onSelect={() => void refresh()}
          />
          {summary.error && (
            <div className="px-2 py-1 text-[11.5px] text-rose-500">
              {summary.error}
            </div>
          )}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}

function ConversationMenu({
  threadId,
  cwd,
  currentTitle,
  onNewConversation,
  onRename,
}: {
  threadId: string | null;
  cwd?: string;
  currentTitle?: string;
  onNewConversation: () => void;
  onRename: () => void;
}) {
  const togglePin = useHistoryStore((s) => s.togglePin);
  const archive = useHistoryStore((s) => s.archiveThread);
  const messages = useThreadStore((s) => s.items);

  function copyAsMarkdown() {
    if (messages.length === 0) {
      void navigator.clipboard.writeText(`# ${currentTitle ?? "Codex conversation"}\n`);
      return;
    }
    const lines = messages.map((item) => {
      const header =
        item.role === "user"
          ? "## 用户"
          : item.role === "assistant"
            ? "## Codex"
            : `## ${item.type ?? item.role ?? "tool"}`;
      const body = item.text ?? JSON.stringify(item.raw, null, 2);
      return `${header}\n\n${body}`;
    });
    void navigator.clipboard.writeText(
      `# ${currentTitle ?? "Codex conversation"}\n\n${lines.join("\n\n")}`,
    );
  }

  return (
    <DropdownMenu.Portal>
      <DropdownMenu.Content
        sideOffset={6}
        className="z-50 min-w-[240px] rounded-lg bg-white p-1 text-[12.5px] text-foreground shadow-popover ring-1 ring-black/[0.06]"
      >
        <Item
          icon={<MessageSquarePlus size={13} />}
          label="新对话"
          onSelect={onNewConversation}
        />
        <DropdownMenu.Separator className="my-1 h-px bg-black/[0.06]" />
        <Item
          icon={<Pin size={13} />}
          label="置顶对话"
          disabled={!threadId}
          onSelect={() => threadId && void togglePin(threadId)}
        />
        <Item
          icon={<Pencil size={13} />}
          label="重命名对话"
          disabled={!threadId}
          onSelect={onRename}
        />
        <Item
          icon={<Archive size={13} />}
          label="归档对话"
          disabled={!threadId}
          onSelect={() => threadId && void archive(threadId)}
        />
        <DropdownMenu.Separator className="my-1 h-px bg-black/[0.06]" />
        <Item
          icon={<Copy size={13} />}
          label="复制工作目录"
          disabled={!cwd}
          onSelect={() => cwd && void window.codex.file.copyPath(cwd)}
        />
        <Item
          icon={<Fingerprint size={13} />}
          label="复制会话 ID"
          disabled={!threadId}
          onSelect={() =>
            threadId && void navigator.clipboard.writeText(threadId)
          }
        />
        <Item
          icon={<FileText size={13} />}
          label="复制为 Markdown"
          onSelect={copyAsMarkdown}
        />
        <DropdownMenu.Separator className="my-1 h-px bg-black/[0.06]" />
        <Item
          icon={<Sparkles size={13} />}
          label="添加自动化"
          onSelect={() => useNavigationStore.getState().setView("automation")}
        />
      </DropdownMenu.Content>
    </DropdownMenu.Portal>
  );
}

function Item({
  icon,
  label,
  trailing,
  onSelect,
  disabled,
}: {
  icon: React.ReactNode;
  label: string;
  trailing?: React.ReactNode;
  onSelect?: () => void;
  disabled?: boolean;
}) {
  return (
    <DropdownMenu.Item
      disabled={disabled}
      onSelect={() => {
        onSelect?.();
      }}
      className={cn(
        "flex h-7 cursor-pointer items-center gap-2 rounded-md px-2 outline-none",
        "data-[highlighted]:bg-black/[0.05]",
        "data-[disabled]:cursor-default data-[disabled]:opacity-40",
      )}
    >
      <span className="flex h-4 w-4 items-center justify-center text-foreground-subtle">
        {icon}
      </span>
      <span className="flex-1 truncate">{label}</span>
      {trailing ? (
        <span className="ml-3 shrink-0 text-foreground-subtle">{trailing}</span>
      ) : null}
    </DropdownMenu.Item>
  );
}
