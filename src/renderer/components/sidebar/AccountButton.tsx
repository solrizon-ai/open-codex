import * as Popover from "@radix-ui/react-popover";
import { Settings, ExternalLink } from "lucide-react";
import { useEffect, useState } from "react";
import { cn } from "../../lib/cn";
import { ensureCodexInitialized } from "../../codex/useCodex";

type AccountInfo = {
  email?: string;
  plan?: string;
  type?: string;
};

interface AccountResponse {
  account?: { type: string; email?: string; planType?: string } | null;
  requiresOpenaiAuth?: boolean;
}

interface RateLimitWindow {
  usedPercent: number;
  resetsAt: number | null;
  windowDurationMins: number | null;
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

/**
 * The bottom-left account chip mirrors the Codex app-server account and
 * metered usage state.
 */
export function AccountButton() {
  const [account, setAccount] = useState<AccountInfo>({});
  const [rateLimits, setRateLimits] = useState<RateLimitSnapshot[]>([]);
  const [error, setError] = useState<string | null>(null);

  async function reload() {
    try {
      await ensureCodexInitialized();
      const [accountResponse, limitsResponse] = await Promise.all([
        window.codex.codex.request("account/read", { refreshToken: false }) as Promise<AccountResponse>,
        window.codex.codex
          .request("account/rateLimits/read")
          .catch(() => null) as Promise<RateLimitResponse | null>,
      ]);
      const next = normalizeAccount(accountResponse);
      setAccount(next);
      setRateLimits(normalizeRateLimits(limitsResponse));
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setAccount({});
      setRateLimits([]);
    }
  }

  useEffect(() => {
    void reload();
    return window.codex.codex.onNotification((msg) => {
      if (!msg || typeof msg !== "object") return;
      const method = (msg as { method?: unknown }).method;
      if (method === "account/updated" || method === "account/rateLimits/updated") {
        void reload();
      }
    });
  }, []);

  const email = account.email ?? "未登录";
  const plan = account.plan ?? "本地模式";
  const initial = email[0]?.toUpperCase() ?? "?";

  async function signOut() {
    if (!confirm("确认退出 Codex 登录？")) return;
    await ensureCodexInitialized();
    await window.codex.codex.request("account/logout");
    await reload();
  }

  return (
    <Popover.Root>
      <Popover.Trigger asChild>
        <button
          type="button"
          aria-label="账户"
          className={cn(
            "flex h-[40px] w-[40px] items-center justify-center rounded-full bg-white/[0.16] text-[16px] font-medium text-foreground",
            "transition-colors hover:bg-white/[0.22] [app-region:no-drag]",
            "dark:bg-white/15 dark:text-foreground dark:hover:bg-white/20",
          )}
        >
          {initial}
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          side="top"
          align="start"
          sideOffset={6}
          alignOffset={-4}
          className={cn(
            "z-50 w-[268px] rounded-[10px] border border-border bg-surface-elevated p-[6px]",
            "text-[12.5px] text-foreground shadow-popover",
          )}
        >
          <div className="px-[8px] pb-[6px] pt-[8px]">
            <div className="truncate text-[12.5px] text-foreground">{email}</div>
            <div className="mt-[2px] text-[11.5px] text-foreground-subtle">
              {plan}
            </div>
            {error && (
              <div className="mt-1 line-clamp-2 text-[11px] text-rose-500">
                {error}
              </div>
            )}
          </div>

          <PopoverSeparator />

          <PopoverItem
            icon={<Settings size={13} strokeWidth={1.8} />}
            label="设置"
            onClick={() => void window.codex?.window?.openSettings()}
          />
          <PopoverItem
            icon={<ExternalLink size={13} strokeWidth={1.8} />}
            label="工作空间设置"
            external
            onClick={async () => {
              const path = await window.codex.config.path();
              void window.codex.file.open(path);
            }}
          />

          <PopoverSeparator />

          <div className="px-[8px] pb-[6px] pt-[6px] text-[11.5px] text-foreground-subtle">
            使用额度
          </div>
          {rateLimits.length > 0 ? (
            <div className="space-y-2 px-[8px] pb-[6px]">
              {rateLimits.flatMap((limit) => limitRows(limit)).map((row) => (
                <Meter key={`${row.label}-${row.caption}`} {...row} />
              ))}
            </div>
          ) : (
            <div className="px-[8px] pb-[6px] text-[11.5px] leading-[1.45] text-foreground-subtle">
              当前账户未返回额度信息。
            </div>
          )}

          <PopoverSeparator />

          <PopoverItem
            label="了解更多"
            onClick={() => void window.codex.file.open("https://github.com/openai/codex")}
          />
          <PopoverItem
            label="退出登录"
            onClick={() => void signOut()}
          />
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}

function normalizeAccount(response: AccountResponse): AccountInfo {
  const account = response.account;
  if (!account) return {};
  if (account.type === "chatgpt") {
    return {
      type: account.type,
      email: account.email,
      plan: account.planType ?? "ChatGPT",
    };
  }
  if (account.type === "apiKey") return { type: account.type, email: "API Key", plan: "API key" };
  if (account.type === "amazonBedrock") {
    return { type: account.type, email: "Amazon Bedrock", plan: "Bedrock" };
  }
  return { type: account.type, email: account.type, plan: "Codex" };
}

function normalizeRateLimits(response: RateLimitResponse | null): RateLimitSnapshot[] {
  if (!response) return [];
  const byId = Object.values(response.rateLimitsByLimitId ?? {}).filter(
    (limit): limit is RateLimitSnapshot => !!limit,
  );
  if (byId.length > 0) return byId;
  return response.rateLimits ? [response.rateLimits] : [];
}

function limitRows(limit: RateLimitSnapshot): Array<{
  label: string;
  used: number;
  caption: string;
}> {
  return [
    limit.primary
      ? {
          label: `${limit.limitName ?? "额度"} · 主要`,
          used: limit.primary.usedPercent / 100,
          caption: resetCaption(limit.primary),
        }
      : null,
    limit.secondary
      ? {
          label: `${limit.limitName ?? "额度"} · 次要`,
          used: limit.secondary.usedPercent / 100,
          caption: resetCaption(limit.secondary),
        }
      : null,
  ].filter(Boolean) as Array<{ label: string; used: number; caption: string }>;
}

function resetCaption(window: RateLimitWindow): string {
  if (!window.resetsAt) return "重置时间未知";
  return new Date(window.resetsAt * 1000).toLocaleString();
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
  const pct = Math.max(0, Math.min(1, used));
  return (
    <div>
      <div className="flex items-center justify-between text-[11.5px] text-foreground-muted">
        <span>{label}</span>
        <span>{caption}</span>
      </div>
      <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-black/[0.08]">
        <div
          className="h-full rounded-full bg-foreground/70"
          style={{ width: `${Math.round(pct * 100)}%` }}
        />
      </div>
    </div>
  );
}

function PopoverItem({
  icon,
  label,
  external,
  onClick,
}: {
  icon?: React.ReactNode;
  label: string;
  external?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex h-[28px] w-full items-center gap-[8px] rounded-[6px] px-[8px] text-left text-[12.5px] text-foreground",
        "hover:bg-black/[0.04] dark:hover:bg-white/[0.06]",
      )}
    >
      {icon && (
        <span className="flex w-[14px] shrink-0 items-center justify-center text-foreground-muted">
          {icon}
        </span>
      )}
      <span className="flex-1 truncate">{label}</span>
      {external && (
        <ExternalLink
          size={11}
          strokeWidth={1.8}
          className="shrink-0 text-foreground-subtle"
        />
      )}
    </button>
  );
}

function PopoverSeparator() {
  return <div className="my-[4px] h-px bg-border" />;
}
