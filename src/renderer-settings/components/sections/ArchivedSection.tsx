import { ArchiveRestore, RefreshCw } from "lucide-react";
import { useEffect, useState } from "react";
import { SectionShell } from "../SectionShell";
import { cn } from "../../../renderer/lib/cn";
import { ensureCodexInitialized } from "../../../renderer/codex/useCodex";

interface ArchivedOverlay {
  title?: string;
  archived?: boolean;
  pinned?: boolean;
  unread?: boolean;
}

interface ArchivedEntry {
  id: string;
  title: string;
  cwd?: string;
  updatedAt?: number;
}

/**
 * Surfaces threads the user has archived from the sidebar. Archived state
 * lives in `~/.codex/desktop-state.json` under `thread_overlays` (see
 * renderer/state/history.ts). We also try to enrich each id with the
 * latest title/cwd from `thread/list` so the row shows the real name even
 * for threads no longer in the recent-50 window.
 */
export function ArchivedSection() {
  const [entries, setEntries] = useState<ArchivedEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function refresh() {
    setLoading(true);
    setError(null);
    try {
      const overlaysRaw = await window.codex.config.getState("thread_overlays");
      const overlays =
        overlaysRaw && typeof overlaysRaw === "object"
          ? (overlaysRaw as Record<string, ArchivedOverlay>)
          : {};
      const archivedIds = Object.entries(overlays)
        .filter(([, o]) => o?.archived)
        .map(([id, o]) => ({ id, overlay: o }));

      let recent: { id: string; name?: string; cwd?: string; updatedAt?: number }[] = [];
      try {
        await ensureCodexInitialized();
        const response = (await window.codex.codex.request("thread/list", {
          limit: 200,
          archived: true,
          useStateDbOnly: false,
        })) as { data?: unknown[] };
        recent = (response.data ?? [])
          .filter((row): row is Record<string, unknown> =>
            !!row && typeof row === "object",
          )
          .map((row) => ({
            id: typeof row.id === "string" ? row.id : "",
            name: typeof row.name === "string" ? row.name : undefined,
            cwd: typeof row.cwd === "string" ? row.cwd : undefined,
            updatedAt:
              typeof row.updatedAt === "number" ? row.updatedAt : undefined,
          }))
          .filter((row) => row.id);
      } catch {
        // codex may not have a thread-list call yet; the overlay alone is
        // still enough to render a "Restore" row.
      }
      const recentMap = new Map(recent.map((r) => [r.id, r]));

      const list: ArchivedEntry[] = archivedIds.map(({ id, overlay }) => {
        const upstream = recentMap.get(id);
        return {
          id,
          title:
            overlay.title || upstream?.name || upstream?.cwd || id.slice(0, 8),
          cwd: upstream?.cwd,
          updatedAt: upstream?.updatedAt,
        };
      });
      setEntries(list);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void refresh();
  }, []);

  async function restore(id: string) {
    const raw = (await window.codex.config.getState("thread_overlays")) as
      | Record<string, ArchivedOverlay>
      | null;
    const next = { ...(raw ?? {}) };
    if (next[id]) {
      next[id] = { ...next[id], archived: false };
    }
    await window.codex.config.setState("thread_overlays", next);
    setEntries((prev) => prev.filter((e) => e.id !== id));
  }

  return (
    <SectionShell title="已归档对话">
      <section>
        <header className="mb-2 flex items-center justify-between">
          <h2 className="text-[13px] font-medium text-foreground">
            {entries.length > 0 ? `${entries.length} 个会话` : "暂无已归档的聊天。"}
          </h2>
          <button
            type="button"
            onClick={() => void refresh()}
            className="flex h-6 w-6 items-center justify-center rounded-md text-foreground-muted hover:bg-black/[0.04]"
            aria-label="刷新"
          >
            <RefreshCw
              size={12}
              strokeWidth={1.8}
              className={cn(loading && "animate-spin")}
            />
          </button>
        </header>
        {error ? (
          <div className="rounded-lg px-3 py-3 text-[12.5px] text-rose-500 ring-1 ring-border">
            {error}
          </div>
        ) : entries.length === 0 ? (
          <div className="rounded-lg px-3 py-3 text-[12.5px] text-foreground-subtle ring-1 ring-border">
            暂无已归档的聊天。
          </div>
        ) : (
          <div className="overflow-hidden rounded-lg ring-1 ring-border">
            {entries.map((entry) => (
              <div
                key={entry.id}
                className="flex items-center gap-3 border-b border-border px-4 py-3 last:border-b-0"
              >
                <div className="flex-1 min-w-0">
                  <div className="truncate text-[12.5px] text-foreground">
                    {entry.title}
                  </div>
                  {entry.cwd && (
                    <div className="mt-0.5 truncate text-[11.5px] text-foreground-subtle">
                      {entry.cwd}
                    </div>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => void restore(entry.id)}
                  className="flex h-7 items-center gap-1 rounded-md border border-border bg-white px-2 text-[12px] text-foreground hover:bg-black/[0.02]"
                >
                  <ArchiveRestore size={12} strokeWidth={1.8} />
                  恢复
                </button>
              </div>
            ))}
          </div>
        )}
      </section>
    </SectionShell>
  );
}
