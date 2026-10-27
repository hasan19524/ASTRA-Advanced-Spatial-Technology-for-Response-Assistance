/**
 * EmptyState — shown when a list has no rows / a widget has no data.
 * Hard demo rule: never a blank area — always a labelled empty or error state.
 * Usage: <EmptyState title="No incidents" body="Reports will appear here." />
 */
import type { ReactNode } from "react";

export function EmptyState({
  icon = "◇",
  title,
  body,
  action,
}: {
  icon?: ReactNode;
  title: string;
  body?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-[var(--border-strong)] bg-[var(--surface)] px-6 py-10 text-center">
      <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-[var(--surface-2)] text-lg text-[var(--muted)]">
        {icon}
      </div>
      <p className="text-sm font-semibold text-[var(--foreground)]">{title}</p>
      {body && <p className="mt-1 max-w-sm text-xs text-[var(--muted)]">{body}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
