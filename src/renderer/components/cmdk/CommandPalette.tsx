import { useCallback, useEffect, useMemo, useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { Command } from "cmdk";
import { MessageCircle, Settings, FolderOpen, Plus, FileText } from "lucide-react";
import { cn } from "../../lib/cn";
import { useGlobalShortcut } from "../../hooks/useGlobalShortcut";
import { useHistoryStore } from "../../state/history";
import { useNavigationStore } from "../../state/navigation";
import { useProjectStore } from "../../state/project";
import { useReviewTabsStore } from "../../state/reviewTabs";
import { useUiStore } from "../../state/ui";

export function CommandPalette() {
  const open = useUiStore((s) => s.paletteOpen);
  const setOpen = useUiStore((s) => s.setPaletteOpen);
  const togglePalette = useUiStore((s) => s.togglePalette);
  const [search, setSearch] = useState("");
  const [fileMatches, setFileMatches] = useState<{ path: string }[]>([]);
  const threads = useHistoryStore((s) => s.threads);
  const loadHistory = useHistoryStore((s) => s.loadRecent);
  const project = useProjectStore((s) => s.current);

  useGlobalShortcut(
    { key: "k", metaOrCtrl: true },
    useCallback(
      (event: KeyboardEvent) => {
        event.preventDefault();
        togglePalette();
      },
      [togglePalette],
    ),
  );

  useEffect(() => {
    if (open && threads.length === 0) void loadHistory();
  }, [open, threads.length, loadHistory]);

  useEffect(() => {
    if (!open) {
      setSearch("");
      setFileMatches([]);
    }
  }, [open]);

  // Debounced file search when the palette is open.
  useEffect(() => {
    if (!open || !project?.cwd) {
      setFileMatches([]);
      return;
    }
    const q = search.trim();
    if (!q) {
      setFileMatches([]);
      return;
    }
    const handle = window.setTimeout(async () => {
      try {
        const matches = await window.codex.search.files(project.cwd, q);
        setFileMatches(matches.slice(0, 8));
      } catch {
        setFileMatches([]);
      }
    }, 120);
    return () => window.clearTimeout(handle);
  }, [open, project?.cwd, search]);

  const projectName = (cwd: string) =>
    cwd.split("/").filter(Boolean).pop() ?? cwd;

  const openThread = useCallback(
    (id: string) => {
      const thread = threads.find((t) => t.id === id);
      if (!thread) return;
      useNavigationStore.getState().openThread(thread);
      setOpen(false);
    },
    [threads, setOpen],
  );

  const openFile = useCallback(
    (path: string) => {
      if (!project) return;
      const abs = `${project.cwd}/${path}`;
      useUiStore.getState().setReviewVisible(true);
      useReviewTabsStore.getState().add({
        kind: "file",
        title: path.split("/").pop() ?? path,
        path: abs,
      });
      setOpen(false);
    },
    [project, setOpen],
  );

  const visibleThreads = useMemo(() => threads.slice(0, 12), [threads]);

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Portal>
        <Dialog.Overlay
          className={cn(
            "fixed inset-0 z-50 bg-white/40 backdrop-blur-sm dark:bg-black/40",
            "data-[state=open]:animate-in data-[state=open]:fade-in-0",
            "data-[state=closed]:animate-out data-[state=closed]:fade-out-0",
          )}
        />
        <Dialog.Content
          aria-describedby={undefined}
          className={cn(
            "fixed left-1/2 top-1/2 z-50 w-[560px] max-w-[calc(100vw-32px)]",
            "-translate-x-1/2 -translate-y-1/2",
            "rounded-xl bg-surface-elevated text-foreground",
            "shadow-popover ring-1 ring-black/[0.06]",
            "overflow-hidden outline-none",
            "data-[state=open]:animate-in data-[state=open]:fade-in-0",
            "data-[state=open]:zoom-in-95",
            "data-[state=closed]:animate-out data-[state=closed]:fade-out-0",
          )}
        >
          <Dialog.Title className="sr-only">命令面板</Dialog.Title>
          <Command label="命令面板" loop className="flex flex-col">
            <Command.Input
              value={search}
              onValueChange={setSearch}
              placeholder="搜索对话、文件，或输入命令"
              className={cn(
                "h-[44px] w-full px-[14px] text-[14px]",
                "bg-transparent text-foreground placeholder:text-foreground-subtle",
                "border-0 border-b border-black/[0.06]",
                "outline-none focus:outline-none focus:ring-0",
              )}
            />

            <Command.List
              className={cn(
                "max-h-[420px] overflow-y-auto py-1",
                "[&_[cmdk-group-heading]]:px-3",
                "[&_[cmdk-group-heading]]:pt-2",
                "[&_[cmdk-group-heading]]:pb-1",
                "[&_[cmdk-group-heading]]:text-[11px]",
                "[&_[cmdk-group-heading]]:text-foreground-subtle",
              )}
            >
              <Command.Empty className="px-3 py-6 text-center text-[12px] text-foreground-subtle">
                没有找到结果
              </Command.Empty>

              <Command.Group heading="操作">
                <PaletteItem
                  icon={<Plus size={13} className="opacity-60" />}
                  label="新建对话"
                  onSelect={() => {
                    useNavigationStore.getState().startNewConversation();
                    setOpen(false);
                  }}
                />
                <PaletteItem
                  icon={<FolderOpen size={13} className="opacity-60" />}
                  label="打开项目…"
                  onSelect={() => {
                    void useProjectStore.getState().chooseFolder();
                    setOpen(false);
                  }}
                />
                <PaletteItem
                  icon={<Settings size={13} className="opacity-60" />}
                  label="打开设置"
                  onSelect={() => {
                    void window.codex.window.openSettings();
                    setOpen(false);
                  }}
                />
              </Command.Group>

              <Command.Group heading="近期对话">
                {visibleThreads.length === 0 && (
                  <div className="px-3 py-3 text-[12px] text-foreground-subtle">
                    暂无对话
                  </div>
                )}
                {visibleThreads.map((thread) => (
                  <Command.Item
                    key={thread.id}
                    value={`thread ${thread.title} ${thread.cwd}`}
                    onSelect={() => openThread(thread.id)}
                    className={cn(
                      "group mx-1 flex h-[32px] cursor-pointer items-center gap-2 rounded-md px-2",
                      "text-foreground",
                      "data-[selected=true]:bg-black/[0.04]",
                      "hover:bg-black/[0.04]",
                      "aria-selected:bg-black/[0.04]",
                    )}
                  >
                    <MessageCircle
                      size={13}
                      className="shrink-0 opacity-60"
                      aria-hidden
                    />
                    <span className="flex-1 truncate text-[12.5px]">
                      {thread.title}
                    </span>
                    <span className="shrink-0 text-[11px] text-foreground-subtle">
                      {projectName(thread.cwd)}
                    </span>
                  </Command.Item>
                ))}
              </Command.Group>

              {fileMatches.length > 0 && (
                <Command.Group heading="文件">
                  {fileMatches.map((file) => (
                    <Command.Item
                      key={file.path}
                      value={`file ${file.path}`}
                      onSelect={() => openFile(file.path)}
                      className={cn(
                        "group mx-1 flex h-[32px] cursor-pointer items-center gap-2 rounded-md px-2",
                        "text-foreground",
                        "data-[selected=true]:bg-black/[0.04]",
                        "hover:bg-black/[0.04]",
                        "aria-selected:bg-black/[0.04]",
                      )}
                    >
                      <FileText
                        size={13}
                        className="shrink-0 opacity-60"
                        aria-hidden
                      />
                      <span className="flex-1 truncate font-mono text-[12px]">
                        {file.path}
                      </span>
                    </Command.Item>
                  ))}
                </Command.Group>
              )}
            </Command.List>
          </Command>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function PaletteItem({
  icon,
  label,
  onSelect,
}: {
  icon: React.ReactNode;
  label: string;
  onSelect: () => void;
}) {
  return (
    <Command.Item
      value={label}
      onSelect={onSelect}
      className={cn(
        "mx-1 flex h-[32px] cursor-pointer items-center gap-2 rounded-md px-2 text-foreground",
        "data-[selected=true]:bg-black/[0.04]",
        "hover:bg-black/[0.04]",
        "aria-selected:bg-black/[0.04]",
      )}
    >
      {icon}
      <span className="flex-1 truncate text-[12.5px]">{label}</span>
    </Command.Item>
  );
}
