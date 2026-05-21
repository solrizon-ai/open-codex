import { create } from "zustand";
import { useProjectStore } from "./project";
import { useBackendStore } from "./backend";
import { useClaudeCodeConfigStore } from "./claudeConfig";
import { useHistoryStore } from "./history";
import { useReviewDiffStore } from "./reviewDiff";
import { ensureCodexInitialized } from "../codex/useCodex";

/**
 * Subset of the codex protocol item shape — we keep it loose because the
 * full taxonomy (assistant_message / tool_call / shell_call / etc.) is
 * large and still evolving in app-server-protocol/v2.
 */
export interface TurnItem {
  id?: string;
  type?: string;
  role?: "user" | "assistant" | "system" | "tool";
  text?: string;
  // raw payload from the codex notification — UI can format on-demand
  raw: Record<string, unknown>;
}

export type UserTurnInput =
  | { type: "text"; text: string; text_elements?: unknown[] }
  | {
      type: "image";
      url: string;
      detail?: "low" | "high" | "auto" | "original";
    }
  | {
      type: "localImage";
      path: string;
      detail?: "low" | "high" | "auto" | "original";
    }
  | {
      type: "skill";
      name: string;
      path: string;
    };

export type ThreadStatus = "idle" | "starting" | "ready" | "running" | "error";

interface ThreadState {
  threadId: string | null;
  cwd: string | null;
  items: TurnItem[];
  status: ThreadStatus;
  error: string | null;

  /** Lazily start a thread on first need. */
  ensureThread: (cwd: string) => Promise<string>;
  /** Send a user-typed turn. */
  sendTurn: (text: string, attachments?: UserTurnInput[]) => Promise<void>;
  /** Resume a persisted Codex CLI/app-server thread and render its history. */
  resumeThread: (threadId: string, cwd: string) => Promise<void>;
  /** Reset for a new conversation. */
  reset: () => void;

  // internal: dispatched from the notification subscriber
  _ingestNotification: (msg: { method: string; params?: unknown }) => void;
}

interface ThreadStartResponse {
  thread: { id: string };
}

let resumeGeneration = 0;

async function syncProjectForThread(cwd: string): Promise<void> {
  const current = useProjectStore.getState().current;
  if (current?.cwd === cwd) return;
  useReviewDiffStore.getState().clear();
  await useProjectStore.getState().setCurrent(cwd);
}

function extractItemSummary(raw: Record<string, unknown>): {
  role?: TurnItem["role"];
  text?: string;
  type?: string;
} {
  // codex item shape: { id, type, role?, content: [{type:"text", text:"..."}] }
  const item = (raw["item"] ?? raw) as Record<string, unknown>;
  const type = typeof item.type === "string" ? item.type : undefined;
  const role =
    typeof item.role === "string"
      ? (item.role as TurnItem["role"])
      : type?.startsWith("assistant")
        ? "assistant"
        : type?.startsWith("user")
          ? "user"
          : isToolLikeType(type)
            ? "tool"
            : undefined;
  const content = item.content;
  let text: string | undefined;
  if (Array.isArray(content)) {
    text = content
      .map((c) => {
        if (c && typeof c === "object" && "text" in c) {
          const t = (c as { text?: unknown }).text;
          return typeof t === "string" ? t : "";
        }
        return "";
      })
      .filter(Boolean)
      .join("");
  } else if (typeof item.text === "string") {
    text = item.text;
  }
  return { role, text, type };
}

function typeKey(type?: string): string {
  return (type ?? "").replace(/[_-]/g, "").toLowerCase();
}

function isToolLikeType(type?: string): boolean {
  switch (typeKey(type)) {
    case "mcptoolcall":
    case "dynamictoolcall":
    case "collabagenttoolcall":
    case "websearch":
    case "imageview":
    case "imagegeneration":
    case "enteredreviewmode":
    case "exitedreviewmode":
    case "contextcompaction":
    case "hookprompt":
      return true;
    default:
      return false;
  }
}

function textFromUserInput(content: unknown): string | undefined {
  if (!Array.isArray(content)) return undefined;
  return content
    .map((entry) => {
      if (!entry || typeof entry !== "object") return "";
      const input = entry as Record<string, unknown>;
      if (typeof input.text === "string") return input.text;
      if (input.type === "skill" && typeof input.name === "string") {
        return `/${input.name}`;
      }
      return "";
    })
    .filter(Boolean)
    .join("");
}

function displayTextFromUserInput(input: UserTurnInput[]): string {
  return input
    .map((entry) => {
      if (entry.type === "text") return entry.text;
      if (entry.type === "skill") return `/${entry.name}`;
      if (entry.type === "image" || entry.type === "localImage") return "[image]";
      return "";
    })
    .filter(Boolean)
    .join(" ");
}

function turnItemsToMessages(thread: Record<string, unknown>): TurnItem[] {
  const turns = Array.isArray(thread.turns) ? thread.turns : [];
  const messages: TurnItem[] = [];

  for (const turn of turns) {
    if (!turn || typeof turn !== "object") continue;
    const items = Array.isArray((turn as Record<string, unknown>).items)
      ? ((turn as Record<string, unknown>).items as unknown[])
      : [];
    for (const rawItem of items) {
      if (!rawItem || typeof rawItem !== "object") continue;
      const item = rawItem as Record<string, unknown>;
      const type = typeof item.type === "string" ? item.type : undefined;
      const id = typeof item.id === "string" ? item.id : undefined;
      if (type === "userMessage") {
        messages.push({
          id,
          type,
          role: "user",
          text: textFromUserInput(item.content),
          raw: item,
        });
      } else if (type === "agentMessage" || type === "plan") {
        messages.push({
          id,
          type,
          role: "assistant",
          text: typeof item.text === "string" ? item.text : undefined,
          raw: item,
        });
      } else if (type === "reasoning") {
        const summary = Array.isArray(item.summary)
          ? item.summary.filter((s): s is string => typeof s === "string")
          : [];
        if (summary.length > 0) {
          messages.push({
            id,
            type,
            role: "assistant",
            text: summary.join("\n"),
            raw: item,
          });
        }
      } else if (type === "commandExecution") {
        const command = typeof item.command === "string" ? item.command : "";
        const output =
          typeof item.aggregatedOutput === "string"
            ? item.aggregatedOutput
            : "";
        messages.push({
          id,
          type,
          role: "tool",
          text: [command ? `$ ${command}` : "", output]
            .filter(Boolean)
            .join("\n"),
          raw: item,
        });
      } else if (type === "fileChange") {
        messages.push({
          id,
          type,
          role: "tool",
          raw: item,
        });
      } else if (isToolLikeType(type)) {
        messages.push({
          id,
          type,
          role: "tool",
          raw: item,
        });
      }
    }
  }

  return messages;
}

export const useThreadStore = create<ThreadState>((set, get) => ({
  threadId: null,
  cwd: null,
  items: [],
  status: "idle",
  error: null,

  ensureThread: async (cwd: string) => {
    if (useBackendStore.getState().backend !== "codex") {
      const existing = get().threadId;
      if (existing) return existing;
      const id = crypto.randomUUID();
      set({ threadId: id, cwd, status: "ready", error: null });
      return id;
    }
    const existing = get().threadId;
    if (existing) return existing;
    set({ status: "starting", error: null });
    try {
      // initialize() must already have been sent by useCodex; reuse the
      // same app-server process.
      const res = (await window.codex.codex.request("thread/start", {
        cwd,
      })) as ThreadStartResponse;
      const id = res?.thread?.id;
      if (!id) throw new Error("thread/start returned no id");
      set({ threadId: id, cwd, status: "ready" });
      return id;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      set({ status: "error", error: msg });
      throw e;
    }
  },

  sendTurn: async (text: string, attachments: UserTurnInput[] = []) => {
    resumeGeneration++;
    const trimmed = text.trim();
    const input: UserTurnInput[] = [
      ...(trimmed ? [{ type: "text" as const, text: trimmed }] : []),
      ...attachments,
    ];
    if (input.length === 0) return;
    const project =
      useProjectStore.getState().current ??
      (await useProjectStore.getState().load());
    if (!project) {
      set({ status: "error", error: "No project is selected" });
      return;
    }
    if (useBackendStore.getState().backend !== "codex") {
      const displayText = trimmed || displayTextFromUserInput(input);
      const previousThreadId = get().threadId;
      const shouldResumeClaudeThread = previousThreadId && get().items.length > 0;
      set((s) => ({
        items: [
          ...s.items,
          {
            role: "user",
            type: "userMessage",
            text: displayText,
            raw: { type: "userMessage", content: input },
          },
        ],
        cwd: project.cwd,
        status: "running",
        error: null,
      }));
      try {
        const claudeConfig = useClaudeCodeConfigStore.getState();
        if (!claudeConfig.loaded) await claudeConfig.load();
        const { model, permissionMode } = useClaudeCodeConfigStore.getState();
        const res = await window.codex.claude.startTurn({
          cwd: project.cwd,
          threadId: shouldResumeClaudeThread ? previousThreadId : null,
          input,
          model,
          permissionMode,
        });
        set((s) => ({
          threadId: res.threadId,
          cwd: project.cwd,
          status: "ready",
          items: [
            ...s.items,
            {
              id: `${res.threadId}-${Date.now()}`,
              role: "assistant",
              type: "agentMessage",
              text: res.text || "Claude Code 已完成，但没有返回文本输出。",
              raw: { type: "agentMessage", backend: "claude", raw: res.raw },
            },
          ],
        }));
        void useHistoryStore.getState().loadRecent();
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        set({ status: "error", error: msg });
      }
      return;
    }
    const id = await get().ensureThread(project.cwd);
    const displayText = trimmed || displayTextFromUserInput(input);
    set((s) => ({
      items: [
        ...s.items,
        {
          role: "user",
          type: "userMessage",
          text: displayText,
          raw: { type: "userMessage", content: input },
        },
      ],
      status: "running",
    }));
    try {
      await window.codex.codex.request("turn/start", {
        threadId: id,
        input,
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      set({ status: "error", error: msg });
    }
  },

  resumeThread: async (threadId: string, cwd: string) => {
    const generation = ++resumeGeneration;
    set({ status: "starting", error: null });
    useReviewDiffStore.getState().clear();
    try {
      if (useBackendStore.getState().backend !== "codex") {
        const response = await window.codex.claude.historyRead(threadId, cwd);
        if (generation !== resumeGeneration) return;
        const resolvedCwd = response.cwd ?? cwd;
        await syncProjectForThread(resolvedCwd);
        if (generation !== resumeGeneration) return;
        set({
          threadId,
          cwd: resolvedCwd,
          items: response.items,
          status: "ready",
          error: null,
        });
        return;
      }
      await ensureCodexInitialized();
      const response = (await window.codex.codex.request("thread/resume", {
        threadId,
        cwd,
      })) as { thread?: unknown };
      const thread =
        response.thread && typeof response.thread === "object"
          ? (response.thread as Record<string, unknown>)
          : null;
      if (!thread) throw new Error("thread/resume returned no thread");
      if (generation !== resumeGeneration) return;
      await syncProjectForThread(cwd);
      if (generation !== resumeGeneration) return;
      set({
        threadId,
        cwd,
        items: turnItemsToMessages(thread),
        status: "ready",
        error: null,
      });
    } catch (e) {
      if (generation !== resumeGeneration) return;
      const msg = e instanceof Error ? e.message : String(e);
      set({ status: "error", error: msg });
    }
  },

  reset: () => {
    resumeGeneration++;
    set({ threadId: null, cwd: null, items: [], status: "idle", error: null });
  },

  _ingestNotification: (msg) => {
    if (typeof msg?.method !== "string") return;
    const params = (msg.params ?? {}) as Record<string, unknown>;
    switch (msg.method) {
      case "turn/started":
        set({ status: "running" });
        break;
      case "turn/completed":
        set({ status: "ready" });
        break;
      case "item/started":
      case "item/completed": {
        const { role, text, type } = extractItemSummary(params);
        if (role === "user") break; // already added by sendTurn
        set((s) => {
          const last = s.items[s.items.length - 1];
          // Update the in-flight assistant item if it matches our id
          const id =
            typeof (params.item as { id?: string } | undefined)?.id === "string"
              ? (params.item as { id: string }).id
              : undefined;
          if (id && last && last.id === id) {
            const next = s.items.slice(0, -1);
            next.push({ ...last, text: text ?? last.text, raw: params });
            return { items: next };
          }
          return {
            items: [...s.items, { id, role, type, text, raw: params }],
          };
        });
        break;
      }
      case "turn/diff/updated":
      case "turn/plan/updated":
        // Future: route to ReviewPane / PlanPane
        break;
      default:
        // Unhandled — let it pass; useCodex's stderr panel will surface errors
        break;
    }
  },
}));
