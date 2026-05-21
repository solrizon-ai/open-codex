import type { CodexBridge } from "../main/preload";

declare global {
  interface Window {
    codex: CodexBridge;
  }
}

export {};
