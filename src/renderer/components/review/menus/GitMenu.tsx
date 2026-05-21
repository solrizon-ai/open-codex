import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import type { ReactNode } from "react";
import { menuContentClass, MenuItem, MenuSeparator } from "./menu-primitives";

interface GitMenuProps {
  trigger: ReactNode;
  /** When false the file-specific items (stage/unstage/discard) are disabled. */
  hasActiveFile?: boolean;
  onStage?: () => void;
  onUnstage?: () => void;
  onCommit?: () => void;
  onPush?: () => void;
  onDiscard?: () => void;
  onCheckout?: () => void;
  onRefresh?: () => void;
}

export function GitMenu({
  trigger,
  hasActiveFile,
  onStage,
  onUnstage,
  onCommit,
  onPush,
  onDiscard,
  onCheckout,
  onRefresh,
}: GitMenuProps) {
  const fileDisabled = !hasActiveFile;
  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>{trigger}</DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          className={menuContentClass}
          sideOffset={6}
          align="end"
        >
          <MenuItem onSelect={onStage} disabled={fileDisabled}>
            暂存
          </MenuItem>
          <MenuItem onSelect={onUnstage} disabled={fileDisabled}>
            取消暂存
          </MenuItem>
          <MenuSeparator />
          <MenuItem onSelect={onCommit}>提交…</MenuItem>
          <MenuItem onSelect={onPush}>推送</MenuItem>
          <MenuItem onSelect={onCheckout}>切换分支…</MenuItem>
          <MenuSeparator />
          <MenuItem onSelect={onRefresh}>刷新</MenuItem>
          <MenuItem onSelect={onDiscard} disabled={fileDisabled}>
            丢弃改动
          </MenuItem>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
