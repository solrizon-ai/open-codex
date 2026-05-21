import { app, BrowserWindow, Menu, MenuItemConstructorOptions, shell } from "electron";
import { openSettingsWindow } from "./windows";

/** Native macOS menu bar (and a sensible default on Windows/Linux). */
export function buildAppMenu(): void {
  const isMac = process.platform === "darwin";
  const appName = app.getName();

  const codexSubmenu: MenuItemConstructorOptions[] = [
    { label: `About ${appName}`, role: "about" },
    { type: "separator" },
    { label: "Settings…", accelerator: "CmdOrCtrl+,", click: openSettings },
    { type: "separator" },
    { label: "Services", role: "services", submenu: [] },
    { type: "separator" },
    { label: `Hide ${appName}`, role: "hide" },
    { label: "Hide Others", role: "hideOthers" },
    { label: "Show All", role: "unhide" },
    { type: "separator" },
    { label: `Quit ${appName}`, role: "quit" },
  ];

  const fileSubmenu: MenuItemConstructorOptions[] = [
    { label: "New Conversation", accelerator: "CmdOrCtrl+N", click: newConversation },
    { label: "New Window", accelerator: "CmdOrCtrl+Shift+N", click: newWindow },
    { type: "separator" },
    { label: "Open Folder…", accelerator: "CmdOrCtrl+O", click: openFolder },
    { type: "separator" },
    { label: "Close Window", role: "close" },
  ];

  const editSubmenu: MenuItemConstructorOptions[] = [
    { role: "undo" },
    { role: "redo" },
    { type: "separator" },
    { role: "cut" },
    { role: "copy" },
    { role: "paste" },
    { role: "selectAll" },
  ];

  const viewSubmenu: MenuItemConstructorOptions[] = [
    { label: "Toggle Sidebar", accelerator: "CmdOrCtrl+B", click: toggleSidebar },
    { label: "Toggle Review Pane", accelerator: "CmdOrCtrl+J", click: toggleReview },
    { type: "separator" },
    { role: "reload" },
    { role: "forceReload" },
    { role: "toggleDevTools" },
    { type: "separator" },
    { role: "resetZoom" },
    { role: "zoomIn" },
    { role: "zoomOut" },
    { type: "separator" },
    { role: "togglefullscreen" },
  ];

  const windowSubmenu: MenuItemConstructorOptions[] = [
    { role: "minimize" },
    { role: "zoom" },
    ...(isMac
      ? [
          { type: "separator" as const },
          { role: "front" as const },
          { type: "separator" as const },
          { role: "window" as const },
        ]
      : [{ role: "close" as const }]),
  ];

  const helpSubmenu: MenuItemConstructorOptions[] = [
    {
      label: "Documentation",
      click: () => void shell.openExternal("https://developers.openai.com/codex"),
    },
  ];

  const template: MenuItemConstructorOptions[] = [
    ...(isMac ? [{ label: appName, submenu: codexSubmenu }] : []),
    { label: "File", submenu: fileSubmenu },
    { label: "Edit", submenu: editSubmenu },
    { label: "View", submenu: viewSubmenu },
    { label: "Window", submenu: windowSubmenu },
    { label: "Help", submenu: helpSubmenu, role: "help" },
  ];

  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

function focused(): BrowserWindow | null {
  return BrowserWindow.getFocusedWindow();
}

function openSettings() {
  focused()?.webContents.send("menu:open-settings");
  openSettingsWindow();
}

function newConversation() {
  focused()?.webContents.send("menu:new-conversation");
}

function newWindow() {
  // BrowserWindow construction is handled in index.ts; we just broadcast.
  focused()?.webContents.send("menu:new-window");
}

function openFolder() {
  focused()?.webContents.send("menu:open-folder");
}

function toggleSidebar() {
  focused()?.webContents.send("menu:toggle-sidebar");
}

function toggleReview() {
  focused()?.webContents.send("menu:toggle-review");
}
