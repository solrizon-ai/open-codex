import { ipcMain, session } from "electron";

const BROWSER_PARTITION = "persist:codex-browser";

export function registerBrowserIpc(): void {
  ipcMain.handle("browser:clear-data", async () => {
    const browserSession = session.fromPartition(BROWSER_PARTITION);
    await Promise.all([
      browserSession.clearCache(),
      browserSession.clearStorageData(),
    ]);
    return true;
  });
}
