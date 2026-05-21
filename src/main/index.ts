import { app, BrowserWindow, nativeTheme } from "electron";
import path from "node:path";
import { registerAllIpc } from "./ipc";
import { buildAppMenu } from "./menu";
import { openSettingsWindow } from "./windows";
import { syncWindowThemeBackground } from "./ipc/theme";

// Expose the Chromium DevTools Protocol on a known port in dev so the
// visual-snapshot loop (scripts/snap.mjs) can attach via Playwright.
const enableDevTools = !app.isPackaged && process.env.CODEX_DISABLE_CDP !== "1";

if (enableDevTools) {
  app.commandLine.appendSwitch("remote-debugging-port", "9223");
  app.commandLine.appendSwitch("remote-allow-origins", "*");
}

declare const MAIN_WINDOW_VITE_DEV_SERVER_URL: string;
declare const MAIN_WINDOW_VITE_NAME: string;

const isDev = !app.isPackaged;

function createMainWindow(): BrowserWindow {
  const win = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 760,
    minHeight: 480,
    title: "Codex",
    frame: false,
    backgroundColor: "#181818",
    show: false,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      sandbox: false,
      nodeIntegration: false,
      spellcheck: true,
      webviewTag: true, // for the right-pane browser tab
    },
  });

  if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
    void win.loadURL(MAIN_WINDOW_VITE_DEV_SERVER_URL);
  } else {
    void win.loadFile(
      path.join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`),
    );
  }

  win.once("ready-to-show", () => win.show());

  if (enableDevTools) win.webContents.openDevTools({ mode: "detach" });

  return win;
}

app.whenReady().then(() => {
  nativeTheme.themeSource = "system";
  registerAllIpc();
  buildAppMenu();
  createMainWindow();
  void syncWindowThemeBackground();
  nativeTheme.on("updated", () => {
    void syncWindowThemeBackground();
  });

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createMainWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
