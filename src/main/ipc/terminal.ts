import { ipcMain, type WebContents } from "electron";
import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { randomUUID } from "node:crypto";
import { hostname, userInfo } from "node:os";
import { basename } from "node:path";

interface TerminalSession {
  id: string;
  ownerId: number;
  proc: ChildProcessWithoutNullStreams;
}

const sessions = new Map<string, TerminalSession>();

function promptFor(cwd: string) {
  const user = userInfo().username || "user";
  const host = hostname().split(".")[0] || "localhost";
  const dir = basename(cwd) || cwd;
  return `${user}@${host} ${dir} % `;
}

function send(owner: WebContents, channel: string, payload: unknown) {
  if (!owner.isDestroyed()) owner.send(channel, payload);
}

function killSession(id: string) {
  const session = sessions.get(id);
  if (!session) return;
  sessions.delete(id);
  if (!session.proc.killed) {
    session.proc.kill("SIGTERM");
  }
}

function cleanupOwner(ownerId: number) {
  for (const session of sessions.values()) {
    if (session.ownerId === ownerId) killSession(session.id);
  }
}

export function registerTerminalIpc(): void {
  ipcMain.handle(
    "terminal:create",
    async (event, rawCwd: string | null | undefined) => {
      const shellPath = process.env.SHELL || "/bin/zsh";
      const cwd = rawCwd || process.cwd();
      const id = randomUUID();
      const proc = spawn(shellPath, [], {
        cwd,
        stdio: ["pipe", "pipe", "pipe"],
        env: {
          ...process.env,
          TERM: "dumb",
        },
      });

      const session: TerminalSession = {
        id,
        ownerId: event.sender.id,
        proc,
      };
      sessions.set(id, session);

      const forward = (chunk: Buffer) => {
        send(event.sender, "terminal:data", {
          id,
          chunk: chunk.toString("utf8"),
        });
      };
      proc.stdout.on("data", forward);
      proc.stderr.on("data", forward);
      proc.on("exit", (code, signal) => {
        sessions.delete(id);
        send(event.sender, "terminal:exit", { id, code, signal });
      });
      proc.on("error", (err) => {
        send(event.sender, "terminal:data", {
          id,
          chunk: `\n${err.message}\n`,
        });
      });

      event.sender.once("destroyed", () => cleanupOwner(event.sender.id));
      return { id, shell: basename(shellPath), cwd, prompt: promptFor(cwd) };
    },
  );

  ipcMain.handle("terminal:write", async (_event, id: string, data: string) => {
    const session = sessions.get(id);
    if (!session) throw new Error("terminal session not found");
    session.proc.stdin.write(data);
    return true;
  });

  ipcMain.handle("terminal:kill", async (_event, id: string) => {
    killSession(id);
    return true;
  });
}
