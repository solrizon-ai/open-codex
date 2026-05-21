import { create } from "zustand";
import { ensureCodexInitialized } from "../codex/useCodex";
import { useBackendStore } from "./backend";

export interface HistoryThread {
  id: string;
  title: string;
  preview: string;
  cwd: string;
  updatedAt: number;
  source?: string;
  /** Local-only — synced via the desktop-state JSON, not codex's thread store. */
  pinned?: boolean;
  /** Local-only. */
  unread?: boolean;
  /** Local-only — true means hidden from the recent list. */
  archived?: boolean;
}

interface HistoryState {
  threads: HistoryThread[];
  loading: boolean;
  error: string | null;
  loadRecent: () => Promise<void>;
  loadForCwd: (cwd: string) => Promise<void>;
  renameThread: (id: string, title: string) => Promise<void>;
  archiveThread: (id: string) => Promise<void>;
  togglePin: (id: string) => Promise<void>;
  markUnread: (id: string, unread: boolean) => Promise<void>;
}

interface DesktopThreadOverlay {
  pinned?: boolean;
  unread?: boolean;
  archived?: boolean;
  title?: string;
}

type DesktopThreadOverlays = Record<string, DesktopThreadOverlay>;

async function readOverlays(): Promise<DesktopThreadOverlays> {
  try {
    const value = await window.codex.config.getState("thread_overlays");
    return value && typeof value === "object"
      ? (value as DesktopThreadOverlays)
      : {};
  } catch {
    return {};
  }
}

async function writeOverlay(
  id: string,
  patch: DesktopThreadOverlay,
): Promise<DesktopThreadOverlays> {
  const overlays = await readOverlays();
  const next: DesktopThreadOverlays = {
    ...overlays,
    [id]: { ...(overlays[id] ?? {}), ...patch },
  };
  await window.codex.config.setState("thread_overlays", next);
  return next;
}

function applyOverlays(
  threads: HistoryThread[],
  overlays: DesktopThreadOverlays,
): HistoryThread[] {
  const overlaid = threads.map((t) => {
    const o = overlays[t.id];
    if (!o) return t;
    return {
      ...t,
      pinned: o.pinned ?? t.pinned,
      unread: o.unread ?? t.unread,
      archived: o.archived ?? t.archived,
      title: o.title ?? t.title,
    };
  });
  return overlaid
    .filter((t) => !t.archived)
    .sort((a, b) => {
      if ((a.pinned ?? false) !== (b.pinned ?? false)) {
        return a.pinned ? -1 : 1;
      }
      return (b.updatedAt ?? 0) - (a.updatedAt ?? 0);
    });
}

function getString(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

function normalizeThread(raw: unknown): HistoryThread | null {
  if (!raw || typeof raw !== "object") return null;
  const t = raw as Record<string, unknown>;
  const id = getString(t.id);
  const cwd = getString(t.cwd);
  if (!id || !cwd) return null;

  const name = getString(t.name);
  const preview = getString(t.preview) ?? "";
  const updatedAt = typeof t.updatedAt === "number" ? t.updatedAt : 0;
  const source =
    typeof t.source === "object" && t.source !== null
      ? getString((t.source as Record<string, unknown>).type) ?? undefined
      : getString(t.source) ?? undefined;

  return {
    id,
    cwd,
    preview,
    updatedAt,
    source,
    title: name || preview || "未命名对话",
  };
}

export const useHistoryStore = create<HistoryState>((set, get) => ({
  threads: [],
  loading: false,
  error: null,

  loadRecent: async () => {
    set({ loading: true, error: null });
    try {
      if (useBackendStore.getState().backend !== "codex") {
        const [response, overlays] = await Promise.all([
          window.codex.claude.historyList(null),
          readOverlays(),
        ]);
        const threads = (response.data ?? [])
          .map(normalizeThread)
          .filter((thread): thread is HistoryThread => thread !== null);
        set({ threads: applyOverlays(threads, overlays), loading: false });
        return;
      }
      await ensureCodexInitialized();
      const [response, overlays] = await Promise.all([
        window.codex.codex.request("thread/list", {
          limit: 50,
          archived: false,
          useStateDbOnly: false,
        }) as Promise<{ data?: unknown[] }>,
        readOverlays(),
      ]);
      const threads = (response.data ?? [])
        .map(normalizeThread)
        .filter((thread): thread is HistoryThread => thread !== null);
      set({ threads: applyOverlays(threads, overlays), loading: false });
    } catch (e) {
      const error = e instanceof Error ? e.message : String(e);
      set({ error, loading: false });
    }
  },

  loadForCwd: async (cwd: string) => {
    set({ loading: true, error: null });
    try {
      if (useBackendStore.getState().backend !== "codex") {
        const [response, overlays] = await Promise.all([
          window.codex.claude.historyList(cwd),
          readOverlays(),
        ]);
        const threads = (response.data ?? [])
          .map(normalizeThread)
          .filter((thread): thread is HistoryThread => thread !== null);
        set({ threads: applyOverlays(threads, overlays), loading: false });
        return;
      }
      await ensureCodexInitialized();
      const [response, overlays] = await Promise.all([
        window.codex.codex.request("thread/list", {
          limit: 50,
          cwd,
          archived: false,
          useStateDbOnly: false,
        }) as Promise<{ data?: unknown[] }>,
        readOverlays(),
      ]);
      const threads = (response.data ?? [])
        .map(normalizeThread)
        .filter((thread): thread is HistoryThread => thread !== null);
      set({ threads: applyOverlays(threads, overlays), loading: false });
    } catch (e) {
      const error = e instanceof Error ? e.message : String(e);
      set({ error, loading: false });
    }
  },

  renameThread: async (id: string, title: string) => {
    const next = title.trim();
    if (!next) return;
    await writeOverlay(id, { title: next });
    if (useBackendStore.getState().backend === "codex") {
      try {
        await window.codex.codex.request("thread/name/set", {
          threadId: id,
          name: next,
        });
      } catch {
        // Keep the local overlay if app-server cannot update this thread.
      }
    }
    set((s) => ({
      threads: s.threads.map((t) => (t.id === id ? { ...t, title: next } : t)),
    }));
  },

  archiveThread: async (id: string) => {
    await writeOverlay(id, { archived: true });
    if (useBackendStore.getState().backend === "codex") {
      try {
        await window.codex.codex.request("thread/archive", { threadId: id });
      } catch {
        // Same fallback as rename: keep local-only archive flag if the
        // upstream RPC is unavailable.
      }
    }
    set((s) => ({ threads: s.threads.filter((t) => t.id !== id) }));
  },

  togglePin: async (id: string) => {
    const current = get().threads.find((t) => t.id === id);
    if (!current) return;
    const pinned = !current.pinned;
    await writeOverlay(id, { pinned });
    const overlays = await readOverlays();
    set((s) => ({
      threads: applyOverlays(
        s.threads.map((t) => (t.id === id ? { ...t, pinned } : t)),
        overlays,
      ),
    }));
  },

  markUnread: async (id: string, unread: boolean) => {
    await writeOverlay(id, { unread });
    set((s) => ({
      threads: s.threads.map((t) => (t.id === id ? { ...t, unread } : t)),
    }));
  },
}));
