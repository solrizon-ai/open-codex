/**
 * Shared theme types used by both renderer windows and the main process
 * (which persists the theme to ~/.codex/desktop-theme.json).
 */

export type ThemeMode = "light" | "dark" | "system";

export interface ThemeVariant {
  accent: string;
  background: string;
  foreground: string;
  uiFont: string;
  monoFont: string;
  translucentSidebar: boolean;
  contrast: number; // 0-100
}

export interface ThemeConfig {
  mode: ThemeMode;
  light: ThemeVariant;
  dark: ThemeVariant;
  uiFontSize: number; // px
  codeFontSize: number; // px
  reduceMotion: "system" | "on" | "off";
  fontSmoothing: boolean;
  cursorPointer: boolean;
}

export const DEFAULT_THEME: ThemeConfig = {
  mode: "dark",
  light: {
    accent: "#339CFF",
    background: "#FFFFFF",
    foreground: "#1A1C1F",
    uiFont: "-apple-system, Blink",
    monoFont: 'ui-monospace, "SFM"',
    translucentSidebar: true,
    contrast: 45,
  },
  dark: {
    accent: "#339CFF",
    background: "#181818",
    foreground: "#FFFFFF",
    uiFont: "-apple-system, Blink",
    monoFont: 'ui-monospace, "SFM"',
    translucentSidebar: true,
    contrast: 60,
  },
  uiFontSize: 14,
  codeFontSize: 12,
  reduceMotion: "system",
  fontSmoothing: true,
  cursorPointer: false,
};
