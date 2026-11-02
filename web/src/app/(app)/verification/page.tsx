"use client";
/**
 * Officer Verification Queue (Day 4) — incidents awaiting verification.
 * Only visible to roles holding `incident.verify` (officer + admin).
 * Fetches GET /api/v1/verification/queue with filter chips for age /
 * assessment / urgency. Rows link to the investigation view.
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
import { useAuthSession } from "@/hooks/useAuth";

const PAGE_SIZE = 20;

const ASSESSMENT_FILTERS = [
  { value: "all", label: "All Assessment" },
  { value: "UNASSESSED", label: "Unassessed" },
  { value: "MAYBE_TRUE", label: "Maybe True" },
  { value: "DEFINITELY_FALSE", label: "Definitely False" },
];

const AGE_FILTERS = [
  { value: "all", label: "All Ages" },
  { value: "60", label: "Older than 1 hour" },
  { value: "180", label: "Older than 3 hours" },
  { value: "360", label: "Older than 6 hours" },
];

const URGENCY_FILTERS = [
  { value: "all", label: "All Urgency" },
  { value: "urgent", label: "Urgent categories" },
];

export default function VerificationQueuePage() {
  const { can, token } = useAuthSession();
  const router = useRouter();
  const {
    items,
    total,
    loading,
    error,
    loadVerificationQueue,
  } = useIncidents();
  const [offset, setOffset] = useState(0);
  const [filters, setFilters] = useState({
    assessment: "all",
    min_age_minutes: "all",
    urgency: "all",
  });

  useEffect(() => {
    void loadVerificationQueue({
      assessment: filters.assessment,
      min_age_minutes: filters.min_age_minutes,
      urgency: filters.urgency,
      offset,
      limit: PAGE_SIZE,
    }, token);
  }, [
    loadVerificationQueue,
    filters.assessment,
    filters.min_age_minutes,
    filters.urgency,
    offset,
    token,
  ]);

  // Guard: only officer + admin can see this page
  if (!can("incident.verify")) {
    return (
      <div className="flex h-screen flex-col items-center justify-center text-center">
        <h1 className="text-lg font-semibold text-[var(--foreground)]">Not authorized</h1>
        <p className="mt-1 text-xs text-[var(--muted)]">
          You need officer or admin permissions to view the verification queue.
        </p>
        <Button variant="primary" className="mt-4" onClick={() => router.push("/dashboard")}>
          Back to dashboard
        </Button>
      </div>
    );
  }

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
      key: "sensitivity",
      header: "Sensitivity",
      render: (r) => <StatusBadge value={r.sensitivity} />,
    },
    {
      key: "action",
      header: "Action",
      render: (r) => (
        <Link href={`/incidents/${r.id}`}>
          <Button variant="secondary">
            Investigate
          </Button>
        </Link>
      ),
    },
  ];

  const totalPages = Math.ceil(total / PAGE_SIZE) || 1;
  const currentPage = Math.floor(offset / PAGE_SIZE) + 1;
  const showingFrom = items.length > 0 ? offset + 1 : 0;
  const showingTo = items.length > 0 ? Math.min(offset + items.length, total) : 0;

  return (
    <div>
      <PageHeader
        title="Verification Queue"
        subtitle={`${total} incident{total !== 1 ? "s" : ""} awaiting officer review`}
      />

      {/* filter row */}
      <div className="mb-3 flex flex-wrap gap-2">
        <Select
          value={filters.assessment}
          onChange={(v) => {
            setFilters({ ...filters, assessment: v });
            setOffset(0);
          }}
          options={ASSESSMENT_FILTERS}
        />
        <Select
          value={filters.min_age_minutes}
          onChange={(v) => {
            setFilters({ ...filters, min_age_minutes: v });
            setOffset(0);
          }}
          options={AGE_FILTERS}
        />
        <Select
          value={filters.urgency}
          onChange={(v) => {
            setFilters({ ...filters, urgency: v });
            setOffset(0);
          }}
          options={URGENCY_FILTERS}
        />
      </div>

      {error && (
        <div
          role="alert"
          className="mb-3 rounded-lg border border-[var(--danger)]/40 bg-[rgba(239,68,68,.1)] px-4 py-2.5 text-xs text-[#fee2e2]"
        >
          Couldn&apos;t load verification queue — {error}.
        </div>
      )}

      {loading && items.length === 0 ? (
        <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-8 text-center text-xs text-[var(--muted)]">
          Loading verification queue…
        </div>
      ) : (
        <DataTable
          columns={columns}
          rows={items}
          rowKey={(r) => r.id}
          empty={
            <EmptyState
              title="No incidents awaiting verification"
              body={
                filters.assessment !== "all" ||
                filters.min_age_minutes !== "all" ||
                filters.urgency !== "all"
                  ? "Try clearing a filter."
                  : "All caught up — no incidents need verification right now."
              }
              action={
                <Button
                  onClick={() => {
                    setFilters({ assessment: "all", min_age_minutes: "all", urgency: "all" });
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

      {/* pagination */}
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
