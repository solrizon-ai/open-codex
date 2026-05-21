import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import type { ReactNode } from "react";
import { menuContentClass, MenuItem, MenuSeparator } from "./menu-primitives";

export function JumpToFileMenu({
  trigger,
  onPrev,
  onNext,
  onJump,
}: {
  trigger: ReactNode;
  onPrev?: () => void;
  onNext?: () => void;
  onJump?: () => void;
}) {
  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>{trigger}</DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          className={menuContentClass}
          sideOffset={6}
          align="end"
        >
          <MenuItem onSelect={onPrev} shortcut="⌥↑">
            上一个
          </MenuItem>
          <MenuItem onSelect={onNext} shortcut="⌥↓">
            下一个
          </MenuItem>
          <MenuSeparator />
          <MenuItem onSelect={onJump}>跳转到文件…</MenuItem>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
