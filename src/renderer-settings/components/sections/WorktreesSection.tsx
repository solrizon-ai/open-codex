import { FolderOpen, RefreshCw, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { SectionShell } from "../SectionShell";
import { cn } from "../../../renderer/lib/cn";

interface WorktreeEntry {
  path: string;
  branch: string | null;
  head: string | null;
  bare: boolean;
  detached: boolean;
  locked: boolean;
}

/**
 * Renders the output of `git worktree list --porcelain` for the active
 * project. The list is empty if there is no git repository or no extra
 * worktrees beyond the main checkout.
 */
export function WorktreesSection() {
  const [entries, setEntries] = useState<WorktreeEntry[]>([]);
  const [spinning, setSpinning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cwd, setCwd] = useState<string | null>(null);

  async function refresh() {
    setSpinning(true);
    setError(null);
    try {
      const project = await window.codex.project.current();
      const projectCwd = project?.cwd ?? null;
      setCwd(projectCwd);
      if (!projectCwd) {
        setEntries([]);
        return;
      }
      const list = (await window.codex.git.worktreeList(projectCwd)) as WorktreeEntry[];
      setEntries(list);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSpinning(false);
    }
  }

  useEffect(() => {
    void refresh();
  }, []);

  async function remove(path: string) {
    if (!cwd) return;
    try {
      await window.codex.git.worktreeRemove(cwd, path);
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  return (
    <SectionShell title="工作树">
      <section>
        <header className="mb-2 flex items-center justify-between">
          <h2 className="text-[13px] font-medium text-foreground">
            {entries.length > 0 ? `${entries.length} 个工作树` : "尚无工作树"}
          </h2>
          <button
            type="button"
            onClick={() => void refresh()}
            className="flex h-6 w-6 items-center justify-center rounded-md text-foreground-muted transition-colors hover:bg-black/[0.04] hover:text-foreground"
            aria-label="刷新"
          >
            <RefreshCw
              size={12}
              strokeWidth={1.8}
              className={cn(spinning && "animate-spin")}
            />
          </button>
        </header>
        <div className="overflow-hidden rounded-lg ring-1 ring-border">
          {error ? (
            <div className="px-4 py-3 text-[12.5px] text-rose-500">{error}</div>
          ) : entries.length === 0 ? (
            <div className="px-4 py-3 text-[12.5px] text-foreground-subtle">
              {cwd
                ? "Codex 创建的工作树将显示在此处。"
                : "请先在主窗口选择一个项目。"}
            </div>
          ) : (
            entries.map((entry) => (
              <div
                key={entry.path}
                className="flex items-center gap-3 border-b border-border px-4 py-3 last:border-b-0"
              >
                <div className="flex-1 min-w-0">
                  <div className="truncate text-[12.5px] text-foreground">
                    {entry.path}
                  </div>
                  <div className="mt-0.5 truncate text-[11.5px] text-foreground-subtle">
                    {entry.detached
                      ? `detached @ ${entry.head?.slice(0, 7) ?? "?"}`
                      : entry.branch ?? entry.head?.slice(0, 7) ?? ""}
                    {entry.locked ? " · locked" : ""}
                    {entry.bare ? " · bare" : ""}
                  </div>
                </div>
                <button
                  type="button"
                  title="在文件管理器中打开"
                  onClick={() => void window.codex.file.showInFolder(entry.path)}
                  className="flex h-6 w-6 items-center justify-center rounded-md text-foreground-muted hover:bg-black/[0.04]"
                >
                  <FolderOpen size={12} strokeWidth={1.8} />
                </button>
                <button
                  type="button"
                  title="删除"
                  onClick={() => void remove(entry.path)}
                  disabled={entry.path === cwd}
                  className="flex h-6 w-6 items-center justify-center rounded-md text-foreground-muted hover:bg-black/[0.04] disabled:opacity-30"
                >
                  <Trash2 size={12} strokeWidth={1.8} />
                </button>
              </div>
            ))
          )}
        </div>
      </section>
    </SectionShell>
  );
}
