import { app, ipcMain } from "electron";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { parse, stringify } from "smol-toml";

/**
 * Persistent settings live in two places:
 *   1. `~/.codex/config.toml` — the same file the codex CLI reads. The
 *      desktop app uses `app.set` / `app.merge` to write a top-level table,
 *      and `app.get` to read it back. Renderer-only preferences (sidebar
 *      width, etc.) are NOT stored here; they live in zustand + localStorage.
 *   2. `~/.codex/desktop-state.json` — a small JSON file for desktop-app
 *      state that does not belong in the shared TOML (pinned sessions,
 *      archived flags, etc.). Avoids polluting the upstream schema.
 */

const CODEX_HOME = process.env.CODEX_HOME || join(app.getPath("home"), ".codex");
const CONFIG_PATH = join(CODEX_HOME, "config.toml");
const STATE_PATH = join(CODEX_HOME, "desktop-state.json");

type TomlValue =
  | string
  | number
  | boolean
  | Date
  | TomlValue[]
  | { [k: string]: TomlValue };

async function ensureCodexHome(): Promise<void> {
  await mkdir(CODEX_HOME, { recursive: true });
}

async function readConfigRaw(): Promise<Record<string, TomlValue>> {
  try {
    const text = await readFile(CONFIG_PATH, "utf8");
    return parse(text) as Record<string, TomlValue>;
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return {};
    throw err;
  }
}

async function writeConfigRaw(value: Record<string, TomlValue>): Promise<void> {
  await ensureCodexHome();
  await writeFile(CONFIG_PATH, stringify(value), "utf8");
}

function getPath(obj: Record<string, TomlValue>, path: string[]): TomlValue | undefined {
  let cur: TomlValue | undefined = obj;
  for (const key of path) {
    if (!cur || typeof cur !== "object" || Array.isArray(cur)) return undefined;
    cur = (cur as Record<string, TomlValue>)[key];
  }
  return cur;
}

function setPath(
  obj: Record<string, TomlValue>,
  path: string[],
  value: TomlValue | undefined,
): void {
  if (path.length === 0) return;
  let cur: Record<string, TomlValue> = obj;
  for (let i = 0; i < path.length - 1; i++) {
    const key = path[i]!;
    const next = cur[key];
    if (!next || typeof next !== "object" || Array.isArray(next)) {
      cur[key] = {};
    }
    cur = cur[key] as Record<string, TomlValue>;
  }
  const last = path[path.length - 1]!;
  if (value === undefined) delete cur[last];
  else cur[last] = value;
}

async function readDesktopState(): Promise<Record<string, unknown>> {
  try {
    const text = await readFile(STATE_PATH, "utf8");
    return JSON.parse(text) as Record<string, unknown>;
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return {};
    throw err;
  }
}

async function writeDesktopState(value: Record<string, unknown>): Promise<void> {
  await ensureCodexHome();
  await writeFile(STATE_PATH, JSON.stringify(value, null, 2), "utf8");
}

export function registerConfigIpc(): void {
  ipcMain.handle("config:read", async () => readConfigRaw());

  ipcMain.handle(
    "config:get",
    async (_evt, path: string[]) => getPath(await readConfigRaw(), path) ?? null,
  );

  ipcMain.handle(
    "config:set",
    async (_evt, path: string[], value: TomlValue | null) => {
      const next = await readConfigRaw();
      setPath(next, path, value === null ? undefined : value);
      await writeConfigRaw(next);
      return true;
    },
  );

  ipcMain.handle(
    "config:merge",
    async (_evt, path: string[], patch: Record<string, TomlValue>) => {
      const next = await readConfigRaw();
      const existing = getPath(next, path);
      const base =
        existing && typeof existing === "object" && !Array.isArray(existing)
          ? (existing as Record<string, TomlValue>)
          : {};
      setPath(next, path, { ...base, ...patch });
      await writeConfigRaw(next);
      return true;
    },
  );

  ipcMain.handle("config:path", () => CONFIG_PATH);

  ipcMain.handle("state:get", async (_evt, key: string) => {
    const state = await readDesktopState();
    return state[key] ?? null;
  });

  ipcMain.handle("state:set", async (_evt, key: string, value: unknown) => {
    const state = await readDesktopState();
    if (value === null || value === undefined) delete state[key];
    else state[key] = value;
    await writeDesktopState(state);
    return true;
  });
}
