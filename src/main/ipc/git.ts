import { ipcMain, shell } from "electron";
import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { resolveCodexBin } from "../codex/spawn";

const execFileAsync = promisify(execFile);

/**
 * Thin wrapper around the `git` CLI for the renderer's GitMenu / BranchPopover.
 *
 * Each handler shells out to `git -C <cwd> ...` with a short timeout so a
 * misbehaving repo can't wedge the UI. Errors are surfaced as rejected
 * promises so the renderer can show a toast/dialog.
 */

type GitArgs = ReadonlyArray<string>;

interface GitOptions {
  /** Treat exit code 1 as success (e.g. `git diff --quiet` returns 1 when dirty). */
  allowNonZero?: boolean;
  /** Override the default 5s timeout for slow operations like `push`. */
  timeoutMs?: number;
}

async function git(
  cwd: string,
  args: GitArgs,
  options: GitOptions = {},
): Promise<{ stdout: string; stderr: string; code: number }> {
  if (!cwd) throw new Error("git: missing cwd");
  try {
    const { stdout, stderr } = await execFileAsync(
      "git",
      ["-C", cwd, ...args],
      {
        timeout: options.timeoutMs ?? 5000,
        windowsHide: true,
        maxBuffer: 16 * 1024 * 1024,
      },
    );
    return { stdout, stderr, code: 0 };
  } catch (err) {
    const e = err as NodeJS.ErrnoException & {
      stdout?: string;
      stderr?: string;
      code?: number;
    };
    const code = typeof e.code === "number" ? e.code : 1;
    if (options.allowNonZero) {
      return { stdout: e.stdout ?? "", stderr: e.stderr ?? "", code };
    }
    const message =
      (e.stderr && String(e.stderr).trim()) ||
      e.message ||
      "git command failed";
    throw new Error(message);
  }
}

export interface GitFileEntry {
  path: string;
  /** ' ', 'M', 'A', 'D', 'R', '?' — index column from `git status --porcelain=v1`. */
  index: string;
  /** worktree column from `git status --porcelain=v1`. */
  worktree: string;
  /** Old path when status code is 'R' (rename). */
  oldPath?: string;
}

export interface GitStatus {
  branch: string | null;
  upstream: string | null;
  ahead: number;
  behind: number;
  files: GitFileEntry[];
  clean: boolean;
}

function parsePorcelainStatus(stdout: string): {
  branchLine: string;
  files: GitFileEntry[];
} {
  const lines = stdout.split("\n").filter(Boolean);
  let branchLine = "";
  const files: GitFileEntry[] = [];
  for (const line of lines) {
    if (line.startsWith("## ")) {
      branchLine = line.slice(3);
      continue;
    }
    if (line.length < 3) continue;
    const index = line[0] ?? " ";
    const worktree = line[1] ?? " ";
    const rest = line.slice(3);
    if (index === "R" || worktree === "R") {
      const [oldPath, newPath] = rest.split(" -> ");
      if (newPath) {
        files.push({ path: newPath, index, worktree, oldPath });
        continue;
      }
    }
    files.push({ path: rest, index, worktree });
  }
  return { branchLine, files };
}

function parseBranchLine(line: string): {
  branch: string | null;
  upstream: string | null;
  ahead: number;
  behind: number;
} {
  if (!line) return { branch: null, upstream: null, ahead: 0, behind: 0 };
  // Examples:
  //   "main"
  //   "main...origin/main"
  //   "main...origin/main [ahead 2, behind 1]"
  //   "No commits yet on main"
  let branch: string | null = null;
  let upstream: string | null = null;
  let ahead = 0;
  let behind = 0;
  const noCommits = /^No commits yet on (.+)$/.exec(line);
  if (noCommits) {
    return { branch: noCommits[1] ?? null, upstream: null, ahead: 0, behind: 0 };
  }
  const tracking = /^(.+?)\.\.\.(\S+)(?:\s+\[(.+)\])?$/.exec(line);
  if (tracking) {
    branch = tracking[1] ?? null;
    upstream = tracking[2] ?? null;
    const bracket = tracking[3] ?? "";
    for (const part of bracket.split(",")) {
      const [name, valueStr] = part.trim().split(" ");
      const value = Number(valueStr);
      if (name === "ahead" && Number.isFinite(value)) ahead = value;
      if (name === "behind" && Number.isFinite(value)) behind = value;
    }
  } else {
    branch = line.trim() || null;
  }
  return { branch, upstream, ahead, behind };
}

async function readStatus(cwd: string): Promise<GitStatus> {
  const { stdout } = await git(cwd, [
    "status",
    "--porcelain=v1",
    "--branch",
    "--untracked-files=all",
  ]);
  const { branchLine, files } = parsePorcelainStatus(stdout);
  const branchInfo = parseBranchLine(branchLine);
  return {
    ...branchInfo,
    files,
    clean: files.length === 0,
  };
}

async function readDiff(
  cwd: string,
  options: { path?: string; staged?: boolean; includeUntracked?: boolean },
): Promise<string> {
  const args = ["diff", "--no-color", "--unified=3"];
  if (options.staged) args.push("--cached");
  if (options.path) args.push("--", options.path);
  const { stdout } = await git(cwd, args, { allowNonZero: true });
  if (options.includeUntracked && !options.staged && !options.path) {
    // Untracked files do not appear in plain `git diff`. Show them as
    // additions so the review pane can render them next to modifications.
    const { stdout: untrackedList } = await git(
      cwd,
      ["ls-files", "--others", "--exclude-standard"],
      { allowNonZero: true },
    );
    const untracked = untrackedList.split("\n").filter(Boolean);
    let extra = "";
    for (const file of untracked) {
      const { stdout: blob } = await git(
        cwd,
        ["diff", "--no-color", "--no-index", "--unified=3", "/dev/null", file],
        { allowNonZero: true },
      );
      extra += blob;
    }
    return stdout + extra;
  }
  return stdout;
}

export interface ChangedFile {
  path: string;
  status: "added" | "deleted" | "modified" | "renamed";
  staged: boolean;
  added: number;
  removed: number;
  diff: string;
}

async function listChanges(cwd: string): Promise<ChangedFile[]> {
  const status = await readStatus(cwd);
  const out: ChangedFile[] = [];
  for (const f of status.files) {
    const isStaged = f.index !== " " && f.index !== "?";
    const isWorktreeChange = f.worktree !== " ";
    const isUntracked = f.index === "?" && f.worktree === "?";
    const code = isStaged ? f.index : f.worktree;

    let mappedStatus: ChangedFile["status"];
    if (code === "A" || isUntracked) mappedStatus = "added";
    else if (code === "D") mappedStatus = "deleted";
    else if (code === "R") mappedStatus = "renamed";
    else mappedStatus = "modified";

    let diff = "";
    if (isUntracked) {
      const { stdout } = await git(
        cwd,
        [
          "diff",
          "--no-color",
          "--no-index",
          "--unified=3",
          "/dev/null",
          f.path,
        ],
        { allowNonZero: true },
      );
      diff = stdout;
    } else if (isWorktreeChange) {
      diff = await readDiff(cwd, { path: f.path });
    } else if (isStaged) {
      diff = await readDiff(cwd, { path: f.path, staged: true });
    }

    let added = 0;
    let removed = 0;
    for (const line of diff.split("\n")) {
      if (line.startsWith("+") && !line.startsWith("+++")) added++;
      if (line.startsWith("-") && !line.startsWith("---")) removed++;
    }
    out.push({
      path: f.path,
      status: mappedStatus,
      staged: isStaged && !isWorktreeChange,
      added,
      removed,
      diff,
    });
  }
  return out;
}

async function listBranches(
  cwd: string,
): Promise<{ branches: string[]; current: string | null }> {
  const { stdout: cur } = await git(cwd, ["branch", "--show-current"], {
    allowNonZero: true,
  });
  const { stdout: all } = await git(
    cwd,
    ["branch", "--format=%(refname:short)"],
    { allowNonZero: true },
  );
  return {
    current: cur.trim() || null,
    branches: all
      .split("\n")
      .map((b) => b.trim())
      .filter(Boolean),
  };
}

function parseGithubRemote(raw: string): { owner: string; repo: string } | null {
  const trimmed = raw.trim().replace(/\.git$/, "");
  const https = /^https:\/\/github\.com\/([^/\s]+)\/([^/\s]+)$/.exec(trimmed);
  if (https?.[1] && https[2]) {
    return { owner: https[1], repo: https[2] };
  }
  const ssh = /^git@github\.com:([^/\s]+)\/([^/\s]+)$/.exec(trimmed);
  if (ssh?.[1] && ssh[2]) {
    return { owner: ssh[1], repo: ssh[2] };
  }
  const sshUrl = /^ssh:\/\/git@github\.com\/([^/\s]+)\/([^/\s]+)$/.exec(trimmed);
  if (sshUrl?.[1] && sshUrl[2]) {
    return { owner: sshUrl[1], repo: sshUrl[2] };
  }
  return null;
}

async function openPullRequest(cwd: string): Promise<true> {
  const status = await readStatus(cwd);
  const branch = status.branch;
  if (!branch) throw new Error("当前仓库没有活动分支");

  const { stdout: remote } = await git(cwd, ["remote", "get-url", "origin"], {
    allowNonZero: true,
  });
  const parsed = parseGithubRemote(remote);
  if (!parsed) throw new Error("没有找到 GitHub origin remote");

  const upstreamBranch = status.upstream?.replace(/^origin\//, "");
  const base = upstreamBranch && upstreamBranch !== branch ? upstreamBranch : "main";
  const compare = `${encodeURIComponent(base)}...${encodeURIComponent(branch)}`;
  await shell.openExternal(
    `https://github.com/${parsed.owner}/${parsed.repo}/compare/${compare}?expand=1`,
  );
  return true;
}

function fallbackCommitMessage(changes: ChangedFile[]): string {
  if (changes.length === 0) return "chore: update workspace";
  if (changes.length === 1) {
    const only = changes[0];
    if (!only) return "chore: update workspace";
    const subject =
      only.status === "added"
        ? "add"
        : only.status === "deleted"
          ? "remove"
          : "update";
    return `${subject}: ${only.path}`;
  }
  const dominant = changes.reduce<Record<ChangedFile["status"], number>>(
    (acc, change) => {
      acc[change.status] += 1;
      return acc;
    },
    { added: 0, deleted: 0, modified: 0, renamed: 0 },
  );
  const action =
    dominant.added > dominant.modified
      ? "add"
      : dominant.deleted > dominant.modified
        ? "remove"
        : "update";
  return `${action}: ${changes.length} files`;
}

function cleanCommitMessage(raw: string, fallback: string): string {
  const first = raw
    .split("\n")
    .map((line) => line.trim())
    .find(Boolean);
  if (!first) return fallback;
  const cleaned = first
    .replace(/^```(?:text)?/i, "")
    .replace(/^[-*]\s+/, "")
    .replace(/^git commit -m\s+/i, "")
    .replace(/^["'`]+|["'`]+$/g, "")
    .trim();
  if (!cleaned) return fallback;
  return cleaned.length > 96 ? cleaned.slice(0, 93).trimEnd() + "..." : cleaned;
}

async function suggestCommitMessage(cwd: string): Promise<string> {
  const changes = await listChanges(cwd);
  const fallback = fallbackCommitMessage(changes);
  if (changes.length === 0) return fallback;

  const diff = await readDiff(cwd, { includeUntracked: true });
  const cappedDiff =
    diff.length > 18000
      ? `${diff.slice(0, 18000)}\n\n[diff truncated for commit-message generation]`
      : diff;
  const prompt = [
    "Generate one concise Git commit subject for the following diff.",
    "Rules:",
    "- Output exactly one line.",
    "- Use imperative mood.",
    "- Prefer Conventional Commits when obvious, otherwise plain imperative is fine.",
    "- No markdown, no quotes, no explanation.",
    "- Keep it under 72 characters if possible.",
    "",
    "Diff:",
    cappedDiff,
  ].join("\n");

  const bin = resolveCodexBin();
  if (!bin) return fallback;

  const dir = await mkdtemp(join(tmpdir(), "codex-commit-"));
  const outputPath = join(dir, "message.txt");
  try {
    const { stdout } = await execFileAsync(
      bin,
      [
        "exec",
        "--ephemeral",
        "--color",
        "never",
        "--sandbox",
        "read-only",
        "-C",
        cwd,
        "-o",
        outputPath,
        prompt,
      ],
      {
        timeout: 90000,
        windowsHide: true,
        maxBuffer: 4 * 1024 * 1024,
      },
    );
    const generated = await readFile(outputPath, "utf8").catch(() => stdout);
    return cleanCommitMessage(generated || stdout, fallback);
  } catch {
    return fallback;
  } finally {
    await rm(dir, { recursive: true, force: true }).catch(() => undefined);
  }
}

export function registerGitIpc(): void {
  ipcMain.handle("git:status", async (_evt, cwd: string) => readStatus(cwd));

  ipcMain.handle("git:changes", async (_evt, cwd: string) =>
    listChanges(cwd),
  );

  ipcMain.handle(
    "git:diff",
    async (
      _evt,
      cwd: string,
      options: { path?: string; staged?: boolean; includeUntracked?: boolean } = {},
    ) => readDiff(cwd, options),
  );

  ipcMain.handle("git:branches", async (_evt, cwd: string) =>
    listBranches(cwd),
  );

  ipcMain.handle(
    "git:checkout",
    async (
      _evt,
      cwd: string,
      branch: string,
      options: { create?: boolean } = {},
    ) => {
      const args = ["checkout"];
      if (options.create) args.push("-b");
      args.push(branch);
      await git(cwd, args, { timeoutMs: 15000 });
      return true;
    },
  );

  ipcMain.handle(
    "git:stage",
    async (_evt, cwd: string, paths: string[]) => {
      if (!paths.length) return true;
      await git(cwd, ["add", "--", ...paths]);
      return true;
    },
  );

  ipcMain.handle(
    "git:unstage",
    async (_evt, cwd: string, paths: string[]) => {
      if (!paths.length) return true;
      await git(cwd, ["restore", "--staged", "--", ...paths]);
      return true;
    },
  );

  ipcMain.handle(
    "git:discard",
    async (_evt, cwd: string, paths: string[]) => {
      if (!paths.length) return true;
      // Discard worktree changes; for untracked files we have to rm.
      await git(cwd, ["restore", "--worktree", "--", ...paths], {
        allowNonZero: true,
      });
      return true;
    },
  );

  ipcMain.handle(
    "git:commit",
    async (
      _evt,
      cwd: string,
      message: string,
      options: { stageAll?: boolean } = {},
    ) => {
      if (!message.trim()) throw new Error("commit message is empty");
      if (options.stageAll) await git(cwd, ["add", "-A"]);
      const { stdout } = await git(cwd, [
        "commit",
        "-m",
        message,
      ]);
      return stdout.trim();
    },
  );

  ipcMain.handle("git:suggest-commit-message", async (_evt, cwd: string) =>
    suggestCommitMessage(cwd),
  );

  ipcMain.handle(
    "git:push",
    async (
      _evt,
      cwd: string,
      options: { remote?: string; branch?: string; force?: boolean } = {},
    ) => {
      const args = ["push"];
      if (options.force) args.push("--force-with-lease");
      if (options.remote) args.push(options.remote);
      if (options.branch) args.push(options.branch);
      const { stdout, stderr } = await git(cwd, args, { timeoutMs: 60000 });
      return (stdout || stderr).trim();
    },
  );

  ipcMain.handle(
    "git:fetch",
    async (_evt, cwd: string, remote: string | undefined) => {
      const args = ["fetch"];
      if (remote) args.push(remote);
      await git(cwd, args, { timeoutMs: 60000 });
      return true;
    },
  );

  ipcMain.handle("git:worktree-list", async (_evt, cwd: string) => {
    const { stdout } = await git(cwd, ["worktree", "list", "--porcelain"], {
      allowNonZero: true,
    });
    return parseWorktreeList(stdout);
  });

  ipcMain.handle(
    "git:worktree-add",
    async (_evt, cwd: string, targetPath: string, branch: string | undefined) => {
      const args = ["worktree", "add"];
      if (branch) args.push(targetPath, branch);
      else args.push(targetPath);
      await git(cwd, args, { timeoutMs: 30000 });
      return true;
    },
  );

  ipcMain.handle(
    "git:worktree-remove",
    async (
      _evt,
      cwd: string,
      targetPath: string,
      options: { force?: boolean } = {},
    ) => {
      const args = ["worktree", "remove"];
      if (options.force) args.push("--force");
      args.push(targetPath);
      await git(cwd, args, { timeoutMs: 15000 });
      return true;
    },
  );

  ipcMain.handle("git:open-pull-request", async (_evt, cwd: string) =>
    openPullRequest(cwd),
  );
}

export interface WorktreeEntry {
  path: string;
  branch: string | null;
  head: string | null;
  bare: boolean;
  detached: boolean;
  locked: boolean;
}

function parseWorktreeList(stdout: string): WorktreeEntry[] {
  const entries: WorktreeEntry[] = [];
  let current: Partial<WorktreeEntry> | null = null;
  for (const raw of stdout.split("\n")) {
    if (!raw) {
      if (current?.path) entries.push(finalizeWorktree(current));
      current = null;
      continue;
    }
    const [key, ...rest] = raw.split(" ");
    const value = rest.join(" ");
    if (key === "worktree") {
      current = { path: value };
    } else if (current) {
      if (key === "HEAD") current.head = value;
      else if (key === "branch") current.branch = value.replace(/^refs\/heads\//, "");
      else if (key === "bare") current.bare = true;
      else if (key === "detached") current.detached = true;
      else if (key === "locked") current.locked = true;
    }
  }
  if (current?.path) entries.push(finalizeWorktree(current));
  return entries;
}

function finalizeWorktree(partial: Partial<WorktreeEntry>): WorktreeEntry {
  return {
    path: partial.path ?? "",
    branch: partial.branch ?? null,
    head: partial.head ?? null,
    bare: partial.bare ?? false,
    detached: partial.detached ?? false,
    locked: partial.locked ?? false,
  };
}
