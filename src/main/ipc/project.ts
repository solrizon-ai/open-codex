import { dialog, ipcMain } from "electron";
import { execFile } from "node:child_process";
import path from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

export interface ProjectInfo {
  cwd: string;
  name: string;
  branch: string | null;
  branches: string[];
}

let currentCwd = process.env.CODEX_PROJECT_CWD || process.cwd();

function projectName(cwd: string): string {
  return path.basename(cwd) || cwd;
}

async function git(args: string[], cwd: string): Promise<string | null> {
  try {
    const { stdout } = await execFileAsync("git", ["-C", cwd, ...args], {
      timeout: 2500,
      windowsHide: true,
    });
    return stdout.trim();
  } catch {
    return null;
  }
}

async function readProjectInfo(cwd = currentCwd): Promise<ProjectInfo> {
  const [branch, branchOutput] = await Promise.all([
    git(["branch", "--show-current"], cwd),
    git(["branch", "--format=%(refname:short)"], cwd),
  ]);

  const branches = (branchOutput ?? "")
    .split("\n")
    .map((b) => b.trim())
    .filter(Boolean);

  return {
    cwd,
    name: projectName(cwd),
    branch: branch || null,
    branches,
  };
}

export function registerProjectIpc(): void {
  ipcMain.handle("project:current", async () => readProjectInfo());

  ipcMain.handle("project:set-current", async (_event, cwd: string) => {
    if (typeof cwd !== "string" || cwd.trim().length === 0) return null;
    currentCwd = path.resolve(cwd);
    return readProjectInfo(currentCwd);
  });

  ipcMain.handle("project:choose-folder", async () => {
    const result = await dialog.showOpenDialog({
      title: "打开项目",
      defaultPath: currentCwd,
      properties: ["openDirectory", "createDirectory"],
    });
    if (result.canceled || result.filePaths.length === 0) {
      return null;
    }

    currentCwd = result.filePaths[0]!;
    return readProjectInfo(currentCwd);
  });

  // Like choose-folder, but does not mutate the main-process "current
  // project" state. Used by Settings when the user just wants to browse
  // for a path (e.g. to add an environment) without switching projects.
  ipcMain.handle("project:browse-folder", async () => {
    const result = await dialog.showOpenDialog({
      title: "选择文件夹",
      defaultPath: currentCwd,
      properties: ["openDirectory", "createDirectory"],
    });
    if (result.canceled || result.filePaths.length === 0) return null;
    return readProjectInfo(result.filePaths[0]!);
  });

  // Clear the current project — used by ProjectPopover's "不使用项目".
  ipcMain.handle("project:clear", () => {
    currentCwd = process.env.HOME || process.cwd();
    return readProjectInfo(currentCwd);
  });
}
