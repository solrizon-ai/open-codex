import { Sidebar } from "./components/Sidebar";
import { ChatPane } from "./components/ChatPane";
import { ReviewPane } from "./components/ReviewPane";
import { CommandPalette } from "./components/cmdk";
import { IntegratedTerminal } from "./components/IntegratedTerminal";
import { PluginsView } from "./components/views/PluginsView";
import { AutomationView } from "./components/views/AutomationView";
import { SearchView } from "./components/views/SearchView";
import { WindowNavChrome } from "./components/WindowNavChrome";
import {
  SIDEBAR_BOUNDS,
  REVIEW_BOUNDS,
  TERMINAL_BOUNDS,
  useUiStore,
} from "./state/ui";
import { useProjectStore } from "./state/project";
import { useBackendStore } from "./state/backend";
import { useHistoryStore } from "./state/history";
import { useThreadStore } from "./state/thread";
import { useTabsStore } from "./state/tabs";
import { useThreadSubscription } from "./codex/useThreadSubscription";
import { useWindowWidth } from "./hooks/useWindowWidth";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

// In dev, expose the ui store on window so the visual-snapshot loop can
// flip views via CDP eval before each screenshot.
if ((import.meta as { env?: { DEV?: boolean } }).env?.DEV) {
  (window as unknown as { __thread?: unknown; __ui?: unknown }).__ui =
    useUiStore;
  (window as unknown as { __thread?: unknown; __ui?: unknown }).__thread =
    useThreadStore;
}

export function App() {
  useThreadSubscription();
  const loadProject = useProjectStore((s) => s.load);
  const loadBackend = useBackendStore((s) => s.load);
  const backendLoaded = useBackendStore((s) => s.loaded);
  const backend = useBackendStore((s) => s.backend);
  const loadHistory = useHistoryStore((s) => s.loadRecent);
  const view = useUiStore((s) => s.view);
  const reviewVisible = useUiStore((s) => s.reviewVisible);
  const sidebarCollapsed = useUiStore((s) => s.sidebarCollapsed);
  const terminalVisible = useUiStore((s) => s.terminalVisible);
  const project = useProjectStore((s) => s.current);

  // Responsive auto-collapse: below 740px the sidebar always hides;
  // below 980px the review pane hides regardless of user preference,
  // so the chat column always has enough room for the composer.
  const width = useWindowWidth();

  useEffect(() => {
    void loadProject();
  }, [loadProject]);

  useEffect(() => {
    void loadBackend();
  }, [loadBackend]);

  useEffect(() => {
    if (backendLoaded) void loadHistory();
  }, [backend, backendLoaded, loadHistory]);

  useEffect(() => {
    return window.codex.menu.onCommand((command) => {
      if (command === "menu:new-conversation") {
        useThreadStore.getState().reset();
        useTabsStore.getState().setActive(null);
        useUiStore.getState().setView("chat");
      } else if (command === "menu:open-folder") {
        void useProjectStore
          .getState()
          .chooseFolder()
          .then((project) => {
            if (project) void useHistoryStore.getState().loadRecent();
          });
      } else if (command === "menu:toggle-sidebar") {
        useUiStore.getState().toggleSidebar();
      } else if (command === "menu:toggle-review") {
        useUiStore.getState().toggleReview();
      } else if (command === "menu:open-settings") {
        void window.codex.window.openSettings();
      }
    });
  }, []);
  const effectiveSidebarCollapsed = sidebarCollapsed || width < 740;
  const effectiveReviewVisible =
    reviewVisible && view === "chat" && width >= 980;
  const effectiveTerminalVisible = terminalVisible && view === "chat";

  // Dynamic widths from store, clamped per useWindowWidth so we never
  // exceed what the viewport can hold.
  const sidebarWidth = useUiStore((s) => s.sidebarWidth);
  const reviewWidth = useUiStore((s) => s.reviewWidth);
  const terminalHeight = useUiStore((s) => s.terminalHeight);
  const setSidebarWidth = useUiStore((s) => s.setSidebarWidth);
  const setReviewWidth = useUiStore((s) => s.setReviewWidth);
  const setTerminalHeight = useUiStore((s) => s.setTerminalHeight);
  const setTerminalVisible = useUiStore((s) => s.setTerminalVisible);
  const setSidebarCollapsed = useUiStore((s) => s.setSidebarCollapsed);
  const [liveSidebarWidth, setLiveSidebarWidth] = useState(sidebarWidth);
  const liveSidebarWidthRef = useRef(sidebarWidth);
  const [liveReviewWidth, setLiveReviewWidth] = useState(reviewWidth);
  const liveReviewWidthRef = useRef(reviewWidth);
  const effectiveReviewVisibleRef = useRef(effectiveReviewVisible);
  const maxReviewWidthForViewportRef = useRef(REVIEW_BOUNDS.min);
  const reviewShellRef = useRef<HTMLDivElement | null>(null);
  const reviewInnerRef = useRef<HTMLDivElement | null>(null);
  const [terminalMounted, setTerminalMounted] = useState(
    effectiveTerminalVisible,
  );
  const [terminalExpanded, setTerminalExpanded] = useState(
    effectiveTerminalVisible,
  );

  useEffect(() => {
    const next = clamp(sidebarWidth, SIDEBAR_BOUNDS.min, SIDEBAR_BOUNDS.max);
    liveSidebarWidthRef.current = next;
    setLiveSidebarWidth(next);
  }, [sidebarWidth]);

  useEffect(() => {
    liveReviewWidthRef.current = reviewWidth;
    setLiveReviewWidth(reviewWidth);
  }, [reviewWidth]);

  useEffect(() => {
    if (effectiveTerminalVisible) {
      setTerminalMounted(true);
      setTerminalExpanded(false);
    } else {
      setTerminalExpanded(false);
    }
  }, [effectiveTerminalVisible]);

  useEffect(() => {
    if (!terminalMounted || !effectiveTerminalVisible || terminalExpanded) {
      return;
    }

    let frame = requestAnimationFrame(() => {
      frame = requestAnimationFrame(() => setTerminalExpanded(true));
    });

    return () => {
      cancelAnimationFrame(frame);
    };
  }, [effectiveTerminalVisible, terminalExpanded, terminalMounted]);

  const usableSidebar = effectiveSidebarCollapsed ? 0 : liveSidebarWidth;
  const usableReview = effectiveReviewVisible
    ? Math.min(
        liveReviewWidth,
        Math.max(REVIEW_BOUNDS.min, width - usableSidebar - 360),
      )
    : 0;
  const maxReviewWidthForViewport = Math.max(
    REVIEW_BOUNDS.min,
    width - usableSidebar - 360,
  );
  effectiveReviewVisibleRef.current = effectiveReviewVisible;
  maxReviewWidthForViewportRef.current = maxReviewWidthForViewport;

  const paintReviewWidth = useCallback((rawWidth: number) => {
    const clamped = clamp(rawWidth, REVIEW_BOUNDS.min, REVIEW_BOUNDS.max);
    const visibleWidth = effectiveReviewVisibleRef.current
      ? Math.min(clamped, maxReviewWidthForViewportRef.current)
      : 0;
    liveReviewWidthRef.current = clamped;
    if (reviewShellRef.current) {
      reviewShellRef.current.style.width = `${visibleWidth}px`;
    }
    if (reviewInnerRef.current) {
      reviewInnerRef.current.style.width = `${visibleWidth || clamped}px`;
    }
  }, []);

  const sidebarResize = useMemo(
    () => ({
      getWidth: () => liveSidebarWidthRef.current,
      onWidth: (w: number) => {
        if (w < SIDEBAR_BOUNDS.min) {
          liveSidebarWidthRef.current = SIDEBAR_BOUNDS.min;
          setLiveSidebarWidth(SIDEBAR_BOUNDS.min);
          setSidebarCollapsed(true);
          return;
        }
        const next = clamp(w, SIDEBAR_BOUNDS.min, SIDEBAR_BOUNDS.max);
        liveSidebarWidthRef.current = next;
        setLiveSidebarWidth(next);
      },
      onCommit: (w: number) => {
        if (w < SIDEBAR_BOUNDS.min) {
          liveSidebarWidthRef.current = SIDEBAR_BOUNDS.min;
          setSidebarWidth(SIDEBAR_BOUNDS.min);
          setSidebarCollapsed(true);
          return;
        }
        const next = clamp(w, SIDEBAR_BOUNDS.min, SIDEBAR_BOUNDS.max);
        liveSidebarWidthRef.current = next;
        setSidebarWidth(next);
      },
    }),
    [setSidebarCollapsed, setSidebarWidth],
  );

  const reviewResize = useMemo(
    () => ({
      getWidth: () => liveReviewWidthRef.current,
      onWidth: paintReviewWidth,
      onCommit: (w: number) => {
        const next = clamp(w, REVIEW_BOUNDS.min, REVIEW_BOUNDS.max);
        paintReviewWidth(next);
        setLiveReviewWidth(next);
        setReviewWidth(next);
      },
    }),
    [paintReviewWidth, setReviewWidth],
  );
  const usableTerminalHeight = clamp(
    terminalHeight,
    TERMINAL_BOUNDS.min,
    TERMINAL_BOUNDS.max,
  );
  const animatedTerminalHeight =
    terminalMounted && terminalExpanded && effectiveTerminalVisible
      ? usableTerminalHeight
      : 0;
  const chatTitleInset = effectiveSidebarCollapsed
    ? Math.min(430, Math.max(300, width * 0.41))
    : 0;

  return (
    <div className="relative flex h-full w-full overflow-hidden bg-surface-sidebar">
      <WindowNavChrome sidebarCollapsed={effectiveSidebarCollapsed} />
      <div
        className="panel-resize h-full shrink-0 overflow-hidden bg-transparent transition-[width] duration-[420ms] ease-[cubic-bezier(0.22,1,0.36,1)]"
        style={{ width: usableSidebar }}
      >
        <div style={{ width: liveSidebarWidth, height: "100%" }}>
          <Sidebar
            collapsed={effectiveSidebarCollapsed}
            resize={sidebarResize}
          />
        </div>
      </div>
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden rounded-l-[22px] border-y border-l border-border bg-surface-elevated dark:border-white/[0.1]">
        <div className="flex min-h-0 flex-1 overflow-hidden">
          <div className="min-w-0 flex-1 overflow-hidden pl-[3px]">
            {view === "chat" && <ChatPane titlebarInset={chatTitleInset} />}
            {view === "search" && <SearchView />}
            {view === "plugins" && <PluginsView />}
            {view === "automation" && <AutomationView />}
          </div>
          <div
            ref={reviewShellRef}
            className="review-shell panel-resize h-full shrink-0 overflow-hidden bg-surface-elevated transition-[width] duration-[420ms] ease-[cubic-bezier(0.22,1,0.36,1)]"
            style={{ width: usableReview }}
          >
            <div
              ref={reviewInnerRef}
              className="h-full overflow-hidden"
              style={{ width: usableReview || liveReviewWidth, height: "100%" }}
            >
              <ReviewPane
                collapsed={!effectiveReviewVisible}
                resize={reviewResize}
              />
            </div>
          </div>
        </div>
        {terminalMounted && (
          <IntegratedTerminal
            cwd={project?.cwd ?? null}
            height={animatedTerminalHeight}
            onHeight={setTerminalHeight}
            onClose={() => setTerminalVisible(false)}
            onCollapsed={() => {
              if (!effectiveTerminalVisible) setTerminalMounted(false);
            }}
          />
        )}
      </div>
      <CommandPalette />
    </div>
  );
}
