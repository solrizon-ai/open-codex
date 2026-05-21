import {
  Sun,
  Sliders,
  User,
  Server,
  Anchor,
  GitFork,
  AppWindow,
  Archive,
  ChevronLeft,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { cn } from "../../renderer/lib/cn";

export type SectionId =
  | "appearance"
  | "config"
  | "personalization"
  | "mcp"
  | "hooks"
  | "worktrees"
  | "browser"
  | "archived";

const ITEMS: { id: SectionId; label: string; icon: LucideIcon }[] = [
  { id: "config", label: "配置", icon: Sliders },
  { id: "appearance", label: "外观", icon: Sun },
  { id: "personalization", label: "个性化", icon: User },
  { id: "mcp", label: "MCP 服务器", icon: Server },
  { id: "hooks", label: "钩子", icon: Anchor },
  { id: "worktrees", label: "工作树", icon: GitFork },
  { id: "browser", label: "浏览器", icon: AppWindow },
  { id: "archived", label: "已归档对话", icon: Archive },
];

interface Props {
  active: SectionId;
  onSelect: (id: SectionId) => void;
}

export function SettingsSidebar({ active, onSelect }: Props) {
  return (
    <aside className="flex h-full select-none flex-col bg-transparent text-[12.5px] text-foreground-muted [app-region:drag]">
      <div className="h-[40px] [app-region:drag]" />

      <button
        type="button"
        className="mx-2 mb-2 flex h-7 items-center gap-1 rounded-md px-2 text-[12px] text-foreground-muted hover:bg-black/[0.04] [app-region:no-drag]"
        onClick={() => window.close()}
      >
        <ChevronLeft size={13} strokeWidth={1.8} />
        返回应用
      </button>

      <nav className="flex flex-1 flex-col gap-[2px] overflow-y-auto px-2 pb-3 [app-region:no-drag]">
        {ITEMS.map(({ id, label, icon: Icon }) => {
          const isActive = active === id;
          return (
            <button
              key={id}
              type="button"
              onClick={() => onSelect(id)}
              className={cn(
                "flex h-7 items-center gap-2 rounded-md px-2 text-[12.5px]",
                isActive
                  ? "bg-black/[0.06] text-foreground"
                  : "text-foreground-muted hover:bg-black/[0.03]",
              )}
            >
              <Icon size={14} strokeWidth={1.8} />
              {label}
            </button>
          );
        })}
      </nav>
    </aside>
  );
}
