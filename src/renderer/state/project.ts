import { create } from "zustand";

export interface ProjectInfo {
  cwd: string;
  name: string;
  branch: string | null;
  branches: string[];
}

interface ProjectState {
  current: ProjectInfo | null;
  loading: boolean;
  error: string | null;
  load: () => Promise<ProjectInfo | null>;
  setCurrent: (cwd: string) => Promise<ProjectInfo | null>;
  chooseFolder: () => Promise<ProjectInfo | null>;
}

function normalizeProject(value: unknown): ProjectInfo | null {
  if (!value || typeof value !== "object") return null;
  const v = value as Partial<ProjectInfo>;
  if (typeof v.cwd !== "string" || typeof v.name !== "string") return null;
  return {
    cwd: v.cwd,
    name: v.name,
    branch: typeof v.branch === "string" ? v.branch : null,
    branches: Array.isArray(v.branches)
      ? v.branches.filter((b): b is string => typeof b === "string")
      : [],
  };
}

export const useProjectStore = create<ProjectState>((set) => ({
  current: null,
  loading: false,
  error: null,

  load: async () => {
    set({ loading: true, error: null });
    try {
      const project = normalizeProject(await window.codex.project.current());
      set({ current: project, loading: false });
      return project;
    } catch (e) {
      const error = e instanceof Error ? e.message : String(e);
      set({ error, loading: false });
      return null;
    }
  },

  setCurrent: async (cwd) => {
    set({ loading: true, error: null });
    try {
      const project = normalizeProject(
        await window.codex.project.setCurrent(cwd),
      );
      set({ current: project, loading: false });
      return project;
    } catch (e) {
      const error = e instanceof Error ? e.message : String(e);
      set({ error, loading: false });
      return null;
    }
  },

  chooseFolder: async () => {
    set({ loading: true, error: null });
    try {
      const project = normalizeProject(
        await window.codex.project.chooseFolder(),
      );
      set((s) => ({ current: project ?? s.current, loading: false }));
      return project;
    } catch (e) {
      const error = e instanceof Error ? e.message : String(e);
      set({ error, loading: false });
      return null;
    }
  },
}));
