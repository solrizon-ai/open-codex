import { registerBrowserIpc } from "./browser";
import { registerClaudeIpc } from "./claude";
import { registerCodexIpc } from "./codex";
import { registerConfigIpc } from "./config";
import { registerFileIpc } from "./file";
import { registerGitIpc } from "./git";
import { registerProjectIpc } from "./project";
import { registerSearchIpc } from "./search";
import { registerSystemIpc } from "./system";
import { registerTerminalIpc } from "./terminal";
import { registerThemeIpc } from "./theme";
import { registerWindowIpc } from "./window";

export function registerAllIpc(): void {
  registerBrowserIpc();
  registerClaudeIpc();
  registerCodexIpc();
  registerConfigIpc();
  registerFileIpc();
  registerGitIpc();
  registerProjectIpc();
  registerSearchIpc();
  registerSystemIpc();
  registerTerminalIpc();
  registerThemeIpc();
  registerWindowIpc();
}
