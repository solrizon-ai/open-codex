import {
  Pin,
  PencilLine,
  Archive,
  Circle,
  ArrowUpRight,
  FolderInput,
  Hash,
} from "lucide-react";
import * as ContextMenu from "@radix-ui/react-context-menu";
import { useState } from "react";
import { cn } from "../../lib/cn";
import type { Session } from "./types";
import { useHistoryStore } from "../../state/history";
import { PromptDialog } from "../common/PromptDialog";

type SessionRowProps = {
  session: Session;
  cwd?: string;
  onClick?: () => void;
};

export function SessionRow({ session, cwd, onClick }: SessionRowProps) {
  const [renaming, setRenaming] = useState(false);

  if (session.muted) {
    return (
      <div className="flex h-[31px] items-center px-[14px] text-[13px] font-medium text-foreground-subtle/70">
        {session.title}
      </div>
    );
  }

  return (
    <>
      <ContextMenu.Root>
        <ContextMenu.Trigger asChild>
          <button
            type="button"
            onClick={onClick}
            className={cn(
              "group/session flex h-[31px] w-full min-w-0 items-center rounded-[11px] px-[14px] text-left text-[14px] font-medium transition-colors",
              session.active
                ? "bg-white/[0.13] text-foreground shadow-[inset_0_0_0_1px_rgba(255,255,255,0.03)] dark:bg-white/[0.13]"
                : "text-foreground-muted hover:bg-white/[0.08] hover:text-foreground dark:hover:bg-white/[0.08]",
            )}
          >
            {session.pinned && (
              <Pin size={10} className="mr-[6px] shrink-0 text-foreground-subtle" />
            )}
            {session.unread && (
              <span className="mr-[6px] h-[6px] w-[6px] shrink-0 rounded-full bg-accent" />
            )}
            <span className="min-w-0 flex-1 truncate">{session.title}</span>
            {session.time && (
              <span
                className={cn(
                  "ml-3 w-[50px] shrink-0 text-right text-[12px] text-foreground-subtle",
                )}
              >
                {session.time}
              </span>
            )}
          </button>
        </ContextMenu.Trigger>
        <SessionContextMenuContent
          session={session}
          cwd={cwd}
          onRename={() => setRenaming(true)}
        />
      </ContextMenu.Root>
      <PromptDialog
        open={renaming}
        title="重命名对话"
        defaultValue={session.title}
        confirmLabel="保存"
        onCancel={() => setRenaming(false)}
        onConfirm={(value) => {
          useHistoryStore
            .getState()
            .renameThread(session.id, value);
          setRenaming(false);
        }}
      />
    </>
  );
}

function SessionContextMenuContent({
  session,
  cwd,
  onRename,
}: {
  session: Session;
  cwd?: string;
  onRename: () => void;
}) {
  const archive = useHistoryStore((s) => s.archiveThread);
  const togglePin = useHistoryStore((s) => s.togglePin);
  const markUnread = useHistoryStore((s) => s.markUnread);

  return (
    <ContextMenu.Portal>
      <ContextMenu.Content
        className={cn(
          "z-50 min-w-[196px] rounded-[8px] border border-border bg-surface-elevated p-[4px]",
          "text-[12.5px] text-foreground shadow-popover",
        )}
      >
        <MenuItem
          icon={<Pin size={13} strokeWidth={1.8} />}
          label={session.pinned ? "取消置顶" : "置顶对话"}
          onSelect={() => void togglePin(session.id)}
        />
        <MenuItem
          icon={<PencilLine size={13} strokeWidth={1.8} />}
          label="重命名对话"
          onSelect={onRename}
        />
        <MenuItem
          icon={<Archive size={13} strokeWidth={1.8} />}
          label="归档对话"
          onSelect={() => void archive(session.id)}
        />
        <MenuItem
          icon={<Circle size={13} strokeWidth={1.8} />}
          label={session.unread ? "标记为已读" : "标记为未读"}
          onSelect={() => void markUnread(session.id, !session.unread)}
        />
        <MenuSeparator />
        <MenuItem
          icon={<ArrowUpRight size={13} strokeWidth={1.8} />}
          label='在 "访达" 中打开'
          disabled={!cwd}
          onSelect={() => cwd && void window.codex.file.showInFolder(cwd)}
        />
        <MenuItem
          icon={<FolderInput size={13} strokeWidth={1.8} />}
          label="复制工作目录"
          disabled={!cwd}
          onSelect={() => cwd && void window.codex.file.copyPath(cwd)}
        />
        <MenuItem
          icon={<Hash size={13} strokeWidth={1.8} />}
          label="复制会话 ID"
          onSelect={() => {
            void navigator.clipboard.writeText(session.id);
          }}
        />
      </ContextMenu.Content>
    </ContextMenu.Portal>
  );
}

function MenuItem({
  icon,
  label,
  onSelect,
  disabled,
}: {
  icon: React.ReactNode;
  label: string;
  onSelect?: () => void;
  disabled?: boolean;
}) {
  return (
    <ContextMenu.Item
      disabled={disabled}
      onSelect={() => {
        onSelect?.();
      }}
      className={cn(
        "flex h-[26px] cursor-default select-none items-center gap-[8px] rounded-[5px] px-[8px] text-[12.5px] text-foreground outline-none",
        "data-[highlighted]:bg-accent data-[highlighted]:text-accent-foreground",
        "data-[disabled]:opacity-40",
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
  return (
    <ContextMenu.Separator className="my-[3px] h-px bg-border" />
  );
}
