"use client";
/**
 * StatGrid — presentational dashboard KPI row from real StatsOut.
 * Props-only: owns no fetching.
 */
import { StatCard } from "@/components/ui/StatCard";
import type { StatsOut } from "@/api/openapi-types";

export type StatGridProps = { stats: StatsOut };

export function StatGrid({ stats }: StatGridProps) {
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      <StatCard icon="📋" value={stats.total_incidents ?? 0} label="Total incidents" tone="info" />
      <StatCard icon="🔓" value={stats.open_incidents ?? 0} label="Open incidents" tone="moderate" />
      <StatCard icon="✅" value={stats.verified_incidents ?? 0} label="Verified incidents" tone="verified" />
      <StatCard icon="⚠" value={stats.rejected_incidents ?? 0} label="Rejected incidents" tone="critical" />
      <StatCard icon="🗂" value={stats.active_tasks ?? 0} label="Active tasks" tone="info" />
      <StatCard icon="✔" value={stats.done_tasks ?? 0} label="Done tasks" tone="verified" />
      <StatCard icon="📢" value={stats.active_alerts ?? 0} label="Active alerts" tone="moderate" />
      <StatCard
        icon="🗳"
        value={Math.round((stats.poll_participation_rate ?? 0) * 100)}
        label="Poll participation across eligible incidents"
        tone="verified"
      />
    </div>
  );
}
