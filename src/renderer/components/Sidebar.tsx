import { NavSection } from "./sidebar/NavSection";
import { ProjectsSection, SectionLabel } from "./sidebar/ProjectsSection";
import { AccountButton } from "./sidebar/AccountButton";
import { SettingsButton } from "./sidebar/SettingsButton";
import type { NavId, Project } from "./sidebar/types";
import { useUiStore, type MainView } from "../state/ui";
import { ResizeHandle } from "./ResizeHandle";
import { useProjectStore } from "../state/project";
import { useHistoryStore } from "../state/history";
import type { HistoryThread } from "../state/history";
import { useNavigationStore } from "../state/navigation";
import { useThreadStore } from "../state/thread";
import { cn } from "../lib/cn";
import { memo } from "react";

interface ResizeBinding {
  getWidth: () => number;
  onWidth: (width: number) => void;
  onCommit: (width: number) => void;
}

const NAV_TO_VIEW: Record<NavId, MainView> = {
  new: "chat",
  search: "search",
  plugins: "plugins",
  automations: "automation",
};

const VIEW_TO_NAV: Record<MainView, NavId> = {
  chat: "new",
  search: "search",
  plugins: "plugins",
  automation: "automations",
};

export const Sidebar = memo(function Sidebar({
  collapsed = false,
  resize,
}: {
  collapsed?: boolean;
  resize?: ResizeBinding;
}) {
  const view = useUiStore((s) => s.view);
  const setPaletteOpen = useUiStore((s) => s.setPaletteOpen);
  const project = useProjectStore((s) => s.current);
  const threads = useHistoryStore((s) => s.threads);
  const loadingHistory = useHistoryStore((s) => s.loading);
  const activeThreadId = useThreadStore((s) => s.threadId);
  const active = VIEW_TO_NAV[view];
  const projects = buildProjects({
    activeThreadId,
    currentProject: project,
    loadingHistory,
    threads,
  });

  const handleSelect = (id: NavId) => {
    // 搜索 nav opens the cmdk palette rather than swapping the main view.
    if (id === "search") {
      setPaletteOpen(true);
      return;
    }
    if (id === "new") {
      useNavigationStore.getState().startNewConversation();
      return;
    }
    if (id === "plugins") {
      useUiStore.getState().setIntegrationsTab("plugins");
    }
    useNavigationStore.getState().setView(NAV_TO_VIEW[id]);
  };

  return (
    <aside
      className={cn(
        "relative flex h-full min-h-0 select-none flex-col overflow-hidden bg-surface-sidebar text-[12.5px] text-foreground-muted [app-region:no-drag]",
        "transition-transform duration-[420ms] ease-[cubic-bezier(0.22,1,0.36,1)]",
        collapsed ? "pointer-events-none -translate-x-2" : "translate-x-0",
      )}
      aria-hidden={collapsed}
    >
      {!collapsed && (
        <ResizeHandle
          side="right"
          getWidth={
            resize?.getWidth ?? (() => useUiStore.getState().sidebarWidth)
          }
          onWidth={
            resize?.onWidth ?? ((w) => useUiStore.getState().setSidebarWidth(w))
          }
          onCommit={resize?.onCommit}
        />
      )}
      <div className="relative z-10 h-[86px] shrink-0 [app-region:no-drag]">
        <div
          aria-hidden
          className="absolute left-[250px] right-0 top-0 h-[70px] [app-region:drag]"
        />
        <div
          aria-hidden
          className="absolute inset-x-0 bottom-0 top-[70px] [app-region:drag]"
        />
      </div>

      <div className="relative z-10">
        <NavSection active={active} onSelect={handleSelect} />
      </div>

      <div className="relative z-10 mt-[28px] min-h-0 flex-1 overflow-y-auto overscroll-contain [app-region:no-drag]">
        <ProjectsSection
          projects={projects}
          onSessionClick={(session) => {
            const thread = threads.find((t) => t.id === session.id);
            if (!thread) return;
            useNavigationStore.getState().openThread(thread);
          }}
        />

        <SectionLabel>对话</SectionLabel>
        <div className="px-[16px] pb-[6px] text-[12px] italic text-foreground-subtle">
          暂无聊天
        </div>
      </div>

      <div className="relative z-10 flex h-[58px] items-center justify-between px-[22px] [app-region:no-drag]">
        <SettingsButton />
        <AccountButton />
      </div>
    </aside>
  );
});

function formatRelativeTime(timestampSeconds: number): string {
  if (!timestampSeconds) return "";
  const diffMs = Date.now() - timestampSeconds * 1000;
  const minute = 60 * 1000;
  const hour = 60 * minute;
  const day = 24 * hour;
  if (diffMs < hour) return `${Math.max(1, Math.floor(diffMs / minute))} 分`;
  if (diffMs < day) return `${Math.floor(diffMs / hour)} 小时`;
  if (diffMs < 30 * day) return `${Math.floor(diffMs / day)} 天`;
  return new Date(timestampSeconds * 1000).toLocaleDateString("zh-CN", {
    month: "numeric",
    day: "numeric",
  });
}

function buildProjects({
  activeThreadId,
  currentProject,
  loadingHistory,
  threads,
}: {
  activeThreadId: string | null;
  currentProject: { cwd: string; name: string } | null;
  loadingHistory: boolean;
  threads: HistoryThread[];
}): Project[] {
  const byCwd = new Map<string, Project>();

  for (const thread of threads) {
    const project = byCwd.get(thread.cwd) ?? {
      id: thread.cwd,
      name: projectNameFromCwd(thread.cwd),
      expanded: true,
      sessions: [],
    };
    project.sessions.push({
      id: thread.id,
      title: thread.title,
      time: formatRelativeTime(thread.updatedAt),
      active: thread.id === activeThreadId,
    });
    byCwd.set(thread.cwd, project);
  }

  if (currentProject && !byCwd.has(currentProject.cwd)) {
    byCwd.set(currentProject.cwd, {
      id: currentProject.cwd,
      name: currentProject.name,
      expanded: true,
      sessions: [
        {
          id: "empty",
          title: loadingHistory ? "正在同步对话…" : "暂无对话",
          muted: true,
        },
      ],
    });
  }

  return Array.from(byCwd.values()).sort((a, b) => {
    if (currentProject?.cwd === a.id) return -1;
    if (currentProject?.cwd === b.id) return 1;
    return 0;
  });
}

function projectNameFromCwd(cwd: string): string {
  const parts = cwd.split("/").filter(Boolean);
  return parts[parts.length - 1] ?? cwd;
}
