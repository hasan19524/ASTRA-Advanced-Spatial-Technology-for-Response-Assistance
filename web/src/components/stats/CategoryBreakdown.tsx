"use client";
/**
 * CategoryBreakdown — presentational per-category counts.
 * Props-only: renders EmptyState when there is no breakdown data.
 */
import { EmptyState } from "@/components/ui/EmptyState";

type BreakdownRow = { category: string; count: number };

export type CategoryBreakdownProps = { breakdown: BreakdownRow[] };

export function CategoryBreakdown({ breakdown }: CategoryBreakdownProps) {
  if (breakdown.length === 0) {
    return (
      <EmptyState title="No category breakdown" body="Category stats are not available yet." icon="◐" />
    );
  }
  return (
    <div className="space-y-2">
      {breakdown.map((row) => (
        <div key={row.category} className="flex items-center justify-between text-[11px]">
          <span className="text-[var(--muted)]">{row.category}</span>
          <span className="font-mono font-semibold text-[var(--foreground)]">{row.count}</span>
        </div>
      ))}
    </div>
  );
}
