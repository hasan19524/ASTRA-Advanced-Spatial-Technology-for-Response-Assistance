"use client";
/** Reports/analytics — role-restricted operational overview (analytics.operational). */
import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/Card";
import { StatCard } from "@/components/ui/StatCard";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { RoleGate } from "@/components/ui/RoleGate";
import { EmptyState } from "@/components/ui/EmptyState";
import { mockIncidents, mockStats } from "@/lib/mocks/fixtures";

const BY_CATEGORY = [
  ["Fire", 18],
  ["Accident", 32],
  ["Flood/Waterlogging", 21],
  ["Structural collapse", 6],
  ["Medical emergency", 24],
  ["Crime/Safety", 14],
  ["Utility outage", 9],
  ["Hazard/Other", 4],
] as const;

export default function ReportsPage() {
  const max = Math.max(...BY_CATEGORY.map(([, n]) => n));

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
        <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatCard icon="📊" value="128" label="Total incidents (7d)" tone="info" delta="↑ 12%" />
          <StatCard icon="✅" value="54" label="Resolved" tone="verified" delta="↑ 8%" />
          <StatCard icon="⏱" value="18m" label="Avg. verify time" tone="moderate" delta="↓ 3m" />
          <StatCard icon="🎯" value="94%" label="Poll vs officer agreement" tone="verified" />
        </div>

        <div className="grid gap-4 lg:grid-cols-3">
          <Card title="Incidents by category" className="lg:col-span-2">
            <ul className="space-y-2.5">
              {BY_CATEGORY.map(([name, n]) => (
                <li key={name}>
                  <div className="mb-1 flex justify-between text-[11px]">
                    <span className="text-[var(--muted)]">{name}</span>
                    <span className="font-semibold">{n}</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-[var(--surface-3)]">
                    <div
                      className="h-full rounded-full bg-[var(--primary)]"
                      style={{ width: `${(n / max) * 100}%` }}
                    />
                  </div>
                </li>
              ))}
            </ul>
          </Card>

          <Card title="Recent closures">
            <ul className="space-y-2.5">
              {mockIncidents
                .filter((i) => i.lifecycle === "CLOSED" || i.response_phase === "RESOLVED")
                .slice(0, 5)
                .map((i) => (
                  <li key={i.id} className="rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-mono text-[11px] text-[var(--primary)]">{i.id}</span>
                      <StatusBadge value={i.lifecycle} />
                    </div>
                    <p className="mt-0.5 truncate text-[11px] text-[var(--muted)]">
                      {i.category} — {i.location}
                    </p>
                  </li>
                ))}
            </ul>
          </Card>
        </div>

        <p className="mt-4 text-[10px] text-[var(--subtle)]">
          Snapshot numbers come from the mock layer until GET /stats/overview ships
          (currently {mockStats.active_incidents} active in the demo world).
        </p>
      </RoleGate>
    </div>
  );
}
