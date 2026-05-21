import { GitBranch, Plus } from "lucide-react";
import { useMemo, useState, type ReactNode } from "react";
import {
  ChipPopover,
  PopoverItem,
  PopoverSectionLabel,
  PopoverSeparator,
} from "./popover-shell";
import { useProjectStore } from "../../../state/project";
import { useReviewDiffStore } from "../../../state/reviewDiff";
import { PromptDialog } from "../../common/PromptDialog";

export function BranchPopover({ trigger }: { trigger: ReactNode }) {
  const project = useProjectStore((s) => s.current);
  const reloadProject = useProjectStore((s) => s.load);
  const refreshDiff = useReviewDiffStore((s) => s.refreshFromGit);
  const branches = project?.branches ?? [];
  const [query, setQuery] = useState("");
  const [creating, setCreating] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return branches;
    return branches.filter((b) => b.toLowerCase().includes(q));
  }, [branches, query]);

  async function checkout(branch: string, options: { create?: boolean } = {}) {
    if (!project) return;
    setBusy(branch);
    setError(null);
    try {
      await window.codex.git.checkout(project.cwd, branch, options);
      await reloadProject();
      await refreshDiff(project.cwd);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
    }
  }

  return (
    <>
      <ChipPopover
        trigger={trigger}
        align="start"
        side="bottom"
        sideOffset={6}
        className="min-w-[260px]"
      >
        <div className="flex h-7 items-center gap-1.5 rounded-md px-2 text-[12px] text-foreground-subtle">
          <svg width="13" height="13" viewBox="0 0 24 24" className="opacity-70">
            <circle cx="11" cy="11" r="6" stroke="currentColor" strokeWidth="1.6" fill="none" />
            <path d="M20 20l-4-4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
          </svg>
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="搜索分支"
            className="flex-1 bg-transparent text-[12px] text-foreground placeholder:text-foreground-subtle focus:outline-none"
          />
        </div>
        <PopoverSectionLabel>分支</PopoverSectionLabel>
        <div className="max-h-[200px] overflow-y-auto">
          {filtered.length > 0 ? (
            filtered.map((name) => (
              <PopoverItem
                key={name}
                selected={name === project?.branch}
                leading={<GitBranch size={13} strokeWidth={1.7} />}
                onClick={() => void checkout(name)}
              >
                {busy === name ? `${name}…` : name}
              </PopoverItem>
            ))
          ) : (
            <PopoverItem leading={<GitBranch size={13} strokeWidth={1.7} />} muted>
              {project ? "无匹配分支" : "当前项目不是 Git 仓库"}
            </PopoverItem>
          )}
        </div>
        {error && (
          <div className="px-2 py-1 text-[11.5px] text-rose-500">{error}</div>
        )}
        <PopoverSeparator />
        <PopoverItem
          leading={<Plus size={13} strokeWidth={1.7} />}
          onClick={() => setCreating(true)}
        >
          创建并检出新分支…
        </PopoverItem>
      </ChipPopover>
      <PromptDialog
        open={creating}
        title="创建并检出新分支"
        placeholder="分支名"
        confirmLabel="检出"
        onCancel={() => setCreating(false)}
        onConfirm={async (name) => {
          await checkout(name, { create: true });
          setCreating(false);
        }}
      />
    </>
  );
}
