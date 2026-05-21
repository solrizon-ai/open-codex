import { chromium } from "playwright-core";
const browser = await chromium.connectOverCDP("http://localhost:9223");
for (const ctx of browser.contexts()) {
  for (const page of ctx.pages()) {
    const title = await page.title().catch(() => "");
    if (title === "Codex") {
      await page.evaluate(async () => {
        const cur = await window.codex.theme.get();
        await window.codex.theme.set({ ...cur, mode: "dark" });
        window.__ui.setState({ view: "chat", reviewVisible: false, activeSessionId: null, sidebarCollapsed: false });
      });
      await page.waitForTimeout(400);
      await page.screenshot({ path: "screenshots/auto/dark-welcome.png" });
      console.log("✓ dark welcome");
      break;
    }
  }
}
await browser.close();
