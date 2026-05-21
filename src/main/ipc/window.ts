import { BrowserWindow, ipcMain } from "electron";
import { openSettingsWindow } from "../windows";

export function registerWindowIpc(): void {
  ipcMain.handle("window:open-settings", () => {
    openSettingsWindow();
    return true;
  });

  ipcMain.handle("window:close", (event) => {
    BrowserWindow.fromWebContents(event.sender)?.close();
    return true;
  });

  ipcMain.handle("window:minimize", (event) => {
    BrowserWindow.fromWebContents(event.sender)?.minimize();
    return true;
  });

  ipcMain.handle("window:toggle-maximize", (event) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    if (!win) return false;
    if (win.isMaximized()) win.unmaximize();
    else win.maximize();
    return true;
  });
}
