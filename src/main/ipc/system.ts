import { ipcMain, shell } from "electron";
import { execFile } from "node:child_process";
import { access } from "node:fs/promises";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

async function ensurePath(target: string): Promise<string> {
  if (!target || typeof target !== "string") {
    throw new Error("missing path");
  }
  await access(target);
  return target;
}

async function tryOpenApp(appName: string, target: string): Promise<boolean> {
  try {
    await execFileAsync("open", ["-a", appName, target], {
      timeout: 5000,
      windowsHide: true,
    });
    return true;
  } catch {
    return false;
  }
}

async function openPathFallback(target: string): Promise<true> {
  const error = await shell.openPath(target);
  if (error) throw new Error(error);
  return true;
}

export function registerSystemIpc(): void {
  ipcMain.handle("system:open-editor", async (_evt, rawTarget: string) => {
    const target = await ensurePath(rawTarget);
    if (process.platform === "darwin") {
      const candidates = [
        process.env.CODEX_EDITOR_APP,
        "Visual Studio Code",
        "Cursor",
        "Windsurf",
      ].filter((name): name is string => !!name);
      for (const appName of candidates) {
        if (await tryOpenApp(appName, target)) return true;
      }
    }
    return openPathFallback(target);
  });

  ipcMain.handle("system:open-terminal", async (_evt, rawTarget: string) => {
    const target = await ensurePath(rawTarget);
    if (process.platform === "darwin") {
      if (await tryOpenApp("Terminal", target)) return true;
      if (await tryOpenApp("iTerm", target)) return true;
    }
    return openPathFallback(target);
  });
}
