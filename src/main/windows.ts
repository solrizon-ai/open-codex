import { BrowserWindow } from "electron";
import path from "node:path";
import { syncWindowThemeBackground } from "./ipc/theme";

declare const SETTINGS_WINDOW_VITE_DEV_SERVER_URL: string;
declare const SETTINGS_WINDOW_VITE_NAME: string;

let settingsWindow: BrowserWindow | null = null;

export function openSettingsWindow(): BrowserWindow {
  if (settingsWindow && !settingsWindow.isDestroyed()) {
    settingsWindow.focus();
    return settingsWindow;
  }

  const win = new BrowserWindow({
    width: 900,
    height: 640,
    minWidth: 720,
    minHeight: 500,
    title: "设置",
    titleBarStyle: "hidden",
    trafficLightPosition: { x: 14, y: 14 },
    backgroundColor: "#181818",
    show: false,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      sandbox: false,
      nodeIntegration: false,
    },
  });

  if (SETTINGS_WINDOW_VITE_DEV_SERVER_URL) {
    void win.loadURL(SETTINGS_WINDOW_VITE_DEV_SERVER_URL);
  } else {
    void win.loadFile(
      path.join(
        __dirname,
        `../renderer/${SETTINGS_WINDOW_VITE_NAME}/index.html`,
      ),
    );
  }

  win.once("ready-to-show", () => win.show());
  void syncWindowThemeBackground();
  win.on("closed", () => {
    settingsWindow = null;
  });

  settingsWindow = win;
  return win;
}
