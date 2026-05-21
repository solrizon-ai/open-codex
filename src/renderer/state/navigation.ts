import { create } from "zustand";
import type { HistoryThread } from "./history";
import { useHistoryStore } from "./history";
import { useTabsStore } from "./tabs";
import { useThreadStore } from "./thread";
import { useUiStore, type MainView } from "./ui";

interface NavigationSnapshot {
  view: MainView;
  threadId: string | null;
  cwd: string | null;
  tabId: string | null;
  tabTitle: string | null;
  activeSessionId: string | null;
}

interface NavigationState {
  backStack: NavigationSnapshot[];
  forwardStack: NavigationSnapshot[];
  goBack: () => void;
  goForward: () => void;
  setView: (view: MainView) => void;
  startNewConversation: () => void;
  openThread: (thread: Pick<HistoryThread, "id" | "title" | "cwd">) => void;
}

const MAX_STACK = 50;

function snapshotCurrent(): NavigationSnapshot {
  const ui = useUiStore.getState();
  const thread = useThreadStore.getState();
  const tabs = useTabsStore.getState();
  const activeTab = tabs.tabs.find((tab) => tab.id === tabs.activeId) ?? null;
  const historyThread = thread.threadId
    ? useHistoryStore.getState().threads.find((t) => t.id === thread.threadId)
    : null;

  return {
    view: ui.view,
    threadId: thread.threadId,
    cwd: thread.cwd,
    tabId: tabs.activeId,
    tabTitle: activeTab?.title ?? historyThread?.title ?? null,
    activeSessionId: ui.activeSessionId,
  };
}

function sameSnapshot(a: NavigationSnapshot, b: NavigationSnapshot): boolean {
  return (
    a.view === b.view &&
    a.threadId === b.threadId &&
    a.cwd === b.cwd &&
    a.tabId === b.tabId &&
    a.activeSessionId === b.activeSessionId
  );
}

function pushSnapshot(
  stack: NavigationSnapshot[],
  snapshot: NavigationSnapshot,
): NavigationSnapshot[] {
  const last = stack[stack.length - 1];
  if (last && sameSnapshot(last, snapshot)) return stack;
  return [...stack, snapshot].slice(-MAX_STACK);
}

function applySnapshot(snapshot: NavigationSnapshot): void {
  useUiStore.setState({
    view: snapshot.view,
    activeSessionId: snapshot.activeSessionId,
  });

  if (snapshot.view !== "chat") {
    if (snapshot.tabId) useTabsStore.getState().setActive(snapshot.tabId);
    return;
  }

  if (snapshot.threadId && snapshot.cwd) {
    useTabsStore.getState().open({
      id: snapshot.tabId ?? snapshot.threadId,
      title: snapshot.tabTitle ?? "未命名对话",
      threadId: snapshot.threadId,
    });
    void useThreadStore.getState().resumeThread(snapshot.threadId, snapshot.cwd);
    return;
  }

  useTabsStore.getState().setActive(null);
  useThreadStore.getState().reset();
}

export const useNavigationStore = create<NavigationState>((set, get) => ({
  backStack: [],
  forwardStack: [],

  goBack: () => {
    const { backStack, forwardStack } = get();
    const target = backStack[backStack.length - 1];
    if (!target) return;
    const current = snapshotCurrent();
    set({
      backStack: backStack.slice(0, -1),
      forwardStack: pushSnapshot(forwardStack, current),
    });
    applySnapshot(target);
  },

  goForward: () => {
    const { backStack, forwardStack } = get();
    const target = forwardStack[forwardStack.length - 1];
    if (!target) return;
    const current = snapshotCurrent();
    set({
      backStack: pushSnapshot(backStack, current),
      forwardStack: forwardStack.slice(0, -1),
    });
    applySnapshot(target);
  },

  setView: (view) => {
    const current = snapshotCurrent();
    if (current.view === view) {
      useUiStore.getState().setView(view);
      return;
    }
    set((s) => ({
      backStack: pushSnapshot(s.backStack, current),
      forwardStack: [],
    }));
    useUiStore.getState().setView(view);
  },

  startNewConversation: () => {
    const current = snapshotCurrent();
    const next: NavigationSnapshot = {
      view: "chat",
      threadId: null,
      cwd: null,
      tabId: null,
      tabTitle: null,
      activeSessionId: null,
    };
    if (!sameSnapshot(current, next)) {
      set((s) => ({
        backStack: pushSnapshot(s.backStack, current),
        forwardStack: [],
      }));
    }
    useThreadStore.getState().reset();
    useTabsStore.getState().setActive(null);
    useUiStore.setState({ view: "chat", activeSessionId: null });
  },

  openThread: (thread) => {
    const current = snapshotCurrent();
    const next: NavigationSnapshot = {
      view: "chat",
      threadId: thread.id,
      cwd: thread.cwd,
      tabId: thread.id,
      tabTitle: thread.title,
      activeSessionId: null,
    };
    if (!sameSnapshot(current, next)) {
      set((s) => ({
        backStack: pushSnapshot(s.backStack, current),
        forwardStack: [],
      }));
    }
    useUiStore.setState({ view: "chat", activeSessionId: null });
    useTabsStore.getState().open({
      id: thread.id,
      title: thread.title,
      threadId: thread.id,
    });
    void useThreadStore.getState().resumeThread(thread.id, thread.cwd);
  },
}));
