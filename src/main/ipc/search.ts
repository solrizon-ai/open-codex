import { ipcMain } from "electron";
import { execFile, spawn } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

/**
 * Workspace search.
 *
 * - `search:files` uses `git ls-files` to enumerate tracked files and
 *   does a substring filter (case-insensitive) on the relative path.
 *   Cheap and reliable in any git repo.
 * - `search:text` shells out to `git grep -n -i -I --max-count=5`.
 *   `-I` skips binary blobs; `--max-count=5` keeps the result set small
 *   so we don't blow renderer memory on large repos.
 */

const MAX_FILE_RESULTS = 200;
const MAX_TEXT_RESULTS = 200;

export interface FileMatch {
  path: string;
  score: number;
}

export interface TextMatch {
  path: string;
  line: number;
  text: string;
}

function fuzzyScore(query: string, target: string): number {
  // Tiny "subsequence + adjacency" score: higher is better. We use the
  // basename for an initial big bonus, then fall through to substring
  // position.
  const q = query.toLowerCase();
  const t = target.toLowerCase();
  if (!q) return 1;
  const pos = t.indexOf(q);
  if (pos === -1) return -1;
  const slash = t.lastIndexOf("/");
  const inBasename = pos > slash;
  return 1000 - pos + (inBasename ? 500 : 0);
}

export function registerSearchIpc(): void {
  ipcMain.handle(
    "search:files",
    async (_evt, cwd: string, query: string): Promise<FileMatch[]> => {
      if (!cwd) return [];
      try {
        const { stdout } = await execFileAsync(
          "git",
          ["-C", cwd, "ls-files"],
          { timeout: 5000, maxBuffer: 32 * 1024 * 1024, windowsHide: true },
        );
        const files = stdout.split("\n").filter(Boolean);
        const q = query.trim();
        if (!q) return files.slice(0, MAX_FILE_RESULTS).map((path) => ({ path, score: 1 }));
        const scored: FileMatch[] = [];
        for (const path of files) {
          const score = fuzzyScore(q, path);
          if (score > 0) scored.push({ path, score });
          if (scored.length > MAX_FILE_RESULTS * 4) break;
        }
        scored.sort((a, b) => b.score - a.score);
        return scored.slice(0, MAX_FILE_RESULTS);
      } catch {
        return [];
      }
    },
  );

  ipcMain.handle(
    "search:text",
    async (_evt, cwd: string, query: string): Promise<TextMatch[]> => {
      if (!cwd || !query.trim()) return [];
      // Use spawn so a quoted/regex-special pattern can't be interpreted
      // by the shell; the trailing `--` makes git treat the arg as a
      // pattern in all cases.
      return new Promise((resolve) => {
        const child = spawn(
          "git",
          [
            "-C",
            cwd,
            "grep",
            "--no-color",
            "-n",
            "-i",
            "-I",
            "--max-count=5",
            "-e",
            query,
            "--",
          ],
          { windowsHide: true },
        );
        let out = "";
        child.stdout.setEncoding("utf8");
        child.stdout.on("data", (chunk: string) => {
          out += chunk;
          if (out.length > 1024 * 1024) child.kill();
        });
        child.on("error", () => resolve([]));
        child.on("close", () => {
          const matches: TextMatch[] = [];
          for (const line of out.split("\n")) {
            if (!line) continue;
            const m = /^(.+?):(\d+):(.*)$/.exec(line);
            if (m) {
              matches.push({ path: m[1]!, line: Number(m[2]!), text: m[3] ?? "" });
              if (matches.length >= MAX_TEXT_RESULTS) break;
            }
          }
          resolve(matches);
        });
        setTimeout(() => child.kill(), 10000);
      });
    },
  );
}
