import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type PropsWithChildren,
} from "react";
import { DEFAULT_THEME, type ThemeConfig, type ThemeVariant } from "../../shared/theme";
import type { CodexBridge } from "../../main/preload";

declare global {
  interface Window {
    codex: CodexBridge;
  }
}

type ThemeContextValue = {
  theme: ThemeConfig;
  update: (patch: Partial<ThemeConfig>) => void;
  updateLight: (patch: Partial<ThemeVariant>) => void;
  updateDark: (patch: Partial<ThemeVariant>) => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

/**
 * Applies a ThemeConfig to the document by writing CSS variables to <html>
 * and toggling the `[data-theme]` attribute so Tailwind's dark variant
 * activates. The variant chosen depends on `mode` + system pref.
 */
function applyTheme(theme: ThemeConfig): void {
  const html = document.documentElement;
  const resolved =
    theme.mode === "system"
      ? window.matchMedia("(prefers-color-scheme: dark)").matches
        ? "dark"
        : "light"
      : theme.mode;
  html.setAttribute("data-theme", resolved);

  const v: ThemeVariant = resolved === "dark" ? theme.dark : theme.light;

  html.style.setProperty("--accent", v.accent);
  html.style.setProperty("--accent-foreground", "#ffffff");
  html.style.setProperty("--surface-elevated", v.background);
  html.style.setProperty("--foreground", v.foreground);
  html.style.setProperty("--font-ui", v.uiFont);
  html.style.setProperty("--font-mono", v.monoFont);

  document.body.style.fontSize = `${theme.uiFontSize}px`;
  html.style.setProperty("--code-font-size", `${theme.codeFontSize}px`);
  if (theme.cursorPointer) html.classList.add("pointer-cursor");
  else html.classList.remove("pointer-cursor");

  html.setAttribute(
    "data-reduce-motion",
    theme.reduceMotion === "system" ? "system" : theme.reduceMotion,
  );
}

export function ThemeProvider({ children }: PropsWithChildren) {
  const [theme, setTheme] = useState<ThemeConfig>(DEFAULT_THEME);

  useEffect(() => {
    // Defensive: render with DEFAULT_THEME if the preload bridge isn't
    // available (e.g. running in plain browser context for tests).
    applyTheme(DEFAULT_THEME);
    if (!window.codex?.theme) return;

    let alive = true;
    void (async () => {
      const t = (await window.codex.theme.get()) ?? DEFAULT_THEME;
      if (!alive) return;
      setTheme(t);
      applyTheme(t);
    })();

    const off = window.codex.theme.onChange((t) => {
      setTheme(t);
      applyTheme(t);
    });

    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onSchemeChange = () => {
      void (async () => {
        const current = await window.codex.theme.get();
        if (current.mode === "system") applyTheme(current);
      })();
    };
    mq.addEventListener("change", onSchemeChange);

    return () => {
      alive = false;
      off();
      mq.removeEventListener("change", onSchemeChange);
    };
  }, []);

  const persist = useCallback((next: ThemeConfig) => {
    setTheme(next);
    applyTheme(next);
    void window.codex?.theme?.set(next);
  }, []);

  const update = useCallback(
    (patch: Partial<ThemeConfig>) => persist({ ...theme, ...patch }),
    [theme, persist],
  );
  const updateLight = useCallback(
    (patch: Partial<ThemeVariant>) =>
      persist({ ...theme, light: { ...theme.light, ...patch } }),
    [theme, persist],
  );
  const updateDark = useCallback(
    (patch: Partial<ThemeVariant>) =>
      persist({ ...theme, dark: { ...theme.dark, ...patch } }),
    [theme, persist],
  );

  return (
    <ThemeContext.Provider value={{ theme, update, updateLight, updateDark }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used inside <ThemeProvider>");
  return ctx;
}
