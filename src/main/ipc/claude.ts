import { BrowserWindow, ipcMain } from "electron";
import { execFile, spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { readdir, readFile, stat } from "node:fs/promises";
import { homedir } from "node:os";
import { basename, dirname, isAbsolute, join, relative, resolve } from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

const CLAUDE_HOME = process.env.CLAUDE_HOME || join(homedir(), ".claude");
const PROJECTS_DIR = join(CLAUDE_HOME, "projects");
const SKILLS_DIR = join(CLAUDE_HOME, "skills");
const PLUGIN_CACHE_DIR = join(CLAUDE_HOME, "plugins", "cache");
const INSTALLED_PLUGINS_FILE = join(
  CLAUDE_HOME,
  "plugins",
  "installed_plugins.json",
);

interface ClaudeHistoryThread {
  id: string;
  title: string;
  preview: string;
  cwd: string;
  updatedAt: number;
  source: "claude";
}

interface ClaudeTurnItem {
  id?: string;
  type?: string;
  role?: "user" | "assistant" | "system" | "tool";
  text?: string;
  raw: Record<string, unknown>;
}

interface ClaudeSlashCommand {
  command: string;
  description: string;
  path?: string;
  kind: "skill" | "command";
  order?: number;
}

type JsonObject = Record<string, unknown>;
interface ClaudePluginInstall {
  scope?: string;
  projectPath?: string;
  installPath?: string;
}

interface ClaudePluginRegistry {
  plugins?: Record<string, ClaudePluginInstall[]>;
}

type ClaudePermissionMode =
  | "default"
  | "acceptEdits"
  | "plan"
  | "dontAsk"
  | "bypassPermissions"
  | "auto";

interface ClaudeTurnParams {
  cwd: string;
  threadId?: string | null;
  input: unknown;
  model?: string | null;
  permissionMode?: ClaudePermissionMode | "" | null;
}

const CLAUDE_PERMISSION_MODES = new Set<ClaudePermissionMode>([
  "default",
  "acceptEdits",
  "plan",
  "dontAsk",
  "bypassPermissions",
  "auto",
]);

const BUILTIN_CLAUDE_COMMANDS: ClaudeSlashCommand[] = [
  { command: "add-dir", description: "Add a new working directory", kind: "command" },
  { command: "advisor", description: "Configure the Advisor Tool to consult a stronger model for guidance", kind: "command" },
  { command: "agents", description: "Manage agent configurations", kind: "command" },
  { command: "apps", description: "Manage connected apps", kind: "command" },
  { command: "autofix-pr", description: "Monitor and autofix issues with the current PR", kind: "command" },
  { command: "batch", description: "Research and plan a large-scale change, then execute it in parallel across isolated worktree agents", kind: "command" },
  { command: "background", description: "Send this session to the background and free the terminal", kind: "command" },
  { command: "branch", description: "Create a branch of the current conversation at this point", kind: "command" },
  { command: "btw", description: "Ask a quick side question without interrupting the main conversation", kind: "command" },
  { command: "chrome", description: "Claude in Chrome settings", kind: "command" },
  { command: "clear", description: "Start a new session with empty context; previous session stays on disk", kind: "command" },
  { command: "color", description: "Set the prompt bar color for this session", kind: "command" },
  { command: "compact", description: "Free up context by summarizing the conversation so far", kind: "command" },
  { command: "config", description: "Open config panel", kind: "command" },
  { command: "context", description: "Visualize current context usage as a colored grid", kind: "command" },
  { command: "copy", description: "Copy Claude's last response to clipboard", kind: "command" },
  { command: "debug", description: "Enable debug logging for this session and help diagnose issues", kind: "command" },
  { command: "desktop", description: "Continue the current session in Claude Desktop", kind: "command" },
  { command: "diff", description: "View uncommitted changes and per-turn diffs", kind: "command" },
  { command: "doctor", description: "Diagnose and verify your Claude Code installation and settings", kind: "command" },
  { command: "effort", description: "Set effort level for model usage", kind: "command" },
  { command: "exit", description: "Exit the CLI", kind: "command" },
  { command: "export", description: "Export the current conversation to a file or clipboard", kind: "command" },
  { command: "fast", description: "Toggle fast mode", kind: "command" },
  { command: "feedback", description: "Submit feedback, report a bug, or share your conversation", kind: "command" },
  { command: "focus", description: "Toggle focus view", kind: "command" },
  { command: "goal", description: "Set a goal and keep working until the condition is met", kind: "command" },
  { command: "help", description: "Show help and available commands", kind: "command" },
  { command: "hooks", description: "View hook configurations for tool events", kind: "command" },
  { command: "ide", description: "Manage IDE integrations and show status", kind: "command" },
  { command: "install-github-app", description: "Set up Claude GitHub Actions for a repository", kind: "command" },
  { command: "install-slack-app", description: "Install the Claude Slack app", kind: "command" },
  { command: "keybindings", description: "Open or create your keybindings configuration file", kind: "command" },
  { command: "login", description: "Sign in with your Anthropic account", kind: "command" },
  { command: "logout", description: "Sign out from your Anthropic account", kind: "command" },
  { command: "mcp", description: "Manage MCP servers", kind: "command" },
  { command: "memory", description: "Edit Claude memory files", kind: "command" },
  { command: "mobile", description: "Show QR code to download the Claude mobile app", kind: "command" },
  { command: "model", description: "Set the AI model for Claude Code", kind: "command" },
  { command: "permissions", description: "Manage allow and deny tool permission rules", kind: "command" },
  { command: "plan", description: "Enable plan mode or view the current session plan", kind: "command" },
  { command: "plugin", description: "Manage Claude Code plugins", kind: "command" },
  { command: "powerup", description: "Discover Claude Code features through quick interactive lessons", kind: "command" },
  { command: "privacy-settings", description: "View and update your privacy settings", kind: "command" },
  { command: "radio", description: "Listen to Claude FM lo-fi radio", kind: "command" },
  { command: "recap", description: "Generate a one-line session recap now", kind: "command" },
  { command: "release-notes", description: "View release notes", kind: "command" },
  { command: "reload-plugins", description: "Activate pending plugin changes in the current session", kind: "command" },
  { command: "remote-control", description: "Control this session from your phone or claude.ai/code", kind: "command" },
  { command: "remote-env", description: "Configure the default remote environment for teleport sessions", kind: "command" },
  { command: "rename", description: "Rename the current conversation", kind: "command" },
  { command: "resume", description: "Resume a previous conversation", kind: "command" },
  { command: "review", description: "Review a pull request", kind: "command" },
  { command: "rewind", description: "Restore the code and/or conversation to a previous point", kind: "command" },
  { command: "sandbox", description: "Configure sandbox mode", kind: "command" },
  { command: "schedule", description: "Create, update, list, or run scheduled remote agents", kind: "command" },
  { command: "security-review", description: "Complete a security review of the pending changes on the current branch", kind: "command" },
  { command: "simplify", description: "Review changed code for reuse, quality, and efficiency, then fix issues found", kind: "command" },
  { command: "skills", description: "List available skills", kind: "command" },
  { command: "status", description: "Show Claude Code status including version, model, account, API connectivity, and tool statuses", kind: "command" },
  { command: "statusline", description: "Set up Claude Code's status line UI", kind: "command" },
  { command: "stickers", description: "Order Claude Code stickers", kind: "command" },
  { command: "tasks", description: "List and manage background tasks", kind: "command" },
  { command: "teleport", description: "Resume a Claude Code session from claude.ai", kind: "command" },
  { command: "terminal-setup", description: "Check terminal setup", kind: "command" },
  { command: "theme", description: "Change the theme", kind: "command" },
  { command: "tui", description: "Set the terminal UI renderer", kind: "command" },
  { command: "ultraplan", description: "Claude Code on the web drafts a plan you can edit and approve", kind: "command" },
  { command: "ultrareview", description: "Finds and verifies bugs in your branch", kind: "command" },
  { command: "upgrade", description: "Upgrade to Max for higher rate limits and more Opus", kind: "command" },
  { command: "usage", description: "Show session cost, plan usage, and activity stats", kind: "command" },
  { command: "usage-credits", description: "Configure usage credits to keep working when you hit a limit", kind: "command" },
  { command: "voice", description: "Toggle voice mode", kind: "command" },
  { command: "web-setup", description: "Setup Claude Code on the web", kind: "command" },
];

function broadcast(channel: string, payload: unknown) {
  for (const win of BrowserWindow.getAllWindows()) {
    if (!win.isDestroyed()) win.webContents.send(channel, payload);
  }
}

async function commandExists(bin: string): Promise<boolean> {
  try {
    await execFileAsync(bin, ["--version"], { timeout: 3000 });
    return true;
  } catch {
    return false;
  }
}

async function resolveClaudeBin(): Promise<string> {
  const candidates = [
    process.env.CLAUDE_BIN,
    process.env.CCB_BIN,
    "/opt/homebrew/bin/claude",
    "/usr/local/bin/claude",
    "claude",
    "ccb",
    "claude-code-best",
  ].filter((v): v is string => !!v);

  for (const candidate of candidates) {
    if (await commandExists(candidate)) return candidate;
  }

  throw new Error(
    "未找到 Claude Code CLI。请安装 claude，或设置 CLAUDE_BIN=/path/to/claude。",
  );
}

async function pathExists(path: string): Promise<boolean> {
  try {
    await stat(path);
    return true;
  } catch {
    return false;
  }
}

async function listFiles(
  root: string,
  predicate: (path: string) => boolean,
  maxDepth = 8,
): Promise<string[]> {
  if (!(await pathExists(root))) return [];
  const out: string[] = [];
  async function walk(dir: string, depth: number): Promise<void> {
    if (depth > maxDepth) return;
    let entries: Array<{
      name: string;
      isDirectory: () => boolean;
    }>;
    try {
      entries = await readdir(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      if (entry.name.startsWith(".")) continue;
      const path = join(dir, entry.name);
      if (entry.isDirectory()) await walk(path, depth + 1);
      else if (predicate(path)) out.push(path);
    }
  }
  await walk(root, 0);
  return out;
}

function projectDirForCwd(cwd: string): string {
  return join(PROJECTS_DIR, cwd.replace(/\//g, "-"));
}

function parseJsonLine(line: string): JsonObject | null {
  try {
    const value = JSON.parse(line) as unknown;
    return value && typeof value === "object" && !Array.isArray(value)
      ? (value as JsonObject)
      : null;
  } catch {
    return null;
  }
}

function timestampMs(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value > 10_000_000_000 ? value : value * 1000;
  }
  if (typeof value === "string") {
    const parsed = Date.parse(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

function isJsonObject(value: unknown): value is JsonObject {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function contentParts(content: unknown): JsonObject[] {
  if (typeof content === "string") return [{ type: "text", text: content }];
  if (!Array.isArray(content)) return [];
  return content.filter(isJsonObject);
}

function messageContent(obj: JsonObject): unknown {
  const message = obj.message;
  if (isJsonObject(message)) return message.content;
  if ("content" in obj) return obj.content;
  return undefined;
}

function tagValue(text: string, tag: string): string {
  const match = new RegExp(`<${tag}>([\\s\\S]*?)</${tag}>`).exec(text);
  return (match?.[1] ?? "").trim();
}

function isCommandXml(text: string): boolean {
  return /<command-(?:name|message|args)>/.test(text);
}

function isTaskNotificationXml(text: string): boolean {
  return /<task-notification>/.test(text);
}

function isLocalCommandXml(text: string): boolean {
  return /<local-command-(?:stdout|stderr)>/.test(text);
}

function commandTextFromXml(text: string, includeEmpty = true): string {
  if (!isCommandXml(text)) return "";
  const command = tagValue(text, "command-name") || tagValue(text, "command-message");
  const args = tagValue(text, "command-args");
  if (!command) return "";
  if (!includeEmpty && !args) return "";
  const normalized = command.startsWith("/") ? command : `/${command}`;
  return [normalized, args].filter(Boolean).join(" ");
}

function taskNotificationText(text: string): string {
  if (!isTaskNotificationXml(text)) return "";
  const summary = tagValue(text, "summary");
  const status = tagValue(text, "status");
  const output = tagValue(text, "output-file");
  return [
    status ? `任务状态: ${status}` : "",
    summary,
    output ? `输出文件: ${output}` : "",
  ]
    .filter(Boolean)
    .join("\n");
}

function localCommandText(text: string): string {
  if (!isLocalCommandXml(text)) return "";
  const stdout = tagValue(text, "local-command-stdout");
  const stderr = tagValue(text, "local-command-stderr");
  return summarize(stdout || stderr, 320);
}

function toolUseErrorText(text: string): string {
  return tagValue(text, "tool_use_error");
}

function isInjectedClaudeContext(text: string): boolean {
  const clean = text.trim();
  return (
    clean.startsWith("Base directory for this skill:") ||
    clean.startsWith("Base directory for this plugin:") ||
    /^# .+\n\n## When to Use/m.test(clean)
  );
}

function safeTextPreview(value: unknown, limit = 280): string {
  let text = "";
  if (typeof value === "string") {
    text = taskNotificationText(value) || toolUseErrorText(value) || value;
  } else if (Array.isArray(value)) {
    const entries = value
      .map((entry) => {
        if (!isJsonObject(entry)) return "";
        if (typeof entry.text === "string") return entry.text;
        if (typeof entry.content === "string") return entry.content;
        if (typeof entry.tool_name === "string") return entry.tool_name;
        return "";
      })
      .filter(Boolean);
    text = entries.length > 0 ? entries.join("\n") : JSON.stringify(value);
  } else if (value != null) {
    try {
      text = JSON.stringify(value);
    } catch {
      text = String(value);
    }
  }

  const clean = text.replace(/\s+/g, " ").trim();
  return clean.length > limit ? `${clean.slice(0, limit - 1)}…` : clean;
}

function userTextFromContent(content: unknown, includeEmptyCommands = true): string {
  return contentParts(content)
    .map((part) => {
      if (typeof part.text !== "string") return "";
      const text = part.text.trim();
      if (!text || isInjectedClaudeContext(text)) return "";
      if (isCommandXml(text)) return commandTextFromXml(text, includeEmptyCommands);
      if (isTaskNotificationXml(text) || isLocalCommandXml(text)) return "";
      return text;
    })
    .filter(Boolean)
    .join("\n\n")
    .trim();
}

function assistantTextFromContent(content: unknown): string {
  return contentParts(content)
    .map((part) => (typeof part.text === "string" ? part.text : ""))
    .filter(Boolean)
    .join("\n")
    .trim();
}

function toolResultTextFromContent(content: unknown): string {
  const entries = contentParts(content)
    .filter((part) => part.type === "tool_result")
    .map((part) => {
      const value = part.content;
      const isError = part.is_error === true;
      if (typeof value === "string") {
        const task = taskNotificationText(value);
        if (task) return task;
        const preview = safeTextPreview(value);
        const important =
          isError ||
          /^Task #\d+/i.test(preview) ||
          /\b(rate limit|hit your limit|error|failed|exception)\b/i.test(preview) ||
          /(?:^|\s|\/)generated_images\/.+\.(?:png|jpe?g|webp)\b/i.test(preview);
        return important ? preview : "";
      }
      if (Array.isArray(value)) {
        const objects = value.filter(isJsonObject);
        if (
          objects.length > 0 &&
          objects.every((entry) => entry.type === "tool_reference")
        ) {
          return "";
        }
        if (!isError) return "";
        const texts = objects
          .map((entry) => {
            if (typeof entry.text === "string") return entry.text;
            if (typeof entry.content === "string") return entry.content;
            if (typeof entry.tool_name === "string") return entry.tool_name;
            return "";
          })
          .filter(Boolean);
        return safeTextPreview(texts.length > 0 ? texts.join("\n") : value);
      }
      return safeTextPreview(value);
    })
    .filter(Boolean);
  return entries.join("\n\n").trim();
}

function localCommandTextFromContent(content: unknown): string {
  return contentParts(content)
    .map((part) =>
      typeof part.text === "string" ? localCommandText(part.text) : "",
    )
    .filter(Boolean)
    .join("\n\n")
    .trim();
}

function toolInputPreview(input: unknown): string {
  if (typeof input === "string") return summarize(input, 220);
  if (Array.isArray(input)) return safeTextPreview(input, 220);
  if (!isJsonObject(input)) return "";
  const preferred =
    input.command ??
    input.description ??
    input.prompt ??
    input.query ??
    input.q ??
    input.path ??
    input.file_path ??
    input.pattern ??
    input.url ??
    input.name ??
    input.title ??
    input.message;
  if (typeof preferred === "string") return summarize(preferred, 220);
  return safeTextPreview(input, 220);
}

function summarize(text: string, limit = 120): string {
  const clean = text.replace(/\s+/g, " ").trim();
  return clean.length > limit ? `${clean.slice(0, limit - 1)}…` : clean;
}

async function readThreadSummary(file: string): Promise<ClaudeHistoryThread | null> {
  const id = basename(file, ".jsonl");
  const fallbackCwd = dirname(file)
    .slice(PROJECTS_DIR.length)
    .replace(/^\//, "")
    .replace(/-/g, "/");
  let text = "";
  try {
    text = await readFile(file, "utf8");
  } catch {
    return null;
  }

  let title = "";
  let firstUser = "";
  let preview = "";
  let cwd = fallbackCwd.startsWith("/") ? fallbackCwd : `/${fallbackCwd}`;
  let updatedAt = 0;

  for (const line of text.split("\n")) {
    if (!line.trim()) continue;
    const obj = parseJsonLine(line);
    if (!obj) continue;
    if (typeof obj.cwd === "string") cwd = obj.cwd;
    if (typeof obj.aiTitle === "string") title = obj.aiTitle;
    updatedAt = Math.max(updatedAt, timestampMs(obj.timestamp));

    const type = typeof obj.type === "string" ? obj.type : "";
    let entryText = "";
    if (type === "user") {
      entryText = userTextFromContent(messageContent(obj), false);
    } else if (type === "assistant") {
      entryText = assistantTextFromContent(messageContent(obj));
    } else if (type === "last-prompt" && typeof obj.lastPrompt === "string") {
      entryText = obj.lastPrompt;
    }
    if (type === "user" && entryText && !firstUser && !obj.isMeta) {
      firstUser = entryText;
    }
    if (
      (type === "user" || type === "assistant" || type === "last-prompt") &&
      entryText &&
      !obj.isMeta
    ) {
      preview = entryText;
    }
  }

  if (!updatedAt) {
    try {
      updatedAt = (await stat(file)).mtimeMs;
    } catch {
      updatedAt = 0;
    }
  }

  return {
    id,
    cwd,
    title: summarize(
      title && !/\[Request interrupted by user\]/i.test(title)
        ? title
        : firstUser || preview || "未命名对话",
      80,
    ),
    preview: summarize(preview, 160),
    updatedAt: Math.floor(updatedAt / 1000),
    source: "claude",
  };
}

async function listClaudeHistory(cwd?: string | null): Promise<ClaudeHistoryThread[]> {
  const roots =
    cwd && cwd.trim()
      ? [projectDirForCwd(cwd.trim())]
      : (await readdir(PROJECTS_DIR, { withFileTypes: true }).catch(() => []))
          .filter((entry) => entry.isDirectory())
          .map((entry) => join(PROJECTS_DIR, entry.name));

  const files: string[] = [];
  for (const root of roots) {
    files.push(
      ...(await listFiles(root, (path) => path.endsWith(".jsonl"), 1)),
    );
  }

  const threads = (
    await Promise.all(files.map((file) => readThreadSummary(file)))
  ).filter((thread): thread is ClaudeHistoryThread => thread !== null);

  return threads
    .filter((thread) => !cwd || thread.cwd === cwd)
    .sort((a, b) => b.updatedAt - a.updatedAt)
    .slice(0, 80);
}

async function locateThreadFile(threadId: string, cwd?: string | null): Promise<string> {
  const direct = cwd ? join(projectDirForCwd(cwd), `${threadId}.jsonl`) : null;
  if (direct && (await pathExists(direct))) return direct;
  const matches = await listFiles(
    PROJECTS_DIR,
    (path) => basename(path) === `${threadId}.jsonl`,
    2,
  );
  if (matches[0]) return matches[0];
  throw new Error(`找不到 Claude Code 会话: ${threadId}`);
}

function itemsFromClaudeLine(obj: JsonObject, index: number): ClaudeTurnItem[] {
  if (obj.isMeta === true) return [];
  const type = typeof obj.type === "string" ? obj.type : "";
  const id = typeof obj.uuid === "string" ? obj.uuid : `${type}-${index}`;
  if (type === "user") {
    const content = messageContent(obj);
    const userText = userTextFromContent(content, true);
    if (userText) {
      return [
        {
          id,
          type: "userMessage",
          role: "user",
          text: summarize(userText, 10000),
          raw: obj,
        },
      ];
    }
    const toolText = toolResultTextFromContent(content);
    const localText = localCommandTextFromContent(content);
    const activityText = toolText || localText;
    if (!activityText) return [];
    return [
      {
        id,
        type: "claudeToolResult",
        role: "tool",
        text: summarize(activityText, 700),
        raw: {
          ...obj,
          type: "claudeToolResult",
          label: localText ? "本地命令输出" : "工具结果",
          detail: summarize(activityText, 240),
        },
      },
    ];
  }
  if (type === "assistant") {
    const content = messageContent(obj);
    const items: ClaudeTurnItem[] = [];
    const text = assistantTextFromContent(content);
    if (text) {
      items.push({ id, type: "agentMessage", role: "assistant", text, raw: obj });
    }
    contentParts(content)
      .filter((part) => part.type === "tool_use" && typeof part.name === "string")
      .forEach((part, partIndex) => {
        const toolName = String(part.name);
        if (toolName === "TaskUpdate" || toolName === "Monitor") return;
        const detail = toolInputPreview(part.input);
        items.push({
          id: `${id}:tool:${partIndex}`,
          type: "claudeToolUse",
          role: "tool",
          text: [`使用工具: ${toolName}`, detail].filter(Boolean).join("\n"),
          raw: {
            ...obj,
            type: "claudeToolUse",
            label: `使用工具: ${toolName}`,
            detail,
            toolName,
            input: part.input,
          },
        });
      });
    return items;
  }
  if (type === "system" && typeof obj.content === "string") {
    if (
      isCommandXml(obj.content) ||
      isLocalCommandXml(obj.content) ||
      isTaskNotificationXml(obj.content)
    ) {
      return [];
    }
    return [
      {
        id,
        type: "system",
        role: "system",
        text: obj.content,
        raw: obj,
      },
    ];
  }
  return [];
}

function compactClaudeToolRuns(items: ClaudeTurnItem[]): ClaudeTurnItem[] {
  const out: ClaudeTurnItem[] = [];
  let buffer: ClaudeTurnItem[] = [];

  const flush = () => {
    if (buffer.length === 0) return;
    if (buffer.length <= 14) {
      out.push(...buffer);
      buffer = [];
      return;
    }

    const keep = new Set<number>();
    for (let i = 0; i < Math.min(5, buffer.length); i++) keep.add(i);
    for (let i = Math.max(0, buffer.length - 3); i < buffer.length; i++) {
      keep.add(i);
    }
    buffer.forEach((item, index) => {
      if (item.type === "claudeToolResult") keep.add(index);
    });

    const kept = [...keep].sort((a, b) => a - b);
    let hiddenCount = 0;
    const hiddenNames = new Map<string, number>();
    buffer.forEach((item, index) => {
      if (keep.has(index)) return;
      hiddenCount++;
      const raw = item.raw;
      const name =
        typeof raw.toolName === "string"
          ? raw.toolName
          : item.type ?? item.role ?? "tool";
      hiddenNames.set(name, (hiddenNames.get(name) ?? 0) + 1);
    });

    for (const index of kept) out.push(buffer[index]!);
    if (hiddenCount > 0) {
      const detail = [...hiddenNames.entries()]
        .sort((a, b) => b[1] - a[1])
        .map(([name, count]) => `${name} x${count}`)
        .join(", ");
      out.push({
        id: `claude-tool-summary-${out.length}`,
        type: "claudeToolResult",
        role: "tool",
        text: `已折叠 ${hiddenCount} 个 Claude Code 工具事件`,
        raw: {
          type: "claudeToolResult",
          label: `已折叠 ${hiddenCount} 个 Claude Code 工具事件`,
          detail,
        },
      });
    }
    buffer = [];
  };

  for (const item of items) {
    if (item.role === "tool") {
      buffer.push(item);
      continue;
    }
    flush();
    out.push(item);
  }
  flush();
  return out;
}

async function readClaudeThread(
  threadId: string,
  cwd?: string | null,
): Promise<{ id: string; cwd: string | null; items: ClaudeTurnItem[] }> {
  const file = await locateThreadFile(threadId, cwd);
  const text = await readFile(file, "utf8");
  const items: ClaudeTurnItem[] = [];
  let resolvedCwd: string | null = cwd ?? null;
  let index = 0;
  for (const line of text.split("\n")) {
    if (!line.trim()) continue;
    const obj = parseJsonLine(line);
    if (!obj) continue;
    if (typeof obj.cwd === "string") resolvedCwd = obj.cwd;
    items.push(...itemsFromClaudeLine(obj, index++));
  }
  return { id: threadId, cwd: resolvedCwd, items: compactClaudeToolRuns(items) };
}

function parseFrontmatter(text: string): Record<string, string> {
  const lines = text.split(/\r?\n/);
  if (lines[0] !== "---") return {};
  const out: Record<string, string> = {};
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    if (line === "---") break;
    const match = /^([A-Za-z0-9_-]+):\s*(.*)$/.exec(line ?? "");
    if (match?.[1]) out[match[1]] = unquoteFrontmatterValue(match[2] ?? "");
  }
  return out;
}

function unquoteFrontmatterValue(value: string): string {
  const trimmed = value.trim();
  if (trimmed.length < 2) return trimmed;
  const quote = trimmed[0];
  if (
    (quote !== `"` && quote !== `'`) ||
    trimmed[trimmed.length - 1] !== quote
  ) {
    return trimmed;
  }
  const inner = trimmed.slice(1, -1);
  if (quote === `"`) {
    return inner
      .replace(/\\"/g, `"`)
      .replace(/\\\\/g, "\\")
      .trim();
  }
  return inner.replace(/\\'/g, "'").trim();
}

async function pluginNameForFile(file: string): Promise<string | null> {
  let dir = dirname(file);
  for (let i = 0; i < 8; i++) {
    const manifest = join(dir, ".claude-plugin", "plugin.json");
    if (await pathExists(manifest)) {
      const body = await readFile(manifest, "utf8").catch(() => "");
      try {
        const parsed = JSON.parse(body) as unknown;
        if (isJsonObject(parsed) && typeof parsed.name === "string") {
          return parsed.name.trim() || null;
        }
      } catch {
        return null;
      }
    }
    const next = dirname(dir);
    if (next === dir) break;
    dir = next;
  }
  return null;
}

async function commandNameForFile(
  file: string,
  meta: Record<string, string>,
): Promise<string> {
  const declared = (meta.name || meta.command || "").trim();
  if (declared) return declared.replace(/^\//, "");
  const command = basename(file, ".md");
  const plugin = await pluginNameForFile(file);
  return plugin ? `${plugin}:${command}` : command;
}

function pathContains(parentPath: string, childPath: string): boolean {
  const parent = resolve(parentPath);
  const child = resolve(childPath);
  const rel = relative(parent, child);
  return rel === "" || (!!rel && !rel.startsWith("..") && !isAbsolute(rel));
}

async function enabledClaudePluginRoots(
  cwd: string | null,
): Promise<string[] | null> {
  const body = await readFile(INSTALLED_PLUGINS_FILE, "utf8").catch(() => "");
  if (!body) return null;

  let parsed: unknown;
  try {
    parsed = JSON.parse(body);
  } catch {
    return null;
  }
  if (!isJsonObject(parsed) || !isJsonObject(parsed.plugins)) return null;

  const roots = new Set<string>();
  const registry = parsed.plugins as NonNullable<ClaudePluginRegistry["plugins"]>;
  for (const installs of Object.values(registry)) {
    if (!Array.isArray(installs)) continue;
    for (const install of installs) {
      if (!isJsonObject(install) || typeof install.installPath !== "string") {
        continue;
      }
      const scope =
        typeof install.scope === "string" ? install.scope.toLowerCase() : "";
      if (scope === "project") {
        if (
          cwd &&
          typeof install.projectPath === "string" &&
          pathContains(install.projectPath, cwd)
        ) {
          roots.add(install.installPath);
        }
        continue;
      }
      roots.add(install.installPath);
    }
  }
  return [...roots];
}

function fileInPluginRoots(file: string, roots: string[] | null): boolean {
  if (!roots) return true;
  return roots.some((root) => pathContains(root, file));
}

async function listClaudeSlashCommands(
  cwd?: string | null,
): Promise<ClaudeSlashCommand[]> {
  const pluginRoots = await enabledClaudePluginRoots(cwd?.trim() || null);
  const userSkillFiles = (
    await listFiles(SKILLS_DIR, (path) => basename(path) === "SKILL.md", 2)
  ).sort((a, b) => a.localeCompare(b));
  const pluginSkillFiles = (
    await listFiles(
      PLUGIN_CACHE_DIR,
      (path) => path.endsWith("/SKILL.md") && path.includes("/skills/"),
      8,
    )
  )
    .filter((path) => fileInPluginRoots(path, pluginRoots))
    .sort((a, b) => a.localeCompare(b));
  const commandFiles = (
    await listFiles(
      PLUGIN_CACHE_DIR,
      (path) => path.endsWith(".md") && path.includes("/commands/"),
      8,
    )
  )
    .filter((path) => fileInPluginRoots(path, pluginRoots))
    .sort((a, b) => a.localeCompare(b));

  const seen = new Set<string>();
  const commands: ClaudeSlashCommand[] = [];

  async function addSkillFiles(files: string[], orderStart: number) {
    let order = orderStart;
    for (const file of files) {
      const body = await readFile(file, "utf8").catch(() => "");
      const meta = parseFrontmatter(body);
      const command = (meta.name || basename(dirname(file))).trim();
      if (!command || seen.has(command)) continue;
      seen.add(command);
      commands.push({
        command,
        description: meta.description || "Claude Code skill",
        path: file,
        kind: "skill",
        order: order++,
      });
    }
  }

  async function addCommandFiles(files: string[], orderStart: number) {
    let order = orderStart;
    for (const file of files) {
      const body = await readFile(file, "utf8").catch(() => "");
      const meta = parseFrontmatter(body);
      const command = await commandNameForFile(file, meta);
      if (!command || seen.has(command)) continue;
      seen.add(command);
      commands.push({
        command,
        description: meta.description || "Claude Code slash command",
        path: file,
        kind: "command",
        order: order++,
      });
    }
  }

  await addSkillFiles(userSkillFiles, 10);
  await addCommandFiles(commandFiles, 100);

  BUILTIN_CLAUDE_COMMANDS.forEach((command, index) => {
    if (seen.has(command.command)) return;
    seen.add(command.command);
    commands.push({ ...command, order: 300 + index });
  });

  await addSkillFiles(pluginSkillFiles, 1000);

  return commands;
}

function inputToPrompt(input: unknown): string {
  if (!Array.isArray(input)) return "";
  return input
    .map((entry) => {
      if (!entry || typeof entry !== "object") return "";
      const item = entry as JsonObject;
      if (item.type === "text" && typeof item.text === "string") return item.text;
      if (item.type === "skill" && typeof item.name === "string") {
        return `/${item.name}`;
      }
      if (item.type === "localImage" && typeof item.path === "string") {
        return `请参考本地图片: ${item.path}`;
      }
      if (item.type === "image" && typeof item.url === "string") {
        return `请参考图片: ${item.url}`;
      }
      return "";
    })
    .filter(Boolean)
    .join("\n\n")
    .trim();
}

function normalizedClaudeModel(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function normalizedClaudePermissionMode(
  value: unknown,
): ClaudePermissionMode | null {
  if (typeof value !== "string" || !value.trim()) return null;
  return CLAUDE_PERMISSION_MODES.has(value as ClaudePermissionMode)
    ? (value as ClaudePermissionMode)
    : null;
}

async function runClaudeTurn({
  cwd,
  threadId,
  input,
  model,
  permissionMode,
}: ClaudeTurnParams): Promise<{ threadId: string; text: string; raw: unknown[] }> {
  const bin = await resolveClaudeBin();
  const prompt = inputToPrompt(input);
  if (!prompt) throw new Error("Claude Code prompt is empty");
  const sessionId = threadId || randomUUID();
  const args = [
    "--print",
    "--output-format",
    "stream-json",
    "--verbose",
  ];
  const cliModel = normalizedClaudeModel(model);
  const cliPermissionMode = normalizedClaudePermissionMode(permissionMode);
  if (cliModel) args.push("--model", cliModel);
  if (cliPermissionMode) args.push("--permission-mode", cliPermissionMode);
  args.push(threadId ? "--resume" : "--session-id", sessionId, prompt);

  return await new Promise((resolve, reject) => {
    const child = spawn(bin, args, {
      cwd,
      env: { ...process.env, FORCE_COLOR: "0" },
      stdio: ["ignore", "pipe", "pipe"],
    });
    const raw: unknown[] = [];
    const texts: string[] = [];
    let resultText: string | null = null;
    let stdoutBuffer = "";
    let stderr = "";

    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk: string) => {
      stdoutBuffer += chunk;
      const lines = stdoutBuffer.split(/\r?\n/);
      stdoutBuffer = lines.pop() ?? "";
      for (const line of lines) {
        if (!line.trim()) continue;
        const obj = parseJsonLine(line);
        if (obj) {
          raw.push(obj);
          const text = claudeStreamText(obj);
          if (text) {
            if (obj.type === "result") resultText = text;
            else texts.push(text);
          }
          broadcast("claude:notification", {
            method: "item/completed",
            params: { item: obj, sessionId },
          });
        } else {
          texts.push(line);
        }
      }
    });
    child.stderr.on("data", (chunk: string) => {
      stderr += chunk;
      broadcast("claude:stderr", chunk);
    });
    child.on("error", reject);
    child.on("close", (code, signal) => {
      if (stdoutBuffer.trim()) {
        const obj = parseJsonLine(stdoutBuffer.trim());
        if (obj) {
          raw.push(obj);
          const text = claudeStreamText(obj);
          if (text) {
            if (obj.type === "result") resultText = text;
            else texts.push(text);
          }
        } else {
          texts.push(stdoutBuffer.trim());
        }
      }
      const outputText = (resultText ?? texts.filter(Boolean).join("\n")).trim();
      if (code === 0) {
        resolve({
          threadId: sessionId,
          text: outputText,
          raw,
        });
        return;
      }
      reject(
        new Error(
          stderr.trim() ||
            outputText ||
            `claude exited (code=${code} signal=${signal})`,
        ),
      );
    });
  });
}

function claudeStreamText(obj: JsonObject): string {
  const type = typeof obj.type === "string" ? obj.type : "";
  if (type === "assistant") return assistantTextFromContent(messageContent(obj));
  if (type === "result" && typeof obj.result === "string") return obj.result;
  if (type === "error" && typeof obj.message === "string") return obj.message;
  return "";
}

export function registerClaudeIpc(): void {
  ipcMain.handle("claude:info", async () => {
    const bin = await resolveClaudeBin();
    const version = await execFileAsync(bin, ["--version"], {
      timeout: 3000,
    })
      .then(({ stdout, stderr }) => (stdout || stderr).trim())
      .catch(() => "");
    return { bin, version, claudeHome: CLAUDE_HOME };
  });

  ipcMain.handle("claude:history:list", async (_evt, cwd?: string | null) => ({
    data: await listClaudeHistory(cwd),
  }));

  ipcMain.handle(
    "claude:history:read",
    async (_evt, threadId: string, cwd?: string | null) =>
      readClaudeThread(threadId, cwd),
  );

  ipcMain.handle("claude:slash:list", async (_evt, cwd?: string | null) => ({
    data: await listClaudeSlashCommands(cwd),
  }));

  ipcMain.handle(
    "claude:turn:start",
    async (_evt, params: ClaudeTurnParams) => runClaudeTurn(params),
  );
}
