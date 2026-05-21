import { useCallback, useEffect, useState } from "react";

type TomlScalar = string | number | boolean | null;
type TomlTable = { [k: string]: TomlValue };
export type TomlValue = TomlScalar | TomlValue[] | TomlTable;

/**
 * Read a single value from `~/.codex/config.toml` and write it back on
 * change. The path is dotted (e.g. `["git", "pr_method"]`); a write of
 * `null` removes the key.
 *
 * Returns `[value, setValue, status]`. `status` is "loading" while the
 * first read is in flight, "ready" after it lands, or "error" if reading
 * failed (writes always go through optimistically and fall back if the
 * IPC rejects).
 */
export function useConfigValue<T extends TomlValue | null>(
  path: ReadonlyArray<string>,
  defaultValue: T,
): [T, (next: T) => void, "loading" | "ready" | "error"] {
  const key = path.join(".");
  const [value, setValue] = useState<T>(defaultValue);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");

  useEffect(() => {
    let alive = true;
    setStatus("loading");
    void window.codex.config
      .get([...path])
      .then((v) => {
        if (!alive) return;
        if (v === null || v === undefined) {
          setValue(defaultValue);
        } else {
          setValue(v as T);
        }
        setStatus("ready");
      })
      .catch(() => {
        if (alive) setStatus("error");
      });
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  const update = useCallback(
    (next: T) => {
      const previous = value;
      setValue(next);
      void window.codex.config
        .set([...path], next as unknown)
        .catch((err) => {
          console.error("config:set failed", err);
          setValue(previous);
        });
    },
    [path, value],
  );

  return [value, update, status];
}

export function useConfigTable<T extends TomlTable>(
  path: ReadonlyArray<string>,
): [T, (patch: Partial<T>) => void, "loading" | "ready" | "error"] {
  const key = path.join(".");
  const [value, setValue] = useState<T>({} as T);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");

  useEffect(() => {
    let alive = true;
    setStatus("loading");
    void window.codex.config
      .get([...path])
      .then((v) => {
        if (!alive) return;
        setValue(
          v && typeof v === "object" && !Array.isArray(v) ? (v as T) : ({} as T),
        );
        setStatus("ready");
      })
      .catch(() => alive && setStatus("error"));
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  const merge = useCallback(
    (patch: Partial<T>) => {
      setValue((prev) => ({ ...prev, ...patch }));
      void window.codex.config
        .merge([...path], patch as Record<string, unknown>)
        .catch((err) => console.error("config:merge failed", err));
    },
    [path],
  );

  return [value, merge, status];
}
