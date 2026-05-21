import { create } from "zustand";

export type AgentBackend = "codex" | "ccb";

interface BackendState {
  backend: AgentBackend;
  loaded: boolean;
  load: () => Promise<void>;
  setBackend: (backend: AgentBackend) => Promise<void>;
}

const STATE_KEY = "agent_backend";

function normalizeBackend(value: unknown): AgentBackend {
  return value === "ccb" || value === "claude-code" ? "ccb" : "codex";
}

export const BACKEND_LABEL: Record<AgentBackend, string> = {
  codex: "Codex",
  ccb: "Claude Code",
};

export const useBackendStore = create<BackendState>((set) => ({
  backend: "codex",
  loaded: false,

  load: async () => {
    try {
      const value = await window.codex.config.getState(STATE_KEY);
      set({ backend: normalizeBackend(value), loaded: true });
    } catch {
      set({ backend: "codex", loaded: true });
    }
  },

  setBackend: async (backend) => {
    set({ backend, loaded: true });
    await window.codex.config.setState(STATE_KEY, backend);
  },
}));
