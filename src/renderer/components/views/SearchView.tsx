import { useEffect, useMemo, useState } from "react";
import {
  Search,
  FileText,
  MessageCircle,
  CornerDownLeft,
  Folder,
} from "lucide-react";
import { cn } from "../../lib/cn";
import { useHistoryStore } from "../../state/history";
import { useNavigationStore } from "../../state/navigation";
import { useProjectStore } from "../../state/project";
import { useReviewTabsStore } from "../../state/reviewTabs";
import { useUiStore } from "../../state/ui";

type Scope = "all" | "threads" | "files" | "code";

interface FileResult {
  path: string;
}

interface CodeResult {
  path: string;
  line: number;
  text: string;
}

export function SearchView() {
  const [query, setQuery] = useState("");
  const [scope, setScope] = useState<Scope>("all");
  const [files, setFiles] = useState<FileResult[]>([]);
  const [code, setCode] = useState<CodeResult[]>([]);
  const [searching, setSearching] = useState(false);
  const project = useProjectStore((s) => s.current);
  const threads = useHistoryStore((s) => s.threads);
  const loadHistory = useHistoryStore((s) => s.loadRecent);

  useEffect(() => {
    if (threads.length === 0) void loadHistory();
  }, [threads.length, loadHistory]);

  // Debounced file / code search.
  useEffect(() => {
    const cwd = project?.cwd;
    if (!cwd || !query.trim()) {
      setFiles([]);
      setCode([]);
      setSearching(false);
      return;
    }
    setSearching(true);
    const handle = window.setTimeout(async () => {
      try {
        const [fileMatches, textMatches] = await Promise.all([
          scope === "code" ? Promise.resolve([]) : window.codex.search.files(cwd, query),
          scope === "files" || scope === "threads"
            ? Promise.resolve([])
            : window.codex.search.text(cwd, query),
        ]);
        setFiles(fileMatches);
        setCode(textMatches);
      } finally {
        setSearching(false);
      }
    }, 180);
    return () => window.clearTimeout(handle);
  }, [project?.cwd, query, scope]);

  const threadMatches = useMemo(() => {
    if (scope === "files" || scope === "code") return [];
    const q = query.trim().toLowerCase();
    if (!q) return threads.slice(0, 20);
    return threads
      .filter(
        (t) =>
          t.title.toLowerCase().includes(q) ||
          t.preview.toLowerCase().includes(q),
      )
      .slice(0, 50);
  }, [threads, query, scope]);

  const showFiles = scope !== "threads" && scope !== "code";
  const showCode = scope !== "threads" && scope !== "files";
  const showThreads = scope !== "files" && scope !== "code";

  return (
    <main className="flex h-full w-full flex-col bg-surface-elevated">
      <header className="flex h-[44px] items-center px-4 [app-region:drag]">
        <h1 className="text-[13px] text-foreground/85 [app-region:no-drag]">搜索</h1>
      </header>
      <div className="mx-auto flex w-full max-w-[760px] flex-1 flex-col overflow-hidden px-6 pb-10">
        <div className="flex items-center gap-2">
          <div className="flex h-10 flex-1 items-center gap-2 rounded-lg border border-border bg-white px-3 text-[13px] text-foreground">
            <Search size={14} className="opacity-60" />
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={
                project
                  ? `在「${project.name}」中搜索对话、文件、代码`
                  : "搜索对话"
              }
              className="flex-1 bg-transparent text-foreground placeholder:text-foreground-subtle focus:outline-none"
            />
            {searching && (
              <span className="text-[11px] text-foreground-subtle">…</span>
            )}
          </div>
        </div>

        <div className="mt-3 flex items-center gap-1 text-[12px] text-foreground-muted">
          {(
            [
              { id: "all", label: "全部" },
              { id: "threads", label: "对话" },
              { id: "files", label: "文件" },
              { id: "code", label: "代码" },
            ] as { id: Scope; label: string }[]
          ).map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => setScope(s.id)}
              className={cn(
                "h-7 rounded-md px-2",
                scope === s.id
                  ? "bg-black/[0.06] text-foreground"
                  : "hover:bg-black/[0.04]",
              )}
            >
              {s.label}
            </button>
          ))}
        </div>

        <div className="mt-4 flex-1 overflow-y-auto">
          {showThreads && (
            <ResultSection
              title="对话"
              empty={query ? "未找到匹配的对话" : "暂无最近对话"}
              count={threadMatches.length}
            >
              {threadMatches.map((t) => (
                <ResultRow
                  key={t.id}
                  icon={<MessageCircle size={13} className="opacity-70" />}
                  primary={t.title}
                  secondary={`${t.cwd.split("/").filter(Boolean).pop() ?? t.cwd}`}
                  onSelect={() => {
                    useNavigationStore.getState().openThread(t);
                  }}
                />
              ))}
            </ResultSection>
          )}

          {showFiles && (
            <ResultSection
              title="文件"
              empty={
                !project
                  ? "请先选择一个项目"
                  : query
                    ? "未找到匹配的文件"
                    : "输入关键词以搜索文件"
              }
              count={files.length}
            >
              {files.slice(0, 50).map((f) => (
                <ResultRow
                  key={f.path}
                  icon={<FileText size={13} className="opacity-70" />}
                  primary={f.path.split("/").pop() ?? f.path}
                  secondary={f.path}
                  onSelect={() => {
                    if (!project) return;
                    const abs = `${project.cwd}/${f.path}`;
                    useUiStore.getState().setReviewVisible(true);
                    useReviewTabsStore.getState().add({
                      kind: "file",
                      title: f.path.split("/").pop() ?? f.path,
                      path: abs,
                    });
                  }}
                />
              ))}
            </ResultSection>
          )}

          {showCode && (
            <ResultSection
              title="代码"
              empty={
                !project
                  ? "请先选择一个项目"
                  : query
                    ? "未找到匹配的代码"
                    : "输入关键词以搜索代码内容"
              }
              count={code.length}
            >
              {code.slice(0, 50).map((c, i) => (
                <ResultRow
                  key={`${c.path}:${c.line}:${i}`}
                  icon={<Folder size={13} className="opacity-70" />}
                  primary={`${c.path}:${c.line}`}
                  secondary={c.text.trim()}
                  mono
                  onSelect={() => {
                    if (!project) return;
                    const abs = `${project.cwd}/${c.path}`;
                    useUiStore.getState().setReviewVisible(true);
                    useReviewTabsStore.getState().add({
                      kind: "file",
                      title: c.path.split("/").pop() ?? c.path,
                      path: abs,
                    });
                  }}
                />
              ))}
            </ResultSection>
          )}
        </div>
      </div>
    </main>
  );
}

function ResultSection({
  title,
  empty,
  count,
  children,
}: {
  title: string;
  empty: string;
  count: number;
  children: React.ReactNode;
}) {
  return (
    <section className="mb-6">
      <div className="mb-2 flex items-center justify-between text-[11px] text-foreground-subtle">
        <span className="uppercase tracking-wide">{title}</span>
        <span>{count > 0 ? `${count} 条` : ""}</span>
      </div>
      {count === 0 ? (
        <div className="rounded-lg border border-dashed border-border px-4 py-6 text-center text-[12px] text-foreground-subtle">
          {empty}
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg ring-1 ring-border">
          {children}
        </div>
      )}
    </section>
  );
}

function ResultRow({
  icon,
  primary,
  secondary,
  mono,
  onSelect,
}: {
  icon: React.ReactNode;
  primary: string;
  secondary?: string;
  mono?: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className="group flex w-full items-center gap-3 border-b border-border bg-white px-3 py-2 text-left last:border-b-0 hover:bg-black/[0.02]"
    >
      <span className="text-foreground-subtle">{icon}</span>
      <div className="min-w-0 flex-1">
        <div
          className={cn(
            "truncate text-[12.5px] text-foreground",
            mono && "font-mono text-[12px]",
          )}
        >
          {primary}
        </div>
        {secondary && (
          <div
            className={cn(
              "truncate text-[11.5px] text-foreground-subtle",
              mono && "font-mono",
            )}
          >
            {secondary}
          </div>
        )}
      </div>
      <CornerDownLeft
        size={12}
        className="text-foreground-subtle opacity-0 group-hover:opacity-100"
      />
    </button>
  );
}
