import { FolderClosed, FolderPlus, FolderX } from "lucide-react";
import { useMemo, useState, type ReactNode } from "react";
import {
  ChipPopover,
  PopoverItem,
  PopoverSeparator,
} from "./popover-shell";
import { useProjectStore } from "../../../state/project";
import { useHistoryStore } from "../../../state/history";
import { useThreadStore } from "../../../state/thread";
import { useReviewDiffStore } from "../../../state/reviewDiff";

export function ProjectPopover({ trigger }: { trigger: ReactNode }) {
  const project = useProjectStore((s) => s.current);
  const chooseFolder = useProjectStore((s) => s.chooseFolder);
  const threads = useHistoryStore((s) => s.threads);
  const [query, setQuery] = useState("");

  // Each unique cwd in the history list is a "known project". Surface the
  // unique entries so users can quickly swap back to one they've used
  // before without navigating the open-folder dialog.
  const knownProjects = useMemo(() => {
    const set = new Map<string, string>();
    for (const t of threads) {
      if (!set.has(t.cwd)) {
        const name = t.cwd.split("/").filter(Boolean).pop() ?? t.cwd;
        set.set(t.cwd, name);
      }
    }
    if (project) set.set(project.cwd, project.name);
    return Array.from(set.entries())
      .map(([cwd, name]) => ({ cwd, name }))
      .filter((entry) => {
        const q = query.trim().toLowerCase();
        if (!q) return true;
        return (
          entry.name.toLowerCase().includes(q) ||
          entry.cwd.toLowerCase().includes(q)
        );
      });
  }, [threads, project, query]);

  async function clearProject() {
    await window.codex.project.clear();
    useProjectStore.setState({ current: null });
    useThreadStore.getState().reset();
    useReviewDiffStore.getState().clear();
  }

  return (
    <ChipPopover trigger={trigger} align="start" side="bottom" sideOffset={6}>
      <div className="flex h-7 items-center gap-1.5 rounded-md px-2 text-[12px] text-foreground-subtle">
        <svg width="13" height="13" viewBox="0 0 24 24" className="opacity-70">
          <circle cx="11" cy="11" r="6" stroke="currentColor" strokeWidth="1.6" fill="none" />
          <path d="M20 20l-4-4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
        </svg>
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="搜索项目"
          className="flex-1 bg-transparent text-[12px] text-foreground placeholder:text-foreground-subtle focus:outline-none"
        />
      </div>
      <PopoverSeparator />
      <div className="max-h-[220px] overflow-y-auto">
        {knownProjects.map((entry) => (
          <PopoverItem
            key={entry.cwd}
            selected={entry.cwd === project?.cwd}
            leading={<FolderClosed size={13} strokeWidth={1.7} />}
            onClick={async () => {
              // We don't yet have a "switch to known path" IPC; reuse
              // browseFolder to open a dialog defaulting to this path.
              // For now, only the current project entry is read-only.
              if (entry.cwd === project?.cwd) return;
              await chooseFolder();
            }}
          >
            {entry.name}
          </PopoverItem>
        ))}
      </div>
      <PopoverSeparator />
      <PopoverItem
        leading={<FolderPlus size={13} strokeWidth={1.7} />}
        onClick={() => void chooseFolder()}
      >
        添加新项目
      </PopoverItem>
      <PopoverItem
        leading={<FolderX size={13} strokeWidth={1.7} />}
        onClick={() => void clearProject()}
      >
        不使用项目
      </PopoverItem>
    </ChipPopover>
  );
}
