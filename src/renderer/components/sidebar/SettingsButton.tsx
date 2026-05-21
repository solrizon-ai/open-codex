import { Settings } from "lucide-react";
import { cn } from "../../lib/cn";

export function SettingsButton() {
  return (
    <button
      type="button"
      onClick={() => void window.codex?.window?.openSettings()}
      className={cn(
        "flex h-[32px] items-center gap-[14px] rounded-[10px] text-[14px] font-semibold text-foreground",
        "hover:text-foreground-muted [app-region:no-drag]",
      )}
    >
      <Settings size={20} strokeWidth={1.8} />
      <span>设置</span>
    </button>
  );
}
