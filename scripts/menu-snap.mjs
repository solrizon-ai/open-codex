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
// Make sure dark mode
await target.evaluate(async () => {
  const cur = await window.codex.theme.get();
  await window.codex.theme.set({ ...cur, mode: "dark" });
});
await target.waitForTimeout(400);
// open a tab to activate the conversation header dropdown trigger
await target.evaluate(() => {
  // pick the first project session row and click
  const rows = Array.from(document.querySelectorAll("aside button"))
    .filter((b) => b.textContent && b.textContent.length > 6 && b.textContent.length < 40);
  if (rows[0]) rows[0].click();
});
await target.waitForTimeout(300);
// click the conversation title chevron in ChatHeader to open the dropdown
await target.evaluate(() => {
  const titleBtn = Array.from(document.querySelectorAll("header button"))
    .find((b) => b.textContent && b.textContent.includes("更新 README"));
  if (titleBtn) titleBtn.click();
});
await target.waitForTimeout(400);
await target.screenshot({ path: "screenshots/auto/dark-menu.png" });
await execFile("sips", ["-Z", "1600", "screenshots/auto/dark-menu.png"]);
console.log("✓ dark-menu");
await browser.close();
