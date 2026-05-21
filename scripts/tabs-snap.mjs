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

await target.setViewportSize({ width: 1280, height: 800 });
await target.evaluate(() => {
  const rows = Array.from(document.querySelectorAll("aside button"))
    .filter((b) => b.textContent && b.textContent.length > 6 && b.textContent.length < 40)
    .slice(0, 5);
  rows.forEach((r, i) => { if (i < 3) r.click(); });
});
await target.waitForTimeout(400);
await target.screenshot({ path: "screenshots/auto/tabs.png" });
await execFile("sips", ["-Z", "1600", "screenshots/auto/tabs.png"]);
console.log("✓ tabs");
await browser.close();
