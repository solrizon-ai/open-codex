/**
 * Subset of the JSON-RPC protocol implemented by the codex-rs `app-server`
 * binary (see codex-rs/app-server-protocol/src/protocol/v1.rs and v2/).
 *
 * Only the message shapes the desktop app currently consumes are typed here.
 * The full schema is generated from Rust via `cargo run -p codex-app-server-protocol --
 * generate-ts`; we vendor a subset for ergonomic IPC.
 */

export type JsonValue =
  | null
  | boolean
  | number
  | string
  | JsonValue[]
  | { [k: string]: JsonValue };

export interface JsonRpcRequest {
  jsonrpc: "2.0";
  id: number | string;
  method: string;
  params?: JsonValue;
}

export interface JsonRpcSuccessResponse<T = JsonValue> {
  jsonrpc: "2.0";
  id: number | string;
  result: T;
}

export interface JsonRpcErrorResponse {
  jsonrpc: "2.0";
  id: number | string | null;
  error: { code: number; message: string; data?: JsonValue };
}

export type JsonRpcResponse<T = JsonValue> =
  | JsonRpcSuccessResponse<T>
  | JsonRpcErrorResponse;

export interface JsonRpcNotification {
  jsonrpc: "2.0";
  method: string;
  params?: JsonValue;
}

export type JsonRpcMessage = JsonRpcRequest | JsonRpcResponse | JsonRpcNotification;

export interface ClientInfo {
  name: string;
  title?: string;
  version: string;
}

export interface InitializeParams {
  clientInfo: ClientInfo;
  capabilities?: {
    experimentalApi?: boolean;
    requestAttestation?: boolean;
    optOutNotificationMethods?: string[];
  };
}

export interface InitializeResponse {
  serverInfo: { name: string; version: string };
  capabilities?: Record<string, JsonValue>;
}

export type ServerNotification =
  | { method: "thread/started"; params: { threadId: string; metadata?: JsonValue } }
  | { method: "thread/event"; params: { threadId: string; event: JsonValue } }
  | { method: "config/warning"; params: { warning: string; layer?: string } }
  | { method: string; params?: JsonValue };

export function isResponse(m: unknown): m is JsonRpcResponse {
  if (!m || typeof m !== "object") return false;
  const o = m as Record<string, unknown>;
  return "id" in o && ("result" in o || "error" in o);
}

export function isNotification(m: unknown): m is JsonRpcNotification {
  if (!m || typeof m !== "object") return false;
  const o = m as Record<string, unknown>;
  return !("id" in o) && "method" in o;
}
