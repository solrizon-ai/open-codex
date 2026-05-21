import { create } from "zustand";
import {
  CODEX_BUILTIN_SLASH_COMMANDS,
  type SlashCommand,
} from "../codex/slashCommands";
import { ensureCodexInitialized } from "../codex/useCodex";
import { useBackendStore } from "./backend";

interface SkillListResponse {
  data?: Array<{
    skills?: Array<{
      name?: string;
      description?: string;
      enabled?: boolean;
      path?: string;
      interface?: {
        displayName?: string;
        shortDescription?: string;
        defaultPrompt?: string;
      };
      shortDescription?: string;
    }>;
  }>;
}

interface ClaudeSlashListResponse {
  data?: Array<{
    command?: string;
    description?: string;
    path?: string;
    kind?: "skill" | "command";
    order?: number;
  }>;
}

interface SlashCommandState {
  commands: SlashCommand[];
  loading: boolean;
  error: string | null;
  load: (cwd: string | null) => Promise<void>;
}

const CLAUDE_COMMAND_META: Record<
  string,
  Pick<SlashCommand, "label" | "description" | "icon" | "priority">
> = {
  mcp: {
    label: "MCP",
    description: "显示 MCP 服务器状态",
    icon: "mcp",
    priority: 10,
  },
  config: {
    label: "个性",
    description: "打开 Claude Code 配置",
    icon: "personality",
    priority: 11,
  },
  review: {
    label: "代码审查",
    description: "审查当前改动",
    icon: "review",
    priority: 12,
  },
  feedback: {
    label: "反馈",
    description: "发送反馈",
    icon: "feedback",
    priority: 13,
  },
  fast: {
    label: "快速",
    description: "开启快速模式，加快聊天、子智能体和上下文压缩中的推理速度",
    icon: "fast",
    priority: 14,
  },
  effort: {
    label: "推理模式",
    description: "调整 Claude 的推理强度",
    icon: "reasoning",
    priority: 15,
  },
  "add-dir": {
    label: "添加目录",
    description: "向会话添加额外工作目录",
    icon: "folder",
    priority: 16,
  },
  model: {
    label: "模型",
    description: "切换 Claude 模型",
    icon: "model",
    priority: 17,
  },
  status: {
    label: "状态",
    description: "显示会话、上下文和额度状态",
    icon: "status",
    priority: 18,
  },
  permissions: {
    label: "权限",
    description: "切换 Claude Code 权限模式",
    icon: "permissions",
    priority: 19,
  },
  branch: {
    label: "分支",
    description: "查看或切换 Git 分支",
    icon: "branch",
    priority: 20,
  },
  diff: {
    label: "差异",
    description: "显示 Git diff",
    icon: "diff",
    priority: 21,
  },
  agents: {
    label: "Agents",
    description: "管理 Claude Code agents",
    icon: "agents",
    priority: 22,
  },
  tasks: {
    label: "任务",
    description: "查看后台任务",
    icon: "tasks",
    priority: 23,
  },
  clear: {
    label: "清空",
    description: "清空当前上下文并开始新对话",
    icon: "clear",
    priority: 24,
  },
  compact: {
    label: "压缩",
    description: "压缩当前对话上下文",
    icon: "compact",
    priority: 25,
  },
  context: {
    label: "上下文",
    description: "查看上下文使用情况",
    icon: "context",
    priority: 26,
  },
  cost: {
    label: "用量",
    description: "显示使用量和费用",
    icon: "status",
    priority: 27,
  },
  doctor: {
    label: "诊断",
    description: "诊断 Claude Code 环境",
    icon: "doctor",
    priority: 28,
  },
  files: {
    label: "文件",
    description: "查看会话中的文件上下文",
    icon: "files",
    priority: 29,
  },
  help: {
    label: "帮助",
    description: "显示 Claude Code 帮助",
    icon: "help",
    priority: 30,
  },
  hooks: {
    label: "Hooks",
    description: "管理 Claude Code hooks",
    icon: "hooks",
    priority: 31,
  },
  ide: {
    label: "IDE",
    description: "连接或管理 IDE 集成",
    icon: "ide",
    priority: 32,
  },
  init: {
    label: "初始化",
    description: "初始化项目指导文件",
    icon: "init",
    priority: 33,
  },
  login: {
    label: "登录",
    description: "配置 Claude Code 登录或提供商",
    icon: "login",
    priority: 34,
  },
  logout: {
    label: "退出登录",
    description: "退出 Claude Code 登录",
    icon: "login",
    priority: 35,
  },
  memory: {
    label: "记忆",
    description: "编辑 Claude 记忆",
    icon: "memory",
    priority: 36,
  },
  "output-style": {
    label: "输出风格",
    description: "切换 Claude 输出风格",
    icon: "style",
    priority: 37,
  },
  plan: {
    label: "计划模式",
    description: "进入或配置计划模式",
    icon: "plan",
    priority: 38,
  },
  plugin: {
    label: "插件",
    description: "管理 Claude Code 插件",
    icon: "plugins",
    priority: 39,
  },
  provider: {
    label: "提供商",
    description: "管理模型提供商配置",
    icon: "provider",
    priority: 40,
  },
  resume: {
    label: "恢复",
    description: "恢复之前的会话",
    icon: "resume",
    priority: 41,
  },
  rewind: {
    label: "回退",
    description: "回退会话状态",
    icon: "rewind",
    priority: 42,
  },
  session: {
    label: "会话",
    description: "显示当前会话信息",
    icon: "session",
    priority: 43,
  },
  share: {
    label: "分享",
    description: "分享当前对话",
    icon: "share",
    priority: 44,
  },
  skills: {
    label: "技能",
    description: "管理 Claude Code 技能",
    icon: "skills",
    priority: 45,
  },
  stats: {
    label: "统计",
    description: "显示使用统计",
    icon: "status",
    priority: 46,
  },
  theme: {
    label: "主题",
    description: "切换 Claude Code 主题",
    icon: "theme",
    priority: 47,
  },
  usage: {
    label: "额度",
    description: "显示使用和额度信息",
    icon: "usage",
    priority: 48,
  },
  version: {
    label: "版本",
    description: "显示 Claude Code 版本",
    icon: "version",
    priority: 49,
  },
  vim: {
    label: "Vim",
    description: "切换 Vim 模式",
    icon: "vim",
    priority: 50,
  },
};

function normalizeSkillCommands(response: SkillListResponse): SlashCommand[] {
  const seen = new Set(CODEX_BUILTIN_SLASH_COMMANDS.map((cmd) => cmd.command));
  const commands: SlashCommand[] = [];

  for (const entry of response.data ?? []) {
    for (const skill of entry.skills ?? []) {
      if (skill.enabled === false || !skill.name || !skill.path) continue;
      const command = skill.name.trim();
      if (!command || seen.has(command)) continue;
      seen.add(command);
      commands.push({
        command,
        label: `/${command}`,
        description: compactDescription(
          skill.interface?.shortDescription ||
            skill.shortDescription ||
            skill.description ||
            skill.interface?.displayName ||
            "Codex skill",
        ),
        icon: "skills",
        priority: 80,
        supportsInlineArgs: true,
        source: "skill",
        skill: {
          name: skill.name,
          path: skill.path,
        },
      });
    }
  }

  return commands;
}

function normalizeClaudeCommands(response: ClaudeSlashListResponse): SlashCommand[] {
  const seen = new Set<string>();
  const commands: SlashCommand[] = [];

  for (const raw of response.data ?? []) {
    const command = raw.command?.trim();
    if (!command || seen.has(command)) continue;
    seen.add(command);
    const meta = CLAUDE_COMMAND_META[command];
    commands.push({
      command,
      label: `/${command}`,
      description: compactDescription(
        raw.description || "Claude Code command",
      ),
      icon: meta?.icon ?? (raw.kind === "skill" ? "skills" : "command"),
      priority: raw.order ?? meta?.priority ?? (raw.kind === "command" ? 60 : 90),
      supportsInlineArgs: true,
      source: "backend",
      backendCommand: {
        kind: raw.kind ?? "command",
        path: raw.path,
      },
    });
  }

  return commands;
}

export const useSlashCommandStore = create<SlashCommandState>((set) => ({
  commands: CODEX_BUILTIN_SLASH_COMMANDS,
  loading: false,
  error: null,

  load: async (cwd) => {
    const backend = useBackendStore.getState().backend;
    if (backend !== "codex") {
      set({ commands: [], loading: true, error: null });
      try {
        const response = await window.codex.claude.slashList(cwd);
        if (useBackendStore.getState().backend !== backend) return;
        set({
          commands: sortSlashCommands(normalizeClaudeCommands(response)),
          loading: false,
          error: null,
        });
      } catch (e) {
        if (useBackendStore.getState().backend !== backend) return;
        set({
          commands: [],
          loading: false,
          error: e instanceof Error ? e.message : String(e),
        });
      }
      return;
    }

    set({ loading: true, error: null });
    try {
      await ensureCodexInitialized();
      const response = (await window.codex.codex.request("skills/list", {
        cwds: cwd ? [cwd] : [],
        forceReload: false,
      })) as SkillListResponse;
      if (useBackendStore.getState().backend !== backend) return;
      set({
        commands: sortSlashCommands([
          ...CODEX_BUILTIN_SLASH_COMMANDS,
          ...normalizeSkillCommands(response),
        ]),
        loading: false,
        error: null,
      });
    } catch (e) {
      if (useBackendStore.getState().backend !== backend) return;
      set({
        commands: CODEX_BUILTIN_SLASH_COMMANDS,
        loading: false,
        error: e instanceof Error ? e.message : String(e),
      });
    }
  },
}));

function sortSlashCommands(commands: SlashCommand[]): SlashCommand[] {
  return [...commands].sort((a, b) => {
    const priority = (a.priority ?? 100) - (b.priority ?? 100);
    if (priority !== 0) return priority;
    return (a.label ?? a.command).localeCompare(b.label ?? b.command);
  });
}

function compactDescription(description: string): string {
  return description
    .replace(/\s+/g, " ")
    .trim();
}
