import { spawn, ChildProcessWithoutNullStreams } from "node:child_process";
import { EventEmitter } from "node:events";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { app } from "electron";
import type {
  JsonRpcMessage,
  JsonRpcNotification,
  JsonRpcRequest,
  JsonRpcResponse,
} from "./protocol";
import { isNotification, isResponse } from "./protocol";

/**
 * Resolves the path to the `codex` binary.
 *
 * Order of resolution:
 *   1. CODEX_BIN env override
 *   2. Bundled binary inside the packaged app (`Resources/codex`)
 *   3. Development overrides for a local codex-rs checkout
 *   4. Production Codex.app binary on macOS
 *   5. $PATH lookup (`codex`)
 */
export function resolveCodexBin(): string | null {
  if (process.env.CODEX_BIN && existsSync(process.env.CODEX_BIN)) {
    return process.env.CODEX_BIN;
  }

  const bundled = app.isPackaged
    ? join(process.resourcesPath, "codex")
    : null;
  if (bundled && existsSync(bundled)) return bundled;

  const devWorkspace = process.env.CODEX_DEV_WORKSPACE;
  const devCandidates = app.isPackaged
    ? []
    : [
        process.env.CODEX_RS_TARGET,
        devWorkspace
          ? join(devWorkspace, "codex-rs/target/release/codex")
          : null,
        devWorkspace
          ? join(devWorkspace, "codex-rs/target/debug/codex")
          : null,
        join(process.cwd(), "../codex/codex-rs/target/release/codex"),
        join(process.cwd(), "../codex/codex-rs/target/debug/codex"),
      ];
  const candidates = [
    ...devCandidates,
    "/Applications/Codex.app/Contents/Resources/codex",
  ].filter((p): p is string => !!p);
  for (const p of candidates) {
    if (existsSync(p)) return p;
  }

  // Last resort: rely on PATH lookup at spawn time
  return "codex";
}

/**
 * One running `codex app-server` subprocess, with framed JSON-RPC over stdio.
 *
 * The codex app-server transport speaks line-delimited JSON (one JSON-RPC
 * message per stdout line). We accumulate stdout, split on `\n`, parse, and
 * dispatch to pending response promises or notification listeners.
 */
export class CodexAppServer extends EventEmitter {
  private proc: ChildProcessWithoutNullStreams | null = null;
  private nextId = 1;
  private pending = new Map<
    number | string,
    { resolve: (v: unknown) => void; reject: (e: Error) => void }
  >();
  private stdoutBuf = "";

  async start(): Promise<void> {
    if (this.proc) return;
    const bin = resolveCodexBin();
    if (!bin) {
      throw new Error("codex binary not found");
    }
    this.proc = spawn(bin, ["app-server"], {
      stdio: ["pipe", "pipe", "pipe"],
      env: { ...process.env, CODEX_DESKTOP: "1" },
    });

    this.proc.stdout.setEncoding("utf8");
    this.proc.stdout.on("data", (chunk: string) => this.onStdout(chunk));
    this.proc.stderr.setEncoding("utf8");
    this.proc.stderr.on("data", (chunk: string) => this.emit("stderr", chunk));
    this.proc.on("error", (err) => this.emit("error", err));
    this.proc.on("exit", (code, signal) => {
      this.emit("exit", { code, signal });
      this.proc = null;
      // Reject all in-flight requests
      for (const [, p] of this.pending) p.reject(new Error("codex app-server exited"));
      this.pending.clear();
    });
  }

  isRunning(): boolean {
    return this.proc !== null;
  }

  stop(): void {
    if (this.proc) {
      this.proc.kill("SIGTERM");
      this.proc = null;
    }
  }

  /** Send a JSON-RPC request and wait for the matching response. */
  request<T = unknown>(method: string, params?: unknown): Promise<T> {
    if (!this.proc) return Promise.reject(new Error("codex app-server not started"));
    const id = this.nextId++;
    const msg: JsonRpcRequest = {
      jsonrpc: "2.0",
      id,
      method,
      params: params as never,
    };
    return new Promise<T>((resolve, reject) => {
      this.pending.set(id, { resolve: resolve as (v: unknown) => void, reject });
      this.write(msg);
    });
  }

  /** Send a notification (no response expected). */
  notify(method: string, params?: unknown): void {
    if (!this.proc) return;
    const msg: JsonRpcNotification = {
      jsonrpc: "2.0",
      method,
      params: params as never,
    };
    this.write(msg);
  }

  private write(msg: JsonRpcMessage): void {
    if (!this.proc) return;
    this.proc.stdin.write(JSON.stringify(msg) + "\n");
  }

  private onStdout(chunk: string): void {
    this.stdoutBuf += chunk;
    let nl: number;
    while ((nl = this.stdoutBuf.indexOf("\n")) !== -1) {
      const line = this.stdoutBuf.slice(0, nl).trim();
      this.stdoutBuf = this.stdoutBuf.slice(nl + 1);
      if (!line) continue;
      try {
        const m = JSON.parse(line) as JsonRpcMessage;
        this.dispatch(m);
      } catch (e) {
        this.emit("parse-error", { line, error: (e as Error).message });
      }
    }
  }

  private dispatch(m: JsonRpcMessage): void {
    if (isResponse(m)) {
      const id = m.id;
      if (id === null) {
        this.emit("error", new Error("response with null id"));
        return;
      }
      const pending = this.pending.get(id);
      if (!pending) {
        this.emit("orphan-response", m);
        return;
      }
      this.pending.delete(id);
      if ("result" in m) pending.resolve(m.result);
      else pending.reject(new Error(m.error.message));
      return;
    }
    if (isNotification(m)) {
      this.emit("notification", m);
      this.emit(`notification:${m.method}`, m.params);
    }
  }
}
