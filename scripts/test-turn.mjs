import { chromium } from "playwright-core";
const browser = await chromium.connectOverCDP("http://localhost:9223");
for (const ctx of browser.contexts()) {
  for (const page of ctx.pages()) {
    const title = await page.title().catch(() => "");
    if (title !== "Codex") continue;
    // wait for store to be ready
    await page.waitForFunction(() => !!window.codex && !!window.__ui, { timeout: 10000 });
    // ensure connected
    const status = await page.evaluate(async () => {
      try {
        await window.codex.codex.start();
        const info = await window.codex.codex.initialize({ clientInfo: { name: "codex-app", version: "0.0.1" } });
        return { ok: true, info };
      } catch (e) { return { ok: false, err: String(e) }; }
    });
    console.log("init:", JSON.stringify(status).slice(0, 200));
    // start a thread + send a turn
    const out = await page.evaluate(async () => {
      const res = await window.codex.codex.request("thread/start", { cwd: "/Users/cat/Downloads/codex-reverse" });
      return res;
    });
    console.log("thread/start →", JSON.stringify(out).slice(0, 200));
    await page.screenshot({ path: "screenshots/auto/real-codex.png" });
    break;
  }
}
await browser.close();
