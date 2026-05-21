import {
  ChevronLeft,
  ChevronRight,
  PanelLeft,
  SquarePen,
} from "lucide-react";
import {
  useRef,
  type ButtonHTMLAttributes,
  type CSSProperties,
  type PropsWithChildren,
} from "react";
import { cn } from "../lib/cn";
import { useNavigationStore } from "../state/navigation";
import { useUiStore } from "../state/ui";

const NO_DRAG_STYLE = { WebkitAppRegion: "no-drag" } as CSSProperties;

const TRAFFIC_LIGHTS = [
  {
    label: "关闭窗口",
    color: "bg-[#ff5f57]",
    action: () => window.codex.window.close(),
  },
  {
    label: "最小化窗口",
    color: "bg-[#febc2e]",
    action: () => window.codex.window.minimize(),
  },
  {
    label: "最大化窗口",
    color: "bg-[#28c840]",
    action: () => window.codex.window.toggleMaximize(),
  },
] as const;

export function WindowNavChrome({
  sidebarCollapsed,
}: {
  sidebarCollapsed: boolean;
}) {
  const setSidebarCollapsed = useUiStore((s) => s.setSidebarCollapsed);
  const canGoBack = useNavigationStore((s) => s.backStack.length > 0);
  const canGoForward = useNavigationStore((s) => s.forwardStack.length > 0);
  const goBack = useNavigationStore((s) => s.goBack);
  const goForward = useNavigationStore((s) => s.goForward);
  const startNewConversation = useNavigationStore((s) => s.startNewConversation);

  return (
    <div
      data-window-nav-chrome
      style={NO_DRAG_STYLE}
      className="pointer-events-auto absolute left-0 top-0 z-40 h-[70px] w-[250px] [app-region:no-drag]"
    >
      <div
        data-window-nav-actions
        style={NO_DRAG_STYLE}
        className="pointer-events-auto absolute left-[23px] top-[18px] z-10 flex h-8 items-center [app-region:no-drag]"
      >
        <div
          style={NO_DRAG_STYLE}
          className="flex items-center gap-[2px] [app-region:no-drag]"
        >
          {TRAFFIC_LIGHTS.map((light) => (
            <TrafficLightButton
              key={light.label}
              label={light.label}
              color={light.color}
              onClick={() => void light.action()}
            />
          ))}
        </div>
        <div
          style={NO_DRAG_STYLE}
          className="panel-resize ml-[10px] flex h-8 items-center gap-[6px] transition-transform duration-[420ms] ease-[cubic-bezier(0.22,1,0.36,1)] [app-region:no-drag]"
        >
          <ChromeButton
            tooltip={sidebarCollapsed ? "显示边栏" : "隐藏边栏"}
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
          >
            <PanelLeft size={18} strokeWidth={1.75} />
          </ChromeButton>
          <ChromeButton tooltip="后退" disabled={!canGoBack} onClick={goBack}>
            <ChevronLeft size={18} strokeWidth={1.75} />
          </ChromeButton>
          <ChromeButton tooltip="前进" disabled={!canGoForward} onClick={goForward}>
            <ChevronRight size={18} strokeWidth={1.75} />
          </ChromeButton>
          {sidebarCollapsed && (
            <ChromeButton tooltip="新对话" onClick={startNewConversation}>
              <SquarePen size={17} strokeWidth={1.75} />
            </ChromeButton>
          )}
        </div>
      </div>
    </div>
  );
}

function useReliableButtonAction(onClick: () => void) {
  const lastActivationAt = useRef(0);

  return (event: {
    button?: number;
    preventDefault: () => void;
    stopPropagation: () => void;
  }) => {
    if (event.button != null && event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();

    const now = Date.now();
    if (now - lastActivationAt.current < 240) return;
    lastActivationAt.current = now;
    onClick();
  };
}

function TrafficLightButton({
  label,
  color,
  onClick,
}: {
  label: string;
  color: string;
  onClick: () => void;
}) {
  const activate = useReliableButtonAction(onClick);

  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onPointerDown={activate}
      onMouseDown={activate}
      onClick={activate}
      style={NO_DRAG_STYLE}
      className={cn(
        "pointer-events-auto flex h-[22px] w-[22px] items-center justify-center rounded-md",
        "transition-[filter,transform] duration-100 active:scale-95",
        "[app-region:no-drag]",
      )}
    >
      <span
        className={cn(
          "h-[14px] w-[14px] rounded-full shadow-[inset_0_0_0_0.5px_rgba(0,0,0,0.18)] hover:brightness-105",
          color,
        )}
      />
    </button>
  );
}

function ChromeButton({
  tooltip,
  children,
  onClick,
  ...props
}: PropsWithChildren<{ tooltip: string }> &
  Omit<ButtonHTMLAttributes<HTMLButtonElement>, "onClick"> & {
  onClick?: () => void;
  }) {
  const activate = useReliableButtonAction(() => onClick?.());

  return (
    <button
      {...props}
      type="button"
      aria-label={props["aria-label"] ?? tooltip}
      title={tooltip}
      onPointerDown={activate}
      onMouseDown={activate}
      onClick={activate}
      style={{ ...NO_DRAG_STYLE, ...props.style }}
      className={cn(
        "pointer-events-auto flex h-7 w-7 items-center justify-center rounded-md text-foreground-muted",
        "hover:bg-black/[0.05] hover:text-foreground dark:hover:bg-white/[0.08]",
        "disabled:pointer-events-none disabled:opacity-35",
        "[app-region:no-drag]",
        props.className,
      )}
    >
      <span className="pointer-events-none flex items-center justify-center">
        {children}
      </span>
    </button>
  );
}
