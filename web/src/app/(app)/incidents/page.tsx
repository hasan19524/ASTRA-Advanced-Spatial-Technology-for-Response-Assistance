"use client";
/**
 * Incident Management list — real API (GET /api/v1/incidents) with category /
 * assessment / verification filters + real pagination (Prev/Next), plus a WS
 * subscription that prepends any new public incident as it arrives (AD-10).
 * Phase filter removed — backend has no `phase` param (B4).
 */
import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { PageHeader } from "@/components/layout/PageHeader";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { EmptyState } from "@/components/ui/EmptyState";
import { Button } from "@/components/ui/Button";
import { DataTable, type Column } from "@/components/ui/DataTable";
import { useIncidents } from "@/stores/incidents";
import type { IncidentOut } from "@/api/types";
import { CATEGORIES } from "@/lib/constants";
import { useAuthSession } from "@/hooks/useAuth";

const ASSESSMENTS = [
  { value: "all", label: "All" },
  { value: "UNASSESSED", label: "Unassessed" },
  { value: "MAYBE_TRUE", label: "Maybe True" },
  { value: "DEFINITELY_FALSE", label: "Definitely False" },
];

const PAGE_SIZE = 20;

export default function IncidentsPage() {
  const router = useRouter();
  const { token, can } = useAuthSession();
  const {
    items,
    total,
    load,
    loading,
    error,
    filters,
    setFilter,
    connectWS,
    disconnectWS,
  } = useIncidents();
  const [offset, setOffset] = useState(0);

  // load on mount + whenever filters change (server-side via query params)
  useEffect(() => {
    void load({
      category: filters.category,
      assessment: filters.assessment,
      verification: filters.verification,
      offset,
      limit: PAGE_SIZE,
    }, token);
  }, [load, filters.category, filters.assessment, filters.verification, offset, token]);

  // live-map WS: prepend fresh public incidents (AD-10)
  useEffect(() => {
    connectWS(token);
    return () => disconnectWS();
  }, [connectWS, disconnectWS, token]);

  const columns: Column<IncidentOut>[] = [
    {
      key: "id",
      header: "ID",
      render: (r) => <span className="font-mono text-[var(--primary)]">{r.id}</span>,
    },
    { key: "category", header: "Category", render: (r) => r.category },
    {
      key: "location",
      header: "Location",
      render: (r) => (
        <span className="text-[var(--muted)]">{r.location_text ?? r.region ?? "—"}</span>
      ),
    },
    {
      key: "assessment",
      header: "AI Assessment",
      render: (r) => <StatusBadge value={r.assessment_status} />,
    },
    {
      key: "verification",
      header: "Verification",
      render: (r) => <StatusBadge value={r.verification} />,
    },
    {
      key: "updated",
      header: "Updated",
      render: (r) => <span className="text-[var(--subtle)] text-[10px]">{r.updated_at}</span>,
    },
  ];

  const totalPages = Math.ceil(total / PAGE_SIZE) || 1;
  const currentPage = Math.floor(offset / PAGE_SIZE) + 1;
  const showingFrom = items.length > 0 ? offset + 1 : 0;
  const showingTo = items.length > 0 ? Math.min(offset + items.length, total) : 0;

  return (
    <div>
      <PageHeader
        title="Incident Management"
        subtitle={`${total} incident${total !== 1 ? "s" : ""} · live feed over WebSocket`}
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
          onChange={(v) => {
            setFilter("category", v);
            setOffset(0);
          }}
          options={[
            { value: "all", label: "All Categories" },
            ...CATEGORIES.map((c) => ({ value: c, label: c })),
          ]}
        />
        <Select
          value={filters.assessment}
          onChange={(v) => {
            setFilter("assessment", v);
            setOffset(0);
          }}
          options={ASSESSMENTS}
        />
        <Select
          value={filters.verification}
          onChange={(v) => {
            setFilter("verification", v);
            setOffset(0);
          }}
          options={[
            { value: "all", label: "All Verification" },
            { value: "UNVERIFIED", label: "Pending" },
            { value: "VERIFIED", label: "Verified" },
            { value: "REJECTED", label: "Rejected" },
          ]}
        />
      </div>

      {error && (
        <div
          role="alert"
          className="mb-3 rounded-lg border border-[var(--danger)]/40 bg-[rgba(239,68,68,.1)] px-4 py-2.5 text-xs text-[#fee2e2]"
        >
          Couldn&apos;t reach the incidents API — {error}.
        </div>
      )}

      {loading && items.length === 0 ? (
        <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-8 text-center text-xs text-[var(--muted)]">
          Loading incidents…
        </div>
      ) : (
        <DataTable
          columns={columns}
          rows={items}
          rowKey={(r) => r.id}
          onRowClick={(r) => router.push(`/incidents/${r.id}`)}
          empty={
            <EmptyState
              title="No incidents match these filters"
              body="Try clearing a filter or submit the first report."
              action={
                <Button
                  onClick={() => {
                    setFilter("category", "all");
                    setFilter("assessment", "all");
                    setFilter("verification", "all");
                    setOffset(0);
                  }}
                >
                  Clear filters
                </Button>
              }
            />
          }
        />
      )}

      {/* real pagination — showing X–Y of Z with Prev / Next */}
      {total > 0 && (
        <div className="mt-4 flex items-center justify-between gap-4">
          <div className="text-xs text-[var(--muted)]">
            Showing {showingFrom}–{showingTo} of {total}
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              disabled={offset === 0}
              onClick={() => setOffset(Math.max(0, offset - PAGE_SIZE))}
            >
              ← Prev
            </Button>
            <span className="text-xs text-[var(--muted)]">
              Page {currentPage} of {totalPages}
            </span>
            <Button
              variant="secondary"
              disabled={offset + PAGE_SIZE >= total}
              onClick={() => setOffset(offset + PAGE_SIZE)}
            >
              Next →
            </Button>
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
