import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

export type MainView = "chat" | "search" | "plugins" | "automation";
export type IntegrationsTab = "plugins" | "apps" | "skills";

interface UiState {
  view: MainView;
  integrationsTab: IntegrationsTab;
  reviewVisible: boolean;
  paletteOpen: boolean;
  sidebarCollapsed: boolean;
  terminalVisible: boolean;
  activeSessionId: string | null;
  /** Pixel widths for the two drag-resizable side columns. */
  sidebarWidth: number; // px
  reviewWidth: number;  // px
  terminalHeight: number; // px
  setView: (v: MainView) => void;
  setIntegrationsTab: (v: IntegrationsTab) => void;
  setReviewVisible: (v: boolean) => void;
  setPaletteOpen: (v: boolean) => void;
  setSidebarCollapsed: (v: boolean) => void;
  setTerminalVisible: (v: boolean) => void;
  setActiveSessionId: (v: string | null) => void;
  setSidebarWidth: (w: number) => void;
  setReviewWidth: (w: number) => void;
  setTerminalHeight: (h: number) => void;
  togglePalette: () => void;
  toggleReview: () => void;
  toggleSidebar: () => void;
  toggleTerminal: () => void;
}

const SIDEBAR_MIN = 190;
const SIDEBAR_MAX = 360;
const REVIEW_MIN = 280;
const REVIEW_MAX = 720;
const TERMINAL_MIN = 180;
const TERMINAL_MAX = 520;
const clamp = (v: number, lo: number, hi: number) =>
  Math.min(hi, Math.max(lo, v));

export const useUiStore = create<UiState>()(
  persist(
    (set) => ({
      view: "chat",
      integrationsTab: "plugins",
      reviewVisible: false,
      paletteOpen: false,
      sidebarCollapsed: false,
      terminalVisible: false,
      activeSessionId: null,
      sidebarWidth: 220,
      reviewWidth: 420,
      terminalHeight: 300,
      setView: (view) => set({ view }),
      setIntegrationsTab: (integrationsTab) => set({ integrationsTab }),
      setReviewVisible: (reviewVisible) => set({ reviewVisible }),
      setPaletteOpen: (paletteOpen) => set({ paletteOpen }),
      setSidebarCollapsed: (sidebarCollapsed) => set({ sidebarCollapsed }),
      setTerminalVisible: (terminalVisible) => set({ terminalVisible }),
      setActiveSessionId: (activeSessionId) => set({ activeSessionId }),
      setSidebarWidth: (w) =>
        set({ sidebarWidth: clamp(w, SIDEBAR_MIN, SIDEBAR_MAX) }),
      setReviewWidth: (w) =>
        set({ reviewWidth: clamp(w, REVIEW_MIN, REVIEW_MAX) }),
      setTerminalHeight: (h) =>
        set({ terminalHeight: clamp(h, TERMINAL_MIN, TERMINAL_MAX) }),
      togglePalette: () => set((s) => ({ paletteOpen: !s.paletteOpen })),
      toggleReview: () => set((s) => ({ reviewVisible: !s.reviewVisible })),
      toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
      toggleTerminal: () =>
        set((s) => ({ terminalVisible: !s.terminalVisible })),
    }),
    {
      name: "codex-ui",
      storage: createJSONStorage(() => localStorage),
      partialize: (s) => ({
        view: s.view,
        integrationsTab: s.integrationsTab,
        reviewVisible: s.reviewVisible,
        sidebarCollapsed: s.sidebarCollapsed,
        terminalVisible: s.terminalVisible,
        sidebarWidth: s.sidebarWidth,
        reviewWidth: s.reviewWidth,
        terminalHeight: s.terminalHeight,
      }),
    },
  ),
);

export const SIDEBAR_BOUNDS = { min: SIDEBAR_MIN, max: SIDEBAR_MAX };
export const REVIEW_BOUNDS = { min: REVIEW_MIN, max: REVIEW_MAX };
export const TERMINAL_BOUNDS = { min: TERMINAL_MIN, max: TERMINAL_MAX };
