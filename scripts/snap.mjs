#!/usr/bin/env node
/**
 * Visual-snapshot tool for the design-matching loop.
 *
 * Attaches to the running Electron dev app via Chrome DevTools Protocol
 * (port 9223), iterates through a list of UI "scenes", flips the ui store
 * to the right state, and saves a PNG per scene to screenshots/auto/.
 *
 * Usage:
 *   pnpm dev   # in a terminal — leaves Electron running with CDP on :9223
 *   pnpm snap  # in another terminal — captures all scenes
 *
 * Then read screenshots/auto/*.png and compare with the references.
 */

import { chromium } from "playwright-core";
import { mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { execFile as _execFile } from "node:child_process";
import { promisify } from "node:util";
const execFile = promisify(_execFile);

const CDP_URL = "http://localhost:9223";
const OUT_DIR = resolve(process.cwd(), "screenshots/auto");

/**
 * Each scene names the target window, sets ui-store state if needed,
 * waits for layout, then snapshots.
 *
 * `windowTitle` matches Electron's BrowserWindow title:
 *   - main_window  → "Codex"
 *   - settings     → "设置"
 */
const SCENES = [
  {
    // 首页折叠.png is the welcome state — no active session, no review pane.
    name: "01-chat-welcome",
    windowTitle: "Codex",
    setup: () => window.__ui.setState({
      view: "chat",
      reviewVisible: false,
      paletteOpen: false,
      activeSessionId: null,
    }),
  },
  {
    // 首页右侧文件修改展开.png is the conversation+review state.
    name: "02-chat-with-review",
    windowTitle: "Codex",
    setup: () => window.__ui.setState({
      view: "chat",
      reviewVisible: true,
      paletteOpen: false,
      activeSessionId: "readme-thread",
    }),
  },
  {
    name: "03-plugins",
    windowTitle: "Codex",
    setup: () => window.__ui.setState({ view: "plugins", paletteOpen: false }),
  },
  {
    name: "04-automation",
    windowTitle: "Codex",
    setup: () => window.__ui.setState({ view: "automation", paletteOpen: false }),
  },
  {
    name: "05-command-palette",
    windowTitle: "Codex",
    setup: () => window.__ui.setState({
      view: "plugins", // reference shows palette over plugins
      paletteOpen: true,
      activeSessionId: null,
    }),
  },
  // Settings window — must be open already; the snap script will open it
  // automatically (see ensureSettingsOpen below).
  { name: "11-settings-appearance",      windowTitle: "设置", section: "appearance" },
  { name: "12-settings-config",          windowTitle: "设置", section: "config" },
  { name: "13-settings-personalization", windowTitle: "设置", section: "personalization" },
  { name: "14-settings-mcp",             windowTitle: "设置", section: "mcp" },
  { name: "15-settings-hooks",           windowTitle: "设置", section: "hooks" },
  { name: "19-settings-worktrees",       windowTitle: "设置", section: "worktrees" },
  { name: "20-settings-browser",         windowTitle: "设置", section: "browser" },
  { name: "22-settings-archived",        windowTitle: "设置", section: "archived" },
];

async function findPage(browser, title) {
  for (const ctx of browser.contexts()) {
    for (const page of ctx.pages()) {
      try {
        const t = await page.title();
        if (t === title || t.includes(title)) return page;
      } catch {
        /* ignore closed pages */
      }
    }
  }
  return null;
}

async function ensureSettingsOpen(browser) {
  if (await findPage(browser, "设置")) return;
  const main = await findPage(browser, "Codex");
  if (!main) throw new Error("main window not found; is the dev app running?");
  console.log("→ opening settings window via IPC");
  await main.evaluate(() => window.codex?.window?.openSettings());
  // wait for the new window to appear
  for (let i = 0; i < 30; i++) {
    if (await findPage(browser, "设置")) return;
    await new Promise((r) => setTimeout(r, 200));
  }
  throw new Error("settings window did not appear");
}

async function snapshot(page, scene) {
  if (scene.setup) {
    await page.evaluate(scene.setup);
  }
  if (scene.section) {
    // Settings window: click the matching sidebar nav button
    await page.evaluate((id) => {
      // Match a SectionId by walking the sidebar nav buttons; works because
      // SettingsSidebar renders one <button> per item in order.
      const order = [
        "config","appearance","personalization","mcp","hooks","worktrees",
        "browser","archived",
      ];
      const idx = order.indexOf(id);
      if (idx < 0) return;
      const buttons = document.querySelectorAll("aside nav button");
      const target = buttons[idx];
      if (target instanceof HTMLElement) target.click();
    }, scene.section);
  }
  // Let layout settle (popovers/animations/etc.)
  await page.waitForTimeout(250);

  const outFile = resolve(OUT_DIR, `${scene.name}.png`);
  await page.screenshot({ path: outFile, fullPage: false });

  // Retina screenshots are 2x — clamp longest edge to 1600 so Read can
  // ingest them (>2000 trips the API multi-image guard).
  try {
    await execFile("sips", ["-Z", "1600", outFile], { stdio: "ignore" });
  } catch {
    /* sips is macOS-only; skip silently elsewhere */
  }

  return outFile;
}

async function main() {
  if (!existsSync(OUT_DIR)) await mkdir(OUT_DIR, { recursive: true });

  let browser;
  try {
    browser = await chromium.connectOverCDP(CDP_URL);
  } catch (err) {
    console.error(`✘ Could not connect to ${CDP_URL}. Is the dev app running?`);
    console.error(`  Tip: in the dev terminal, type "rs" to restart the main`);
    console.error(`  process after the latest main/index.ts change which enables`);
    console.error(`  --remote-debugging-port=9223.`);
    console.error(`  Underlying error: ${err.message}`);
    process.exit(1);
  }

  // Ensure both windows exist
  const main = await findPage(browser, "Codex");
  if (!main) {
    console.error("✘ Main window not found among CDP pages.");
    process.exit(1);
  }

  // Use whichever theme mode the user has stored; the loop is now
  // expected to address contrast in *both* light and dark modes.
  await main.waitForTimeout(200);

  if (SCENES.some((s) => s.windowTitle === "设置")) {
    await ensureSettingsOpen(browser);
  }

  const results = [];
  for (const scene of SCENES) {
    const page = await findPage(browser, scene.windowTitle);
    if (!page) {
      console.warn(`✘ ${scene.name}: window "${scene.windowTitle}" not found, skipping`);
      continue;
    }
    try {
      // Reset palette to avoid leaking open state between scenes
      if (scene.windowTitle === "Codex") {
        await page.evaluate(() =>
          window.__ui?.setState?.({ paletteOpen: false }),
        );
      }
      const file = await snapshot(page, scene);
      console.log(`✓ ${scene.name}  →  ${file.replace(process.cwd() + "/", "")}`);
      results.push({ scene: scene.name, file });
    } catch (err) {
      console.error(`✘ ${scene.name}: ${err.message}`);
    }
  }

  console.log(`\nCaptured ${results.length}/${SCENES.length} scenes into screenshots/auto/`);
  await browser.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
