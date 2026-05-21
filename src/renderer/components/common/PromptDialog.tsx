import { useEffect, useRef, useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { cn } from "../../lib/cn";

interface PromptDialogProps {
  open: boolean;
  title: string;
  description?: string;
  placeholder?: string;
  defaultValue?: string;
  multiline?: boolean;
  confirmLabel?: string;
  cancelLabel?: string;
  inputDisabled?: boolean;
  confirmDisabled?: boolean;
  onConfirm: (value: string) => void | Promise<void>;
  onCancel: () => void;
}

/**
 * Lightweight modal text-prompt used for git commit messages, new branch
 * names, rename dialogs, etc. Renders nothing when closed.
 */
export function PromptDialog({
  open,
  title,
  description,
  placeholder,
  defaultValue = "",
  multiline,
  confirmLabel = "确认",
  cancelLabel = "取消",
  inputDisabled = false,
  confirmDisabled = false,
  onConfirm,
  onCancel,
}: PromptDialogProps) {
  const [value, setValue] = useState(defaultValue);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement | null>(null);

  useEffect(() => {
    if (open) {
      setValue(defaultValue);
      setError(null);
      setSubmitting(false);
    }
  }, [open, defaultValue]);

  async function submit() {
    if (confirmDisabled || inputDisabled) return;
    if (!value.trim()) {
      setError("不能为空");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await onConfirm(value.trim());
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setSubmitting(false);
      return;
    }
    setSubmitting(false);
  }

  return (
    <Dialog.Root open={open} onOpenChange={(o) => !o && !submitting && onCancel()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[80] bg-black/40 backdrop-blur-sm" />
        <Dialog.Content
          className={cn(
            "fixed left-1/2 top-1/2 z-[81] w-[420px] -translate-x-1/2 -translate-y-1/2 rounded-xl bg-surface-elevated p-4 shadow-popover ring-1 ring-black/[0.06]",
          )}
          onOpenAutoFocus={(e) => {
            e.preventDefault();
            inputRef.current?.focus();
            if (inputRef.current && "select" in inputRef.current) {
              (inputRef.current as HTMLInputElement).select();
            }
          }}
        >
          <Dialog.Title className="text-[13.5px] font-medium text-foreground">
            {title}
          </Dialog.Title>
          {description && (
            <Dialog.Description className="mt-1 text-[12px] text-foreground-subtle">
              {description}
            </Dialog.Description>
          )}
          {multiline ? (
            <textarea
              ref={(el) => (inputRef.current = el)}
              value={value}
              placeholder={placeholder}
              disabled={inputDisabled}
              onChange={(e) => setValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) void submit();
              }}
              className="mt-3 block min-h-[88px] w-full resize-y rounded-md border border-border bg-white px-2 py-1.5 text-[12.5px] text-foreground outline-none focus:border-accent disabled:cursor-wait disabled:opacity-70"
            />
          ) : (
            <input
              ref={(el) => (inputRef.current = el)}
              type="text"
              value={value}
              placeholder={placeholder}
              disabled={inputDisabled}
              onChange={(e) => setValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") void submit();
              }}
              className="mt-3 block h-8 w-full rounded-md border border-border bg-white px-2 text-[12.5px] text-foreground outline-none focus:border-accent disabled:cursor-wait disabled:opacity-70"
            />
          )}
          {error && (
            <div className="mt-2 text-[11.5px] text-rose-500">{error}</div>
          )}
          <div className="mt-4 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onCancel}
              disabled={submitting}
              className="h-7 rounded-md px-2.5 text-[12px] text-foreground-muted hover:bg-black/[0.05]"
            >
              {cancelLabel}
            </button>
            <button
              type="button"
              onClick={() => void submit()}
              disabled={submitting || confirmDisabled || inputDisabled}
              className="h-7 rounded-md bg-[#1a1a1a] px-2.5 text-[12px] font-medium text-white hover:bg-black disabled:opacity-50"
            >
              {submitting ? "处理中…" : confirmLabel}
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
