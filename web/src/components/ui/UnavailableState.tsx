"use client";
/**
 * UnavailableState — shown when a feature cannot be populated from the live
 * backend. Never a blank screen; always a labelled reason.
 */
export function UnavailableState({ reason }: { reason: string }) {
  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-6 text-center">
      <p className="text-[11px] font-semibold text-[var(--foreground)] uppercase tracking-wider">
        Unavailable
      </p>
      <p className="mt-1 text-[10px] text-[var(--muted)]">{reason}</p>
    </div>
  );
}
