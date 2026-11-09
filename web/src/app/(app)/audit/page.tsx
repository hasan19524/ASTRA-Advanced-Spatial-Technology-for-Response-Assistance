"use client";
/**
 * Audit viewer — admin/officer audit log (can("audit.read")).
 * GET /api/v1/audit/logs with server-side paging (limit/offset) and actor +
 * action filters. Columns: actor, action, method, path, status, timestamp.
 */
import { useCallback, useEffect, useState } from "react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/Card";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { Button } from "@/components/ui/Button";
import { LinkButton } from "@/components/ui/LinkButton";
import { EmptyState } from "@/components/ui/EmptyState";
import { useAuthSession } from "@/hooks/useAuth";
import { request } from "@/api/client";

const LIMIT = 50;

/** Exactly what GET /api/v1/audit/logs returns (see api/app/routers/audit.py). */
interface AuditLog {
  id: string;
  actor_id: string | null;
  actor_role: string | null;
  actor_label: string | null;
  action: string | null;
  method: string | null;
  path: string | null;
  resource_id: string | null;
  status_code: number | null;
  ip: string | null;
  created_at: string | null;
}

/** Prefer the captured email/label, fall back to the opaque actor id. */
function actorName(l: AuditLog): string {
  return l.actor_label ?? l.actor_id ?? "—";
}

/** ISO timestamp → a readable local string (and a stable key part). */
function stamp(l: AuditLog): string {
  if (!l.created_at) return "—";
  const d = new Date(l.created_at);
  if (Number.isNaN(d.getTime())) return l.created_at;
  return d.toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

export default function AuditPage() {
  const { can, token } = useAuthSession();

  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  const [filters, setFilters] = useState({ actor_id: "", action: "", since: "" });

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const search = new URLSearchParams();
      search.set("limit", String(LIMIT));
      search.set("offset", String(page * LIMIT));
      if (filters.actor_id) search.set("actor_id", filters.actor_id);
      if (filters.action) search.set("action", filters.action);
      if (filters.since) search.set("since", filters.since);
      const data = await request<AuditLog[]>(`/api/v1/audit/logs?${search.toString()}`, {
        token,
      });
      setLogs(Array.isArray(data) ? data : []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load audit logs.");
      setLogs([]);
    } finally {
      setLoading(false);
    }
  }, [page, filters, token]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  if (!can("audit.read")) {
    return (
      <div className="flex h-screen flex-col items-center justify-center text-center">
        <h1 className="text-lg font-semibold text-[var(--foreground)]">Not authorized</h1>
        <p className="mt-1 text-xs text-[var(--muted)]">
          You need the audit.read permission to view the audit log.
        </p>
        <LinkButton href="/dashboard" variant="primary" className="mt-4">
          Back to dashboard
        </LinkButton>
      </div>
    );
  }

  const hasMore = logs.length >= LIMIT;
  const displayLogs = logs.slice(0, LIMIT);

  return (
    <div className="max-w-6xl">
      <PageHeader title="Audit Log" subtitle="Actor, action, method, path, status, timestamp" />
      {error && (
        <div
          role="alert"
          className="mb-4 rounded-lg border border-[var(--danger)]/40 bg-[rgba(239,68,68,.1)] px-4 py-3 text-xs text-[#fee2e2]"
        >
          {error}
        </div>
      )}
      <div className="grid gap-4 lg:grid-cols-4">
        <div className="lg:col-span-3">
          <Card title="Audit Log">
            {loading && logs.length === 0 ? (
              <div className="p-6 text-center text-xs text-[var(--muted)]">Loading audit log…</div>
            ) : displayLogs.length === 0 ? (
              <EmptyState title="No audit entries" body="No log entries match the current filters." icon="◐" />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[760px] text-left text-[10px]">
                <thead>
                  <tr className="border-b border-[var(--border)] text-[var(--muted)]">
                    <th className="px-3 py-2 font-medium">Timestamp</th>
                    <th className="px-3 py-2 font-medium">Actor</th>
                    <th className="px-3 py-2 font-medium">Action</th>
                    <th className="px-3 py-2 font-medium">Method</th>
                    <th className="px-3 py-2 font-medium">Path</th>
                    <th className="px-3 py-2 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border)]">
                  {displayLogs.map((l) => (
                    <tr key={l.id} className="hover:bg-[var(--surface-2)]">
                      <td className="px-3 py-2 text-[var(--muted)] font-mono whitespace-nowrap">{stamp(l)}</td>
                      <td className="px-3 py-2 text-[var(--foreground)] font-mono truncate max-w-[14rem]" title={actorName(l)}>
                        {actorName(l)}
                      </td>
                      <td className="px-3 py-2 text-[var(--foreground)]">{l.action ?? "—"}</td>
                      <td className="px-3 py-2 text-[var(--muted)] font-mono">{l.method ?? "—"}</td>
                      <td className="px-3 py-2 text-[var(--foreground)] font-mono truncate max-w-[26rem]" title={String(l.path ?? "—")}>
                        {l.path ?? "—"}
                      </td>
                      <td className="px-3 py-2">
                        <StatusBadge value={String(l.status_code ?? "—")} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              </div>
            )}
            <div className="mt-3 flex items-center justify-between gap-2">
              <Button
                variant="secondary"
                disabled={page === 0 || loading}
                onClick={() => setPage((p) => p - 1)}
              >
                Prev
              </Button>
              <span className="text-[10px] text-[var(--muted)]">
                Page {page + 1}{" · "}
                {displayLogs.length > 0 ? `showing ${displayLogs.length}` : "0"} entries
              </span>
              <Button
                variant="secondary"
                disabled={!hasMore || loading}
                onClick={() => setPage((p) => p + 1)}
              >
                Next
              </Button>
            </div>
          </Card>
        </div>
        <div className="lg:col-span-1">
          <Card title="Filters">
            <div className="space-y-3">
              <div>
                <label className="block text-[10px] text-[var(--muted)] mb-1">Actor</label>
                <input
                  value={filters.actor_id}
                  onChange={(e) => setFilters((f) => ({ ...f, actor_id: e.target.value }))}
                  className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-2.5 py-1.5 text-[10px] focus:border-[var(--primary)] focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-[10px] text-[var(--muted)] mb-1">Action</label>
                <input
                  value={filters.action}
                  onChange={(e) => setFilters((f) => ({ ...f, action: e.target.value }))}
                  className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-2.5 py-1.5 text-[10px] focus:border-[var(--primary)] focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-[10px] text-[var(--muted)] mb-1">Since (ISO)</label>
                <input
                  value={filters.since}
                  onChange={(e) => setFilters((f) => ({ ...f, since: e.target.value }))}
                  className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-2.5 py-1.5 text-[10px] focus:border-[var(--primary)] focus:outline-none"
                />
              </div>
              <div className="flex gap-2">
                <Button variant="primary" onClick={() => { setPage(0); void load(); }}>
                  Apply
                </Button>
                <Button variant="ghost" onClick={() => { setFilters({ actor_id: "", action: "", since: "" }); setPage(0); void load(); }}>
                  Clear
                </Button>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
