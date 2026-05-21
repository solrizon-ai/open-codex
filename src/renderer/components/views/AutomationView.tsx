import { CheckCircle2 } from "lucide-react";
import { useEffect, useState } from "react";
import { useProjectStore } from "../../state/project";
import { cn } from "../../lib/cn";
import { ensureCodexInitialized } from "../../codex/useCodex";

interface HookEntry {
  key: string;
  eventName: string;
  handlerType: string;
  command: string | null;
  sourcePath: string;
  source: string;
  enabled: boolean;
  trustStatus: string;
}

interface HooksListResponse {
  data?: Array<{
    hooks?: HookEntry[];
    warnings?: string[];
    errors?: Array<{ path: string; message: string }>;
  }>;
}

export function AutomationView() {
  const [hooks, setHooks] = useState<HookEntry[]>([]);
  const [hooksError, setHooksError] = useState<string | null>(null);
  const project = useProjectStore((s) => s.current);

  useEffect(() => {
    let alive = true;
    void (async () => {
      try {
        await ensureCodexInitialized();
        const response = (await window.codex.codex.request("hooks/list", {
          cwds: project?.cwd ? [project.cwd] : [],
        })) as HooksListResponse;
        if (!alive) return;
        setHooks((response.data ?? []).flatMap((entry) => entry.hooks ?? []));
        const firstError = (response.data ?? []).flatMap((entry) => entry.errors ?? [])[0];
        setHooksError(firstError ? `${firstError.path}: ${firstError.message}` : null);
      } catch (e) {
        if (!alive) return;
        setHooksError(e instanceof Error ? e.message : String(e));
        setHooks([]);
      }
    })();
    return () => {
      alive = false;
    };
  }, [project?.cwd]);

  return (
    <main className="flex h-full w-full flex-col bg-surface-elevated">
      <header className="h-[44px] [app-region:drag]" />

      <div className="mx-auto w-full max-w-[820px] flex-1 overflow-y-auto px-6 pb-10">
        <h1 className="mt-2 text-[26px] font-semibold text-foreground">自动化</h1>
        <p className="mt-1 text-[12.5px] text-foreground-muted">
          显示 Codex app-server 从 config.toml 和插件解析到的 hooks。
          {project ? null : (
            <span className="ml-2 rounded bg-amber-100 px-2 py-0.5 text-[11px] text-amber-700">
              选择项目后会按项目工作目录重新加载 hooks
            </span>
          )}
        </p>

        <HooksSection hooks={hooks} error={hooksError} />
      </div>
    </main>
  );
}

function HooksSection({
  hooks,
  error,
}: {
  hooks: HookEntry[];
  error: string | null;
}) {
  return (
    <section className="mt-6">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-[12px] font-medium text-foreground-muted">
          Codex hooks
        </h2>
        <button
          type="button"
          onClick={async () => {
            const path = await window.codex.config.path();
            void window.codex.file.open(path);
          }}
          className="rounded-md px-2 py-1 text-[11.5px] text-foreground-muted hover:bg-black/[0.04]"
        >
          编辑 config.toml
        </button>
      </div>
      {error && (
        <div className="mb-3 rounded-md border border-rose-200 bg-rose-50/60 px-3 py-2 text-[12px] text-rose-600">
          {error}
        </div>
      )}
      {hooks.length > 0 ? (
        <div className="grid grid-cols-2 gap-3">
          {hooks.map((hook) => (
            <div
              key={hook.key}
              className={cn(
                "rounded-lg border border-border bg-white p-3",
                !hook.enabled && "opacity-60",
              )}
            >
              <div className="flex items-center gap-2">
                <CheckCircle2
                  size={15}
                  className={hook.enabled ? "text-emerald-600" : "text-foreground-subtle"}
                />
                <div className="min-w-0 flex-1 truncate text-[13px] font-medium text-foreground">
                  {hook.eventName}
                </div>
                <span className="rounded bg-black/[0.04] px-1.5 py-0.5 text-[10.5px] text-foreground-subtle">
                  {hook.handlerType}
                </span>
              </div>
              <div className="mt-2 truncate font-mono text-[11px] text-foreground-subtle">
                {hook.command ?? hook.sourcePath}
              </div>
              <div className="mt-2 flex items-center justify-between text-[10.5px] uppercase text-foreground-subtle">
                <span>{hook.source}</span>
                <span>{hook.trustStatus}</span>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="rounded-lg border border-dashed border-border px-4 py-8 text-center text-[12px] text-foreground-subtle">
          Codex 当前没有发现 hooks
        </div>
      )}
    </section>
  );
}
