import {
  Check,
  ChevronDown,
  ExternalLink,
  MoreHorizontal,
  Plus,
  Search,
  Trash2,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { cn } from "../../lib/cn";
import { ensureCodexInitialized } from "../../codex/useCodex";
import { useProjectStore } from "../../state/project";
import { useUiStore } from "../../state/ui";
import { PromptDialog } from "../common/PromptDialog";

interface PluginInterface {
  displayName?: string | null;
  shortDescription?: string | null;
  brandColor?: string | null;
}

interface PluginSummary {
  id: string;
  name: string;
  installed: boolean;
  enabled: boolean;
  interface?: PluginInterface | null;
  keywords?: string[];
}

interface MarketplaceEntry {
  name: string;
  path: string | null;
  plugins: PluginSummary[];
}

interface PluginListResponse {
  marketplaces?: MarketplaceEntry[];
  marketplaceLoadErrors?: { message?: string }[];
  featuredPluginIds?: string[];
}

interface PluginListItem {
  marketplaceName: string;
  marketplacePath: string | null;
  plugin: PluginSummary;
}

interface InstalledServer {
  id: string;
  command?: string;
  args?: string[];
  url?: string;
  enabled?: boolean;
}

interface Skill {
  name: string;
  description: string;
  shortDescription?: string;
  path: string;
  scope: string;
  enabled: boolean;
  interface?: {
    displayName?: string;
    shortDescription?: string;
    brandColor?: string;
  };
}

interface SkillsListResponse {
  data?: { cwd: string; skills: Skill[]; errors?: { path: string; message: string }[] }[];
}

interface AppInfo {
  id: string;
  name: string;
  description: string | null;
  logoUrl: string | null;
  branding: {
    category?: string | null;
    developer?: string | null;
  } | null;
  installUrl: string | null;
  isAccessible: boolean;
  isEnabled: boolean;
  pluginDisplayNames?: string[];
}

interface AppsListResponse {
  data?: AppInfo[];
  nextCursor?: string | null;
}

type FilterId = "all" | "available" | "installed";
export function PluginsView() {
  const tab = useUiStore((s) => s.integrationsTab);
  const setTab = useUiStore((s) => s.setIntegrationsTab);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<FilterId>("all");
  const [plugins, setPlugins] = useState<PluginListItem[]>([]);
  const [apps, setApps] = useState<AppInfo[]>([]);
  const [installedServers, setInstalledServers] = useState<Record<string, InstalledServer>>({});
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const project = useProjectStore((s) => s.current);

  async function reload() {
    setLoading(true);
    setError(null);
    try {
      const [pluginResponse, servers] = await Promise.all([
        readPlugins(project?.cwd),
        readMcpServers(),
      ]);
      setPlugins(flattenPluginResponse(pluginResponse));
      setInstalledServers(servers);
      const loadErrors = pluginResponse.marketplaceLoadErrors ?? [];
      if (loadErrors.length > 0) {
        setError(loadErrors.map((e) => summarizeError(e.message)).filter(Boolean).join("\n"));
      }
    } catch (e) {
      setError(summarizeError(e instanceof Error ? e.message : String(e)));
      setPlugins([]);
    } finally {
      setLoading(false);
    }
  }

  async function reloadApps(forceRefetch = false) {
    setLoading(true);
    setError(null);
    try {
      await ensureCodexInitialized();
      const response = (await window.codex.codex.request("app/list", {
        limit: 100,
        forceRefetch,
      })) as AppsListResponse;
      setApps(response.data ?? []);
    } catch (e) {
      setError(summarizeError(e instanceof Error ? e.message : String(e)));
      setApps([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void reload();
  }, [project?.cwd]);

  useEffect(() => {
    if (tab === "apps") void reloadApps(false);
  }, [tab]);

  useEffect(() => {
    const unsubscribe = window.codex.codex.onNotification((message) => {
      if (!message || typeof message !== "object") return;
      const method = (message as { method?: unknown }).method;
      const params = (message as { params?: unknown }).params;
      if (
        method === "app/list/updated" &&
        params &&
        typeof params === "object" &&
        Array.isArray((params as { data?: unknown }).data)
      ) {
        setApps((params as { data: AppInfo[] }).data);
      }
    });
    return unsubscribe;
  }, []);

  async function install(entry: PluginListItem) {
    try {
      await ensureCodexInitialized();
      await window.codex.codex.request("plugin/install", {
        marketplacePath: entry.marketplacePath,
        remoteMarketplaceName: entry.marketplacePath ? null : entry.marketplaceName,
        pluginName: entry.plugin.name,
      });
      await reload();
    } catch (e) {
      setError(summarizeError(e instanceof Error ? e.message : String(e)));
    }
  }

  async function uninstallPlugin(id: string) {
    try {
      await ensureCodexInitialized();
      await window.codex.codex.request("plugin/uninstall", { pluginId: id });
      await reload();
    } catch (e) {
      setError(summarizeError(e instanceof Error ? e.message : String(e)));
    }
  }

  async function uninstallMcpServer(id: string) {
    try {
      await window.codex.config.set(["mcp_servers", id], null);
      setInstalledServers(await readMcpServers());
      await window.codex.codex.request("config/mcpServer/reload").catch(() => undefined);
    } catch (e) {
      setError(summarizeError(e instanceof Error ? e.message : String(e)));
    }
  }

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return plugins.filter((entry) => {
      if (filter === "installed" && !entry.plugin.installed) return false;
      if (filter === "available" && entry.plugin.installed) return false;
      if (!q) return true;
      const iface = entry.plugin.interface;
      return [
        entry.plugin.id,
        entry.plugin.name,
        iface?.displayName,
        iface?.shortDescription,
        ...(entry.plugin.keywords ?? []),
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(q);
    });
  }, [plugins, query, filter]);

  const visibleApps = useMemo(() => {
    const q = query.trim().toLowerCase();
    return apps.filter((app) => {
      if (filter === "installed" && !app.isAccessible) return false;
      if (filter === "available" && app.isAccessible) return false;
      if (!q) return true;
      return [
        app.id,
        app.name,
        app.description,
        app.branding?.category,
        app.branding?.developer,
        ...(app.pluginDisplayNames ?? []),
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(q);
    });
  }, [apps, filter, query]);

  return (
    <main className="flex h-full w-full flex-col bg-surface-elevated">
      <header className="flex h-[44px] items-center justify-between px-4 [app-region:drag]">
        <div className="flex items-center gap-1 text-[12px] text-foreground-muted [app-region:no-drag]">
          <TabButton active={tab === "plugins"} onClick={() => setTab("plugins")}>
            插件
          </TabButton>
          <TabButton active={tab === "apps"} onClick={() => setTab("apps")}>
            应用
          </TabButton>
          <TabButton active={tab === "skills"} onClick={() => setTab("skills")}>
            技能
          </TabButton>
        </div>
        <div className="flex-1" />
        <div className="flex items-center gap-1 text-[12px] text-foreground-muted [app-region:no-drag]">
          <button
            type="button"
            onClick={() => void window.codex.window.openSettings()}
            className="rounded-md px-2 py-1 hover:bg-black/[0.04]"
          >
            管理
          </button>
          <button
            type="button"
            onClick={() => setCreating(true)}
            className="rounded-md px-2 py-1 hover:bg-black/[0.04]"
          >
            创建
          </button>
          <DropdownMenu.Root>
            <DropdownMenu.Trigger asChild>
              <button
                type="button"
                className="flex h-7 w-7 items-center justify-center rounded-md hover:bg-black/[0.04]"
              >
                <MoreHorizontal size={14} />
              </button>
            </DropdownMenu.Trigger>
            <DropdownMenu.Portal>
              <DropdownMenu.Content
                align="end"
                sideOffset={4}
                className="z-50 min-w-[180px] rounded-md border border-border/60 bg-surface-elevated p-1 text-[12.5px] text-foreground shadow-popover"
              >
                <DropdownMenu.Item
                  onSelect={async () => {
                    const path = await window.codex.config.path();
                    void window.codex.file.open(path);
                  }}
                  className="flex h-7 cursor-default select-none items-center rounded px-2 outline-none data-[highlighted]:bg-black/[0.05]"
                >
                  打开 config.toml
                </DropdownMenu.Item>
                <DropdownMenu.Item
                  onSelect={() => {
                    if (tab === "apps") void reloadApps(true);
                    else void reload();
                  }}
                  className="flex h-7 cursor-default select-none items-center rounded px-2 outline-none data-[highlighted]:bg-black/[0.05]"
                >
                  刷新
                </DropdownMenu.Item>
              </DropdownMenu.Content>
            </DropdownMenu.Portal>
          </DropdownMenu.Root>
        </div>
      </header>

      <div className="mx-auto w-full max-w-[760px] flex-1 overflow-y-auto px-6 pb-10">
        <h1 className="mt-6 text-center text-[22px] font-medium text-foreground">
          让 Codex 按你的方式工作
        </h1>

        <div className="mt-5 flex items-center gap-2">
          <div className="flex h-9 flex-1 items-center gap-2 rounded-lg border border-border bg-white px-3 text-[13px] text-foreground">
            <Search size={14} className="opacity-60" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="搜索插件"
              className="flex-1 bg-transparent text-foreground placeholder:text-foreground-subtle focus:outline-none"
            />
          </div>
          <FilterPill label={filterLabel(filter)} onSelect={setFilter} current={filter} />
        </div>

        {error && (
          <div className="mt-3 whitespace-pre-wrap rounded-md border border-rose-200 bg-rose-50/60 px-3 py-2 text-[12px] text-rose-600">
            {error}
          </div>
        )}

        {tab === "plugins" ? (
          <>
            {Object.keys(installedServers).length > 0 && (
              <section className="mt-8">
                <h2 className="mb-2 text-[13px] font-medium text-foreground">
                  MCP 服务器
                </h2>
                <div className="grid grid-cols-2 gap-2">
                  {Object.values(installedServers).map((server) => (
                    <CustomServerCard
                      key={server.id}
                      server={server}
                      onUninstall={() => void uninstallMcpServer(server.id)}
                    />
                  ))}
                </div>
              </section>
            )}

            <section className="mt-8">
              <h2 className="mb-2 text-[13px] font-medium text-foreground">
                Codex 插件
              </h2>
              <div className="grid grid-cols-2 gap-2">
                {visible.map((entry) => (
                  <PluginCard
                    key={`${entry.marketplaceName}:${entry.plugin.id}`}
                    entry={entry}
                    onInstall={() => void install(entry)}
                    onUninstall={() => void uninstallPlugin(entry.plugin.id)}
                  />
                ))}
              </div>
              {visible.length === 0 && (
                <div className="rounded-lg border border-dashed border-border px-4 py-8 text-center text-[12px] text-foreground-subtle">
                  {loading ? "正在读取 Codex 插件…" : "没有匹配的插件"}
                </div>
              )}
            </section>
          </>
        ) : tab === "apps" ? (
          <AppsTab apps={visibleApps} loading={loading} />
        ) : (
          <SkillsTab cwd={project?.cwd ?? null} />
        )}
      </div>

      <PromptDialog
        open={creating}
        title="创建自定义 MCP 服务器"
        description="格式：name|command|args (空格分隔，例：myserver|npx|-y @my/server)"
        placeholder="myserver|npx|-y @my/server"
        confirmLabel="创建"
        onCancel={() => setCreating(false)}
        onConfirm={async (raw) => {
          const [name, command, ...rest] = raw.split("|");
          if (!name || !command) throw new Error("格式不正确");
          const args = rest.join(" ").split(/\s+/).filter(Boolean);
          await window.codex.config.set(["mcp_servers", name], {
            command,
            args,
            enabled: true,
          });
          await window.codex.codex.request("config/mcpServer/reload").catch(() => undefined);
          setInstalledServers(await readMcpServers());
          setCreating(false);
        }}
      />
    </main>
  );
}

function AppsTab({ apps, loading }: { apps: AppInfo[]; loading: boolean }) {
  if (apps.length === 0) {
    return (
      <section className="mt-8">
        <div className="rounded-lg border border-dashed border-border px-4 py-8 text-center text-[12px] text-foreground-subtle">
          {loading ? "正在读取 Codex 应用…" : "没有匹配的应用"}
        </div>
      </section>
    );
  }

  return (
    <section className="mt-8">
      <h2 className="mb-2 text-[13px] font-medium text-foreground">
        Codex 应用
      </h2>
      <div className="grid grid-cols-2 gap-2">
        {apps.map((app) => (
          <AppCard key={app.id} app={app} />
        ))}
      </div>
    </section>
  );
}

function AppCard({ app }: { app: AppInfo }) {
  return (
    <div className="flex items-center gap-3 rounded-lg border border-border bg-white p-3 hover:border-border-strong">
      {app.logoUrl ? (
        <img
          src={app.logoUrl}
          alt=""
          className="h-9 w-9 shrink-0 rounded-lg border border-border object-cover"
        />
      ) : (
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-zinc-900 text-[14px] font-medium text-white">
          {app.name.charAt(0).toUpperCase()}
        </div>
      )}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1">
          <div className="truncate text-[13px] font-medium text-foreground">
            {app.name}
          </div>
          {app.isAccessible && (
            <span className="rounded bg-emerald-50 px-1.5 py-0.5 text-[10.5px] text-emerald-700">
              已连接
            </span>
          )}
        </div>
        <div className="truncate text-[11.5px] text-foreground-subtle">
          {app.description || app.branding?.category || app.id}
        </div>
      </div>
      {app.installUrl && (
        <button
          type="button"
          title={app.isAccessible ? "打开" : "连接"}
          onClick={() => void window.codex.file.open(app.installUrl!)}
          className="flex h-7 w-7 items-center justify-center rounded-md text-foreground-muted hover:bg-black/[0.05]"
        >
          <ExternalLink size={13} strokeWidth={1.8} />
        </button>
      )}
    </div>
  );
}

async function readPlugins(cwd?: string): Promise<PluginListResponse> {
  await ensureCodexInitialized();
  return window.codex.codex.request("plugin/list", {
    cwds: cwd ? [cwd] : undefined,
    marketplaceKinds: ["local", "workspace-directory"],
  }) as Promise<PluginListResponse>;
}

function summarizeError(message?: string): string {
  if (!message) return "";
  if (message.includes("remote plugin catalog") || message.includes("ps/plugins/list")) {
    return "";
  }
  return message.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim().slice(0, 360);
}

async function readMcpServers(): Promise<Record<string, InstalledServer>> {
  const value = await window.codex.config.get(["mcp_servers"]);
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const map: Record<string, InstalledServer> = {};
  for (const [id, raw] of Object.entries(value)) {
    if (raw && typeof raw === "object") {
      map[id] = { ...(raw as InstalledServer), id };
    }
  }
  return map;
}

function flattenPluginResponse(response: PluginListResponse): PluginListItem[] {
  return (response.marketplaces ?? []).flatMap((marketplace) =>
    (marketplace.plugins ?? []).map((plugin) => ({
      marketplaceName: marketplace.name,
      marketplacePath: marketplace.path,
      plugin,
    })),
  );
}

function filterLabel(filter: FilterId): string {
  if (filter === "available") return "可安装";
  if (filter === "installed") return "已安装";
  return "全部";
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-md px-2 py-0.5",
        active ? "text-foreground" : "hover:bg-black/[0.04]",
      )}
    >
      {children}
    </button>
  );
}

function FilterPill({
  label,
  current,
  onSelect,
}: {
  label: string;
  current: FilterId;
  onSelect: (id: FilterId) => void;
}) {
  const options: { id: FilterId; label: string }[] = [
    { id: "all", label: "全部" },
    { id: "available", label: "可安装" },
    { id: "installed", label: "已安装" },
  ];
  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <button className="flex h-9 items-center gap-1 rounded-lg border border-border bg-white px-3 text-[12.5px] text-foreground hover:border-border-strong">
          {label}
          <ChevronDown size={11} className="opacity-60" />
        </button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align="end"
          sideOffset={4}
          className="z-50 min-w-[180px] rounded-md border border-border/60 bg-surface-elevated p-1 text-[12.5px] text-foreground shadow-popover"
        >
          {options.map((opt) => (
            <DropdownMenu.Item
              key={opt.id}
              onSelect={() => onSelect(opt.id)}
              className={cn(
                "flex h-7 cursor-default select-none items-center rounded px-2 outline-none data-[highlighted]:bg-black/[0.05]",
                current === opt.id && "bg-black/[0.04]",
              )}
            >
              {opt.label}
            </DropdownMenu.Item>
          ))}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}

function PluginCard({
  entry,
  onInstall,
  onUninstall,
}: {
  entry: PluginListItem;
  onInstall: () => void;
  onUninstall: () => void;
}) {
  const plugin = entry.plugin;
  const iface = plugin.interface;
  const name = iface?.displayName || plugin.name || plugin.id;
  const description = iface?.shortDescription || entry.marketplaceName;
  const color = iface?.brandColor || "#111827";

  return (
    <div className="flex items-center gap-3 rounded-lg border border-border bg-white p-3 hover:border-border-strong">
      <div
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-[14px] font-medium text-white"
        style={{ background: color }}
      >
        {name.charAt(0).toUpperCase()}
      </div>
      <div className="min-w-0 flex-1">
        <div className="truncate text-[13px] font-medium text-foreground">{name}</div>
        <div className="truncate text-[11.5px] text-foreground-subtle">
          {description}
        </div>
      </div>
      <button
        type="button"
        onClick={plugin.installed ? onUninstall : onInstall}
        title={plugin.installed ? "卸载" : "安装"}
        className={cn(
          "flex h-7 w-7 items-center justify-center rounded-md",
          plugin.installed
            ? "text-emerald-600 hover:bg-rose-50 hover:text-rose-500"
            : "text-foreground-muted hover:bg-black/[0.05]",
        )}
      >
        {plugin.installed ? (
          <Check size={14} strokeWidth={2} />
        ) : (
          <Plus size={14} strokeWidth={1.8} />
        )}
      </button>
    </div>
  );
}

function CustomServerCard({
  server,
  onUninstall,
}: {
  server: InstalledServer;
  onUninstall: () => void;
}) {
  return (
    <div className="flex items-center gap-3 rounded-lg border border-border bg-white p-3 hover:border-border-strong">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-zinc-900 text-[14px] font-medium text-white">
        {server.id.charAt(0).toUpperCase()}
      </div>
      <div className="min-w-0 flex-1">
        <div className="truncate text-[13px] font-medium text-foreground">{server.id}</div>
        <div className="truncate text-[11.5px] text-foreground-subtle">
          {[server.command, ...(server.args ?? [])].filter(Boolean).join(" ") ||
            server.url ||
            ""}
        </div>
      </div>
      <button
        type="button"
        onClick={onUninstall}
        title="卸载"
        className="flex h-7 w-7 items-center justify-center rounded-md text-foreground-muted hover:bg-rose-50 hover:text-rose-500"
      >
        <Trash2 size={13} strokeWidth={1.8} />
      </button>
    </div>
  );
}

function SkillsTab({ cwd }: { cwd: string | null }) {
  const [skills, setSkills] = useState<Skill[]>([]);
  const [errors, setErrors] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  async function reload() {
    setLoading(true);
    setErrors([]);
    try {
      await ensureCodexInitialized();
      const response = (await window.codex.codex.request("skills/list", {
        cwds: cwd ? [cwd] : [],
        forceReload: true,
      })) as SkillsListResponse;
      const entries = response.data ?? [];
      setSkills(entries.flatMap((entry) => entry.skills ?? []));
      setErrors(
        entries.flatMap((entry) =>
          (entry.errors ?? []).map((e) => `${e.path}: ${e.message}`),
        ),
      );
    } catch (e) {
      setErrors([e instanceof Error ? e.message : String(e)]);
      setSkills([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void reload();
  }, [cwd]);

  async function toggle(skill: Skill) {
    const enabled = !skill.enabled;
    setSkills((current) =>
      current.map((s) => (s.path === skill.path ? { ...s, enabled } : s)),
    );
    try {
      await window.codex.codex.request("skills/config/write", {
        path: skill.path,
        enabled,
      });
      await reload();
    } catch (e) {
      setErrors([e instanceof Error ? e.message : String(e)]);
    }
  }

  if (skills.length === 0) {
    return (
      <section className="mt-8">
        {errors.length > 0 && (
          <div className="mb-3 whitespace-pre-wrap rounded-md border border-rose-200 bg-rose-50/60 px-3 py-2 text-[12px] text-rose-600">
            {errors.join("\n")}
          </div>
        )}
        <div className="rounded-lg border border-dashed border-border px-4 py-8 text-center text-[12px] text-foreground-subtle">
          {loading ? "正在读取 Codex 技能…" : "没有可用技能"}
        </div>
      </section>
    );
  }

  return (
    <section className="mt-8">
      {errors.length > 0 && (
        <div className="mb-3 whitespace-pre-wrap rounded-md border border-amber-200 bg-amber-50/60 px-3 py-2 text-[12px] text-amber-700">
          {errors.join("\n")}
        </div>
      )}
      <h2 className="mb-2 text-[13px] font-medium text-foreground">Codex 技能</h2>
      <div className="grid grid-cols-2 gap-2">
        {skills.map((skill) => (
          <div
            key={skill.path}
            className="flex items-center gap-3 rounded-lg border border-border bg-white p-3"
          >
            <div className="min-w-0 flex-1">
              <div className="truncate text-[13px] font-medium text-foreground">
                {skill.interface?.displayName || skill.name}
              </div>
              <div className="truncate text-[11.5px] text-foreground-subtle">
                {skill.interface?.shortDescription ||
                  skill.shortDescription ||
                  skill.description}
              </div>
            </div>
            <button
              type="button"
              onClick={() => void toggle(skill)}
              className={cn(
                "h-6 rounded-md px-2 text-[11.5px]",
                skill.enabled
                  ? "bg-emerald-50 text-emerald-700"
                  : "bg-black/[0.04] text-foreground-muted",
              )}
            >
              {skill.enabled ? "已启用" : "已停用"}
            </button>
          </div>
        ))}
      </div>
    </section>
  );
}
