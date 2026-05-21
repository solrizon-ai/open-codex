import { useEffect } from "react";

export interface GlobalShortcut {
  /** Lower-case `KeyboardEvent.key` value, e.g. "k", "p", "/". */
  key: string;
  /** Require the platform meta key (Cmd on macOS). */
  meta?: boolean;
  /** Require the Control key. */
  ctrl?: boolean;
  /** Require either Cmd (macOS) or Ctrl (other platforms). */
  metaOrCtrl?: boolean;
  /** Require the Shift modifier. */
  shift?: boolean;
  /** Require the Alt / Option modifier. */
  alt?: boolean;
}

/**
 * Listens for a key combination on the `window` and invokes `callback` when it
 * matches. The callback identity does not need to be stable — the latest
 * reference is always invoked.
 */
export function useGlobalShortcut(
  shortcut: GlobalShortcut,
  callback: (event: KeyboardEvent) => void,
  enabled: boolean = true,
): void {
  useEffect(() => {
    if (!enabled) return;

    const handler = (event: KeyboardEvent) => {
      if (event.key.toLowerCase() !== shortcut.key.toLowerCase()) return;

      const wantsMeta = shortcut.meta ?? false;
      const wantsCtrl = shortcut.ctrl ?? false;
      const wantsMetaOrCtrl = shortcut.metaOrCtrl ?? false;
      const wantsShift = shortcut.shift ?? false;
      const wantsAlt = shortcut.alt ?? false;

      if (wantsMetaOrCtrl) {
        if (!(event.metaKey || event.ctrlKey)) return;
      } else {
        if (wantsMeta !== event.metaKey) return;
        if (wantsCtrl !== event.ctrlKey) return;
      }

      if (wantsShift !== event.shiftKey) return;
      if (wantsAlt !== event.altKey) return;

      callback(event);
    };

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [
    shortcut.key,
    shortcut.meta,
    shortcut.ctrl,
    shortcut.metaOrCtrl,
    shortcut.shift,
    shortcut.alt,
    callback,
    enabled,
  ]);
}
