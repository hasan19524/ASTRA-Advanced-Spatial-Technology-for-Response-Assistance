"use client";
/** Incident Management list (reference screen 2) — filters, tabs, table. */
import Link from "next/link";
import { useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { PageHeader } from "@/components/layout/PageHeader";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { EmptyState } from "@/components/ui/EmptyState";
import { Button } from "@/components/ui/Button";
import { DataTable, type Column } from "@/components/ui/DataTable";
import { applyFilters, useIncidents } from "@/stores/incidents";
import type { MockIncident } from "@/lib/mocks/fixtures";
import { CATEGORIES, SEVERITIES } from "@/lib/constants";
import { useAuthSession } from "@/hooks/useAuth";

const PHASES = [
  { value: "all", label: "All" },
  { value: "NONE", label: "Reported" },
  { value: "COORDINATING", label: "Under Verification" },
  { value: "ACTIVE", label: "In Response" },
  { value: "RESOLVED", label: "Resolved" },
];

export default function IncidentsPage() {
  const router = useRouter();
  const { items, load, loading, error, filters, setFilter } = useIncidents();
  const { can } = useAuthSession();

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = useMemo(() => applyFilters(items, filters), [items, filters]);

  const columns: Column<MockIncident>[] = [
    {
      key: "id",
      header: "ID",
      render: (r) => (
        <span className="font-mono text-[var(--primary)]">{r.id}</span>
      ),
    },
    { key: "category", header: "Category", render: (r) => r.category },
    {
      key: "location",
      header: "Location",
      render: (r) => <span className="text-[var(--muted)]">{r.location}</span>,
    },
    { key: "severity", header: "Severity", render: (r) => <StatusBadge value={r.severity} /> },
    {
      key: "verification",
      header: "Verification",
      render: (r) => <StatusBadge value={r.verification} />,
    },
    {
      key: "phase",
      header: "Response Phase",
      render: (r) => <StatusBadge value={r.response_phase} />,
    },
    {
      key: "updated",
      header: "Updated",
      render: (r) => <span className="text-[var(--subtle)]">{r.updated_at}</span>,
    },
  ];

  return (
    <div>
      <PageHeader
        title="Incident Management"
        subtitle="View, filter and manage all reported incidents"
        actions={
          can("report.create") ? (
            <Link href="/report">
              <Button variant="primary">+ Report Incident</Button>
            </Link>
          ) : undefined
        }
      />

      {/* filter row */}
      <div className="mb-3 flex flex-wrap gap-2">
        <Select
          value={filters.category}
          onChange={(v) => setFilter("category", v)}
          options={[{ value: "all", label: "All Categories" }, ...CATEGORIES.map((c) => ({ value: c, label: c }))]}
        />
        <Select
          value={filters.severity}
          onChange={(v) => setFilter("severity", v)}
          options={[{ value: "all", label: "All Severities" }, ...SEVERITIES.map((s) => ({ value: s, label: s }))]}
        />
        <Select
          value={filters.verification}
          onChange={(v) => setFilter("verification", v)}
          options={[
            { value: "all", label: "All Verification" },
            { value: "UNVERIFIED", label: "Pending" },
            { value: "VERIFIED", label: "Verified" },
            { value: "REJECTED", label: "Rejected" },
          ]}
        />
        <Select
          value={filters.phase}
          onChange={(v) => setFilter("phase", v)}
          options={[
            { value: "all", label: "All Response Phase" },
            ...PHASES.filter((p) => p.value !== "all"),
          ]}
        />
        <button className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5 text-[11px] text-[var(--muted)] hover:text-[var(--foreground)]">
          ⏱ Last 7 days
        </button>
      </div>

      {/* phase tabs */}
      <div className="mb-3 flex gap-1 overflow-x-auto rounded-lg border border-[var(--border)] bg-[var(--surface)] p-1">
        {PHASES.map((p) => {
          const active = filters.phase === p.value;
          const count =
            p.value === "all"
              ? items.length
              : items.filter((i) => i.response_phase === p.value).length;
          return (
            <button
              key={p.value}
              onClick={() => setFilter("phase", p.value)}
              className={`whitespace-nowrap rounded-md px-3 py-1.5 text-[11px] font-medium transition-colors ${
                active
                  ? "bg-[var(--primary)] text-white"
                  : "text-[var(--muted)] hover:bg-[var(--surface-2)]"
              }`}
            >
              {p.label} ({count})
            </button>
          );
        })}
      </div>

      {error && (
        <div
          role="alert"
          className="mb-3 rounded-lg border border-[var(--danger)]/40 bg-[rgba(239,68,68,.1)] px-4 py-2.5 text-xs text-[#fee2e2]"
        >
          Couldn&apos;t reach the incidents API — {error}. Showing demo data.
        </div>
      )}

      {loading && items.length === 0 ? (
        <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-8 text-center text-xs text-[var(--muted)]">
          Loading incidents…
        </div>
      ) : (
        <DataTable
          columns={columns}
          rows={filtered}
          rowKey={(r) => r.id}
          onRowClick={(r) => router.push(`/incidents/${r.id}`)}
          empty={
            <EmptyState
              title="No incidents match these filters"
              body="Try clearing a filter or widening the date range."
              action={
                <Button
                  onClick={() => {
                    setFilter("category", "all");
                    setFilter("severity", "all");
                    setFilter("verification", "all");
                    setFilter("phase", "all");
                  }}
                >
                  Clear filters
                </Button>
              }
            />
          }
        />
      )}

      {filtered.length > 0 && (
        <div className="mt-3 flex items-center justify-between text-[11px] text-[var(--muted)]">
          <span>
            Showing 1–{filtered.length} of {filtered.length} incidents
          </span>
          <div className="flex gap-1">
            {[1, 2, 3, 4, 5].map((p) => (
              <button
                key={p}
                className={`h-6 w-6 rounded ${
                  p === 1
                    ? "bg-[var(--primary)] text-white"
                    : "border border-[var(--border)] hover:bg-[var(--surface-2)]"
                }`}
              >
                {p}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function Select({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5 text-[11px] text-[var(--muted)] focus:border-[var(--primary)] focus:outline-none"
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}
