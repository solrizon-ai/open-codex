import { Sun, Moon, MonitorSmartphone } from "lucide-react";
import { SectionShell, SettingsGroup, SettingsRow } from "../SectionShell";
import { Toggle } from "../Toggle";
import { cn } from "../../../renderer/lib/cn";
import { useTheme } from "../../../renderer/theme";
import type { ThemeMode, ThemeVariant } from "../../../shared/theme";

export function AppearanceSection() {
  const { theme, update } = useTheme();

  return (
    <SectionShell title="外观">
      <section>
        <div className="mb-2 flex items-center justify-between">
          <div>
            <h2 className="text-[13px] font-medium text-foreground">主题</h2>
            <p className="mt-0.5 text-[12px] text-foreground-subtle">
              使用浅色、深色、或匹配系统设置
            </p>
          </div>
          <ThemeModeToggle value={theme.mode} onChange={(mode) => update({ mode })} />
        </div>
        <ThemePreview />
      </section>

      <ThemeEditor variant="light" />
      <ThemeEditor variant="dark" />

      <SettingsGroup>
        <SettingsRow label="使用指针光标" description="悬停交互元素时切换为指针光标">
          <Toggle
            checked={theme.cursorPointer}
            onCheckedChange={(cursorPointer) => update({ cursorPointer })}
          />
        </SettingsRow>
        <SettingsRow label="Reduce motion" description="Reduce animations or match your system">
          <SegmentedControl
            options={["System", "On", "Off"]}
            value={
              theme.reduceMotion === "system"
                ? "System"
                : theme.reduceMotion === "on"
                  ? "On"
                  : "Off"
            }
            onSelect={(label) =>
              update({
                reduceMotion:
                  label === "System" ? "system" : label === "On" ? "on" : "off",
              })
            }
          />
        </SettingsRow>
        <SettingsRow label="UI 字号" description="调整 Codex UI 使用的基准字号">
          <NumberInput value={theme.uiFontSize} suffix="px" onChange={(uiFontSize) => update({ uiFontSize })} />
        </SettingsRow>
        <SettingsRow label="代码字体大小" description="调整聊天和差异视图中代码使用的基础字号">
          <NumberInput value={theme.codeFontSize} suffix="px" onChange={(codeFontSize) => update({ codeFontSize })} />
        </SettingsRow>
        <SettingsRow label="字体平滑" description="使用 macOS 原生字体抗锯齿">
          <Toggle
            checked={theme.fontSmoothing}
            onCheckedChange={(fontSmoothing) => update({ fontSmoothing })}
          />
        </SettingsRow>
      </SettingsGroup>
    </SectionShell>
  );
}

function ThemeModeToggle({
  value,
  onChange,
}: {
  value: ThemeMode;
  onChange: (v: ThemeMode) => void;
}) {
  const options: { id: ThemeMode; icon: typeof Sun; label: string }[] = [
    { id: "light", icon: Sun, label: "浅色" },
    { id: "dark", icon: Moon, label: "深色" },
    { id: "system", icon: MonitorSmartphone, label: "系统" },
  ];
  return (
    <div className="flex items-center gap-0.5 rounded-md border border-border bg-white p-0.5 text-[12px] text-foreground-muted">
      {options.map(({ id, icon: Icon, label }) => {
        const isActive = value === id;
        return (
          <button
            key={id}
            type="button"
            onClick={() => onChange(id)}
            className={cn(
              "flex h-6 items-center gap-1 rounded px-2",
              isActive ? "bg-black/[0.06] text-foreground" : "hover:text-foreground",
            )}
          >
            <Icon size={12} strokeWidth={1.8} />
            {label}
          </button>
        );
      })}
    </div>
  );
}

function ThemePreview() {
  const lightSnippet = [
    "const themePreview: ThemeConfig = {",
    "  surface: \"sidebar\",",
    "  accent: \"#2563eb\",",
    "  contrast: 42,",
    "};",
  ];
  const darkSnippet = [
    "const themePreview: ThemeConfig = {",
    "  surface: \"sidebar-elevated\",",
    "  accent: \"#0ea5e9\",",
    "  contrast: 68,",
    "};",
  ];

  return (
    <div className="grid grid-cols-2 gap-px overflow-hidden rounded-lg bg-border ring-1 ring-border">
      <CodeBlock lines={lightSnippet} variant="del" />
      <CodeBlock lines={darkSnippet} variant="add" />
    </div>
  );
}

function CodeBlock({ lines, variant }: { lines: string[]; variant: "add" | "del" }) {
  return (
    <div
      className={cn(
        "font-mono text-[11.5px] leading-[1.7] bg-white",
        variant === "del" && "bg-red-50/70 dark:bg-red-900/15",
        variant === "add" && "bg-green-50/70 dark:bg-green-900/15",
      )}
    >
      {lines.map((line, i) => (
        <div key={i} className="flex items-stretch">
          <div className="w-7 select-none border-r border-black/[0.05] px-2 text-right text-foreground-subtle">
            {i + 1}
          </div>
          <pre className="m-0 flex-1 px-3 py-[1px] text-foreground">{line}</pre>
        </div>
      ))}
    </div>
  );
}

function ThemeEditor({ variant }: { variant: "light" | "dark" }) {
  const { theme, updateLight, updateDark } = useTheme();
  const heading = variant === "light" ? "浅色主题" : "深色主题";
  const v: ThemeVariant = variant === "light" ? theme.light : theme.dark;
  const setV = variant === "light" ? updateLight : updateDark;

  function importTheme() {
    const raw = window.prompt("粘贴主题 JSON");
    if (!raw) return;
    const next = JSON.parse(raw) as Partial<ThemeVariant>;
    setV(next);
  }

  async function copyTheme() {
    await navigator.clipboard.writeText(JSON.stringify(v, null, 2));
  }

  return (
    <section>
      <header className="mb-2 flex items-center justify-between">
        <h2 className="text-[13px] font-medium text-foreground">{heading}</h2>
        <div className="flex items-center gap-2 text-[12px] text-foreground-muted">
          <button
            type="button"
            onClick={importTheme}
            className="rounded px-2 py-0.5 hover:text-foreground"
          >
            导入
          </button>
          <button
            type="button"
            onClick={() => void copyTheme()}
            className="rounded px-2 py-0.5 hover:text-foreground"
          >
            复制主题
          </button>
          <div
            className="flex h-6 items-center gap-1 rounded-md border border-border bg-white px-2"
          >
            <span className="font-mono text-[10.5px]">Aa</span>
            Codex
            <svg width="11" height="11" viewBox="0 0 24 24" className="opacity-60">
              <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" />
            </svg>
          </div>
        </div>
      </header>
      <div className="overflow-hidden rounded-lg ring-1 ring-border">
        <SettingsRow label="强调色">
          <ColorChip color={v.accent} onChange={(accent) => setV({ accent })} />
        </SettingsRow>
        <SettingsRow label="背景">
          <ColorChip color={v.background} bordered onChange={(background) => setV({ background })} />
        </SettingsRow>
        <SettingsRow label="前景">
          <ColorChip color={v.foreground} onChange={(foreground) => setV({ foreground })} />
        </SettingsRow>
        <SettingsRow label="UI 字体">
          <span className="font-mono text-[11.5px] text-foreground-muted">{v.uiFont}</span>
        </SettingsRow>
        <SettingsRow label="代码字体">
          <span className="font-mono text-[11.5px] text-foreground-muted">{v.monoFont}</span>
        </SettingsRow>
        <SettingsRow label="半透明侧边栏">
          <Toggle
            checked={v.translucentSidebar}
            onCheckedChange={(translucentSidebar) => setV({ translucentSidebar })}
          />
        </SettingsRow>
        <SettingsRow label="对比度">
          <Slider value={v.contrast} onChange={(contrast) => setV({ contrast })} />
        </SettingsRow>
      </div>
    </section>
  );
}

function ColorChip({
  color,
  bordered,
  onChange,
}: {
  color: string;
  bordered?: boolean;
  onChange?: (next: string) => void;
}) {
  return (
    <label
      className={cn(
        "flex h-7 w-[200px] cursor-pointer items-center gap-2 rounded-md px-2 font-mono text-[11.5px]",
        bordered ? "border border-border bg-white text-foreground" : "text-white",
      )}
      style={{ background: bordered ? undefined : color }}
    >
      {bordered && (
        <span
          className="h-4 w-4 rounded-full border border-border"
          style={{ background: color }}
        />
      )}
      <span className={cn(bordered ? "text-foreground" : "text-white")}>{color}</span>
      <input
        type="color"
        value={color}
        onChange={(e) => onChange?.(e.target.value.toUpperCase())}
        className="sr-only"
      />
    </label>
  );
}

function SegmentedControl({
  options,
  value,
  onSelect,
}: {
  options: string[];
  value: string;
  onSelect?: (opt: string) => void;
}) {
  return (
    <div className="flex items-center gap-0.5 rounded-md border border-border bg-white p-0.5 text-[12px] text-foreground-muted">
      {options.map((opt) => (
        <button
          key={opt}
          type="button"
          onClick={() => onSelect?.(opt)}
          className={cn(
            "h-6 rounded px-2",
            value === opt ? "bg-black/[0.06] text-foreground" : "hover:text-foreground",
          )}
        >
          {opt}
        </button>
      ))}
    </div>
  );
}

function NumberInput({
  value,
  suffix,
  onChange,
}: {
  value: number;
  suffix?: string;
  onChange?: (v: number) => void;
}) {
  return (
    <div className="flex h-7 items-center gap-1 rounded-md border border-border bg-white px-2 text-[12px] text-foreground focus-within:ring-2 focus-within:ring-ring">
      <input
        type="number"
        value={value}
        onChange={(e) => onChange?.(Number(e.target.value))}
        className="w-10 bg-transparent text-right focus:outline-none"
      />
      {suffix && <span className="text-foreground-subtle">{suffix}</span>}
    </div>
  );
}

function Slider({
  value,
  onChange,
}: {
  value: number;
  onChange?: (v: number) => void;
}) {
  return (
    <div className="flex w-[260px] items-center gap-3">
      <input
        type="range"
        min={0}
        max={100}
        value={value}
        onChange={(e) => onChange?.(Number(e.target.value))}
        className="flex-1 accent-[var(--accent)]"
      />
      <span className="w-10 text-right text-[12px] text-foreground">{value}</span>
    </div>
  );
}
