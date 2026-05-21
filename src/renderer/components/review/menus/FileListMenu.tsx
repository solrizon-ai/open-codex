import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import type { ReactNode } from "react";
import { cn } from "../../../lib/cn";
import type { FileListEntry } from "../types";
import { menuContentClass } from "./menu-primitives";

export function FileListMenu({
  trigger,
  files,
  activePath,
  onSelect,
  scope,
  onScopeChange,
}: {
  trigger: ReactNode;
  files: FileListEntry[];
  activePath?: string;
  onSelect?: (path: string) => void;
  scope: "all" | "modified";
  onScopeChange: (scope: "all" | "modified") => void;
}) {
  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>{trigger}</DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          className={cn(menuContentClass, "min-w-[260px] p-0")}
          sideOffset={6}
          align="end"
        >
          <div className="flex items-center gap-1 border-b border-border/60 p-1">
            <ScopeChip
              active={scope === "all"}
              onClick={() => onScopeChange("all")}
            >
              全部
            </ScopeChip>
            <ScopeChip
              active={scope === "modified"}
              onClick={() => onScopeChange("modified")}
            >
              修改过的
            </ScopeChip>
          </div>
          <div className="p-1">
            {files.map((f) => (
              <DropdownMenu.Item
                key={f.path}
                onSelect={(e) => {
                  e.preventDefault();
                  onSelect?.(f.path);
                }}
                className={cn(
                  "flex h-7 cursor-default select-none items-center gap-2 rounded px-2",
                  "text-[12.5px] text-foreground/90 outline-none",
                  "data-[highlighted]:bg-black/[0.05] data-[highlighted]:text-foreground",
                  activePath === f.path && "bg-black/[0.04]",
                )}
              >
                <span className="flex-1 truncate font-mono text-[12px]">{f.path}</span>
                <span className="text-[11px] text-green-600/90">+{f.added}</span>
                <span className="text-[11px] text-red-600/90">-{f.removed}</span>
              </DropdownMenu.Item>
            ))}
            {files.length === 0 ? (
              <div className="px-2 py-2 text-[12px] text-foreground-subtle">
                没有可显示的文件
              </div>
            ) : null}
          </div>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}

function ScopeChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "h-6 rounded px-2 text-[12px] transition-colors",
        active
          ? "bg-black/[0.06] text-foreground"
          : "text-foreground-muted hover:bg-black/[0.04]",
      )}
    >
      {children}
    </button>
  );
}
