import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { Check } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "../../../lib/cn";

export const menuContentClass = cn(
  "z-50 min-w-[200px] rounded-md border border-border/60 bg-surface-elevated p-1",
  "shadow-popover text-[12.5px] text-foreground",
  "data-[state=open]:animate-in data-[state=closed]:animate-out",
  "data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
);

export const menuItemClass = cn(
  "flex h-7 cursor-default select-none items-center gap-2 rounded px-2",
  "text-foreground/90 outline-none transition-colors",
  "data-[highlighted]:bg-black/[0.05] data-[highlighted]:text-foreground",
  "data-[disabled]:opacity-50",
);

export const menuSeparatorClass = "my-1 h-px bg-border/60";

export function MenuItem({
  icon,
  shortcut,
  children,
  onSelect,
  disabled,
}: {
  icon?: ReactNode;
  shortcut?: string;
  children: ReactNode;
  onSelect?: () => void;
  disabled?: boolean;
}) {
  return (
    <DropdownMenu.Item
      className={menuItemClass}
      disabled={disabled}
      onSelect={() => {
        onSelect?.();
      }}
    >
      {icon ? <span className="flex w-4 items-center justify-center text-foreground-subtle">{icon}</span> : null}
      <span className="flex-1">{children}</span>
      {shortcut ? (
        <span className="ml-4 text-[11px] tracking-wide text-foreground-subtle">
          {shortcut}
        </span>
      ) : null}
    </DropdownMenu.Item>
  );
}

export function MenuCheckItem({
  checked,
  onCheckedChange,
  children,
  shortcut,
}: {
  checked: boolean;
  onCheckedChange: (v: boolean) => void;
  children: ReactNode;
  shortcut?: string;
}) {
  return (
    <DropdownMenu.CheckboxItem
      className={menuItemClass}
      checked={checked}
      onCheckedChange={onCheckedChange}
      onSelect={(e) => e.preventDefault()}
    >
      <span className="flex w-4 items-center justify-center text-foreground">
        {checked ? <Check size={12} strokeWidth={2.5} /> : null}
      </span>
      <span className="flex-1">{children}</span>
      {shortcut ? (
        <span className="ml-4 text-[11px] tracking-wide text-foreground-subtle">
          {shortcut}
        </span>
      ) : null}
    </DropdownMenu.CheckboxItem>
  );
}

export function MenuSeparator() {
  return <DropdownMenu.Separator className={menuSeparatorClass} />;
}
