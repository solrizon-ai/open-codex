import { clipboard, ipcMain, shell } from "electron";
import { readFile } from "node:fs/promises";
import { extname } from "node:path";

const IMAGE_MIME_BY_EXT: Record<string, string> = {
  ".avif": "image/avif",
  ".gif": "image/gif",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".webp": "image/webp",
};

export function registerFileIpc(): void {
  ipcMain.handle("file:open", async (_evt, target: string) => {
    // openPath handles local paths; URLs go through openExternal so they
    // launch the default browser/handler. This lets renderer code treat
    // both uniformly when wiring "open" actions.
    if (/^https?:\/\//.test(target) || target.startsWith("mailto:")) {
      await shell.openExternal(target);
      return true;
    }
    const error = await shell.openPath(target);
    if (error) throw new Error(error);
    return true;
  });

  ipcMain.handle("file:show-in-folder", (_evt, path: string) => {
    shell.showItemInFolder(path);
    return true;
  });

  ipcMain.handle("file:copy-path", (_evt, path: string) => {
    clipboard.writeText(path);
    return true;
  });

  ipcMain.handle("file:read-image-data-url", async (_evt, path: string) => {
    const ext = extname(path).toLowerCase();
    const mime = IMAGE_MIME_BY_EXT[ext];
    if (!mime) throw new Error(`Unsupported image type: ${ext || path}`);
    const bytes = await readFile(path);
    return `data:${mime};base64,${bytes.toString("base64")}`;
  });
}
