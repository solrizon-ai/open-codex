import { useEffect } from "react";
import { useThreadStore } from "../state/thread";
import { useHistoryStore } from "../state/history";
import { useProjectStore } from "../state/project";
import { useSlashCommandStore } from "../state/slashCommands";

/**
 * Pumps every codex `notification` event into the thread store. Mount once
 * (App-level) so we don't double-subscribe.
 */
export function useThreadSubscription(): void {
  useEffect(() => {
    if (!window.codex?.codex) return;
    const off = window.codex.codex.onNotification((msg) => {
      const m = msg as { method?: string; params?: unknown };
      if (typeof m.method !== "string") return;
      useThreadStore.getState()._ingestNotification(m as { method: string; params?: unknown });
      if (m.method === "turn/completed") {
        void useHistoryStore.getState().loadRecent();
      } else if (m.method === "skills/changed") {
        void useSlashCommandStore
          .getState()
          .load(useProjectStore.getState().current?.cwd ?? null);
      }
    });
    return off;
  }, []);
}
