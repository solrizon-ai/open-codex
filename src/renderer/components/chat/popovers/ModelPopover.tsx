import { Check, Search, Zap } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import {
  ChipPopover,
  PopoverItem,
  PopoverSectionLabel,
  PopoverSeparator,
} from "./popover-shell";
import {
  usePreferencesStore,
  type ReasoningEffort,
} from "../../../state/preferences";
import { ensureCodexInitialized } from "../../../codex/useCodex";
import { BACKEND_LABEL, useBackendStore } from "../../../state/backend";
import {
  CLAUDE_MODEL_OPTIONS,
  useClaudeCodeConfigStore,
} from "../../../state/claudeConfig";

const LEVELS: { id: ReasoningEffort; label: string }[] = [
  { id: "low", label: "低" },
  { id: "medium", label: "中" },
  { id: "high", label: "高" },
];

interface ModelListItem {
  id?: string;
  model?: string;
  displayName?: string;
  hidden?: boolean;
}

interface ModelListResponse {
  data?: ModelListItem[];
}

export function ModelPopover({ trigger }: { trigger: ReactNode }) {
  const backend = useBackendStore((s) => s.backend);
  const reasoning = usePreferencesStore((s) => s.reasoning);
  const model = usePreferencesStore((s) => s.model);
  const setReasoning = usePreferencesStore((s) => s.setReasoning);
  const setModel = usePreferencesStore((s) => s.setModel);
  const load = usePreferencesStore((s) => s.load);
  const loaded = usePreferencesStore((s) => s.loaded);
  const claudeModel = useClaudeCodeConfigStore((s) => s.model);
  const setClaudeModel = useClaudeCodeConfigStore((s) => s.setModel);
  const loadClaudeConfig = useClaudeCodeConfigStore((s) => s.load);
  const claudeConfigLoaded = useClaudeCodeConfigStore((s) => s.loaded);
  const [showModels, setShowModels] = useState(false);
  const [models, setModels] = useState<ModelListItem[]>([]);
  const [modelQuery, setModelQuery] = useState("");
  const [modelError, setModelError] = useState<string | null>(null);

  useEffect(() => {
    if (backend === "codex" && !loaded) void load();
  }, [backend, loaded, load]);

  useEffect(() => {
    if (backend !== "codex" && !claudeConfigLoaded) void loadClaudeConfig();
  }, [backend, claudeConfigLoaded, loadClaudeConfig]);

  useEffect(() => {
    if (backend !== "codex") return;
    if (!showModels) return;
    let alive = true;
    setModelError(null);
    void (async () => {
      try {
        await ensureCodexInitialized();
        const response = (await window.codex.codex.request("model/list", {
          includeHidden: false,
        })) as ModelListResponse;
        if (!alive) return;
        const next = Array.isArray(response.data)
          ? response.data.filter((m) => (m.model || m.id) && !m.hidden)
          : [];
        setModels(next);
      } catch (e) {
        if (!alive) return;
        setModels([]);
        setModelError(e instanceof Error ? e.message : String(e));
      }
    })();
    return () => {
      alive = false;
    };
  }, [backend, showModels]);

  if (backend !== "codex") {
    const customModel = modelQuery.trim();
    const canUseCustom =
      customModel.length > 0 &&
      !CLAUDE_MODEL_OPTIONS.some((candidate) => candidate.id === customModel);

    return (
      <ChipPopover
        trigger={trigger}
        align="end"
        side="top"
        sideOffset={6}
        className="min-w-[300px]"
      >
        <PopoverSectionLabel>{BACKEND_LABEL[backend]} 模型</PopoverSectionLabel>
        {CLAUDE_MODEL_OPTIONS.map((option) => (
          <PopoverItem
            key={option.id || "default"}
            selected={claudeModel === option.id}
            trailing={
              claudeModel === option.id ? (
                <Check size={12} className="opacity-70" />
              ) : null
            }
            onClick={() => void setClaudeModel(option.id)}
          >
            <div className="flex flex-col items-start">
              <span className="text-[12.5px] leading-tight">{option.label}</span>
              <span className="text-[11px] leading-tight text-foreground-subtle">
                {option.description}
              </span>
            </div>
          </PopoverItem>
        ))}
        <PopoverSeparator />
        <div className="mx-1 mb-1 flex h-7 items-center gap-1 rounded-md bg-black/[0.04] px-2 text-[12px] text-foreground-muted dark:bg-white/[0.06]">
          <Search size={12} className="shrink-0 opacity-70" />
          <input
            value={modelQuery}
            onChange={(e) => setModelQuery(e.target.value)}
            placeholder="输入自定义模型"
            className="min-w-0 flex-1 bg-transparent text-foreground outline-none placeholder:text-foreground-subtle"
          />
        </div>
        {canUseCustom && (
          <PopoverItem
            onClick={() => {
              void setClaudeModel(customModel);
              setModelQuery("");
            }}
          >
            使用 “{customModel}”
          </PopoverItem>
        )}
      </ChipPopover>
    );
  }

  const options = models
    .map((m) => ({
      id: m.model || m.id || "",
      label: m.displayName || m.model || m.id || "",
    }))
    .filter((m) => m.id)
    .filter(
      (m, index, arr) => arr.findIndex((candidate) => candidate.id === m.id) === index,
    )
    .filter((m) =>
      modelQuery.trim()
        ? `${m.id} ${m.label}`.toLowerCase().includes(modelQuery.trim().toLowerCase())
        : true,
    );

  const customModel = modelQuery.trim();
  const canUseCustom =
    customModel.length > 0 && !options.some((candidate) => candidate.id === customModel);

  return (
    <ChipPopover trigger={trigger} align="end" side="top" sideOffset={6}>
      <PopoverSectionLabel>智能</PopoverSectionLabel>
      {LEVELS.map((level) => (
        <PopoverItem
          key={level.id}
          selected={reasoning === level.id}
          onClick={() => void setReasoning(level.id)}
        >
          {level.label}
        </PopoverItem>
      ))}
      <PopoverSeparator />
      <PopoverItem
        leading={<Zap size={12} className="fill-current" strokeWidth={0} />}
        onClick={() => setShowModels((p) => !p)}
      >
        {model || "默认模型"}
      </PopoverItem>
      {showModels && (
        <>
          <PopoverSeparator />
          <PopoverSectionLabel>模型</PopoverSectionLabel>
          <div className="mx-1 mb-1 flex h-7 items-center gap-1 rounded-md bg-black/[0.04] px-2 text-[12px] text-foreground-muted dark:bg-white/[0.06]">
            <Search size={12} className="shrink-0 opacity-70" />
            <input
              value={modelQuery}
              onChange={(e) => setModelQuery(e.target.value)}
              placeholder="搜索或输入模型"
              className="min-w-0 flex-1 bg-transparent text-foreground outline-none placeholder:text-foreground-subtle"
            />
          </div>
          {modelError && models.length === 0 ? (
            <div className="px-2 py-1.5 text-[11px] text-foreground-subtle">
              无法读取模型列表，可手动输入模型名
            </div>
          ) : null}
          {options.map((m) => (
            <PopoverItem
              key={m.id}
              selected={model === m.id}
              trailing={
                model === m.id ? <Check size={12} className="opacity-70" /> : null
              }
              onClick={() => {
                void setModel(m.id);
                setShowModels(false);
                setModelQuery("");
              }}
            >
              <span className="truncate">{m.label}</span>
            </PopoverItem>
          ))}
          {canUseCustom && (
            <PopoverItem
              onClick={() => {
                void setModel(customModel);
                setShowModels(false);
                setModelQuery("");
              }}
            >
              使用 “{customModel}”
            </PopoverItem>
          )}
        </>
      )}
    </ChipPopover>
  );
}
