import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import {
  Copy,
  ExternalLink,
  FileText,
  FolderOpen,
  MoreHorizontal,
} from "lucide-react";
import { cn } from "../../lib/cn";
import { useProjectStore } from "../../state/project";
import type { DiffFile } from "./types";

interface FileHeaderProps {
  file: DiffFile;
}

const STATUS_COLOR: Record<DiffFile["status"], string> = {
  modified: "text-amber-600",
  added: "text-green-600",
  deleted: "text-red-600",
  renamed: "text-blue-600",
};

export function FileHeader({ file }: FileHeaderProps) {
  const cwd = useProjectStore((s) => s.current?.cwd);
  const absolutePath = file.absolutePath ?? resolvePath(cwd, file.path);

  return (
    <div className="flex h-[52px] items-center gap-2 border-b border-border bg-[var(--code-bg)] px-3">
      <FileText
        size={15}
        className={cn("shrink-0", STATUS_COLOR[file.status])}
      />
      <div className="min-w-0 flex-1">
        <div className="truncate text-[15px] font-medium text-foreground">
          {file.path}
        </div>
      </div>
      <span className="ml-auto flex shrink-0 items-center gap-1.5 text-[15px] font-medium">
        <span className="text-[var(--diff-add-fg)]">+{file.added}</span>
        <span className="text-[var(--diff-del-fg)]">-{file.removed}</span>
      </span>
      <DiffFileActions path={absolutePath} />
    </div>
  );
}

function DiffFileActions({ path }: { path: string }) {
  return (
    <div className="ml-1 flex shrink-0 items-center gap-1">
      <DropdownMenu.Root>
        <DropdownMenu.Trigger asChild>
          <button
            type="button"
            title="更多"
            className="flex h-8 w-8 items-center justify-center rounded-lg text-[var(--code-muted)] hover:bg-black/[0.05] hover:text-foreground data-[state=open]:bg-black/[0.06] data-[state=open]:text-foreground dark:hover:bg-white/[0.08] dark:data-[state=open]:bg-white/[0.12]"
          >
            <MoreHorizontal size={17} strokeWidth={2} />
          </button>
        </DropdownMenu.Trigger>
        <DropdownMenu.Portal>
          <DropdownMenu.Content
            align="end"
            sideOffset={8}
            className="z-50 min-w-[228px] rounded-2xl border border-white/[0.08] bg-[var(--diff-hunk-bg)] p-1.5 text-[15px] font-medium text-foreground shadow-[0_16px_40px_rgba(0,0,0,0.45)]"
          >
            <MenuAction
              icon={<Copy size={17} />}
              label="复制路径"
              onSelect={() => void window.codex.file.copyPath(path)}
            />
          </DropdownMenu.Content>
        </DropdownMenu.Portal>
      </DropdownMenu.Root>
      <IconAction
        title="在编辑器中打开"
        onClick={() => void window.codex.file.open(path)}
      >
        <ExternalLink size={17} strokeWidth={2} />
      </IconAction>
      <IconAction
        title="在文件管理器中打开"
        onClick={() => void window.codex.file.showInFolder(path)}
      >
        <FolderOpen size={18} strokeWidth={2} />
      </IconAction>
    </div>
  );
}

function IconAction({
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

function resolvePath(cwd: string | undefined, filePath: string): string {
  if (!cwd || isAbsolutePath(filePath)) return filePath;
  return `${cwd.replace(/\/+$/, "")}/${filePath.replace(/^\/+/, "")}`;
}

function isAbsolutePath(filePath: string): boolean {
  return filePath.startsWith("/") || /^[A-Za-z]:[\\/]/.test(filePath);
}
