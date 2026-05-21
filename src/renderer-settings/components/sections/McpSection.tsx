import { Plus, Settings2, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { SectionShell } from "../SectionShell";

type McpServerRecord = {
  command?: string;
  args?: string[];
  env?: Record<string, string>;
  enabled?: boolean;
  url?: string;
};

type McpServers = Record<string, McpServerRecord>;

interface DraftServer {
  name: string;
  command: string;
  args: string;
}

/**
 * `~/.codex/config.toml`'s `[mcp_servers.<name>]` tables are the source of
 * truth for which MCP servers Codex launches. We mirror the table here and
 * round-trip changes through the config IPC layer.
 */
export function McpSection() {
  const [servers, setServers] = useState<McpServers>({});
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState<DraftServer>({ name: "", command: "", args: "" });

  useEffect(() => {
    void window.codex.config
      .get(["mcp_servers"])
      .then((value) => {
        if (value && typeof value === "object" && !Array.isArray(value)) {
          setServers(value as McpServers);
        }
      })
      .catch(() => {
        // Initial read failure (likely no config yet) — start with empty table.
      });
  }, []);

  async function toggle(id: string) {
    const current = servers[id];
    if (!current) return;
    const enabled = !(current.enabled ?? true);
    const next: McpServers = { ...servers, [id]: { ...current, enabled } };
    setServers(next);
    await window.codex.config.set(["mcp_servers", id, "enabled"], enabled);
    await reloadMcpServers();
  }

  async function remove(id: string) {
    const { [id]: _omit, ...rest } = servers;
    setServers(rest);
    await window.codex.config.set(["mcp_servers", id], null);
    await reloadMcpServers();
  }

  async function addServer() {
    const name = draft.name.trim();
    if (!name) return;
    const args = draft.args.trim()
      ? draft.args.trim().split(/\s+/)
      : [];
    const record: McpServerRecord = {
      command: draft.command.trim(),
      args,
      enabled: true,
    };
    const next: McpServers = { ...servers, [name]: record };
    setServers(next);
    await window.codex.config.set(["mcp_servers", name], record);
    await reloadMcpServers();
    setAdding(false);
    setDraft({ name: "", command: "", args: "" });
  }

  const entries = Object.entries(servers);

  return (
    <SectionShell title="MCP 服务器">
      <p className="-mt-7 text-[12px] text-foreground-subtle">
        连接外部工具和数据源。
      </p>

      <section>
        <header className="mb-2 flex items-center justify-between">
          <h2 className="text-[13px] font-medium text-foreground">服务器</h2>
          <button
            type="button"
            onClick={() => setAdding((p) => !p)}
            className="flex h-7 items-center gap-1 rounded-md border border-border bg-white px-2 text-[12px] text-foreground hover:bg-black/[0.02]"
          >
            <Plus size={11} strokeWidth={1.8} />
            添加服务器
          </button>
        </header>
        {adding && (
          <div className="mb-3 grid gap-2 rounded-lg p-3 ring-1 ring-border">
            <input
              type="text"
              autoFocus
              placeholder="名称 (例: gitnexus)"
              value={draft.name}
              onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
              className="h-8 rounded-md border border-border bg-white px-2 text-[12.5px] text-foreground outline-none focus:border-accent"
            />
            <input
              type="text"
              placeholder="命令 (例: npx)"
              value={draft.command}
              onChange={(e) => setDraft((d) => ({ ...d, command: e.target.value }))}
              className="h-8 rounded-md border border-border bg-white px-2 text-[12.5px] text-foreground outline-none focus:border-accent"
            />
            <input
              type="text"
              placeholder="参数 (例: -y @some/mcp-package)"
              value={draft.args}
              onChange={(e) => setDraft((d) => ({ ...d, args: e.target.value }))}
              className="h-8 rounded-md border border-border bg-white px-2 text-[12.5px] text-foreground outline-none focus:border-accent"
            />
            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setAdding(false);
                  setDraft({ name: "", command: "", args: "" });
                }}
                className="h-7 rounded-md px-2 text-[12px] text-foreground-muted hover:bg-black/[0.04]"
              >
                取消
              </button>
              <button
                type="button"
                onClick={() => void addServer()}
                disabled={!draft.name.trim()}
                className="h-7 rounded-md bg-[#1a1a1a] px-3 text-[12px] font-medium text-white hover:bg-black disabled:opacity-50"
              >
                添加
              </button>
            </div>
          </div>
        )}
        <div className="overflow-hidden rounded-lg ring-1 ring-border">
          {entries.length === 0 ? (
            <EmptyState
              title="No servers configured"
              subtitle="Add a server to connect external tools"
            />
          ) : (
            entries.map(([id, server]) => {
              const enabled = server.enabled ?? true;
              return (
                <div
                  key={id}
                  className="flex items-center gap-3 border-b border-border px-4 py-3 last:border-b-0"
                >
                  <div className="flex-1">
                    <div className="text-[12.5px] text-foreground">{id}</div>
                    <div className="mt-0.5 truncate text-[11.5px] text-foreground-subtle">
                      {[server.command, ...(server.args ?? [])]
                        .filter(Boolean)
                        .join(" ") || server.url || ""}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => void remove(id)}
                    className="flex h-6 w-6 items-center justify-center rounded-md text-foreground-muted hover:bg-black/[0.04]"
                    aria-label="删除"
                    title="删除"
                  >
                    <Trash2 size={12} strokeWidth={1.8} />
                  </button>
                  <button
                    type="button"
                    className="flex h-6 w-6 items-center justify-center rounded-md text-foreground-muted hover:bg-black/[0.04]"
                    aria-label="服务器设置"
                    title="编辑 config.toml"
                    onClick={async () => {
                      const path = await window.codex.config.path();
                      void window.codex.file.open(path);
                    }}
                  >
                    <Settings2 size={12} strokeWidth={1.8} />
                  </button>
                  <ServerToggle
                    checked={enabled}
                    onCheckedChange={() => void toggle(id)}
                  />
                </div>
              );
            })
          )}
        </div>
      </section>
    </SectionShell>
  );
}

async function reloadMcpServers() {
  await window.codex.codex
    .request("config/mcpServer/reload")
    .catch(() => undefined);
}

function ServerToggle({
  checked,
  onCheckedChange,
}: {
  checked: boolean;
  onCheckedChange: () => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={onCheckedChange}
      data-state={checked ? "checked" : "unchecked"}
      className="relative h-[18px] w-[30px] rounded-full bg-black/[0.18] outline-none transition-colors data-[state=checked]:bg-[#339cff]"
    >
      <span
        data-state={checked ? "checked" : "unchecked"}
        className="block h-3.5 w-3.5 translate-x-[2px] rounded-full bg-white shadow transition-transform data-[state=checked]:translate-x-[14px]"
      />
    </button>
  );
}

function EmptyState({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div className="px-4 py-3">
      <div className="text-[12.5px] text-foreground">{title}</div>
      <div className="mt-0.5 text-[12px] text-foreground-subtle">{subtitle}</div>
    </div>
  );
}
