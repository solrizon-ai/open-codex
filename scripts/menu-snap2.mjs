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
await target.evaluate(async () => {
  const cur = await window.codex.theme.get();
  await window.codex.theme.set({ ...cur, mode: "dark" });
});
await target.waitForTimeout(300);
// Open tab + activate
await target.evaluate(() => {
  const ts = (window).__ts ?? null;
  void ts;
  // simulate by clicking first session row in sidebar
  const rows = Array.from(document.querySelectorAll("aside button"))
    .filter((b) => b.textContent && b.textContent.length > 6 && b.textContent.length < 40);
  if (rows[0]) rows[0].click();
});
await target.waitForTimeout(300);
// Open the conversation title dropdown by clicking the chevron in header
try {
  await target.click('header button:has-text("更新 README")', { timeout: 2000 });
} catch (e) {
  console.log("title click failed:", e.message);
}
await target.waitForTimeout(500);
await target.screenshot({ path: "screenshots/auto/dark-menu2.png" });
await execFile("sips", ["-Z", "1600", "screenshots/auto/dark-menu2.png"]);
console.log("✓ dark-menu2");
await browser.close();
