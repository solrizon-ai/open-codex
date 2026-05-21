import { ChevronDown, Check } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { SectionShell, SettingsGroup, SettingsRow } from "../SectionShell";
import { useConfigValue } from "../../hooks/useConfigValue";
import { cn } from "../../../renderer/lib/cn";
import { ensureCodexInitialized } from "../../../renderer/codex/useCodex";

type Personality = "warm" | "pragmatic";
type CodexPersonality = "none" | "friendly" | "pragmatic";

const PERSONALITY_OPTIONS: {
  id: Personality;
  label: string;
  description: string;
}[] = [
  { id: "warm", label: "亲和", description: "温暖，协作，贴心" },
  { id: "pragmatic", label: "务实", description: "简洁，专注，直接" },
];

export function PersonalizationSection() {
  const [personality, setPersonality] = useConfigValue<CodexPersonality>(
    ["personality"],
    "friendly",
  );
  const [savedInstructions, setSavedInstructions] = useConfigValue<string>(
    ["instructions"],
    "",
  );

  const [draftInstructions, setDraftInstructions] = useState(savedInstructions);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    if (!dirty) setDraftInstructions(savedInstructions);
  }, [savedInstructions, dirty]);

  async function resetMemory() {
    if (!confirm("确认删除所有 Codex 记忆？此操作不可恢复。")) return;
    await ensureCodexInitialized();
    await window.codex.codex.request("memory/reset");
  }

  return (
    <SectionShell title="个性化">
      <SettingsGroup>
        <SettingsRow
          label="个性"
          description="选择 Codex 回复的默认语气"
        >
          <PersonalityDropdown value={personality} onChange={setPersonality} />
        </SettingsRow>
      </SettingsGroup>

      <section>
        <header className="mb-2">
          <h2 className="text-[13px] font-medium text-foreground">自定义指令</h2>
          <p className="mt-0.5 text-[12px] text-foreground-subtle">
            为 Codex 提供额外说明和上下文，写入 config.toml 的 instructions。
          </p>
        </header>
        <div className="overflow-hidden rounded-lg ring-1 ring-border bg-white">
          <textarea
            value={draftInstructions}
            onChange={(e) => {
              setDraftInstructions(e.target.value);
              setDirty(true);
            }}
            placeholder="添加自定义指令…"
            className="block min-h-[180px] w-full resize-none bg-transparent px-3 py-2.5 text-[12.5px] text-foreground placeholder:text-foreground-subtle focus:outline-none"
          />
          <div className="flex justify-end border-t border-border px-2 py-1.5">
            <button
              type="button"
              disabled={!dirty}
              onClick={() => {
                setSavedInstructions(draftInstructions);
                setDirty(false);
              }}
              className={cn(
                "h-7 rounded-md px-3 text-[12px]",
                !dirty
                  ? "bg-black/[0.04] text-foreground-subtle"
                  : "bg-foreground text-white hover:bg-foreground/90",
              )}
            >
              {dirty ? "保存" : "已保存"}
            </button>
          </div>
        </div>
      </section>

      <section>
        <header className="mb-2">
          <h2 className="text-[13px] font-medium text-foreground">
            记忆（实验性）
          </h2>
          <p className="mt-0.5 text-[12px] text-foreground-subtle">
            清除当前 Codex home 下的本地记忆文件和记忆阶段数据。
          </p>
        </header>
        <div className="overflow-hidden rounded-lg ring-1 ring-border">
        <SettingsRow
          label="重置记忆"
          description="删除所有 Codex 记忆"
        >
          <DangerButton label="重置" onClick={() => void resetMemory()} />
        </SettingsRow>
        </div>
      </section>
    </SectionShell>
  );
}

function PersonalityDropdown({
  value,
  onChange,
}: {
  value: CodexPersonality;
  onChange: (v: CodexPersonality) => void;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    }
    window.addEventListener("mousedown", onClick);
    return () => window.removeEventListener("mousedown", onClick);
  }, []);

  const current =
    PERSONALITY_OPTIONS.find((o) => toCodexPersonality(o.id) === value) ??
    PERSONALITY_OPTIONS[0]!;

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex h-7 w-[220px] items-center justify-between gap-1 rounded-md border border-border bg-white px-2 text-[12px] text-foreground"
      >
        <span>{current.label}</span>
        <ChevronDown size={11} strokeWidth={1.8} className="opacity-60" />
      </button>
      {open && (
        <div className="absolute right-0 top-[calc(100%+4px)] z-10 w-[220px] overflow-hidden rounded-md border border-border bg-white shadow-md">
          {PERSONALITY_OPTIONS.map((opt) => {
            const codexValue = toCodexPersonality(opt.id);
            const isActive = codexValue === value;
            return (
              <button
                key={opt.id}
                type="button"
                onClick={() => {
                  onChange(codexValue);
                  setOpen(false);
                }}
                className="flex w-full items-start gap-2 px-3 py-2 text-left hover:bg-black/[0.04]"
              >
                <div className="flex-1">
                  <div className="text-[12.5px] text-foreground">{opt.label}</div>
                  <div className="mt-0.5 text-[11.5px] text-foreground-subtle">
                    {opt.description}
                  </div>
                </div>
                {isActive && (
                  <Check
                    size={12}
                    strokeWidth={2}
                    className="mt-0.5 text-foreground-muted"
                  />
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function toCodexPersonality(value: Personality): CodexPersonality {
  return value === "warm" ? "friendly" : value;
}

function DangerButton({
  label,
  onClick,
}: {
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="h-7 rounded-md border border-red-200 bg-red-50/60 px-3 text-[12px] text-red-600 hover:bg-red-50"
    >
      {label}
    </button>
  );
}
