import { ChevronDown, ExternalLink } from "lucide-react";
import { useEffect, useState } from "react";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import packageJson from "../../../../package.json";
import { SectionShell, SettingsGroup, SettingsRow } from "../SectionShell";
import { useConfigValue } from "../../hooks/useConfigValue";
import { cn } from "../../../renderer/lib/cn";

type ApprovalPolicy = "untrusted" | "on-failure" | "on-request" | "never";
type SandboxMode = "read-only" | "workspace-write" | "danger-full-access";

const APPROVAL_LABEL: Record<ApprovalPolicy, string> = {
  untrusted: "Untrusted",
  "on-failure": "On failure",
  "on-request": "On request",
  never: "Never",
};

const SANDBOX_LABEL: Record<SandboxMode, string> = {
  "read-only": "Read only",
  "workspace-write": "Workspace write",
  "danger-full-access": "Danger full access",
};

export function ConfigSection() {
  const [configPath, setConfigPath] = useState("~/.codex/config.toml");
  const [approval, setApproval] = useConfigValue<ApprovalPolicy>(
    ["approval_policy"],
    "on-request",
  );
  const [sandbox, setSandbox] = useConfigValue<SandboxMode>(
    ["sandbox_mode"],
    "read-only",
  );
  useEffect(() => {
    void window.codex.config.path().then(setConfigPath).catch(() => undefined);
  }, []);

  return (
    <SectionShell title="配置">
      <SectionIntro
        description={
          <>
            配置审批策略和沙盒设置，直接写入 Codex config.toml。
          </>
        }
      />

      <SettingsGroup title="自定义 config.toml 设置">
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <ConfigScopeLabel value="用户配置" className="w-[260px]" />
          <button
            type="button"
            onClick={() => void window.codex.file.open(configPath)}
            className="flex items-center gap-1 text-[12px] text-foreground-muted hover:text-foreground"
          >
            打开 <span className="font-mono">config.toml</span>
            <ExternalLink size={11} strokeWidth={1.8} />
          </button>
        </div>
        <SettingsRow
          label="批准策略"
          description="选择 Codex 何时请求批准"
        >
          <PolicySelect
            value={approval}
            onChange={setApproval}
            labels={APPROVAL_LABEL}
          />
        </SettingsRow>
        <SettingsRow
          label="沙盒设置"
          description="选择 Codex 的命令行执行权限"
        >
          <PolicySelect
            value={sandbox}
            onChange={setSandbox}
            labels={SANDBOX_LABEL}
          />
        </SettingsRow>
      </SettingsGroup>

      <SettingsGroup title="版本">
        <SettingsRow label="当前版本">
          <span className="font-mono text-[12px] text-foreground-muted">
            {APP_VERSION}
          </span>
        </SettingsRow>
      </SettingsGroup>
    </SectionShell>
  );
}

const APP_VERSION = packageJson.version;

function SectionIntro({ description }: { description: React.ReactNode }) {
  return (
    <p className="-mt-7 text-[12px] text-foreground-subtle">{description}</p>
  );
}

function ConfigScopeLabel({
  value,
  className,
}: {
  value: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex h-7 items-center rounded-md border border-border bg-white px-2 text-[12px] text-foreground",
        className,
      )}
    >
      <span>{value}</span>
    </div>
  );
}

function PolicySelect<T extends string>({
  value,
  onChange,
  labels,
}: {
  value: T;
  onChange: (next: T) => void;
  labels: Record<T, string>;
}) {
  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <button
          type="button"
          className="flex h-7 items-center justify-between gap-1 rounded-md border border-border bg-white px-2 text-[12px] text-foreground"
        >
          <span>{labels[value]}</span>
          <ChevronDown size={11} strokeWidth={1.8} className="opacity-60" />
        </button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align="end"
          sideOffset={4}
          className="z-50 min-w-[180px] rounded-md border border-border/60 bg-surface-elevated p-1 text-[12.5px] text-foreground shadow-popover"
        >
          {(Object.keys(labels) as T[]).map((key) => (
            <DropdownMenu.Item
              key={key}
              onSelect={() => onChange(key)}
              className="flex h-7 cursor-default select-none items-center rounded px-2 text-foreground/90 outline-none data-[highlighted]:bg-black/[0.05]"
            >
              {labels[key]}
            </DropdownMenu.Item>
          ))}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
