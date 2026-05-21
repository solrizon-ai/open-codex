import { useEffect, useState, useCallback } from "react";
import packageJson from "../../../package.json";

export interface CodexServerInfo {
  userAgent?: string;
  codexHome?: string;
  platformOs?: string;
  platformFamily?: string;
}

export type CodexStatus = "idle" | "starting" | "ready" | "error";

interface UseCodex {
  status: CodexStatus;
  server: CodexServerInfo | null;
  stderr: string;
  error: string | null;
  reconnect: () => Promise<void>;
}

let inflightInit: Promise<CodexServerInfo> | null = null;

export async function ensureCodexInitialized(): Promise<CodexServerInfo> {
  if (inflightInit) return inflightInit;
  inflightInit = (async () => {
    if (!window.codex?.codex) throw new Error("codex bridge unavailable");
    await window.codex.codex.start();
    return window.codex.codex.initialize({
      clientInfo: { name: "codex-app", version: packageJson.version },
    }) as Promise<CodexServerInfo>;
  })();
  try {
    return await inflightInit;
  } catch (err) {
    inflightInit = null; // allow retry on failure
    throw err;
  }
}

/**
 * Boots the codex-rs `app-server` sidecar on mount, sends the initialize
 * handshake, and exposes connection status to the UI.
 */
export function useCodex(): UseCodex {
  const [status, setStatus] = useState<CodexStatus>("idle");
  const [server, setServer] = useState<CodexServerInfo | null>(null);
  const [stderr, setStderr] = useState("");
  const [error, setError] = useState<string | null>(null);

  const reconnect = useCallback(async () => {
    setStatus("starting");
    setError(null);
    try {
      inflightInit = null;
      const info = await ensureCodexInitialized();
      setServer(info);
      setStatus("ready");
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(msg);
      setStatus("error");
    }
  }, []);

  useEffect(() => {
    let alive = true;
    void (async () => {
      setStatus("starting");
      try {
        const info = await ensureCodexInitialized();
        if (!alive) return;
        setServer(info);
        setStatus("ready");
      } catch (e) {
        if (!alive) return;
        const msg = e instanceof Error ? e.message : String(e);
        setError(msg);
        setStatus("error");
      }
    })();

    const offStderr = window.codex?.codex?.onStderr((chunk) => {
      setStderr((prev) => (prev + chunk).slice(-4096));
    });
    const offExit = window.codex?.codex?.onExit(({ code, signal }) => {
      setStatus("error");
      setError(`codex exited (code=${code} signal=${signal})`);
    });

    return () => {
      alive = false;
      offStderr?.();
      offExit?.();
    };
  }, []);

  return { status, server, stderr, error, reconnect };
}
