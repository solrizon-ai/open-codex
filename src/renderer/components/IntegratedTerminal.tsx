import {
  useEffect,
  useRef,
  useState,
  type ClipboardEvent,
  type KeyboardEvent,
} from "react";
import { Plus, SquareTerminal, X } from "lucide-react";
import { cn } from "../lib/cn";
import { useProjectStore } from "../state/project";
import { TERMINAL_BOUNDS } from "../state/ui";

interface IntegratedTerminalProps {
  cwd: string | null;
  height: number;
  onHeight: (height: number) => void;
  onClose: () => void;
  onCollapsed?: () => void;
}

interface TerminalTab {
  id: string;
  label: string;
  shell: string;
  cwd: string;
  output: string;
  prompt: string;
  input: string;
  busy: boolean;
  exited: boolean;
  history: string[];
  historyIndex: number | null;
}

const ANSI_PATTERN =
  // eslint-disable-next-line no-control-regex
  /[\u001b\u009b][[\]()#;?]*(?:(?:(?:[a-zA-Z\d]*(?:;[a-zA-Z\d]*)*)?\u0007)|(?:(?:\d{1,4}(?:;\d{0,4})*)?[\dA-PR-TZcf-nq-uy=><~]))/g;

function cleanTerminalChunk(chunk: string) {
  return chunk
    .replace(ANSI_PATTERN, "")
    .replace(/%\s*\r\s*\r/g, "")
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "");
}

function dirName(path: string) {
  return path.split("/").filter(Boolean).pop() || path || "terminal";
}

function replaceInput(
  tab: TerminalTab,
  input: string,
  historyIndex = tab.historyIndex,
) {
  const previousLength = tab.input.length;
  const output =
    previousLength > 0
      ? `${tab.output.slice(0, -previousLength)}${input}`
      : tab.output + input;
  return { ...tab, input, historyIndex, output };
}

export function IntegratedTerminal({
  cwd,
  height,
  onHeight,
  onClose,
  onCollapsed,
}: IntegratedTerminalProps) {
  const project = useProjectStore((s) => s.current);
  const [tabs, setTabs] = useState<TerminalTab[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [focused, setFocused] = useState(false);
  const terminalRef = useRef<HTMLDivElement | null>(null);
  const viewportRef = useRef<HTMLPreElement | null>(null);
  const tabsRef = useRef<TerminalTab[]>([]);
  const generationRef = useRef(0);
  const dragRef = useRef<{ startY: number; startHeight: number } | null>(null);

  const activeTab = tabs.find((tab) => tab.id === activeId) ?? tabs[0] ?? null;

  const clearResizeGlobals = () => {
    document.documentElement.removeAttribute("data-resizing-panels");
    document.body.style.cursor = "";
    document.body.style.userSelect = "";
  };

  const endResizeDrag = (pointerId?: number, target?: Element) => {
    if (!dragRef.current) return;
    dragRef.current = null;
    if (pointerId !== undefined && target instanceof HTMLElement) {
      try {
        target.releasePointerCapture(pointerId);
      } catch {
        // The OS can cancel capture when the window loses focus.
      }
    }
    clearResizeGlobals();
  };

  useEffect(() => {
    tabsRef.current = tabs;
  }, [tabs]);

  useEffect(() => {
    const viewport = viewportRef.current;
    if (viewport) viewport.scrollTop = viewport.scrollHeight;
  }, [activeTab?.id, activeTab?.output]);

  useEffect(() => {
    const cancelResize = () => endResizeDrag();
    const cancelOnVisibility = () => {
      if (document.visibilityState !== "visible") endResizeDrag();
    };
    window.addEventListener("pointerup", cancelResize);
    window.addEventListener("pointercancel", cancelResize);
    window.addEventListener("blur", cancelResize);
    document.addEventListener("visibilitychange", cancelOnVisibility);
    return () => {
      window.removeEventListener("pointerup", cancelResize);
      window.removeEventListener("pointercancel", cancelResize);
      window.removeEventListener("blur", cancelResize);
      document.removeEventListener("visibilitychange", cancelOnVisibility);
      clearResizeGlobals();
      for (const tab of tabsRef.current) {
        void window.codex.terminal.kill(tab.id);
      }
    };
  }, []);

  useEffect(() => {
    const offData = window.codex.terminal.onData((event) => {
      const chunk = cleanTerminalChunk(event.chunk);
      setTabs((current) =>
        current.map((tab) => {
          if (tab.id !== event.id) return tab;
          let prompt = tab.prompt;
          let busy = tab.busy;
          let output = tab.output + chunk;
          output = output.replace(
            /\n?__CODEX_DONE__:(\d+):([^\n]*)\n?/g,
            (_match, _code: string, pwd: string) => {
              busy = false;
              const dir = dirName(pwd);
              const [identity = "shell"] = prompt.split(" ");
              prompt = `${identity} ${dir} % `;
              return `\n${prompt}`;
            },
          );
          return { ...tab, output, prompt, busy };
        }),
      );
    });

    const offExit = window.codex.terminal.onExit((event) => {
      setTabs((current) =>
        current.map((tab) => {
          if (tab.id !== event.id) return tab;
          const suffix =
            event.signal || event.code != null
              ? `\n[进程已退出 ${event.signal ?? event.code}]\n`
              : "\n[进程已退出]\n";
          return {
            ...tab,
            output: tab.output + suffix,
            busy: false,
            exited: true,
          };
        }),
      );
    });

    return () => {
      offData();
      offExit();
    };
  }, []);

  function addSession(session: {
    id: string;
    shell: string;
    cwd: string;
    prompt: string;
  }) {
    const baseLabel = project?.name ?? dirName(session.cwd) ?? session.shell;
    setTabs((current) => {
      const siblingCount = current.filter(
        (tab) =>
          tab.label === baseLabel || tab.label.startsWith(`${baseLabel} `),
      ).length;
      const label =
        siblingCount === 0 ? baseLabel : `${baseLabel} ${siblingCount + 1}`;
      return [
        ...current,
        {
          id: session.id,
          label,
          shell: session.shell,
          cwd: session.cwd,
          output: session.prompt,
          prompt: session.prompt,
          input: "",
          busy: false,
          exited: false,
          history: [],
          historyIndex: null,
        },
      ];
    });
    setActiveId(session.id);
    requestAnimationFrame(() => terminalRef.current?.focus());
  }

  function createTab() {
    const generation = generationRef.current;
    setCreating(true);
    void window.codex.terminal
      .create(cwd)
      .then((session) => {
        if (generation !== generationRef.current) {
          void window.codex.terminal.kill(session.id);
          return;
        }
        addSession(session);
      })
      .finally(() => {
        if (generation === generationRef.current) setCreating(false);
      });
  }

  useEffect(() => {
    generationRef.current += 1;
    const existing = tabsRef.current;
    for (const tab of existing) {
      void window.codex.terminal.kill(tab.id);
    }
    setTabs([]);
    setActiveId(null);
    createTab();
  }, [cwd]);

  function updateTab(id: string, updater: (tab: TerminalTab) => TerminalTab) {
    setTabs((current) =>
      current.map((tab) => (tab.id === id ? updater(tab) : tab)),
    );
  }

  function write(id: string, data: string) {
    void window.codex.terminal.write(id, data).catch((err) => {
      updateTab(id, (tab) => ({
        ...tab,
        output: `${tab.output}\n${err instanceof Error ? err.message : String(err)}\n`,
        busy: false,
        exited: true,
      }));
    });
  }

  function closeTab(id: string) {
    void window.codex.terminal.kill(id);
    setTabs((current) => {
      const index = current.findIndex((tab) => tab.id === id);
      const next = current.filter((tab) => tab.id !== id);
      if (next.length === 0) {
        setActiveId(null);
        return next;
      }
      if (activeId === id) {
        setActiveId(next[Math.max(0, index - 1)]?.id ?? next[0]?.id ?? null);
      }
      return next;
    });
  }

  function appendOutput(id: string, text: string) {
    updateTab(id, (tab) => ({ ...tab, output: tab.output + text }));
  }

  function setInput(id: string, input: string, historyIndex?: number | null) {
    updateTab(id, (tab) => replaceInput(tab, input, historyIndex));
  }

  function runCommand(tab: TerminalTab, command: string) {
    if (!command.trim()) {
      appendOutput(tab.id, tab.prompt);
      return;
    }
    updateTab(tab.id, (current) => ({
      ...current,
      busy: true,
      history: [...current.history, command].slice(-100),
      historyIndex: null,
    }));
    write(
      tab.id,
      `${command}\nprintf '\\n__CODEX_DONE__:%s:%s\\n' "$?" "$PWD"\n`,
    );
  }

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const tab = activeTab;
    if (!tab || tab.exited) return;
    if (event.metaKey) return;
    if (event.ctrlKey) {
      const key = event.key.toLowerCase();
      if (key === "c") {
        event.preventDefault();
        updateTab(tab.id, (current) => ({
          ...current,
          output: `${current.output}^C\n${current.prompt}`,
          busy: false,
        }));
        write(tab.id, "\x03");
      } else if (key === "d") {
        event.preventDefault();
        write(tab.id, "\x04");
      }
      return;
    }

    if (tab.busy) {
      event.preventDefault();
      return;
    }

    if (event.key === "ArrowUp" || event.key === "ArrowDown") {
      event.preventDefault();
      const history = tab.history;
      if (history.length === 0) return;
      const current =
        tab.historyIndex ??
        (event.key === "ArrowUp" ? history.length : history.length - 1);
      const next =
        event.key === "ArrowUp"
          ? Math.max(0, current - 1)
          : Math.min(history.length - 1, current + 1);
      setInput(tab.id, history[next] ?? "", next);
      return;
    }

    if (event.key === "Enter") {
      event.preventDefault();
      const command = tab.input;
      updateTab(tab.id, (current) => ({
        ...current,
        input: "",
        output: `${current.output}\n`,
      }));
      runCommand(tab, command);
      return;
    }
    if (event.key === "Backspace") {
      event.preventDefault();
      if (tab.input.length > 0) {
        setInput(tab.id, tab.input.slice(0, -1));
      }
      return;
    }
    if (event.key.length === 1) {
      event.preventDefault();
      setInput(tab.id, tab.input + event.key);
    }
  }

  function handlePaste(event: ClipboardEvent<HTMLDivElement>) {
    const tab = activeTab;
    if (!tab || tab.busy || tab.exited) return;
    const text = event.clipboardData.getData("text");
    if (!text) return;
    event.preventDefault();
    setInput(tab.id, tab.input + text);
  }

  return (
    <section
      data-integrated-terminal
      onTransitionEnd={(event) => {
        if (event.propertyName === "height" && height === 0) {
          onCollapsed?.();
        }
      }}
      className={cn(
        "panel-resize relative shrink-0 overflow-hidden border-t border-border bg-surface-elevated text-foreground [app-region:no-drag]",
        "transition-[height,opacity] duration-[420ms] ease-[cubic-bezier(0.22,1,0.36,1)]",
        height > 0
          ? "pointer-events-auto opacity-100"
          : "pointer-events-none opacity-0",
      )}
      style={{ height }}
    >
      <div
        role="separator"
        aria-orientation="horizontal"
        onPointerDown={(event) => {
          dragRef.current = { startY: event.clientY, startHeight: height };
          event.currentTarget.setPointerCapture(event.pointerId);
          document.documentElement.setAttribute("data-resizing-panels", "true");
          document.body.style.cursor = "row-resize";
          document.body.style.userSelect = "none";
        }}
        onPointerMove={(event) => {
          const drag = dragRef.current;
          if (!drag) return;
          const next = drag.startHeight + (drag.startY - event.clientY);
          onHeight(
            Math.min(TERMINAL_BOUNDS.max, Math.max(TERMINAL_BOUNDS.min, next)),
          );
        }}
        onPointerUp={(event) => {
          endResizeDrag(event.pointerId, event.currentTarget);
        }}
        onPointerCancel={() => {
          endResizeDrag();
        }}
        onLostPointerCapture={() => {
          endResizeDrag();
        }}
        className="absolute -top-[5px] left-0 z-10 h-[10px] w-full cursor-row-resize"
      />
      <div className="flex h-10 items-center gap-1 border-b border-border px-3 text-[12px] dark:border-white/[0.08]">
        <div className="flex min-w-0 flex-1 items-center gap-1 overflow-x-auto">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              data-terminal-tab
              type="button"
              title={`${tab.label} · ${tab.cwd}`}
              onClick={() => {
                setActiveId(tab.id);
                requestAnimationFrame(() => terminalRef.current?.focus());
              }}
              className={cn(
                "group flex h-7 max-w-[180px] shrink-0 items-center gap-2 rounded-lg px-3 font-medium transition-colors",
                activeTab?.id === tab.id
                  ? "bg-black/[0.06] text-foreground dark:bg-white/[0.1]"
                  : "text-foreground-muted hover:bg-black/[0.05] hover:text-foreground dark:hover:bg-white/[0.08]",
              )}
            >
              <SquareTerminal size={13} strokeWidth={1.8} />
              <span className="truncate">{tab.label}</span>
              {tab.exited && (
                <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-rose-400" />
              )}
              {tabs.length > 1 && (
                <span
                  role="button"
                  tabIndex={-1}
                  title="关闭终端标签"
                  onClick={(event) => {
                    event.stopPropagation();
                    closeTab(tab.id);
                  }}
                  className="ml-1 flex h-4 w-4 items-center justify-center rounded text-foreground-subtle opacity-0 hover:bg-black/[0.08] hover:text-foreground group-hover:opacity-100 dark:hover:bg-white/[0.12]"
                >
                  <X size={11} />
                </span>
              )}
            </button>
          ))}
          <button
            data-terminal-new-tab
            type="button"
            title="新建终端"
            disabled={creating}
            onClick={createTab}
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-foreground-muted hover:bg-black/[0.05] hover:text-foreground disabled:cursor-wait disabled:opacity-50 dark:hover:bg-white/[0.08]"
          >
            <Plus size={15} />
          </button>
        </div>
        <button
          type="button"
          title="关闭终端面板"
          onClick={onClose}
          className="ml-2 flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-foreground-muted hover:bg-black/[0.05] hover:text-foreground dark:hover:bg-white/[0.08]"
        >
          <X size={15} />
        </button>
      </div>
      <div
        ref={terminalRef}
        tabIndex={0}
        onKeyDown={handleKeyDown}
        onPaste={handlePaste}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        onClick={() => terminalRef.current?.focus()}
        className={cn(
          "h-[calc(100%-40px)] outline-none",
          activeTab && !activeTab.exited ? "cursor-text" : "cursor-default",
        )}
      >
        <pre
          ref={viewportRef}
          className="h-full overflow-auto whitespace-pre-wrap break-words px-3 py-3 font-mono text-[12.5px] leading-[1.55] text-foreground"
        >
          {activeTab ? (
            <>
              {activeTab.output}
              {!activeTab.busy && !activeTab.exited && (
                <span
                  aria-hidden
                  className={cn(
                    "terminal-caret ml-px inline-block h-[1.15em] w-[7px] translate-y-[2px] rounded-[1px] bg-foreground",
                    focused ? "terminal-caret-blink" : "opacity-70",
                  )}
                />
              )}
            </>
          ) : (
            "正在启动终端…"
          )}
        </pre>
      </div>
    </section>
  );
}
