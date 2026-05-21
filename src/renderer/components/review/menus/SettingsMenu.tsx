import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import type { ReactNode } from "react";
import { menuContentClass, MenuItem, MenuCheckItem, MenuSeparator } from "./menu-primitives";

export interface SettingsMenuState {
  splitView: boolean;
  wrapLines: boolean;
  emphasizeChanges: boolean;
  hideWhitespace: boolean;
  highlightSyntax: boolean;
}

export function SettingsMenu({
  trigger,
  state,
  onChange,
  onOpen,
  onRevealInFinder,
  onCopyPath,
}: {
  trigger: ReactNode;
  state: SettingsMenuState;
  onChange: (next: SettingsMenuState) => void;
  onOpen?: () => void;
  onRevealInFinder?: () => void;
  onCopyPath?: () => void;
}) {
  const set = <K extends keyof SettingsMenuState>(key: K, value: SettingsMenuState[K]) =>
    onChange({ ...state, [key]: value });

  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>{trigger}</DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          className={menuContentClass}
          sideOffset={6}
          align="end"
        >
          <MenuItem onSelect={onOpen} disabled={!onOpen}>
            打开
          </MenuItem>
          <MenuItem onSelect={onRevealInFinder} disabled={!onRevealInFinder}>
            在文件夹中查看
          </MenuItem>
          <MenuItem onSelect={onCopyPath} disabled={!onCopyPath}>
            复制文件路径
          </MenuItem>
          <MenuSeparator />
          <MenuCheckItem
            checked={state.splitView}
            onCheckedChange={(v) => set("splitView", v)}
          >
            拆分视图
          </MenuCheckItem>
          <MenuCheckItem
            checked={state.wrapLines}
            onCheckedChange={(v) => set("wrapLines", v)}
          >
            自动换行
          </MenuCheckItem>
          <MenuCheckItem
            checked={state.emphasizeChanges}
            onCheckedChange={(v) => set("emphasizeChanges", v)}
          >
            强调改动
          </MenuCheckItem>
          <MenuCheckItem
            checked={state.hideWhitespace}
            onCheckedChange={(v) => set("hideWhitespace", v)}
          >
            隐藏空白字符
          </MenuCheckItem>
          <MenuCheckItem
            checked={state.highlightSyntax}
            onCheckedChange={(v) => set("highlightSyntax", v)}
          >
            高亮语法
          </MenuCheckItem>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
