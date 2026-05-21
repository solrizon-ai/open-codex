import { useNavigationStore } from "../../state/navigation";
import { useUiStore } from "../../state/ui";

export function SuggestionList() {
  return (
    <ul className="mt-3 w-full max-w-[640px] divide-y divide-black/[0.05] text-[12.5px] text-zinc-600 dark:divide-white/[0.08] dark:text-zinc-300">
      <li
        className="flex h-9 cursor-pointer items-center gap-2 px-1 hover:text-foreground"
        onClick={() => {
          useUiStore.getState().setIntegrationsTab("apps");
          useNavigationStore.getState().setView("plugins");
        }}
      >
        <GridIcon />
        将你常用的应用连接到 Codex
      </li>
    </ul>
  );
}

function GridIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" className="shrink-0 opacity-65">
      {[
        [3, 3],
        [14, 3],
        [3, 14],
        [14, 14],
      ].map(([x, y]) => (
        <rect
          key={`${x}-${y}`}
          x={x}
          y={y}
          width="7"
          height="7"
          rx="1.5"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
        />
      ))}
    </svg>
  );
}
