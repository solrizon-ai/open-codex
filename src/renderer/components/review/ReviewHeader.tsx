import {
  Settings2,
  FileText,
  Columns2,
  WrapText,
  Files,
  GitBranch,
  Search,
} from "lucide-react";
import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from "react";
import { cn } from "../../lib/cn";
import { SettingsMenu, type SettingsMenuState } from "./menus/SettingsMenu";
import { JumpToFileMenu } from "./menus/JumpToFileMenu";
import { FileListMenu } from "./menus/FileListMenu";
import { GitMenu } from "./menus/GitMenu";
import type { FileListEntry } from "./types";

interface ReviewHeaderProps {
  title: string;
  added: number;
  removed: number;
  settings: SettingsMenuState;
  onSettingsChange: (next: SettingsMenuState) => void;
  files: FileListEntry[];
  activePath?: string;
  onPickFile: (path: string) => void;
  fileScope: "all" | "modified";
  onFileScopeChange: (scope: "all" | "modified") => void;
  onSearch?: () => void;
  onPrevFile?: () => void;
  onNextFile?: () => void;
  onOpenFile?: () => void;
  onRevealFile?: () => void;
  onCopyPath?: () => void;
  onGitStage?: () => void;
  onGitUnstage?: () => void;
  onGitCommit?: () => void;
  onGitPush?: () => void;
  onGitDiscard?: () => void;
  onGitCheckout?: () => void;
  onGitRefresh?: () => void;
  hasActiveFile?: boolean;
}

export function ReviewHeader({
  title,
  added,
  removed,
  settings,
  onSettingsChange,
  files,
  activePath,
  onPickFile,
  fileScope,
  onFileScopeChange,
  onSearch,
  onPrevFile,
  onNextFile,
  onOpenFile,
  onRevealFile,
  onCopyPath,
  onGitStage,
  onGitUnstage,
  onGitCommit,
  onGitPush,
  onGitDiscard,
  onGitCheckout,
  onGitRefresh,
  hasActiveFile,
}: ReviewHeaderProps) {
  return (
    <div className="flex h-[38px] items-center gap-1 border-b border-border/60 bg-surface-elevated px-2 [app-region:drag]">
      <div className="flex min-w-0 flex-1 items-center gap-2 pl-1">
        <span className="truncate text-[12.5px] text-foreground/90">{title}</span>
        <span className="flex shrink-0 items-center gap-1 text-[11px]">
          <span className="text-green-600/90">+{added}</span>
          <span className="text-red-600/90">-{removed}</span>
        </span>
      </div>

      <div className="flex items-center gap-[2px] [app-region:no-drag]">
        <SettingsMenu
          state={settings}
          onChange={onSettingsChange}
          onOpen={onOpenFile}
          onRevealInFinder={onRevealFile}
          onCopyPath={onCopyPath}
          trigger={
            <IconButton aria-label="设置">
              <Settings2 size={14} strokeWidth={1.8} />
            </IconButton>
          }
        />

        <JumpToFileMenu
          onPrev={onPrevFile}
          onNext={onNextFile}
          onJump={onSearch}
          trigger={
            <IconButton aria-label="跳转文件">
              <FileText size={14} strokeWidth={1.8} />
            </IconButton>
          }
        />

        <IconButton
          aria-label="拆分视图"
          active={settings.splitView}
          onClick={() =>
            onSettingsChange({ ...settings, splitView: !settings.splitView })
          }
        >
          <Columns2 size={14} strokeWidth={1.8} />
        </IconButton>

        <IconButton
          aria-label="自动换行"
          active={settings.wrapLines}
          onClick={() =>
            onSettingsChange({ ...settings, wrapLines: !settings.wrapLines })
          }
        >
          <WrapText size={14} strokeWidth={1.8} />
        </IconButton>

        <FileListMenu
          files={files}
          activePath={activePath}
          onSelect={onPickFile}
          scope={fileScope}
          onScopeChange={onFileScopeChange}
          trigger={
            <IconButton aria-label="文件列表">
              <Files size={14} strokeWidth={1.8} />
            </IconButton>
          }
        />

        <GitMenu
          hasActiveFile={hasActiveFile}
          onStage={onGitStage}
          onUnstage={onGitUnstage}
          onCommit={onGitCommit}
          onPush={onGitPush}
          onDiscard={onGitDiscard}
          onCheckout={onGitCheckout}
          onRefresh={onGitRefresh}
          trigger={
            <IconButton aria-label="Git">
              <GitBranch size={14} strokeWidth={1.8} />
            </IconButton>
          }
        />

        <IconButton aria-label="搜索" onClick={onSearch}>
          <Search size={14} strokeWidth={1.8} />
        </IconButton>
      </div>
    </div>
  );
}

interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  active?: boolean;
  children: ReactNode;
}

const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(
  ({ active, className, children, ...rest }, ref) => (
    <button
      ref={ref}
      type="button"
      className={cn(
        "flex h-[26px] w-[26px] items-center justify-center rounded text-foreground-muted",
        "transition-colors hover:bg-black/[0.05] hover:text-foreground",
        active && "bg-black/[0.06] text-foreground",
        className,
      )}
      {...rest}
    >
      {children}
    </button>
  ),
);

IconButton.displayName = "IconButton";
