"use client";
/**
 * AlertList — table of alerts with CAP severity / urgency / certainty chips.
 */
import { useEffect } from "react";
import { EmptyState } from "@/components/ui/EmptyState";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { useAlerts } from "@/stores/alerts";
import { useAuthSession } from "@/hooks/useAuth";

export function AlertList() {
  const { token } = useAuthSession();
  const { items, load, error } = useAlerts();

  useEffect(() => {
    void load(token);
  }, [load, token]);

  if (error) {
    return (
      <div className="rounded-lg border border-[var(--danger)]/40 bg-[rgba(239,68,68,.1)] p-3">
        <p className="text-[10px] text-[var(--danger)]">{error}</p>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <EmptyState title="No alerts" body="No active alerts right now." icon="◐" />
    );
  }

  return (
    <div className="rounded-lg border border-[var(--border)] bg-[var(--surface)] overflow-hidden">
      <table className="w-full text-left text-[10px]">
        <thead>
          <tr className="border-b border-[var(--border)] text-[var(--muted)]">
            <th className="px-3 py-2 font-medium">Event</th>
            <th className="px-3 py-2 font-medium">Severity</th>
            <th className="px-3 py-2 font-medium">Urgency</th>
            <th className="px-3 py-2 font-medium">Certainty</th>
            <th className="px-3 py-2 font-medium">Area</th>
            <th className="px-3 py-2 font-medium">Published</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-[var(--border)]">
          {items.map((a) => (
            <tr key={a.id} className="hover:bg-[var(--surface-2)]">
              <td className="px-3 py-2 font-medium truncate max-w-[20rem]" title={a.event}>
                {a.event}
              </td>
              <td className="px-3 py-2"><StatusBadge value={a.severity} /></td>
              <td className="px-3 py-2"><StatusBadge value={a.urgency} /></td>
              <td className="px-3 py-2"><StatusBadge value={a.certainty} /></td>
              <td className="px-3 py-2 text-[var(--muted)]">{a.area ?? "—"}</td>
              <td className="px-3 py-2 text-[var(--subtle)]">{a.created_at}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
