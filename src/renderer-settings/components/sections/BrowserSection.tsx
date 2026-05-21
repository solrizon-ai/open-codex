import { ChevronDown, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { SectionShell, SettingsGroup, SettingsRow } from "../SectionShell";
import { Toggle } from "../Toggle";
import { useConfigValue } from "../../hooks/useConfigValue";
import { PromptDialog } from "../../../renderer/components/common/PromptDialog";
import { cn } from "../../../renderer/lib/cn";

type WarnPolicy = "always-ask" | "trusted-only" | "never";

const NS = ["desktop", "browser"] as const;

const WARN_LABEL: Record<WarnPolicy, string> = {
  "always-ask": "始终询问",
  "trusted-only": "仅信任域名静默",
  never: "从不询问",
};

export function BrowserSection() {
  const [enabled, setEnabled] = useConfigValue<boolean>(
    [...NS, "enabled"],
    true,
  );
  const [warn, setWarn] = useConfigValue<WarnPolicy>(
    [...NS, "warn_policy"],
    "always-ask",
  );

  async function clearBrowsingData() {
    if (!confirm("确认清除应用内浏览器的所有网站数据和缓存？")) return;
    await window.codex.browser.clearData();
  }

  return (
    <SectionShell title="浏览器">
      <p className="-mt-7 text-[12px] text-foreground-subtle">
        管理内置浏览器的数据、访问提示和域名规则。
      </p>

      <SettingsGroup>
        <SettingsRow
          label="浏览器"
          description="允许 Codex 控制内置浏览器"
        >
          <Toggle checked={enabled} onCheckedChange={setEnabled} />
        </SettingsRow>
      </SettingsGroup>

      <SettingsGroup title="数据">
        <SettingsRow
          label="浏览数据"
          description="清除应用内浏览器中的网站数据和缓存"
        >
          <button
            type="button"
            onClick={() => void clearBrowsingData()}
            className="h-7 rounded-md border border-border bg-white px-2 text-[12px] text-foreground hover:bg-black/[0.02]"
          >
            清除所有浏览数据
          </button>
        </SettingsRow>
      </SettingsGroup>

      <SettingsGroup title="权限">
        <SettingsRow
          label="警告"
          description="选择是否让 Codex 在打开网站前先求批准。"
        >
          <PolicyPill value={warn} labels={WARN_LABEL} onChange={setWarn} />
        </SettingsRow>
      </SettingsGroup>

      <DomainList
        title="已屏蔽的域名"
        hint="Codex 绝不会打开这些网站"
        emptyLabel="没有已屏蔽的域名"
        configKey={[...NS, "blocked_domains"]}
      />

      <DomainList
        title="允许的域名"
        hint="无需询问即可打开的域名"
        emptyLabel="没有允许的域名"
        configKey={[...NS, "allowed_domains"]}
      />
    </SectionShell>
  );
}

function DomainList({
  title,
  hint,
  emptyLabel,
  configKey,
}: {
  title: string;
  hint: string;
  emptyLabel: string;
  configKey: ReadonlyArray<string>;
}) {
  const [domains, setDomains] = useConfigValue<string[]>([...configKey], []);
  const [adding, setAdding] = useState(false);
  const list = Array.isArray(domains) ? domains : [];

  return (
    <section>
      <header className="mb-2 flex items-center justify-between">
        <div>
          <h2 className="text-[13px] font-medium text-foreground">{title}</h2>
          <p className="mt-0.5 text-[12px] text-foreground-subtle">{hint}</p>
        </div>
        <button
          type="button"
          onClick={() => setAdding(true)}
          className="flex h-7 items-center gap-1 rounded-md border border-border bg-white px-2 text-[12px] text-foreground"
        >
          <Plus size={11} strokeWidth={1.8} />
          添加
        </button>
      </header>
      {list.length === 0 ? (
        <div className="flex h-10 items-center justify-center rounded-lg ring-1 ring-border text-[12px] text-foreground-subtle">
          {emptyLabel}
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg ring-1 ring-border">
          {list.map((d) => (
            <div
              key={d}
              className="flex items-center gap-3 border-b border-border bg-white px-3 py-2 last:border-b-0"
            >
              <span className="flex-1 truncate font-mono text-[12px] text-foreground">
                {d}
              </span>
              <button
                type="button"
                onClick={() => setDomains(list.filter((x) => x !== d))}
                className="flex h-6 w-6 items-center justify-center rounded-md text-foreground-muted hover:bg-rose-50 hover:text-rose-500"
                title="删除"
              >
                <Trash2 size={12} strokeWidth={1.8} />
              </button>
            </div>
          ))}
        </div>
      )}
      <PromptDialog
        open={adding}
        title={`添加${title}`}
        placeholder="example.com"
        confirmLabel="添加"
        onCancel={() => setAdding(false)}
        onConfirm={(value) => {
          const next = Array.from(new Set([...list, value]));
          setDomains(next);
          setAdding(false);
        }}
      />
    </section>
  );
}

function PolicyPill<T extends string>({
  value,
  labels,
  onChange,
}: {
  value: T;
  labels: Record<T, string>;
  onChange: (next: T) => void;
}) {
  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <button
          type="button"
          className={cn(
            "flex h-7 min-w-[160px] items-center justify-between gap-1 rounded-md border border-border bg-white px-2 text-[12px] text-foreground",
          )}
        >
          <span>{labels[value]}</span>
          <ChevronDown size={11} strokeWidth={1.8} className="opacity-60" />
        </button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align="end"
          sideOffset={4}
          className="z-50 min-w-[180px] rounded-md border border-border/60 bg-surface-elevated p-1 text-[12.5px] text-foreground shadow-popover"
        >
          {(Object.keys(labels) as T[]).map((id) => (
            <DropdownMenu.Item
              key={id}
              onSelect={() => onChange(id)}
              className="flex h-7 cursor-default select-none items-center rounded px-2 outline-none data-[highlighted]:bg-black/[0.05]"
            >
              {labels[id]}
            </DropdownMenu.Item>
          ))}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
