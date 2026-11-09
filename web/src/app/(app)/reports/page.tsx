"use client";
/**
 * Reports & Analytics — role-restricted operational overview
 * (analytics.operational).
 *
 * Every number comes from GET /api/v1/stats/overview, which counts the
 * database. This page used to render hard-coded fixtures ("128 total
 * incidents", "94% poll agreement", a made-up category chart); those are
 * gone. A metric the backend cannot compute is shown as an honest dash —
 * the screen never invents a figure.
 */
import { useEffect, useMemo } from "react";
import Link from "next/link";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/Card";
import { StatCard } from "@/components/ui/StatCard";
import { RoleGate } from "@/components/ui/RoleGate";
import { EmptyState } from "@/components/ui/EmptyState";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { useAuthSession } from "@/hooks/useAuth";
import { useStats } from "@/stores/stats";
import { CATEGORIES } from "@/lib/constants";

/** Percentage change between two real windows, or null when undefined. */
function delta(current: number, previous: number): string | null {
  if (previous === 0) return current > 0 ? "new" : null;
  const pct = ((current - previous) / previous) * 100;
  if (pct === 0) return null;
  return `${pct > 0 ? "↑" : "↓"} ${Math.abs(Math.round(pct))}%`;
}

/** Human duration for the verification latency. Sub-minute values are shown
 *  in seconds — rounding 6 s to "0m" would look like a bug. */
function duration(minutes: number | null): string {
  if (minutes === null) return "—";
  if (minutes < 1) return `${Math.round(minutes * 60)}s`;
  if (minutes < 60) return `${Math.round(minutes)}m`;
  const hours = minutes / 60;
  return `${hours.toFixed(1)}h`;
}

export default function ReportsPage() {
  const { token } = useAuthSession();
  const { stats, load } = useStats();

  useEffect(() => {
    void load(token);
  }, [load, token]);

  const data = stats.data;

  const categoryRows = useMemo(() => {
    if (!data) return [];
    const counts = data.by_category ?? {};
    // Every AD-15 category appears, even with a zero count — a missing bar
    // would read as "no data" rather than "none reported".
    return CATEGORIES.map((c) => ({ name: c, count: counts[c] ?? 0 })).sort(
      (a, b) => b.count - a.count,
    );
  }, [data]);

  const maxCount = categoryRows.length ? Math.max(...categoryRows.map((r) => r.count)) : 0;

  const trend = data ? delta(data.incidents_7d, data.incidents_previous_7d) : null;

  return (
    <div>
      <PageHeader
        title="Reports & Analytics"
        subtitle="Operational and historical analytics across Delhi NCR"
      />

      <RoleGate
        permission="analytics.operational"
        fallback={
          <EmptyState
            icon="🔒"
            title="Analytics are restricted"
            body="Your role doesn't include analytics.operational. Backend enforces this — the UI is just being polite."
          />
        }
      >
        {stats.error && (
          <div
            role="alert"
            className="mb-4 rounded-lg border border-[var(--danger)]/40 bg-[rgba(239,68,68,.1)] px-4 py-3 text-xs text-[#fee2e2]"
          >
            {stats.error}
          </div>
        )}

        {stats.loading && !data ? (
          <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-8 text-center text-xs text-[var(--muted)]">
            Counting the last 7 days…
          </div>
        ) : !data ? (
          <EmptyState
            title="Analytics unavailable"
            body="The statistics service did not answer. Nothing is shown here rather than a stale or invented number."
            icon="◐"
          />
        ) : (
          <>
            <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
              <StatCard
                icon="📊"
                value={String(data.incidents_7d)}
                label="Incidents (7d)"
                tone="info"
                delta={trend ?? undefined}
              />
              <StatCard
                icon="✅"
                value={String(data.closed_incidents)}
                label="Closed"
                tone="verified"
                delta={
                  data.open_incidents > 0
                    ? `${data.open_incidents} still open`
                    : undefined
                }
              />
              <StatCard
                icon="⏱"
                value={duration(data.avg_verify_minutes)}
                label="Avg. verify time"
                tone="moderate"
              />
              <StatCard
                icon="🎯"
                value={
                  data.poll_officer_agreement === null
                    ? "—"
                    : `${data.poll_officer_agreement}%`
                }
                label="Poll vs officer"
                tone="verified"
              />
            </div>

            <div className="grid gap-4 lg:grid-cols-3">
              <Card title="Incidents by category" className="lg:col-span-2">
                {maxCount === 0 ? (
                  <EmptyState
                    title="No incidents yet"
                    body="Nothing has been reported in the visible scope."
                    icon="◐"
                  />
                ) : (
                  <ul className="space-y-2.5">
                    {categoryRows.map((row) => (
                      <li key={row.name}>
                        <div className="mb-1 flex justify-between text-[11px]">
                          <span className="text-[var(--muted)]">{row.name}</span>
                          <span className="font-semibold">{row.count}</span>
                        </div>
                        <div className="h-2 overflow-hidden rounded-full bg-[var(--surface-3)]">
                          <div
                            className="h-full rounded-full bg-[var(--primary)]"
                            style={{ width: `${(row.count / maxCount) * 100}%` }}
                          />
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </Card>

              <Card title="Recent closures">
                {(data.recent_closures ?? []).length === 0 ? (
                  <EmptyState
                    title="Nothing closed yet"
                    body="Closed incidents appear here as soon as an administrator closes one."
                    icon="◐"
                  />
                ) : (
                  <ul className="space-y-2">
                    {data.recent_closures.map((c) => (
                      <li key={c.id}>
                        <Link
                          href={`/incidents/${c.id}`}
                          className="block rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 hover:border-[var(--border-strong)]"
                        >
                          <span className="block truncate text-[11px] font-medium">
                            {c.title}
                          </span>
                          <span className="mt-1 flex items-center gap-2 text-[10px] text-[var(--muted)]">
                            <StatusBadge value={c.category} />
                            {c.region ?? "Delhi NCR"}
                          </span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </Card>
            </div>

            <p className="mt-4 text-[10px] text-[var(--subtle)]">
              Every figure is counted from the incidents, polls, verification
              events and tasks you are allowed to see — scoped by the backend,
              not filtered in the browser.
            </p>
          </>
        )}
      </RoleGate>
    </div>
  );
}
