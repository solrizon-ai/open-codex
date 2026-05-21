import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

export type ReviewTabKind = "review" | "chat" | "browser" | "file";

export interface ReviewTab {
  id: string;
  kind: ReviewTabKind;
  title: string;
  /** For browser tabs: the URL to load. */
  url?: string;
  /** For file tabs: absolute host path to preview. */
  path?: string;
}

interface ReviewTabsState {
  tabs: ReviewTab[];
  activeId: string;
  add: (tab: Omit<ReviewTab, "id"> & { id?: string }) => string;
  close: (id: string) => void;
  setActive: (id: string) => void;
}

const DEFAULT_REVIEW: ReviewTab = { id: "review", kind: "review", title: "审查" };

export const useReviewTabsStore = create<ReviewTabsState>()(
  persist(
    (set, get) => ({
      tabs: [DEFAULT_REVIEW],
      activeId: "review",

      add: (tab) => {
        const id = tab.id ?? `${tab.kind}-${Math.random().toString(36).slice(2, 8)}`;
        set((s) => {
          const existing = s.tabs.find((t) => t.id === id);
          if (existing) {
            return {
              tabs: s.tabs.map((t) => (t.id === id ? { ...t, ...tab, id } : t)),
              activeId: id,
            };
          }
          return { tabs: [...s.tabs, { ...tab, id }], activeId: id };
        });
        return id;
      },

      close: (id) => {
        if (id === "review") return; // review tab is permanent
        set((s) => {
          const idx = s.tabs.findIndex((t) => t.id === id);
          const tabs = s.tabs.filter((t) => t.id !== id);
          const activeId =
            s.activeId === id
              ? (tabs[idx]?.id ?? tabs[idx - 1]?.id ?? "review")
              : s.activeId;
          return { tabs, activeId };
        });
        void get;
      },

      setActive: (activeId) => set({ activeId }),
    }),
    {
      name: "codex-review-tabs",
      storage: createJSONStorage(() => localStorage),
    },
  ),
);
