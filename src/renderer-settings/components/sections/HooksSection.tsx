import { RefreshCw, ExternalLink } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { SectionShell } from "../SectionShell";
import { cn } from "../../../renderer/lib/cn";
import { ensureCodexInitialized } from "../../../renderer/codex/useCodex";

interface HookEntry {
  key: string;
  eventName: string;
  handlerType: string;
  sourcePath: string;
  source: string;
  enabled: boolean;
  trustStatus: string;
  description: string;
}

interface HooksListResponse {
  data?: Array<{
    hooks?: Array<{
      key: string;
      eventName: string;
      handlerType: string;
      command: string | null;
      sourcePath: string;
      source: string;
      enabled: boolean;
      trustStatus: string;
    }>;
    warnings?: string[];
    errors?: Array<{ path: string; message: string }>;
  }>;
}

/**
 * Surfaces lifecycle hooks declared in `~/.codex/config.toml`. We look at
 * the same Codex app-server `hooks/list` endpoint the CLI uses.
 */
export function HooksSection() {
  const [spinning, setSpinning] = useState(false);
  const [hooks, setHooks] = useState<HookEntry[]>([]);
  const [errors, setErrors] = useState<string[]>([]);
  const [configPath, setConfigPath] = useState<string | null>(null);

  const load = useCallback(async () => {
    setSpinning(true);
    try {
      await ensureCodexInitialized();
      const [response, path] = await Promise.all([
        window.codex.codex.request("hooks/list", { cwds: [] }) as Promise<HooksListResponse>,
        window.codex.config.path(),
      ]);
      setConfigPath(path);
      const entries = (response.data ?? []).flatMap((entry) =>
        (entry.hooks ?? []).map((hook) => ({
          ...hook,
          description: hook.command ?? hook.sourcePath,
        })),
      );
      setHooks(entries);
      setErrors(
        (response.data ?? []).flatMap((entry) => [
          ...(entry.warnings ?? []),
          ...(entry.errors ?? []).map((error) => `${error.path}: ${error.message}`),
        ]),
      );
    } catch (e) {
      setHooks([]);
      setErrors([e instanceof Error ? e.message : String(e)]);
    } finally {
      setSpinning(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <SectionShell title="钩子">
      <div className="-mt-7 flex items-start justify-between gap-4">
        <p className="text-[12px] text-foreground-subtle">
          通过配置和已应用的插件管理插件生命周期钩子。
        </p>
        <div className="flex items-center gap-1">
          {configPath && (
            <button
              type="button"
              onClick={() => void window.codex.file.open(configPath)}
              className="flex h-6 items-center gap-1 rounded px-1.5 text-[11.5px] text-foreground-muted hover:bg-black/[0.04] hover:text-foreground"
            >
              <ExternalLink size={11} strokeWidth={1.8} />
              config.toml
            </button>
          )}
          <button
            type="button"
            onClick={() => void load()}
            aria-label="刷新"
            className="flex h-6 w-6 items-center justify-center rounded text-foreground-muted hover:bg-black/[0.04] hover:text-foreground"
          >
            <RefreshCw
              size={12}
              strokeWidth={1.8}
              className={cn(spinning && "animate-spin")}
            />
          </button>
        </div>
      </div>

      <section>
        <div className="overflow-hidden rounded-lg ring-1 ring-border">
          {errors.length > 0 && (
            <div className="border-b border-border bg-amber-50 px-4 py-3 text-[12px] text-amber-700">
              {errors.join("\n")}
            </div>
          )}
          {hooks.length === 0 ? (
            <div className="px-4 py-3">
              <div className="text-[12.5px] text-foreground">No hooks found</div>
              <div className="mt-0.5 text-[12px] text-foreground-subtle">
                Projects with configured hooks will appear here
              </div>
            </div>
          ) : (
            hooks.map((hook) => (
              <div
                key={hook.key}
                className="flex items-center gap-3 border-b border-border bg-white px-4 py-3 last:border-b-0"
              >
                <div className="flex-1 min-w-0">
                  <div className="truncate font-mono text-[12px] text-foreground">
                    {hook.eventName} · {hook.handlerType}
                  </div>
                  <div className="mt-0.5 truncate text-[12px] text-foreground-subtle">
                    {hook.description}
                  </div>
                </div>
                <div className="text-right text-[10.5px] uppercase text-foreground-subtle">
                  <div>{hook.enabled ? "enabled" : "disabled"}</div>
                  <div>{hook.trustStatus}</div>
                </div>
              </div>
            ))
          )}
        </div>
      </section>
    </SectionShell>
  );
}
