export interface SlashCommand {
  command: string;
  label?: string;
  description: string;
  icon?: string;
  priority?: number;
  supportsInlineArgs?: boolean;
  source?: "local" | "skill" | "backend";
  skill?: {
    name: string;
    path: string;
  };
  backendCommand?: {
    kind: "skill" | "command";
    path?: string;
  };
}

const CODEX_INLINE_ARG_COMMANDS = new Set([
  "review",
  "rename",
  "plan",
  "goal",
  "ide",
  "keymap",
  "mcp",
  "raw",
  "pets",
  "side",
  "resume",
  "sandbox-add-read-dir",
]);

const CODEX_COMMANDS: Array<{
  command: string;
  description: string;
  icon?: string;
}> = [
  { command: "model", description: "choose what model and reasoning effort to use", icon: "model" },
  { command: "fast", description: "toggle Fast mode to enable fastest inference with increased plan usage", icon: "fast" },
  {
    command: "ide",
    description: "include current selection, open files, and other context from your IDE",
    icon: "ide",
  },
  { command: "permissions", description: "choose what Codex is allowed to do", icon: "permissions" },
  { command: "keymap", description: "remap TUI shortcuts", icon: "settings" },
  { command: "vim", description: "toggle Vim mode for the composer", icon: "vim" },
  { command: "experimental", description: "toggle experimental features", icon: "settings" },
  { command: "approve", description: "approve one retry of a recent auto-review denial", icon: "review" },
  { command: "memories", description: "configure memory use and generation", icon: "memory" },
  { command: "skills", description: "use skills to improve how Codex performs specific tasks", icon: "skills" },
  { command: "hooks", description: "view and manage lifecycle hooks", icon: "hooks" },
  { command: "review", description: "review my current changes and find issues", icon: "review" },
  { command: "rename", description: "rename the current thread", icon: "rename" },
  { command: "new", description: "start a new chat during a conversation", icon: "new" },
  { command: "resume", description: "resume a saved chat", icon: "resume" },
  { command: "fork", description: "fork the current chat", icon: "branch" },
  { command: "init", description: "create an AGENTS.md file with instructions for Codex", icon: "init" },
  { command: "compact", description: "summarize conversation to prevent hitting the context limit", icon: "compact" },
  { command: "plan", description: "switch to Plan mode", icon: "plan" },
  { command: "goal", description: "set or view the goal for a long-running task", icon: "goal" },
  { command: "agent", description: "switch the active agent thread", icon: "agents" },
  { command: "subagents", description: "switch the active agent thread", icon: "agents" },
  { command: "side", description: "start a side conversation in an ephemeral fork", icon: "branch" },
  { command: "copy", description: "copy last response as markdown", icon: "copy" },
  { command: "raw", description: "toggle raw scrollback mode for copy-friendly terminal selection", icon: "command" },
  { command: "diff", description: "show git diff (including untracked files)", icon: "diff" },
  { command: "mention", description: "mention a file", icon: "files" },
  { command: "status", description: "show current session configuration and token usage", icon: "status" },
  { command: "title", description: "configure which items appear in the terminal title", icon: "settings" },
  { command: "statusline", description: "configure which items appear in the status line", icon: "settings" },
  { command: "theme", description: "choose a syntax highlighting theme", icon: "theme" },
  { command: "pets", description: "choose or hide the terminal pet", icon: "settings" },
  { command: "mcp", description: "list configured MCP tools; use /mcp verbose for details", icon: "mcp" },
  { command: "plugins", description: "browse plugins", icon: "plugins" },
  { command: "logout", description: "log out of Codex", icon: "login" },
  { command: "exit", description: "exit Codex", icon: "exit" },
  { command: "feedback", description: "send logs to maintainers", icon: "feedback" },
  { command: "ps", description: "list background terminals", icon: "tasks" },
  { command: "stop", description: "stop all background terminals", icon: "tasks" },
  { command: "clear", description: "clear the terminal and start a new chat", icon: "clear" },
  { command: "personality", description: "choose a communication style for Codex", icon: "personality" },
];

export const CODEX_BUILTIN_SLASH_COMMANDS: SlashCommand[] = CODEX_COMMANDS.map(
  (cmd, index) => ({
    ...cmd,
    label: `/${cmd.command}`,
    priority: index + 1,
    supportsInlineArgs: CODEX_INLINE_ARG_COMMANDS.has(cmd.command),
    source: "backend",
  }),
);

export const LOCAL_SLASH_COMMANDS = CODEX_BUILTIN_SLASH_COMMANDS;

export function matchSlashCommands(
  input: string,
  commands: SlashCommand[] = LOCAL_SLASH_COMMANDS,
): SlashCommand[] {
  if (!input.startsWith("/")) return [];
  const query = input.slice(1).trimStart().toLowerCase();
  if (query.includes(" ")) return [];
  return commands
    .filter((cmd) => {
      if (!query) return true;
      const haystack = `${cmd.command} ${cmd.label ?? ""} ${cmd.description}`
        .toLowerCase()
        .replace(/\s+/g, " ");
      return haystack.includes(query);
    })
    .sort((a, b) => compareSlashCommands(a, b, query))
    .slice(0, 9);
}

function compareSlashCommands(
  a: SlashCommand,
  b: SlashCommand,
  query: string,
): number {
  if (query) {
    const aPrefix = a.command.toLowerCase().startsWith(query) ? 0 : 1;
    const bPrefix = b.command.toLowerCase().startsWith(query) ? 0 : 1;
    if (aPrefix !== bPrefix) return aPrefix - bPrefix;
  }
  const priority = (a.priority ?? 100) - (b.priority ?? 100);
  if (priority !== 0) return priority;
  return (a.label ?? a.command).localeCompare(b.label ?? b.command);
}

export function parseSlashInvocation(
  input: string,
  commands: SlashCommand[],
): { command: SlashCommand; args: string } | null {
  if (!input.startsWith("/")) return null;
  const match = /^\/([^\s]+)(?:\s+([\s\S]*))?$/.exec(input.trim());
  if (!match) return null;
  const name = match[1] ?? "";
  const command = commands.find((cmd) => cmd.command === name);
  if (!command) return null;
  return { command, args: match[2] ?? "" };
}
