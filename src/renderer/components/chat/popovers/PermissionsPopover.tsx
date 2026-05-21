import { BookOpen, Check, Globe, Hand, PauseCircle, ShieldCheck, Zap } from "lucide-react";
import { useEffect, type ReactNode } from "react";
import {
  ChipPopover,
  PopoverItem,
  PopoverSectionLabel,
  PopoverSeparator,
} from "./popover-shell";
import {
  usePreferencesStore,
  type ApprovalPolicy,
  type SandboxMode,
} from "../../../state/preferences";
import { BACKEND_LABEL, useBackendStore } from "../../../state/backend";
import {
  CLAUDE_PERMISSION_OPTIONS,
  type ClaudePermissionMode,
  useClaudeCodeConfigStore,
} from "../../../state/claudeConfig";

interface Option {
  id: string;
  label: string;
  description: string;
  icon: typeof Hand;
  approval: ApprovalPolicy;
  sandbox: SandboxMode;
}

const OPTIONS: Option[] = [
  {
    id: "default",
    label: "默认权限",
    description: "Codex 可读写工作区内文件",
    icon: Hand,
    approval: "on-request",
    sandbox: "workspace-write",
  },
  {
    id: "auto",
    label: "自动审核",
    description: "Codex 可自动审核额外的访问权限请求",
    icon: ShieldCheck,
    approval: "on-failure",
    sandbox: "workspace-write",
  },
  {
    id: "full",
    label: "完全访问权限",
    description: "Codex 可改动您电脑上任何文件并运行联网命令",
    icon: Globe,
    approval: "never",
    sandbox: "danger-full-access",
  },
  {
    id: "read",
    label: "只读",
    description: "Codex 只能读取文件，不能修改",
    icon: BookOpen,
    approval: "on-request",
    sandbox: "read-only",
  },
];

function activeOptionId(approval: ApprovalPolicy, sandbox: SandboxMode): string {
  const match = OPTIONS.find(
    (o) => o.approval === approval && o.sandbox === sandbox,
  );
  return match?.id ?? "default";
}

export function PermissionsPopover({ trigger }: { trigger: ReactNode }) {
  const backend = useBackendStore((s) => s.backend);
  const approval = usePreferencesStore((s) => s.approvalPolicy);
  const sandbox = usePreferencesStore((s) => s.sandbox);
  const setApprovalPolicy = usePreferencesStore((s) => s.setApprovalPolicy);
  const setSandbox = usePreferencesStore((s) => s.setSandbox);
  const load = usePreferencesStore((s) => s.load);
  const loaded = usePreferencesStore((s) => s.loaded);
  const claudePermissionMode = useClaudeCodeConfigStore((s) => s.permissionMode);
  const setClaudePermissionMode = useClaudeCodeConfigStore(
    (s) => s.setPermissionMode,
  );
  const loadClaudeConfig = useClaudeCodeConfigStore((s) => s.load);
  const claudeConfigLoaded = useClaudeCodeConfigStore((s) => s.loaded);
  const current = activeOptionId(approval, sandbox);

  useEffect(() => {
    if (backend === "codex" && !loaded) void load();
  }, [backend, loaded, load]);

  useEffect(() => {
    if (backend !== "codex" && !claudeConfigLoaded) void loadClaudeConfig();
  }, [backend, claudeConfigLoaded, loadClaudeConfig]);

  if (backend !== "codex") {
    return (
      <ChipPopover
        trigger={trigger}
        align="start"
        side="top"
        sideOffset={6}
        className="min-w-[320px]"
      >
        <PopoverSectionLabel>{BACKEND_LABEL[backend]} 权限</PopoverSectionLabel>
        {CLAUDE_PERMISSION_OPTIONS.map((option) => {
          const Icon = iconForClaudePermission(option.id);
          return (
            <PopoverItem
              key={option.id || "cli"}
              selected={claudePermissionMode === option.id}
              leading={<Icon size={13} strokeWidth={1.7} />}
              trailing={
                claudePermissionMode === option.id ? (
                  <Check size={12} className="opacity-70" />
                ) : null
              }
              onClick={() => void setClaudePermissionMode(option.id)}
            >
              <div className="flex flex-col items-start">
                <span className="text-[12.5px] leading-tight">{option.label}</span>
                <span className="text-[11px] leading-tight text-foreground-subtle">
                  {option.description}
                </span>
              </div>
            </PopoverItem>
          );
        })}
      </ChipPopover>
    );
  }

  return (
    <ChipPopover
      trigger={trigger}
      align="start"
      side="top"
      sideOffset={6}
      className="min-w-[280px]"
    >
      <PopoverSectionLabel>权限</PopoverSectionLabel>
      {OPTIONS.map((opt) => (
        <PopoverItem
          key={opt.id}
          selected={current === opt.id}
          leading={<opt.icon size={13} strokeWidth={1.7} />}
          onClick={() => {
            void setApprovalPolicy(opt.approval);
            void setSandbox(opt.sandbox);
          }}
        >
          <div className="flex flex-col items-start">
            <span className="text-[12.5px] leading-tight">{opt.label}</span>
            <span className="text-[11px] leading-tight text-foreground-subtle">
              {opt.description}
            </span>
          </div>
        </PopoverItem>
      ))}
      <PopoverSeparator />
      <PopoverItem muted>了解更多关于权限</PopoverItem>
    </ChipPopover>
  );
}

function iconForClaudePermission(mode: ClaudePermissionMode) {
  switch (mode) {
    case "acceptEdits":
      return ShieldCheck;
    case "plan":
      return PauseCircle;
    case "dontAsk":
    case "bypassPermissions":
      return Globe;
    case "auto":
      return Zap;
    case "default":
      return Hand;
    default:
      return BookOpen;
  }
}
