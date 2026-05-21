import { create } from "zustand";
import {
  diffFilesFromChanges,
  type FileChangeRecord,
} from "../components/review/diffModel";
import type { DiffFile } from "../components/review/types";

interface ReviewDiffState {
  files: DiffFile[];
  activePath: string | null;
  cwd: string | null;
  loading: boolean;
  error: string | null;
  source: "git" | "thread" | "none";
  /** User explicitly picked this review target; do not auto-replace it. */
  sticky: boolean;
  setFiles: (files: DiffFile[], activePath?: string | null) => void;
  setFromChanges: (
    changes: FileChangeRecord[],
    cwd?: string | null,
    activePath?: string | null,
    options?: { sticky?: boolean },
  ) => void;
  setActivePath: (path: string) => void;
  /** Pull the current working-tree changes from `git` and populate the store. */
  refreshFromGit: (cwd: string) => Promise<void>;
  clear: () => void;
}

interface GitChangeFromIpc {
  path: string;
  status: "added" | "deleted" | "modified" | "renamed";
  staged: boolean;
  added: number;
  removed: number;
  diff: string;
}

let refreshGeneration = 0;

export const useReviewDiffStore = create<ReviewDiffState>((set, get) => ({
  files: [],
  activePath: null,
  cwd: null,
  loading: false,
  error: null,
  source: "none",
  sticky: false,

  setFiles: (files, activePath) => {
    const preferred = files.find((file) => file.lines.length > 0) ?? files[0];
    const nextActive =
      activePath ??
      (get().activePath && files.some((file) => file.path === get().activePath)
        ? get().activePath
        : preferred?.path ?? null);
    set({ files, activePath: nextActive });
  },

  setFromChanges: (changes, cwd, activePath, options) => {
    const files = diffFilesFromChanges(changes, cwd);
    const normalizedActive =
      files.find((file) => file.path === activePath || file.absolutePath === activePath)
        ?.path ?? activePath;
    get().setFiles(files, normalizedActive);
    set({
      cwd: cwd ?? null,
      source: "thread",
      error: null,
      sticky: options?.sticky ?? false,
    });
  },

  setActivePath: (path) => set({ activePath: path, sticky: true }),

  refreshFromGit: async (cwd: string) => {
    if (!cwd) return;
    const generation = ++refreshGeneration;
    set({ cwd, loading: true, error: null });
    try {
      const changes = (await window.codex.git.changes(cwd)) as GitChangeFromIpc[];
      if (generation !== refreshGeneration || get().cwd !== cwd) return;
      const records: FileChangeRecord[] = changes.map((c) => ({
        path: c.path,
        diff: c.diff,
        status: c.status,
      }));
      const files = diffFilesFromChanges(records, cwd);
      const previous = get().activePath;
      const nextActive =
        previous && files.some((file) => file.path === previous)
          ? previous
          : files[0]?.path ?? null;
      set({
        cwd,
        files,
        activePath: nextActive,
        loading: false,
        error: null,
        source: files.length > 0 ? "git" : "none",
        sticky: false,
      });
    } catch (e) {
      if (generation !== refreshGeneration || get().cwd !== cwd) return;
      const error = e instanceof Error ? e.message : String(e);
      set({ loading: false, error });
    }
  },

  clear: () =>
    set({
      files: [],
      activePath: null,
      cwd: null,
      source: "none",
      error: null,
      loading: false,
      sticky: false,
    }),
}));
