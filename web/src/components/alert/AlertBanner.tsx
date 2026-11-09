"use client";
/**
 * AlertBanner — global immediate-alert strip mounted in AppShell.
 * Shows public (non-RESTRICTED) alerts; a citizen never sees a RESTRICTED
 * incident's alert because the backend filters by visibility and we never
 * unmask it here. Dismiss removes it from this session's view only.
 */
import { useEffect } from "react";
import { Button } from "@/components/ui/Button";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { useAlerts } from "@/stores/alerts";
import { useAuthSession } from "@/hooks/useAuth";

export function AlertBanner() {
  const { token } = useAuthSession();
  const { items, load, dismiss, unread } = useAlerts();

  useEffect(() => {
    void load(token);
  }, [load, token]);

  const visible = items;

  if (visible.length === 0) return null;

  return (
    <div className="border-b border-[var(--border)] bg-[var(--surface-2)]">
      <div className="px-4 py-2 sm:px-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <div className="flex shrink-0 items-center gap-2">
          <span className="text-[10px] font-bold text-[var(--foreground)] uppercase tracking-wider">alert</span>
          <span className="text-[10px] text-[var(--muted)]">{unread} new</span>
        </div>
        {/* On a phone the chips scroll sideways in one row — stacked, they
            pushed the page content a full screen down. */}
        <div className="flex shrink-0 gap-1 overflow-x-auto pb-1 sm:flex-wrap sm:overflow-visible sm:pb-0">
          {visible.slice(0, 4).map((a) => (
            <div key={a.id} className="flex shrink-0 items-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--background)] px-2.5 py-1.5">
              <StatusBadge value={a.severity} />
              <span className="text-[10px] font-medium text-[var(--foreground)] truncate max-w-[14rem]" title={a.event}>
                {a.event}
              </span>
              <span className="ml-auto text-[9px] text-[var(--muted)]">{a.area ?? "—"}</span>
              <Button
                variant="ghost"
                onClick={() => dismiss(a.id)}
                aria-label={`Dismiss alert: ${a.event}`}
                className="min-h-8 min-w-8 px-1.5 [@media(pointer:coarse)]:min-h-10 [@media(pointer:coarse)]:min-w-10"
              >
                ✕
              </Button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
