import type { PropsWithChildren } from "react";

export function SectionShell({
  title,
  children,
}: PropsWithChildren<{ title: string }>) {
  return (
    <div className="mx-auto max-w-[720px] px-8 py-10">
      <h1 className="mb-7 text-[20px] font-semibold text-foreground">{title}</h1>
      <div className="space-y-10">{children}</div>
    </div>
  );
}

export function SettingsGroup({
  title,
  description,
  children,
}: PropsWithChildren<{ title?: string; description?: string }>) {
  return (
    <section>
      {title && (
        <header className="mb-2">
          <h2 className="text-[13px] font-medium text-foreground">{title}</h2>
          {description && (
            <p className="mt-0.5 text-[12px] text-foreground-subtle">{description}</p>
          )}
        </header>
      )}
      <div className="overflow-hidden rounded-lg ring-1 ring-border">
        {children}
      </div>
    </section>
  );
}

export function SettingsRow({
  label,
  description,
  children,
}: PropsWithChildren<{ label: string; description?: string }>) {
  return (
    <div className="flex items-start gap-4 border-b border-border px-4 py-3 last:border-b-0">
      <div className="flex-1">
        <div className="text-[12.5px] text-foreground">{label}</div>
        {description && (
          <div className="mt-1 text-[12px] text-foreground-subtle">{description}</div>
        )}
      </div>
      <div className="flex items-center">{children}</div>
    </div>
  );
}
