import { BrowserWindow, ipcMain } from "electron";
import { CodexAppServer } from "../codex/spawn";
import type { InitializeParams, InitializeResponse } from "../codex/protocol";

let server: CodexAppServer | null = null;
let initializePromise: Promise<InitializeResponse> | null = null;
let initializeResponse: InitializeResponse | null = null;

function ensureServer(): CodexAppServer {
  if (!server) {
    server = new CodexAppServer();
    server.on("notification", (msg) => broadcast("codex:notification", msg));
    server.on("stderr", (chunk: string) => broadcast("codex:stderr", chunk));
    server.on("exit", (info) => {
      initializePromise = null;
      initializeResponse = null;
      broadcast("codex:exit", info);
    });
    server.on("error", (err: Error) =>
      broadcast("codex:error", { message: err.message }),
    );
  }
  return server;
}

function broadcast(channel: string, payload: unknown) {
  for (const win of BrowserWindow.getAllWindows()) {
    if (!win.isDestroyed()) win.webContents.send(channel, payload);
  }
}

export function registerCodexIpc(): void {
  ipcMain.handle("codex:start", async () => {
    const s = ensureServer();
    if (!s.isRunning()) await s.start();
    return { running: s.isRunning() };
  });

  ipcMain.handle("codex:stop", () => {
    server?.stop();
    initializePromise = null;
    initializeResponse = null;
    return { stopped: true };
  });

  ipcMain.handle(
    "codex:initialize",
    async (_evt, params: InitializeParams): Promise<InitializeResponse> => {
      if (initializeResponse) return initializeResponse;
      if (initializePromise) return initializePromise;
      const s = ensureServer();
      if (!s.isRunning()) await s.start();
      initializePromise = s
        .request<InitializeResponse>("initialize", params)
        .then((res) => {
          initializeResponse = res;
          return res;
        })
        .finally(() => {
          initializePromise = null;
        });
      return initializePromise;
    },
  );

  ipcMain.handle(
    "codex:request",
    async (_evt, method: string, params: unknown) => {
      const s = ensureServer();
      if (!s.isRunning()) await s.start();
      return s.request(method, params);
    },
  );

  ipcMain.handle("codex:notify", (_evt, method: string, params: unknown) => {
    ensureServer().notify(method, params);
    return true;
  });
}
