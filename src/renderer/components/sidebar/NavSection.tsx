import { Search, Shapes, Clock, SquarePen, type LucideIcon } from "lucide-react";
import { cn } from "../../lib/cn";
import type { NavId } from "./types";

type NavItem = {
  id: NavId;
  icon: LucideIcon;
  label: string;
};

const NAV: NavItem[] = [
  { id: "new", icon: SquarePen, label: "新对话" },
  { id: "search", icon: Search, label: "搜索" },
  { id: "plugins", icon: Shapes, label: "插件" },
  { id: "automations", icon: Clock, label: "自动化" },
];

type NavSectionProps = {
  active: NavId;
  onSelect: (id: NavId) => void;
};

export function NavSection({ active, onSelect }: NavSectionProps) {
  return (
    <nav className="flex flex-col gap-[8px] px-[26px] [app-region:no-drag]">
      {NAV.map(({ id, icon: Icon, label }) => {
        const isActive = active === id;
        return (
          <button
            key={id}
            type="button"
            onClick={() => onSelect(id)}
            className={cn(
              "flex h-[32px] w-full items-center gap-[16px] rounded-[10px] text-left text-[14px] font-semibold tracking-0 transition-colors",
              isActive
                ? "text-foreground"
                : "text-foreground-muted hover:text-foreground",
            )}
          >
            <Icon
              size={21}
              strokeWidth={1.8}
              className={cn(
                "shrink-0",
                isActive ? "text-foreground" : "text-foreground-muted",
              )}
            />
            <span className="truncate">{label}</span>
          </button>
        );
      })}
    </nav>
  );
}
