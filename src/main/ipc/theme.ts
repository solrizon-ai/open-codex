import { BrowserWindow, app, ipcMain, nativeTheme } from "electron";
import { promises as fs } from "node:fs";
import { join } from "node:path";
import { DEFAULT_THEME, type ThemeConfig } from "../../shared/theme";

function themeFile(): string {
  return join(app.getPath("userData"), "desktop-theme.json");
}

function themeModeFromEnv(): ThemeConfig["mode"] | null {
  const mode = process.env.CODEX_DESKTOP_THEME;
  if (mode === "dark" || mode === "light" || mode === "system") return mode;
  if (!app.isPackaged) return "dark";
  return null;
}

export async function readTheme(): Promise<ThemeConfig> {
  const envMode = themeModeFromEnv();
  try {
    const raw = await fs.readFile(themeFile(), "utf8");
    const theme = { ...DEFAULT_THEME, ...JSON.parse(raw) } as ThemeConfig;
    return envMode ? { ...theme, mode: envMode } : theme;
  } catch {
    return envMode ? { ...DEFAULT_THEME, mode: envMode } : DEFAULT_THEME;
  }
}

async function writeTheme(theme: ThemeConfig): Promise<void> {
  await fs.mkdir(app.getPath("userData"), { recursive: true });
  await fs.writeFile(themeFile(), JSON.stringify(theme, null, 2), "utf8");
}

function broadcast(channel: string, payload: unknown) {
  for (const win of BrowserWindow.getAllWindows()) {
    if (!win.isDestroyed()) win.webContents.send(channel, payload);
  }
}

function effectiveThemeMode(theme: ThemeConfig): "light" | "dark" {
  if (theme.mode === "light" || theme.mode === "dark") return theme.mode;
  return nativeTheme.shouldUseDarkColors ? "dark" : "light";
}

function backgroundForTheme(theme: ThemeConfig): string {
  const mode = effectiveThemeMode(theme);
  return theme[mode]?.background || DEFAULT_THEME[mode].background;
}

export async function syncWindowThemeBackground(): Promise<void> {
  const color = backgroundForTheme(await readTheme());
  for (const win of BrowserWindow.getAllWindows()) {
    if (!win.isDestroyed()) win.setBackgroundColor(color);
  }
}

export function registerThemeIpc(): void {
  ipcMain.handle("theme:get", () => readTheme());
  ipcMain.handle("theme:set", async (_evt, theme: ThemeConfig) => {
    await writeTheme(theme);
    await syncWindowThemeBackground();
    broadcast("theme:changed", theme);
    return true;
  });
}
