import { create } from "zustand";

export type ClaudePermissionMode =
  | ""
  | "default"
  | "acceptEdits"
  | "plan"
  | "dontAsk"
  | "bypassPermissions"
  | "auto";

interface ClaudeConfigState {
  model: string;
  permissionMode: ClaudePermissionMode;
  loaded: boolean;
  load: () => Promise<void>;
  setModel: (model: string) => Promise<void>;
  setPermissionMode: (mode: ClaudePermissionMode) => Promise<void>;
}

const STATE_KEY = "claude_code_config";

export const CLAUDE_MODEL_OPTIONS = [
  { id: "", label: "CLI 默认", description: "使用 Claude Code 当前配置" },
  { id: "sonnet", label: "Sonnet", description: "传递 --model sonnet" },
  { id: "opus", label: "Opus", description: "传递 --model opus" },
  { id: "haiku", label: "Haiku", description: "传递 --model haiku" },
];

export const CLAUDE_PERMISSION_OPTIONS: Array<{
  id: ClaudePermissionMode;
  label: string;
  description: string;
}> = [
  {
    id: "",
    label: "CLI 权限",
    description: "不传 --permission-mode，使用 Claude Code 默认配置",
  },
  {
    id: "default",
    label: "默认权限",
    description: "传递 --permission-mode default",
  },
  {
    id: "acceptEdits",
    label: "接受编辑",
    description: "自动接受文件编辑，仍按 Claude Code 规则处理其他权限",
  },
  {
    id: "plan",
    label: "计划模式",
    description: "先产出计划，再进入执行",
  },
  {
    id: "auto",
    label: "自动模式",
    description: "传递 --permission-mode auto，由 Claude Code 自动判定",
  },
  {
    id: "dontAsk",
    label: "不询问",
    description: "传递 --permission-mode dontAsk",
  },
  {
    id: "bypassPermissions",
    label: "绕过权限",
    description: "传递 --permission-mode bypassPermissions",
  },
];

const VALID_PERMISSION_MODES = new Set(
  CLAUDE_PERMISSION_OPTIONS.map((option) => option.id),
);

function normalizeConfig(value: unknown): {
  model: string;
  permissionMode: ClaudePermissionMode;
} {
  if (!value || typeof value !== "object") {
    return { model: "", permissionMode: "" };
  }
  const raw = value as Record<string, unknown>;
  const model = typeof raw.model === "string" ? raw.model.trim() : "";
  const permissionMode =
    typeof raw.permissionMode === "string" &&
    VALID_PERMISSION_MODES.has(raw.permissionMode as ClaudePermissionMode)
      ? (raw.permissionMode as ClaudePermissionMode)
      : "";
  return { model, permissionMode };
}

export function claudeModelLabel(model: string): string {
  const trimmed = model.trim();
  if (!trimmed) return "Claude CLI";
  const option = CLAUDE_MODEL_OPTIONS.find((candidate) => candidate.id === trimmed);
  return option?.label ?? trimmed;
}

export function claudePermissionLabel(mode: ClaudePermissionMode): string {
  return (
    CLAUDE_PERMISSION_OPTIONS.find((option) => option.id === mode)?.label ??
    "CLI 权限"
  );
}

export function normalizeClaudePermissionMode(
  value: string,
): ClaudePermissionMode | null {
  const normalized = value.trim();
  const aliases: Record<string, ClaudePermissionMode> = {
    acceptedits: "acceptEdits",
    "accept-edits": "acceptEdits",
    accept: "acceptEdits",
    dontask: "dontAsk",
    "dont-ask": "dontAsk",
    bypass: "bypassPermissions",
    bypasspermissions: "bypassPermissions",
    "bypass-permissions": "bypassPermissions",
    default: "default",
    plan: "plan",
    auto: "auto",
    cli: "",
    reset: "",
  };
  return aliases[normalized.toLowerCase()] ?? null;
}

export const useClaudeCodeConfigStore = create<ClaudeConfigState>((set, get) => ({
  model: "",
  permissionMode: "",
  loaded: false,

  load: async () => {
    try {
      const raw = await window.codex.config.getState(STATE_KEY);
      set({ ...normalizeConfig(raw), loaded: true });
    } catch {
      set({ model: "", permissionMode: "", loaded: true });
    }
  },

  setModel: async (model) => {
    const trimmed = model.trim();
    const next = { ...get(), model: trimmed, loaded: true };
    set({ model: trimmed, loaded: true });
    await window.codex.config.setState(STATE_KEY, {
      model: next.model,
      permissionMode: next.permissionMode,
    });
  },

  setPermissionMode: async (permissionMode) => {
    const next = { ...get(), permissionMode, loaded: true };
    set({ permissionMode, loaded: true });
    await window.codex.config.setState(STATE_KEY, {
      model: next.model,
      permissionMode: next.permissionMode,
    });
  },
}));
