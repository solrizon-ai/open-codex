import { create } from "zustand";

/**
 * Mirror of the persistent codex preferences that the chat composer
 * exposes (model intelligence, approval policy, sandbox mode). On first
 * mount the store hydrates from `~/.codex/config.toml` via the config
 * IPC; setters write through and update local state optimistically.
 *
 * Keys map onto `codex-rs` config:
 *   model          → `model`
 *   reasoning      → `model_reasoning_effort` (low|medium|high)
 *   approvalPolicy → `approval_policy` (untrusted|on-failure|on-request|never)
 *   sandbox        → `sandbox_mode` (read-only|workspace-write|danger-full-access)
 */

export type ReasoningEffort = "low" | "medium" | "high" | "minimal";
export type ApprovalPolicy =
  | "untrusted"
  | "on-failure"
  | "on-request"
  | "never";
export type SandboxMode =
  | "read-only"
  | "workspace-write"
  | "danger-full-access";

interface PrefsState {
  model: string;
  reasoning: ReasoningEffort;
  approvalPolicy: ApprovalPolicy;
  sandbox: SandboxMode;
  loaded: boolean;
  load: () => Promise<void>;
  setModel: (next: string) => Promise<void>;
  setReasoning: (next: ReasoningEffort) => Promise<void>;
  setApprovalPolicy: (next: ApprovalPolicy) => Promise<void>;
  setSandbox: (next: SandboxMode) => Promise<void>;
}

async function readKey<T extends string>(
  path: string[],
  fallback: T,
): Promise<T> {
  try {
    const v = await window.codex.config.get(path);
    return (typeof v === "string" ? (v as T) : fallback) ?? fallback;
  } catch {
    return fallback;
  }
}

export const usePreferencesStore = create<PrefsState>((set) => ({
  model: "",
  reasoning: "medium",
  approvalPolicy: "on-request",
  sandbox: "workspace-write",
  loaded: false,

  load: async () => {
    const [model, reasoning, approvalPolicy, sandbox] = await Promise.all([
      readKey<string>(["model"], ""),
      readKey<ReasoningEffort>(["model_reasoning_effort"], "medium"),
      readKey<ApprovalPolicy>(["approval_policy"], "on-request"),
      readKey<SandboxMode>(["sandbox_mode"], "workspace-write"),
    ]);
    set({ model, reasoning, approvalPolicy, sandbox, loaded: true });
  },

  setModel: async (model) => {
    set({ model });
    await window.codex.config.set(["model"], model);
  },
  setReasoning: async (reasoning) => {
    set({ reasoning });
    await window.codex.config.set(["model_reasoning_effort"], reasoning);
  },
  setApprovalPolicy: async (approvalPolicy) => {
    set({ approvalPolicy });
    await window.codex.config.set(["approval_policy"], approvalPolicy);
  },
  setSandbox: async (sandbox) => {
    set({ sandbox });
    await window.codex.config.set(["sandbox_mode"], sandbox);
  },
}));
