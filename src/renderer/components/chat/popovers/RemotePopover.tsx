import { useEffect, useState, type ReactNode } from "react";
import { ChipPopover, PopoverSeparator } from "./popover-shell";
import { useProjectStore } from "../../../state/project";
import { usePreferencesStore } from "../../../state/preferences";
import { ensureCodexInitialized } from "../../../codex/useCodex";
import { BACKEND_LABEL, useBackendStore } from "../../../state/backend";

/**
 * The "本地模式" popover mirrors the active Codex configuration plus the
 * app-server rate-limit buckets when the authenticated backend exposes them.
 */
interface QuotaRow {
  label: string;
  used: number; // 0..1
  caption: string;
}

interface RateLimitWindow {
  usedPercent: number;
  resetsAt: number | null;
}

interface RateLimitSnapshot {
  limitName: string | null;
  primary: RateLimitWindow | null;
  secondary: RateLimitWindow | null;
}

interface RateLimitResponse {
  rateLimits?: RateLimitSnapshot;
  rateLimitsByLimitId?: Record<string, RateLimitSnapshot | undefined> | null;
}

export function RemotePopover({ trigger }: { trigger: ReactNode }) {
  const [quotas, setQuotas] = useState<QuotaRow[]>([]);
  const backend = useBackendStore((s) => s.backend);
  const project = useProjectStore((s) => s.current);
  const model = usePreferencesStore((s) => s.model);
  const reasoning = usePreferencesStore((s) => s.reasoning);

  useEffect(() => {
    if (backend !== "codex") {
      setQuotas([]);
      return;
    }
    let alive = true;
    void ensureCodexInitialized()
      .then(() => window.codex.codex.request("account/rateLimits/read"))
      .then((value) => {
        if (alive) setQuotas(rateLimitRows(value as RateLimitResponse));
      })
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [backend]);

  return (
    <ChipPopover
      trigger={trigger}
      align="end"
      side="bottom"
      sideOffset={6}
      className="min-w-[260px] p-2.5"
    >
      <div className="text-[12.5px] font-medium text-foreground">
        {backend === "codex" ? "本地模式" : "Claude Code CLI"}
      </div>
      <div className="mt-1 text-[11.5px] text-foreground-subtle">
        {backend === "codex"
          ? "通过本机 codex CLI 直接发送请求"
          : "通过本机 Claude Code CLI 直接发送请求"}
      </div>
      <div className="mt-3 space-y-1 text-[11.5px] text-foreground-muted">
        <Row label="后端" value={BACKEND_LABEL[backend]} />
        {backend === "codex" && (
          <>
            <Row label="模型" value={model || "未设置"} />
            <Row label="推理" value={reasoning} />
          </>
        )}
        <Row label="项目" value={project?.name ?? "未选择"} />
      </div>
      {quotas.length > 0 && (
        <>
          <PopoverSeparator />
          <div className="text-[11.5px] text-foreground-subtle">
            使用额度
          </div>
          <div className="mt-2 space-y-2">
            {quotas.map((q) => (
              <Meter
                key={q.label}
                label={q.label}
                used={q.used}
                caption={q.caption}
              />
            ))}
          </div>
        </>
      )}
    </ChipPopover>
  );
}

function rateLimitRows(response: RateLimitResponse): QuotaRow[] {
  const limits = Object.values(response.rateLimitsByLimitId ?? {}).filter(
    (limit): limit is RateLimitSnapshot => !!limit,
  );
  if (limits.length === 0 && response.rateLimits) limits.push(response.rateLimits);
  return limits.flatMap((limit) => {
    const name = limit.limitName ?? "额度";
    return [
      limit.primary
        ? {
            label: `${name} · 主要`,
            used: limit.primary.usedPercent / 100,
            caption: resetCaption(limit.primary.resetsAt),
          }
        : null,
      limit.secondary
        ? {
            label: `${name} · 次要`,
            used: limit.secondary.usedPercent / 100,
            caption: resetCaption(limit.secondary.resetsAt),
          }
        : null,
    ].filter(Boolean) as QuotaRow[];
  });
}

function resetCaption(resetsAt: number | null): string {
  if (!resetsAt) return "重置时间未知";
  return new Date(resetsAt * 1000).toLocaleString();
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-foreground-subtle">{label}</span>
      <span className="truncate text-foreground">{value}</span>
    </div>
  );
}

function Meter({
  label,
  used,
  caption,
}: {
  label: string;
  used: number;
  caption: string;
}) {
  return (
    <div>
      <div className="flex items-center justify-between text-[11.5px] text-foreground-muted">
        <span>{label}</span>
        <span className="text-foreground-subtle">{caption}</span>
      </div>
      <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-black/[0.07]">
        <div
          className="h-full rounded-full bg-[color:var(--meter-amber,#e4a23a)]"
          style={{ width: `${Math.min(100, Math.max(0, used * 100))}%` }}
        />
      </div>
    </div>
  );
}
