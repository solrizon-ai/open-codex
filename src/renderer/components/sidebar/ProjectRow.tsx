import {
  ChevronRight,
  Folder,
  ArrowUpRight,
  GitBranchPlus,
  Archive,
  Trash2,
  MoreHorizontal,
  SquarePen,
} from "lucide-react";
import * as ContextMenu from "@radix-ui/react-context-menu";
import { useState } from "react";
import { cn } from "../../lib/cn";
import { useHistoryStore } from "../../state/history";
import { useNavigationStore } from "../../state/navigation";
import { useProjectStore } from "../../state/project";
import { PromptDialog } from "../common/PromptDialog";

type ProjectRowProps = {
  id: string;
  name: string;
  cwd?: string;
  expanded: boolean;
  onToggle: () => void;
};

export function ProjectRow({
  id,
  name,
  cwd,
  expanded,
  onToggle,
}: ProjectRowProps) {
  const [worktreeName, setWorktreeName] = useState<string | null>(null);

  async function startNewConversation(e: React.MouseEvent) {
    e.stopPropagation();
    if (cwd) {
      await useProjectStore.getState().setCurrent(cwd);
    }
    useNavigationStore.getState().startNewConversation();
  }

  return (
    <>
      <ContextMenu.Root>
        <ContextMenu.Trigger asChild>
          <div
            className={cn(
              "group/project relative flex h-[30px] items-center rounded-[10px] pr-1 text-[14px] font-medium text-foreground-muted transition-colors",
              "hover:text-foreground",
            )}
          >
            <button
              type="button"
              onClick={onToggle}
              className="flex h-full flex-1 items-center gap-[13px] truncate px-[16px] text-left"
            >
              <Folder
                size={20}
                strokeWidth={1.8}
                className="shrink-0 text-foreground-muted"
              />
              <span className="min-w-0 flex-1 truncate">{name}</span>
              <ChevronRight
                size={13}
                strokeWidth={2}
                className={cn(
                  "shrink-0 text-foreground-subtle opacity-0 transition-[opacity,transform] duration-150 group-hover/project:opacity-100",
                  expanded && "rotate-90",
                )}
              />
            </button>
            <div className="ml-auto flex items-center gap-[2px] pr-[2px] opacity-0 transition-opacity group-hover/project:opacity-100">
              <button
                type="button"
                className="flex h-[20px] w-[20px] items-center justify-center rounded text-foreground-subtle hover:bg-black/[0.06] hover:text-foreground dark:hover:bg-white/[0.08]"
                onClick={(e) => {
                  e.stopPropagation();
                  // The row itself is the ContextMenu.Trigger — fire a
                  // synthetic right-click on it so the menu opens at the
                  // button position.
                  const target = e.currentTarget.closest(
                    "[data-radix-context-menu-trigger]",
                  ) as HTMLElement | null;
                  target?.dispatchEvent(
                    new MouseEvent("contextmenu", {
                      bubbles: true,
                      clientX: e.clientX,
                      clientY: e.clientY,
                    }),
                  );
                }}
                title="更多"
              >
                <MoreHorizontal size={13} strokeWidth={1.8} />
              </button>
              <button
                type="button"
                className="flex h-[20px] w-[20px] items-center justify-center rounded text-foreground-subtle hover:bg-black/[0.06] hover:text-foreground dark:hover:bg-white/[0.08]"
                onClick={(e) => void startNewConversation(e)}
                title="新对话"
              >
                <SquarePen size={12} strokeWidth={1.8} />
              </button>
            </div>
          </div>
        </ContextMenu.Trigger>
        <ProjectContextMenuContent
          id={id}
          name={name}
          cwd={cwd}
          onCreateWorktree={() => setWorktreeName(name)}
        />
      </ContextMenu.Root>
      <PromptDialog
        open={worktreeName !== null}
        title="创建永久工作树"
        description="为该项目创建一个新的 git 工作树。路径相对于项目所在目录的上一级。"
        placeholder="分支名 / 工作树目录名"
        confirmLabel="创建"
        onCancel={() => setWorktreeName(null)}
        onConfirm={async (branch) => {
          if (!cwd) return;
          const targetPath = `${cwd}-${branch.replace(/[^A-Za-z0-9_\-./]/g, "_")}`;
          await window.codex.git.worktreeAdd(cwd, targetPath, branch);
          setWorktreeName(null);
        }}
      />
    </>
  );
}

function ProjectContextMenuContent({
  id,
  name,
  cwd,
  onCreateWorktree,
}: {
  id: string;
  name: string;
  cwd?: string;
  onCreateWorktree: () => void;
}) {
  return (
    <ContextMenu.Portal>
      <ContextMenu.Content
        className={cn(
          "z-50 min-w-[180px] rounded-[8px] border border-border bg-surface-elevated p-[4px]",
          "text-[12.5px] text-foreground shadow-popover",
        )}
      >
        <MenuItem
          icon={<ArrowUpRight size={13} strokeWidth={1.8} />}
          label={`在 "${name}" 中打开`}
          disabled={!cwd}
          onSelect={() => cwd && void window.codex.file.open(cwd)}
        />
        <MenuItem
          icon={<GitBranchPlus size={13} strokeWidth={1.8} />}
          label="创建永久工作树"
          disabled={!cwd}
          onSelect={onCreateWorktree}
        />
        <MenuSeparator />
        <MenuItem
          icon={<Archive size={13} strokeWidth={1.8} />}
          label="归档对话"
          onSelect={() => {
            const ids = useHistoryStore
              .getState()
              .threads.filter((t) => t.cwd === id)
              .map((t) => t.id);
            for (const tid of ids) {
              void useHistoryStore.getState().archiveThread(tid);
            }
          }}
        />
        <MenuItem
          icon={<Trash2 size={13} strokeWidth={1.8} />}
          label="移除"
          danger
          onSelect={async () => {
            // Remove from local list (archive everything). codex itself
            // doesn't have a "delete project" RPC; rows fade out as their
            // threads disappear.
            const store = useHistoryStore.getState();
            const ids = store.threads
              .filter((t) => t.cwd === id)
              .map((t) => t.id);
            for (const tid of ids) await store.archiveThread(tid);
            const current = useProjectStore.getState().current;
            if (current?.cwd === id) {
              await window.codex.project.clear();
              useProjectStore.setState({ current: null });
            }
          }}
        />
      </ContextMenu.Content>
    </ContextMenu.Portal>
  );
}

function MenuItem({
  icon,
  label,
  danger,
  disabled,
  onSelect,
}: {
  icon: React.ReactNode;
  label: string;
  danger?: boolean;
  disabled?: boolean;
  onSelect?: () => void;
}) {
  return (
    <ContextMenu.Item
      disabled={disabled}
      onSelect={() => {
        onSelect?.();
      }}
      className={cn(
        "flex h-[26px] cursor-default select-none items-center gap-[8px] rounded-[5px] px-[8px] text-[12.5px] outline-none",
        "data-[highlighted]:bg-accent data-[highlighted]:text-accent-foreground",
        "data-[disabled]:opacity-40",
        danger ? "text-rose-500" : "text-foreground",
      )}
    >
      <span className="flex w-[14px] shrink-0 items-center justify-center text-foreground-muted [[data-highlighted]>&]:text-accent-foreground">
        {icon}
      </span>
      <span className="flex-1 truncate">{label}</span>
    </ContextMenu.Item>
  );
}

function MenuSeparator() {
  return <ContextMenu.Separator className="my-[3px] h-px bg-border" />;
}
