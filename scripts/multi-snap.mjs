import { chromium } from "playwright-core";
import { execFile as _execFile } from "node:child_process";
import { promisify } from "node:util";
const execFile = promisify(_execFile);
const browser = await chromium.connectOverCDP("http://localhost:9223");
const main = (() => {
  for (const ctx of browser.contexts())
    for (const page of ctx.pages())
      if (((c) => c)(page).url().includes("localhost:5173") || page.url().endsWith("/")) return page;
  return null;
})();
// find main
let target = null;
for (const ctx of browser.contexts())
  for (const page of ctx.pages())
    if ((await page.title()) === "Codex") target = page;
if (!target) throw new Error("no main");

// open a few sessions as tabs
await target.evaluate(() => {
  const t = window.__ui;
  t.setState({ sidebarCollapsed: false, reviewVisible: true, activeSessionId: null });
});
const tabsResult = await target.evaluate(() => {
  // open 3 tabs to show tab bar
  const store = window.__ui;
  void store;
  // tabs store is exported as zustand instance — access via the bridge
  return true;
});
void tabsResult;

// 1) full width
await target.setViewportSize({ width: 1280, height: 800 });
await target.waitForTimeout(300);
await target.screenshot({ path: "screenshots/auto/wide.png" });
await execFile("sips", ["-Z", "1600", "screenshots/auto/wide.png"]);
console.log("✓ wide");

// 2) narrow
await target.setViewportSize({ width: 760, height: 800 });
await target.waitForTimeout(300);
await target.screenshot({ path: "screenshots/auto/narrow.png" });
await execFile("sips", ["-Z", "1600", "screenshots/auto/narrow.png"]);
console.log("✓ narrow");

await browser.close();
