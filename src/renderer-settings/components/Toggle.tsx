import * as Switch from "@radix-ui/react-switch";
import { useState } from "react";

interface ToggleProps {
  defaultChecked?: boolean;
  /** Controlled value. Pass undefined to make Toggle internally stateful. */
  checked?: boolean;
  onCheckedChange?: (next: boolean) => void;
  disabled?: boolean;
}

export function Toggle({
  defaultChecked = false,
  checked,
  onCheckedChange,
  disabled,
}: ToggleProps) {
  const [internal, setInternal] = useState(defaultChecked);
  const value = checked ?? internal;
  return (
    <Switch.Root
      checked={value}
      disabled={disabled}
      onCheckedChange={(next) => {
        if (checked === undefined) setInternal(next);
        onCheckedChange?.(next);
      }}
      className="relative h-[18px] w-[30px] rounded-full bg-black/[0.18] outline-none transition-colors data-[state=checked]:bg-[#339cff] disabled:opacity-50"
    >
      <Switch.Thumb className="block h-3.5 w-3.5 translate-x-[2px] rounded-full bg-white shadow transition-transform data-[state=checked]:translate-x-[14px]" />
    </Switch.Root>
  );
}
