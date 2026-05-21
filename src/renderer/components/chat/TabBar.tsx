import { useEffect } from "react";
import { X, Pin } from "lucide-react";
import { cn } from "../../lib/cn";
import { useTabsStore } from "../../state/tabs";

/**
 * Horizontal conversation tab bar at the top of the chat pane.
 * Matches the per-tab ⌘1..9 affordance visible in the reference
 * screenshots (and the "tabs in chrome" style of multi-conversation).
 */
export function TabBar() {
  const tabs = useTabsStore((s) => s.tabs);
  const activeId = useTabsStore((s) => s.activeId);
  const setActive = useTabsStore((s) => s.setActive);
  const close = useTabsStore((s) => s.close);
  const selectByIndex = useTabsStore((s) => s.selectByIndex);
  const selectRelative = useTabsStore((s) => s.selectRelative);

  // ⌘1..9 jumps to tab; ⌘W closes active; ⌘⇧[ / ⌘⇧] cycles
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey)) return;
      if (e.key >= "1" && e.key <= "9") {
        e.preventDefault();
        selectByIndex(Number(e.key) - 1);
        return;
      }
      if (e.shiftKey && (e.key === "[" || e.key === "{")) {
        e.preventDefault();
        selectRelative(-1);
        return;
      }
      if (e.shiftKey && (e.key === "]" || e.key === "}")) {
        e.preventDefault();
        selectRelative(1);
        return;
      }
      if (e.key.toLowerCase() === "w" && activeId) {
        e.preventDefault();
        close(activeId);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [activeId, close, selectByIndex, selectRelative]);

  if (tabs.length === 0) return null;

  return (
    <div className="flex h-[36px] items-center gap-px overflow-x-auto border-b border-border bg-surface-elevated px-2 [app-region:no-drag] dark:border-white/[0.08]">
      {tabs.map((tab, i) => {
        const isActive = tab.id === activeId;
        return (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActive(tab.id)}
            onAuxClick={(e) => {
              if (e.button === 1) close(tab.id);
            }}
            title={`${tab.title}  ⌘${i + 1}`}
            className={cn(
              "group relative flex h-[26px] min-w-[80px] max-w-[200px] shrink-0 items-center gap-1 rounded-md px-2 text-[12px]",
              isActive
                ? "bg-black/[0.06] text-foreground dark:bg-white/[0.08]"
                : "text-foreground-muted hover:bg-black/[0.04] dark:hover:bg-white/[0.05]",
            )}
          >
            {tab.pinned && <Pin size={10} className="shrink-0 opacity-70" />}
            {tab.unread && !isActive && (
              <span className="block h-1.5 w-1.5 shrink-0 rounded-full bg-accent" />
            )}
            <span className="flex-1 truncate text-left">{tab.title}</span>
            <span
              role="button"
              aria-label="关闭"
              onClick={(e) => {
                e.stopPropagation();
                close(tab.id);
              }}
              className={cn(
                "ml-1 flex h-[18px] w-[18px] items-center justify-center rounded text-foreground-subtle opacity-0 transition-opacity hover:bg-black/[0.06] hover:text-foreground group-hover:opacity-100 dark:hover:bg-white/[0.1]",
                isActive && "opacity-70",
              )}
            >
              <X size={11} strokeWidth={1.8} />
            </span>
          </button>
        );
      })}
    </div>
  );
}
