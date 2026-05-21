import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

export interface ChatTab {
  id: string;          // conversation/thread id or local slug
  title: string;
  threadId?: string;   // codex-rs thread id, if started
  pinned?: boolean;
  unread?: boolean;
}

interface TabsState {
  tabs: ChatTab[];
  activeId: string | null;

  open: (tab: ChatTab) => void;
  close: (id: string) => void;
  setActive: (id: string | null) => void;
  rename: (id: string, title: string) => void;
  pin: (id: string, pinned: boolean) => void;
  markUnread: (id: string, unread: boolean) => void;
  /** Cycle: ⌘1..9 jumps by index; ⌘[ / ⌘] cycles prev/next. */
  selectByIndex: (i: number) => void;
  selectRelative: (delta: number) => void;
}

export const useTabsStore = create<TabsState>()(
  persist(
    (set, get) => ({
      tabs: [],
      activeId: null,

      open: (tab) =>
        set((s) => {
          const existing = s.tabs.find((t) => t.id === tab.id);
          if (existing) return { activeId: tab.id };
          return { tabs: [...s.tabs, tab], activeId: tab.id };
        }),

      close: (id) =>
        set((s) => {
          const idx = s.tabs.findIndex((t) => t.id === id);
          if (idx < 0) return s;
          const tabs = s.tabs.filter((t) => t.id !== id);
          let activeId = s.activeId;
          if (s.activeId === id) {
            const next = tabs[idx] ?? tabs[idx - 1] ?? null;
            activeId = next?.id ?? null;
          }
          return { tabs, activeId };
        }),

      setActive: (activeId) => set({ activeId }),

      rename: (id, title) =>
        set((s) => ({
          tabs: s.tabs.map((t) => (t.id === id ? { ...t, title } : t)),
        })),

      pin: (id, pinned) =>
        set((s) => ({
          tabs: s.tabs.map((t) => (t.id === id ? { ...t, pinned } : t)),
        })),

      markUnread: (id, unread) =>
        set((s) => ({
          tabs: s.tabs.map((t) => (t.id === id ? { ...t, unread } : t)),
        })),

      selectByIndex: (i) => {
        const tabs = get().tabs;
        const tab = tabs[i];
        if (tab) set({ activeId: tab.id });
      },

      selectRelative: (delta) => {
        const { tabs, activeId } = get();
        if (tabs.length === 0) return;
        const idx = tabs.findIndex((t) => t.id === activeId);
        const len = tabs.length;
        const next = (((idx < 0 ? 0 : idx) + delta) % len + len) % len;
        set({ activeId: tabs[next]!.id });
      },
    }),
    {
      name: "codex-tabs",
      storage: createJSONStorage(() => localStorage),
      partialize: (s) => ({ tabs: s.tabs, activeId: s.activeId }),
    },
  ),
);
