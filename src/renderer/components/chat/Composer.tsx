import { memo, useEffect, useLayoutEffect, useRef, useState } from "react";
import {
  Hand,
  ArrowUp,
  Zap,
  X,
  FolderClosed,
  GitBranch,
  Monitor,
  ChevronDown,
  CornerDownLeft,
  AppWindow,
  Bot,
  Brain,
  ClipboardCheck,
  Code2,
  Command,
  FileCode2,
  FolderPlus,
  Gauge,
  GitCompare,
  GitFork,
  HelpCircle,
  Info,
  LogIn,
  MessageSquare,
  PackageOpen,
  Paperclip,
  Puzzle,
  RefreshCcw,
  Settings,
  ShieldCheck,
  Sparkles,
  SquarePen,
  TerminalSquare,
  Wrench,
  type LucideIcon,
} from "lucide-react";
import { cn } from "../../lib/cn";
import { ProjectPopover } from "./popovers/ProjectPopover";
import { BranchPopover } from "./popovers/BranchPopover";
import { ModelPopover } from "./popovers/ModelPopover";
import { PermissionsPopover } from "./popovers/PermissionsPopover";
import { RemotePopover } from "./popovers/RemotePopover";
import { useThreadStore } from "../../state/thread";
import type { UserTurnInput } from "../../state/thread";
import { useProjectStore } from "../../state/project";
import { usePreferencesStore } from "../../state/preferences";
import {
  matchSlashCommands,
  parseSlashInvocation,
  type SlashCommand,
} from "../../codex/slashCommands";
import { useNavigationStore } from "../../state/navigation";
import { useUiStore } from "../../state/ui";
import { useComposerStore } from "../../state/composer";
import { BACKEND_LABEL, useBackendStore } from "../../state/backend";
import {
  claudeModelLabel,
  claudePermissionLabel,
  normalizeClaudePermissionMode,
  useClaudeCodeConfigStore,
} from "../../state/claudeConfig";
import { useSlashCommandStore } from "../../state/slashCommands";

const REASONING_LABEL: Record<string, string> = {
  minimal: "极简",
  low: "低",
  medium: "中",
  high: "高",
};

const APPROVAL_LABEL: Record<string, string> = {
  untrusted: "审核所有",
  "on-failure": "自动审核",
  "on-request": "默认权限",
  never: "完全访问",
};

export const Composer = memo(function Composer() {
  const [value, setValue] = useState("");
  const [pastedImages, setPastedImages] = useState<PastedImage[]>([]);
  const composerRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [slashMaxHeight, setSlashMaxHeight] = useState(260);
  const pendingInsert = useComposerStore((s) => s.pendingInsert);
  const consumeInsert = useComposerStore((s) => s.consumeInsert);
  const sendTurn = useThreadStore((s) => s.sendTurn);
  const status = useThreadStore((s) => s.status);
  const project = useProjectStore((s) => s.current);
  const model = usePreferencesStore((s) => s.model);
  const reasoning = usePreferencesStore((s) => s.reasoning);
  const approval = usePreferencesStore((s) => s.approvalPolicy);
  const loadPrefs = usePreferencesStore((s) => s.load);
  const prefsLoaded = usePreferencesStore((s) => s.loaded);
  const backend = useBackendStore((s) => s.backend);
  const claudeModel = useClaudeCodeConfigStore((s) => s.model);
  const claudePermissionMode = useClaudeCodeConfigStore((s) => s.permissionMode);
  const loadClaudeConfig = useClaudeCodeConfigStore((s) => s.load);
  const claudeConfigLoaded = useClaudeCodeConfigStore((s) => s.loaded);
  const slashCommands = useSlashCommandStore((s) => s.commands);
  const loadSlashCommands = useSlashCommandStore((s) => s.load);
  const busy = status === "running" || status === "starting";
  const projectName = project?.name ?? "选择项目";
  const branchName = project?.branch ?? "无 Git 分支";
  const modelLabel = model ? compactModelName(model) : "默认模型";
  const assistantLabel = BACKEND_LABEL[backend];
  const isCodexBackend = backend === "codex";
  const permissionLabel = isCodexBackend
    ? (APPROVAL_LABEL[approval] ?? "默认权限")
    : claudePermissionLabel(claudePermissionMode);
  const modelChipLabel = isCodexBackend
    ? `${modelLabel} ${REASONING_LABEL[reasoning] ?? "中"}`
    : claudeModelLabel(claudeModel);
  const slashMatches = matchSlashCommands(value, slashCommands);

  useEffect(() => {
    if (!prefsLoaded) void loadPrefs();
  }, [prefsLoaded, loadPrefs]);

  useEffect(() => {
    if (backend !== "codex" && !claudeConfigLoaded) void loadClaudeConfig();
  }, [backend, claudeConfigLoaded, loadClaudeConfig]);

  useEffect(() => {
    void loadSlashCommands(project?.cwd ?? null);
  }, [backend, project?.cwd, loadSlashCommands]);

  useLayoutEffect(() => {
    if (slashMatches.length === 0) return;
    const updateHeight = () => {
      const rect = composerRef.current?.getBoundingClientRect();
      if (!rect) return;
      setSlashMaxHeight(Math.max(132, Math.min(360, rect.top - 152)));
    };
    updateHeight();
    window.addEventListener("resize", updateHeight);
    return () => window.removeEventListener("resize", updateHeight);
  }, [slashMatches.length]);

  useEffect(() => {
    if (!pendingInsert) return;
    const text = consumeInsert();
    if (!text) return;
    setValue((current) => (current.trim() ? `${current}\n\n${text}` : text));
  }, [pendingInsert, consumeInsert]);

  const submit = async () => {
    const text = value.trim();
    if ((!text && pastedImages.length === 0) || busy) return;
    if (pastedImages.length === 0 && runLocalSlashCommand(text, backend)) {
      setValue("");
      return;
    }
    const slash = parseSlashInvocation(text, slashCommands);
    const imageInputs: UserTurnInput[] = pastedImages.map((image) => ({
      type: "image",
      url: image.src,
    }));
    const skillInputs: UserTurnInput[] =
      slash?.command.source === "skill" && slash.command.skill
        ? [
            {
              type: "skill",
              name: slash.command.skill.name,
              path: slash.command.skill.path,
            },
            ...(slash.args.trim()
              ? [{ type: "text" as const, text: slash.args.trim() }]
              : []),
          ]
        : [];
    const restoreImages = pastedImages;
    setValue("");
    setPastedImages([]);
    try {
      await sendTurn(
        skillInputs.length > 0 ? "" : text,
        [...skillInputs, ...imageInputs],
      );
    } catch {
      setValue(text); // restore on failure
      setPastedImages(restoreImages);
    }
  };

  function handlePaste(e: React.ClipboardEvent<HTMLTextAreaElement>) {
    const files = Array.from(e.clipboardData.files).filter((file) =>
      file.type.startsWith("image/"),
    );
    if (files.length === 0) return;
    e.preventDefault();
    for (const file of files) {
      const reader = new FileReader();
      reader.onload = () => {
        const src = typeof reader.result === "string" ? reader.result : null;
        if (!src) return;
        const id =
          typeof crypto?.randomUUID === "function"
            ? crypto.randomUUID()
            : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
        setPastedImages((current) => [
          ...current,
          {
            id,
            name: file.name || "pasted-image",
            src,
          },
        ]);
      };
      reader.readAsDataURL(file);
    }
  }

  return (
    <div
      ref={composerRef}
      className="relative w-full min-w-0 rounded-[22px] bg-[var(--composer-bg)] px-4 pb-3 pt-4 shadow-composer ring-1 ring-[var(--composer-ring)] backdrop-blur-xl"
    >
      {slashMatches.length > 0 && (
        <SlashCommandPanel
          commands={slashMatches}
          maxHeight={slashMaxHeight}
          onSelect={(cmd) => {
            setValue(`/${cmd.command}${cmd.supportsInlineArgs ? " " : ""}`);
            requestAnimationFrame(() => textareaRef.current?.focus());
          }}
        />
      )}
      {pastedImages.length > 0 && (
        <div className="mb-3 flex flex-wrap gap-2 px-2">
          {pastedImages.map((image) => (
            <div
              key={image.id}
              className="group/image relative h-[76px] w-[92px] overflow-hidden rounded-xl border border-border bg-black/[0.04] dark:border-white/[0.1] dark:bg-white/[0.07]"
            >
              <img
                src={image.src}
                alt={image.name}
                className="h-full w-full object-cover"
              />
              <button
                type="button"
                aria-label="移除图片"
                onClick={() =>
                  setPastedImages((current) =>
                    current.filter((entry) => entry.id !== image.id),
                  )
                }
                className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-black/55 text-white opacity-0 transition-opacity group-hover/image:opacity-100"
              >
                <X size={12} strokeWidth={2.2} />
              </button>
            </div>
          ))}
        </div>
      )}
      <textarea
        ref={textareaRef}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onPaste={handlePaste}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
            e.preventDefault();
            void submit();
          }
        }}
        placeholder={`可向 ${assistantLabel} 询问任何事。输入 / 使用后端功能，输入 @ 提及文件`}
        rows={1}
        className="block w-full resize-none bg-transparent px-2 text-[15px] text-foreground focus:outline-none placeholder:text-[var(--placeholder)]"
      />

      <div className="mt-3 flex items-center gap-1 px-1">
        <PermissionsPopover
          trigger={
            <button
              type="button"
              className="flex h-7 items-center gap-1.5 rounded-md px-2 text-[12px] text-foreground-muted hover:bg-black/[0.05] dark:hover:bg-white/[0.08]"
            >
              <Hand size={13} strokeWidth={1.8} />
              {permissionLabel}
              <ChevronDown size={11} className="opacity-60" />
            </button>
          }
        />

        <div className="flex-1" />

        <ModelPopover
          trigger={
            <button
              type="button"
              className="flex h-7 items-center gap-1.5 rounded-md px-2 text-[12px] text-foreground-muted hover:bg-black/[0.05] dark:hover:bg-white/[0.08]"
            >
              <Zap
                size={12}
                className="fill-current text-foreground/65"
                strokeWidth={0}
              />
              {modelChipLabel}
              <ChevronDown size={11} className="opacity-60" />
            </button>
          }
        />

        <button
          type="button"
          aria-label="发送"
          onClick={submit}
          disabled={busy}
          className={cn(
            "ml-1 flex h-7 w-7 items-center justify-center rounded-full transition-colors",
            "bg-foreground text-white shadow-sm hover:bg-foreground/90",
            "dark:bg-white dark:text-black dark:hover:bg-white/90",
            busy && "opacity-60",
          )}
        >
          <ArrowUp size={14} strokeWidth={2.2} />
        </button>
      </div>

      <div className="mt-3 flex items-center gap-1 border-t border-[var(--composer-divider)] px-1 pt-3">
        <ProjectPopover
          trigger={
            <button
              type="button"
              className="flex h-7 items-center gap-1.5 rounded-md px-2 text-[11.5px] text-foreground-muted hover:bg-black/[0.05] dark:hover:bg-white/[0.08]"
            >
              <FolderClosed size={13} strokeWidth={1.8} />
              {projectName}
              <ChevronDown size={11} className="opacity-60" />
            </button>
          }
        />

        <RemotePopover
          trigger={
            <button
              type="button"
              className="flex h-7 items-center gap-1.5 rounded-md px-2 text-[11.5px] text-foreground-muted hover:bg-black/[0.05] dark:hover:bg-white/[0.08]"
            >
              <Monitor size={13} strokeWidth={1.8} />
              {isCodexBackend ? "本地模式" : "Claude CLI"}
              <ChevronDown size={11} className="opacity-60" />
            </button>
          }
        />

        <BranchPopover
          trigger={
            <button
              type="button"
              className="flex h-7 items-center gap-1.5 rounded-md px-2 text-[11.5px] text-foreground-muted hover:bg-black/[0.05] dark:hover:bg-white/[0.08]"
            >
              <GitBranch size={13} strokeWidth={1.8} />
              {branchName}
              <ChevronDown size={11} className="opacity-60" />
            </button>
          }
        />
      </div>
    </div>
  );
});

function SlashCommandPanel({
  commands,
  maxHeight,
  onSelect,
}: {
  commands: SlashCommand[];
  maxHeight: number;
  onSelect: (cmd: SlashCommand) => void;
}) {
  return (
    <div className="absolute bottom-[calc(100%+2px)] left-0 z-30 w-full overflow-hidden rounded-[18px] border border-[var(--composer-ring)] bg-[var(--composer-bg)] p-2 text-[13px] shadow-[0_18px_60px_rgba(0,0,0,0.16)] backdrop-blur-xl dark:border-white/[0.09] dark:shadow-[0_22px_70px_rgba(0,0,0,0.42)]">
      <div className="overflow-y-auto pr-1" style={{ maxHeight }}>
        {commands.map((cmd, index) => {
          const Icon = slashCommandIcon(cmd);
          return (
            <button
              key={cmd.command}
              type="button"
              data-slash-command={cmd.command}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => onSelect(cmd)}
              className={cn(
                "grid h-11 w-full grid-cols-[24px_minmax(128px,240px)_minmax(0,1fr)_18px] items-center gap-2 rounded-xl px-3 text-left transition-colors",
                index === 0
                  ? "bg-black/[0.055] dark:bg-white/[0.08]"
                  : "hover:bg-black/[0.045] dark:hover:bg-white/[0.065]",
              )}
            >
              <Icon
                size={16}
                strokeWidth={1.9}
                className="text-foreground-muted"
              />
              <span className="min-w-0 truncate font-mono text-[12.5px] font-medium text-foreground">
                {cmd.label ?? commandTitle(cmd.command)}
              </span>
              <span className="min-w-0 truncate text-foreground-subtle">
                {cmd.description}
              </span>
              <CornerDownLeft
                size={13}
                strokeWidth={1.8}
                className="text-foreground-subtle opacity-50"
              />
            </button>
          );
        })}
      </div>
    </div>
  );
}

function slashCommandIcon(cmd: SlashCommand): LucideIcon {
  switch (cmd.icon ?? cmd.command) {
    case "new":
      return SquarePen;
    case "clear":
    case "rewind":
    case "resume":
      return RefreshCcw;
    case "plugins":
    case "plugin":
      return Puzzle;
    case "apps":
      return AppWindow;
    case "settings":
    case "config":
    case "theme":
      return Settings;
    case "diff":
      return GitCompare;
    case "review":
      return ClipboardCheck;
    case "mcp":
      return Paperclip;
    case "personality":
      return Bot;
    case "feedback":
      return MessageSquare;
    case "fast":
      return Zap;
    case "reasoning":
    case "compact":
    case "context":
    case "memory":
      return Brain;
    case "folder":
      return FolderPlus;
    case "branch":
      return GitFork;
    case "model":
    case "provider":
      return PackageOpen;
    case "status":
    case "usage":
    case "stats":
    case "version":
      return Info;
    case "permissions":
      return ShieldCheck;
    case "login":
      return LogIn;
    case "doctor":
    case "hooks":
      return Wrench;
    case "files":
    case "skills":
      return FileCode2;
    case "help":
      return HelpCircle;
    case "ide":
      return Code2;
    case "tasks":
    case "agents":
      return Gauge;
    case "command":
      return TerminalSquare;
    default:
      return cmd.backendCommand?.kind === "skill" || cmd.source === "skill"
        ? Sparkles
        : Command;
  }
}

function commandTitle(command: string): string {
  return `/${command}`;
}

function runLocalSlashCommand(text: string, backend: string): boolean {
  if (backend !== "codex") {
    const modelMatch = /^\/model(?:\s+(.+))?$/.exec(text);
    if (modelMatch?.[1]?.trim()) {
      void useClaudeCodeConfigStore
        .getState()
        .setModel(modelMatch[1].trim() === "default" ? "" : modelMatch[1].trim());
      return true;
    }
    const permissionMatch = /^\/permissions?(?:\s+(.+))?$/.exec(text);
    if (permissionMatch?.[1]?.trim()) {
      const mode = normalizeClaudePermissionMode(permissionMatch[1]);
      if (mode !== null) {
        void useClaudeCodeConfigStore.getState().setPermissionMode(mode);
        return true;
      }
    }
    switch (text) {
      case "/new":
        useNavigationStore.getState().startNewConversation();
        return true;
      case "/plugins":
        useUiStore.getState().setIntegrationsTab("plugins");
        useNavigationStore.getState().setView("plugins");
        return true;
      case "/apps":
        useUiStore.getState().setIntegrationsTab("apps");
        useNavigationStore.getState().setView("plugins");
        return true;
      case "/settings":
        void window.codex.window.openSettings();
        return true;
      default:
        return false;
    }
  }

  switch (text) {
    case "/new":
    case "/clear":
      useNavigationStore.getState().startNewConversation();
      return true;
    case "/plugins":
      useUiStore.getState().setIntegrationsTab("plugins");
      useNavigationStore.getState().setView("plugins");
      return true;
    case "/apps":
      useUiStore.getState().setIntegrationsTab("apps");
      useNavigationStore.getState().setView("plugins");
      return true;
    case "/diff":
    case "/review":
      useUiStore.getState().setReviewVisible(true);
      return true;
    case "/settings":
      void window.codex.window.openSettings();
      return true;
    default:
      return false;
  }
}

function compactModelName(model: string): string {
  return model.replace(/^gpt-/, "").replace(/-codex$/, "");
}

interface PastedImage {
  id: string;
  name: string;
  src: string;
}
