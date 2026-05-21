export type DiffLineKind = "context" | "add" | "del" | "hunk" | "spacer";

export interface DiffLine {
  kind: DiffLineKind;
  oldNo?: number;
  newNo?: number;
  text?: string;
  hunkInfo?: string;
}

export interface DiffFile {
  path: string;
  absolutePath?: string;
  language: string;
  added: number;
  removed: number;
  status: "modified" | "added" | "deleted" | "renamed";
  lines: DiffLine[];
}

export interface FileListEntry {
  path: string;
  added: number;
  removed: number;
  status: "modified" | "added" | "deleted";
}
