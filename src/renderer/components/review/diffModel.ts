import type { TurnItem } from "../../state/thread";
import type { DiffFile, DiffLine } from "./types";
import { languageFromPath } from "./CodeViewer";

export interface FileChangeRecord {
  path: string;
  diff: string;
  status?: DiffFile["status"];
}

export function extractFileChanges(item: TurnItem): FileChangeRecord[] {
  const raw = unwrapItem(item.raw);
  return Array.isArray(raw.changes)
    ? raw.changes.flatMap((change) => normalizeChange(change))
    : [];
}

export function diffFilesFromChanges(
  changes: FileChangeRecord[],
  cwd?: string | null,
): DiffFile[] {
  return changes.map((change) => {
    const lines = parseUnifiedDiff(change.diff);
    const stats = countDiffText(change.diff);
    const absolutePath = resolvePath(cwd ?? undefined, change.path);
    return {
      path: displayPath(cwd ?? undefined, change.path),
      absolutePath,
      language: languageFromPath(change.path),
      added: stats.added,
      removed: stats.removed,
      status: change.status ?? inferStatus(stats),
      lines,
    };
  });
}

export function countChange(change: FileChangeRecord): {
  added: number;
  removed: number;
} {
  return countDiffText(change.diff);
}

function normalizeChange(change: unknown): FileChangeRecord[] {
  if (!change || typeof change !== "object") return [];
  const record = change as Record<string, unknown>;
  const path = typeof record.path === "string" ? record.path : undefined;
  if (!path) return [];
  const diff = typeof record.diff === "string" ? record.diff : "";
  const status = normalizeStatus(record.status ?? record.kind ?? record.type);
  return [{ path, diff, status }];
}

function normalizeStatus(value: unknown): DiffFile["status"] | undefined {
  if (value === "added" || value === "deleted" || value === "renamed")
    return value;
  if (value === "modified") return value;
  if (value === "add" || value === "create") return "added";
  if (value === "delete" || value === "remove") return "deleted";
  if (value === "rename") return "renamed";
  return undefined;
}

function parseUnifiedDiff(diff: string): DiffLine[] {
  const lines: DiffLine[] = [];
  let oldNo = 0;
  let newNo = 0;
  let sawHunk = false;

  for (const raw of diff.split("\n")) {
    if (!raw) continue;
    if (
      raw.startsWith("diff --git ") ||
      raw.startsWith("index ") ||
      raw.startsWith("--- ") ||
      raw.startsWith("+++ ") ||
      raw.startsWith("\\ No newline")
    ) {
      continue;
    }

    const hunk = /^@@\s+-(\d+)(?:,\d+)?\s+\+(\d+)(?:,\d+)?\s+@@(.*)$/.exec(raw);
    if (hunk) {
      oldNo = Number(hunk[1]);
      newNo = Number(hunk[2]);
      sawHunk = true;
      lines.push({ kind: "hunk", hunkInfo: raw });
      continue;
    }

    if (!sawHunk) continue;

    const marker = raw[0];
    const text = raw.slice(1);
    if (marker === "+") {
      lines.push({ kind: "add", newNo, text });
      newNo++;
    } else if (marker === "-") {
      lines.push({ kind: "del", oldNo, text });
      oldNo++;
    } else {
      lines.push({
        kind: "context",
        oldNo,
        newNo,
        text: marker === " " ? text : raw,
      });
      oldNo++;
      newNo++;
    }
  }

  return collapseLargeContext(lines);
}

function collapseLargeContext(lines: DiffLine[]): DiffLine[] {
  const collapsed: DiffLine[] = [];
  let contextRun: DiffLine[] = [];

  const flush = () => {
    if (contextRun.length > 18) {
      collapsed.push(...contextRun.slice(0, 6));
      collapsed.push({
        kind: "hunk",
        hunkInfo: `${contextRun.length - 12} unmodified lines`,
      });
      collapsed.push(...contextRun.slice(-6));
    } else {
      collapsed.push(...contextRun);
    }
    contextRun = [];
  };

  for (const line of lines) {
    if (line.kind === "context") {
      contextRun.push(line);
    } else {
      flush();
      collapsed.push(line);
    }
  }
  flush();
  return collapsed;
}

function countDiffText(diff: string): { added: number; removed: number } {
  let added = 0;
  let removed = 0;
  let lineStart = 0;

  for (let i = 0; i <= diff.length; i++) {
    if (i < diff.length && diff.charCodeAt(i) !== 10) continue;
    const first = diff.charCodeAt(lineStart);
    if (first === 43 && diff.slice(lineStart, lineStart + 3) !== "+++") {
      added++;
    } else if (first === 45 && diff.slice(lineStart, lineStart + 3) !== "---") {
      removed++;
    }
    lineStart = i + 1;
  }
  return { added, removed };
}

function inferStatus(stats: {
  added: number;
  removed: number;
}): DiffFile["status"] {
  if (stats.added > 0 && stats.removed === 0) return "added";
  if (stats.removed > 0 && stats.added === 0) return "deleted";
  return "modified";
}

function unwrapItem(raw: Record<string, unknown>): Record<string, unknown> {
  return raw.item && typeof raw.item === "object"
    ? (raw.item as Record<string, unknown>)
    : raw;
}

function resolvePath(cwd: string | undefined, filePath: string): string {
  if (!cwd || isAbsolutePath(filePath)) return filePath;
  return `${cwd.replace(/\/+$/, "")}/${filePath.replace(/^\/+/, "")}`;
}

function displayPath(cwd: string | undefined, filePath: string): string {
  if (!cwd || !isAbsolutePath(filePath)) return filePath;
  const normalizedCwd = cwd.replace(/\/+$/, "");
  if (filePath === normalizedCwd) return filePath.split("/").pop() ?? filePath;
  if (filePath.startsWith(`${normalizedCwd}/`)) {
    return filePath.slice(normalizedCwd.length + 1);
  }
  return filePath;
}

function isAbsolutePath(filePath: string): boolean {
  return filePath.startsWith("/") || /^[A-Za-z]:[\\/]/.test(filePath);
}
