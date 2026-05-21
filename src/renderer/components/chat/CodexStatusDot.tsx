import * as Tooltip from "@radix-ui/react-tooltip";
import { useEffect, useState } from "react";
import { useCodex } from "../../codex/useCodex";
import { cn } from "../../lib/cn";
import { useBackendStore } from "../../state/backend";

/**
 * 6×6 status dot rendered in the chat header. Hover shows the codex
 * userAgent / home / last error.
 */
export function CodexStatusDot() {
  const backend = useBackendStore((s) => s.backend);
  if (backend !== "codex") {
    return <ClaudeStatusDot />;
  }

  return <CodexStatusDotInner />;
}

function ClaudeStatusDot() {
  const [status, setStatus] = useState<"starting" | "ready" | "error">(
    "starting",
  );
  const [label, setLabel] = useState("Claude Code 检测中…");
  const [detail, setDetail] = useState<string | undefined>();

  useEffect(() => {
    let alive = true;
    void window.codex.claude
      .info()
      .then((info) => {
        if (!alive) return;
        setStatus("ready");
        setLabel(`Claude Code 已连接 · ${info.claudeHome}`);
        setDetail([info.version, info.bin].filter(Boolean).join(" · "));
      })
      .catch((e) => {
        if (!alive) return;
        setStatus("error");
        setLabel(e instanceof Error ? e.message : String(e));
      });
    return () => {
      alive = false;
    };
  }, []);

  const tone =
    status === "ready"
      ? "bg-emerald-500"
      : status === "starting"
        ? "bg-amber-400 animate-pulse"
        : "bg-rose-500";

  return <StaticStatusDot tone={tone} label={label} detail={detail} />;
}

function CodexStatusDotInner() {
  const { status, server, error } = useCodex();

  const tone =
    status === "ready"
      ? "bg-emerald-500"
      : status === "starting"
        ? "bg-amber-400 animate-pulse"
        : status === "error"
          ? "bg-rose-500"
          : "bg-zinc-400";

  const label =
    status === "ready"
      ? `codex 已连接 · ${server?.codexHome ?? "~/.codex"}`
      : status === "starting"
        ? "codex 启动中…"
        : status === "error"
          ? `codex 错误: ${error}`
          : "codex 未连接";

  return (
    <StaticStatusDot tone={tone} label={label} detail={server?.userAgent} />
  );
}

function StaticStatusDot({
  tone,
  label,
  detail,
}: {
  tone: string;
  label: string;
  detail?: string;
}) {
  return (
    <Tooltip.Provider delayDuration={250}>
      <Tooltip.Root>
        <Tooltip.Trigger asChild>
          <span
            className={cn(
              "block h-1.5 w-1.5 rounded-full ring-2 ring-transparent",
              tone,
            )}
            aria-label={label}
          />
        </Tooltip.Trigger>
        <Tooltip.Portal>
          <Tooltip.Content
            sideOffset={6}
            className="z-50 max-w-[320px] rounded-md bg-zinc-900 px-2 py-1 text-[11px] text-white shadow-popover dark:bg-zinc-100 dark:text-zinc-900"
          >
            {label}
            {detail && (
              <div className="mt-0.5 font-mono text-[10px] opacity-70">
                {detail}
              </div>
            )}
            <Tooltip.Arrow className="fill-zinc-900 dark:fill-zinc-100" />
          </Tooltip.Content>
        </Tooltip.Portal>
      </Tooltip.Root>
    </Tooltip.Provider>
  );
}
