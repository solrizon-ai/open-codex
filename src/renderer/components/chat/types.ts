export type PermissionMode = "default" | "auto" | "full" | "read-only";

export interface ModelOption {
  id: string;
  label: string;
  description?: string;
}

export interface Branch {
  name: string;
  isCurrent: boolean;
}

export interface ProjectChoice {
  id: string;
  name: string;
  isCurrent: boolean;
}
