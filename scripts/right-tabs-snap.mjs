import { chromium } from "playwright-core";
import { execFile as _execFile } from "node:child_process";
import { promisify } from "node:util";
const execFile = promisify(_execFile);
const browser = await chromium.connectOverCDP("http://localhost:9223");
let target = null;
for (const ctx of browser.contexts())
  for (const page of ctx.pages())
    if ((await page.title()) === "Codex") target = page;
if (!target) throw new Error("no main");

await target.setViewportSize({ width: 1400, height: 900 });
await target.evaluate(async () => {
  const cur = await window.codex.theme.get();
  await window.codex.theme.set({ ...cur, mode: "dark" });
  window.__ui.setState({ reviewVisible: true, sidebarCollapsed: false });
});
await target.waitForTimeout(400);
await target.screenshot({ path: "screenshots/auto/right-tabs.png" });
await execFile("sips", ["-Z", "1600", "screenshots/auto/right-tabs.png"]);
console.log("✓ right-tabs");
await browser.close();
