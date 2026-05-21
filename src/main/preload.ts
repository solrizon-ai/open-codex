import { contextBridge, ipcRenderer } from "electron";
import type { ThemeConfig } from "../shared/theme";

type Unsubscribe = () => void;

const codex = {
  start: () => ipcRenderer.invoke("codex:start"),
  stop: () => ipcRenderer.invoke("codex:stop"),
  initialize: (params: unknown) =>
    ipcRenderer.invoke("codex:initialize", params),
  request: <T = unknown>(method: string, params?: unknown): Promise<T> =>
    ipcRenderer.invoke("codex:request", method, params) as Promise<T>,
  notify: (method: string, params?: unknown) =>
    ipcRenderer.invoke("codex:notify", method, params),

  onNotification: (cb: (msg: unknown) => void): Unsubscribe => {
    const listener = (_: unknown, msg: unknown) => cb(msg);
    ipcRenderer.on("codex:notification", listener);
    return () => ipcRenderer.removeListener("codex:notification", listener);
  },
  onStderr: (cb: (chunk: string) => void): Unsubscribe => {
    const listener = (_: unknown, chunk: string) => cb(chunk);
    ipcRenderer.on("codex:stderr", listener);
    return () => ipcRenderer.removeListener("codex:stderr", listener);
  },
  onExit: (
    cb: (info: { code: number | null; signal: string | null }) => void,
  ): Unsubscribe => {
    const listener = (
      _: unknown,
      info: { code: number | null; signal: string | null },
    ) => cb(info);
    ipcRenderer.on("codex:exit", listener);
    return () => ipcRenderer.removeListener("codex:exit", listener);
  },
};

const claude = {
  info: (): Promise<{
    bin: string;
    version: string;
    claudeHome: string;
  }> => ipcRenderer.invoke("claude:info"),
  historyList: (
    cwd?: string | null,
  ): Promise<{
    data?: Array<{
      id: string;
      title: string;
      preview: string;
      cwd: string;
      updatedAt: number;
      source: "claude";
    }>;
  }> => ipcRenderer.invoke("claude:history:list", cwd ?? null),
  historyRead: (
    threadId: string,
    cwd?: string | null,
  ): Promise<{
    id: string;
    cwd: string | null;
    items: Array<{
      id?: string;
      type?: string;
      role?: "user" | "assistant" | "system" | "tool";
      text?: string;
      raw: Record<string, unknown>;
    }>;
  }> => ipcRenderer.invoke("claude:history:read", threadId, cwd ?? null),
  slashList: (
    cwd?: string | null,
  ): Promise<{
    data?: Array<{
      command: string;
      description: string;
      path?: string;
      kind: "skill" | "command";
      order?: number;
    }>;
  }> => ipcRenderer.invoke("claude:slash:list", cwd ?? null),
  startTurn: (params: {
    cwd: string;
    threadId?: string | null;
    input: unknown;
    model?: string | null;
    permissionMode?:
      | ""
      | "default"
      | "acceptEdits"
      | "plan"
      | "dontAsk"
      | "bypassPermissions"
      | "auto"
      | null;
  }): Promise<{ threadId: string; text: string; raw: unknown[] }> =>
    ipcRenderer.invoke("claude:turn:start", params),
  onNotification: (cb: (msg: unknown) => void): Unsubscribe => {
    const listener = (_: unknown, msg: unknown) => cb(msg);
    ipcRenderer.on("claude:notification", listener);
    return () => ipcRenderer.removeListener("claude:notification", listener);
  },
  onStderr: (cb: (chunk: string) => void): Unsubscribe => {
    const listener = (_: unknown, chunk: string) => cb(chunk);
    ipcRenderer.on("claude:stderr", listener);
    return () => ipcRenderer.removeListener("claude:stderr", listener);
  },
};

const menu = {
  onCommand: (cb: (command: string) => void): Unsubscribe => {
    const channels = [
      "menu:open-settings",
      "menu:new-conversation",
      "menu:new-window",
      "menu:open-folder",
      "menu:toggle-sidebar",
      "menu:toggle-review",
    ] as const;
    const removers = channels.map((ch) => {
      const l = () => cb(ch);
      ipcRenderer.on(ch, l);
      return () => ipcRenderer.removeListener(ch, l);
    });
    return () => removers.forEach((r) => r());
  },
};

const windowApi = {
  openSettings: () => ipcRenderer.invoke("window:open-settings"),
  close: () => ipcRenderer.invoke("window:close"),
  minimize: () => ipcRenderer.invoke("window:minimize"),
  toggleMaximize: () => ipcRenderer.invoke("window:toggle-maximize"),
};

const theme = {
  get: (): Promise<ThemeConfig> => ipcRenderer.invoke("theme:get"),
  set: (next: ThemeConfig): Promise<true> =>
    ipcRenderer.invoke("theme:set", next),
  onChange: (cb: (theme: ThemeConfig) => void): Unsubscribe => {
    const listener = (_: unknown, t: ThemeConfig) => cb(t);
    ipcRenderer.on("theme:changed", listener);
    return () => ipcRenderer.removeListener("theme:changed", listener);
  },
};

const project = {
  current: () => ipcRenderer.invoke("project:current"),
  setCurrent: (cwd: string) => ipcRenderer.invoke("project:set-current", cwd),
  chooseFolder: () => ipcRenderer.invoke("project:choose-folder"),
  browseFolder: () => ipcRenderer.invoke("project:browse-folder"),
  clear: () => ipcRenderer.invoke("project:clear"),
};

const file = {
  open: (path: string): Promise<true> => ipcRenderer.invoke("file:open", path),
  showInFolder: (path: string): Promise<true> =>
    ipcRenderer.invoke("file:show-in-folder", path),
  copyPath: (path: string): Promise<true> =>
    ipcRenderer.invoke("file:copy-path", path),
  readImageDataUrl: (path: string): Promise<string> =>
    ipcRenderer.invoke("file:read-image-data-url", path),
};

const system = {
  openEditor: (path: string): Promise<true> =>
    ipcRenderer.invoke("system:open-editor", path),
  openTerminal: (path: string): Promise<true> =>
    ipcRenderer.invoke("system:open-terminal", path),
};

const git = {
  status: (cwd: string) => ipcRenderer.invoke("git:status", cwd),
  changes: (cwd: string) => ipcRenderer.invoke("git:changes", cwd),
  diff: (
    cwd: string,
    options?: { path?: string; staged?: boolean; includeUntracked?: boolean },
  ) => ipcRenderer.invoke("git:diff", cwd, options ?? {}),
  branches: (cwd: string) => ipcRenderer.invoke("git:branches", cwd),
  checkout: (cwd: string, branch: string, options?: { create?: boolean }) =>
    ipcRenderer.invoke("git:checkout", cwd, branch, options ?? {}),
  stage: (cwd: string, paths: string[]) =>
    ipcRenderer.invoke("git:stage", cwd, paths),
  unstage: (cwd: string, paths: string[]) =>
    ipcRenderer.invoke("git:unstage", cwd, paths),
  discard: (cwd: string, paths: string[]) =>
    ipcRenderer.invoke("git:discard", cwd, paths),
  commit: (cwd: string, message: string, options?: { stageAll?: boolean }) =>
    ipcRenderer.invoke("git:commit", cwd, message, options ?? {}),
  suggestCommitMessage: (cwd: string): Promise<string> =>
    ipcRenderer.invoke("git:suggest-commit-message", cwd),
  push: (
    cwd: string,
    options?: { remote?: string; branch?: string; force?: boolean },
  ) => ipcRenderer.invoke("git:push", cwd, options ?? {}),
  fetch: (cwd: string, remote?: string) =>
    ipcRenderer.invoke("git:fetch", cwd, remote),
  worktreeList: (cwd: string) => ipcRenderer.invoke("git:worktree-list", cwd),
  worktreeAdd: (cwd: string, targetPath: string, branch?: string) =>
    ipcRenderer.invoke("git:worktree-add", cwd, targetPath, branch),
  worktreeRemove: (
    cwd: string,
    targetPath: string,
    options?: { force?: boolean },
  ) =>
    ipcRenderer.invoke("git:worktree-remove", cwd, targetPath, options ?? {}),
  openPullRequest: (cwd: string): Promise<true> =>
    ipcRenderer.invoke("git:open-pull-request", cwd),
};

const terminal = {
  create: (
    cwd?: string | null,
  ): Promise<{
    id: string;
    shell: string;
    cwd: string;
    prompt: string;
  }> => ipcRenderer.invoke("terminal:create", cwd ?? null),
  write: (id: string, data: string): Promise<true> =>
    ipcRenderer.invoke("terminal:write", id, data),
  kill: (id: string): Promise<true> => ipcRenderer.invoke("terminal:kill", id),
  onData: (cb: (event: { id: string; chunk: string }) => void): Unsubscribe => {
    const listener = (_: unknown, event: { id: string; chunk: string }) =>
      cb(event);
    ipcRenderer.on("terminal:data", listener);
    return () => ipcRenderer.removeListener("terminal:data", listener);
  },
  onExit: (
    cb: (event: {
      id: string;
      code: number | null;
      signal: string | null;
    }) => void,
  ): Unsubscribe => {
    const listener = (
      _: unknown,
      event: { id: string; code: number | null; signal: string | null },
    ) => cb(event);
    ipcRenderer.on("terminal:exit", listener);
    return () => ipcRenderer.removeListener("terminal:exit", listener);
  },
};

const config = {
  read: () => ipcRenderer.invoke("config:read"),
  get: (path: string[]) => ipcRenderer.invoke("config:get", path),
  set: (path: string[], value: unknown) =>
    ipcRenderer.invoke("config:set", path, value),
  merge: (path: string[], patch: Record<string, unknown>) =>
    ipcRenderer.invoke("config:merge", path, patch),
  path: (): Promise<string> => ipcRenderer.invoke("config:path"),
  getState: (key: string) => ipcRenderer.invoke("state:get", key),
  setState: (key: string, value: unknown) =>
    ipcRenderer.invoke("state:set", key, value),
};

const search = {
  files: (cwd: string, query: string) =>
    ipcRenderer.invoke("search:files", cwd, query) as Promise<
      { path: string; score: number }[]
    >,
  text: (cwd: string, query: string) =>
    ipcRenderer.invoke("search:text", cwd, query) as Promise<
      { path: string; line: number; text: string }[]
    >,
};

const browser = {
  clearData: (): Promise<true> => ipcRenderer.invoke("browser:clear-data"),
};

const api = {
  platform: process.platform,
  codex,
  claude,
  menu,
  project,
  file,
  system,
  git,
  terminal,
  config,
  search,
  browser,
  theme,
  window: windowApi,
};

contextBridge.exposeInMainWorld("codex", api);

export type CodexBridge = typeof api;
