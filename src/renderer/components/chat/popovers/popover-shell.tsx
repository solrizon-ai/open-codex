import * as Popover from "@radix-ui/react-popover";
import type { PropsWithChildren, ReactNode } from "react";
import { cn } from "../../../lib/cn";

interface ChipPopoverProps {
  trigger: ReactNode;
  align?: "start" | "center" | "end";
  side?: "top" | "right" | "bottom" | "left";
  sideOffset?: number;
  className?: string;
}

/**
 * Shared shell for the composer chip popovers: rounded white card,
 * subtle hairline ring, soft shadow, ~6px padding. Matches the look of
 * all the project/branch/model/permissions/remote popovers.
 */
export function ChipPopover({
  trigger,
  children,
  align = "start",
  side = "top",
  sideOffset = 8,
  className,
}: PropsWithChildren<ChipPopoverProps>) {
  return (
    <Popover.Root>
      <Popover.Trigger asChild>{trigger}</Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          align={align}
          side={side}
          sideOffset={sideOffset}
          className={cn(
            "z-50 min-w-[200px] rounded-lg bg-white p-1 text-[12.5px] text-foreground shadow-popover ring-1 ring-black/[0.06]",
            "data-[side=bottom]:animate-in data-[side=bottom]:slide-in-from-top-1 data-[side=top]:animate-in data-[side=top]:slide-in-from-bottom-1",
            className,
          )}
        >
          {children}
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}

export function PopoverSearch({ placeholder }: { placeholder: string }) {
  return (
    <div className="flex h-7 items-center gap-1.5 rounded-md px-2 text-[12px] text-foreground-subtle">
      <svg width="13" height="13" viewBox="0 0 24 24" className="opacity-70">
        <circle cx="11" cy="11" r="6" stroke="currentColor" strokeWidth="1.6" fill="none" />
        <path d="M20 20l-4-4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      </svg>
      <input
        type="text"
        placeholder={placeholder}
        className="flex-1 bg-transparent text-[12px] text-foreground placeholder:text-foreground-subtle focus:outline-none"
      />
    </div>
  );
}

export function PopoverSectionLabel({ children }: PropsWithChildren) {
  return (
    <div className="px-2 pb-0.5 pt-2 text-[11px] text-foreground-subtle">{children}</div>
  );
}

export function PopoverItem({
  children,
  selected,
  onClick,
  leading,
  trailing,
  muted,
}: PropsWithChildren<{
  selected?: boolean;
  onClick?: () => void;
  leading?: ReactNode;
  trailing?: ReactNode;
  muted?: boolean;
}>) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex h-7 w-full items-center gap-2 rounded-md px-2 text-left text-[12.5px] hover:bg-black/[0.05]",
        muted ? "text-foreground-subtle" : "text-foreground",
      )}
    >
      {leading && <span className="flex h-4 w-4 items-center justify-center opacity-80">{leading}</span>}
      <span className="flex-1 truncate">{children}</span>
      {trailing}
      {selected && (
        <svg width="13" height="13" viewBox="0 0 24 24" className="text-foreground/80">
          <path
            d="M5 12l5 5L20 7"
            stroke="currentColor"
            strokeWidth="2"
            fill="none"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      )}
    </button>
  );
}

export function PopoverSeparator() {
  return <div className="mx-1 my-1 h-px bg-black/[0.06]" />;
}
