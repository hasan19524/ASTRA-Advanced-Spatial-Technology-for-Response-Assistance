"use client";
/**
 * Dashboard (task 2.4) — one shell, cards switch by role.
 * CENTRAL_ADMIN sees the full reference-design overview; other roles get
 * their own distinct card set. Data from the mock layer (API fallback).
 */
import Link from "next/link";
import { useEffect, useMemo } from "react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/Card";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { EmptyState } from "@/components/ui/EmptyState";
import { UnavailableState } from "@/components/ui/UnavailableState";
import { MapPlaceholder } from "@/components/map/MapPlaceholder";
import { Button } from "@/components/ui/Button";
import { useAuthSession } from "@/hooks/useAuth";
import { useIncidents } from "@/stores/incidents";
import { useStats } from "@/stores/stats";
import { StatGrid } from "@/components/stats/StatGrid";
import { CategoryBreakdown } from "@/components/stats/CategoryBreakdown";
import { ROLE_LABELS, type Role } from "@/lib/constants";

export default function DashboardPage() {
  const { user, can, token } = useAuthSession();
  const { items, load, loading, error } = useIncidents();
  const { stats, load: loadStats } = useStats();

  const dateStr = useMemo(
    () =>
      new Date().toLocaleDateString("en-IN", {
        weekday: "short",
        day: "2-digit",
        month: "short",
        year: "numeric",
      }),
    [],
  );
  const updated = new Date().toLocaleTimeString("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
  });

  useEffect(() => {
    void load({}, token);
    void loadStats(token);
  }, [load, loadStats, token]);

  const role = (user?.role ?? "CITIZEN") as Role;
  const recent = useMemo(() => items.slice(0, 5), [items]);

  return (
    <div>
      <PageHeader
        title={dashboardTitle(role)}
        subtitle={`Overview of incidents and response across Delhi NCR · updated ${updated}`}
        actions={
          <>
            <span className="hidden text-[11px] text-[var(--muted)] sm:block">
              {dateStr}
            </span>
            {can("report.create") && (
              <Link href="/report">
                <Button variant="primary">+ Report Incident</Button>
              </Link>
            )}
          </>
        }
      />

      {/* error state — never a blank screen (hard demo rule) */}
      {error && (
        <div
          role="alert"
          className="mb-4 rounded-lg border border-[var(--danger)]/40 bg-[rgba(239,68,68,.1)] px-4 py-3 text-xs text-[#fee2e2]"
        >
          <strong>Couldn&apos;t load live data.</strong> {error} — showing the last
          known demo snapshot.
        </div>
      )}

      {/* ---- KPI row (real stats; never fixtures) ---- */}
      {stats.error ? (
        <UnavailableState
          reason={`Dashboard stats could not be loaded: ${stats.error}. The backend stats endpoint may not be built yet.`}
        />
      ) : stats.data ? (
        <>
          <StatGrid stats={stats.data} />
          <div className="mt-4">
            <Card title="Category breakdown">
              <CategoryBreakdown breakdown={[]} />
            </Card>
          </div>
        </>
      ) : (
        <div className="p-6 text-center text-xs text-[var(--muted)]">
          Loading dashboard stats…
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-3">
        {/* map — 2 cols */}
        <div className="lg:col-span-2">
          <Card
            title="Live Operations Map"
            subtitle="Real-time incidents and response teams across Delhi NCR"
            action={
              <Link href="/map" className="text-[11px] text-[var(--primary)] hover:underline">
                Open full map →
              </Link>
            }
            padding={false}
          >
            <MapPlaceholder className="border-0 rounded-b-xl" selectedId={null} />
          </Card>
        </div>

        {/* activity feed — no live activity endpoint yet; honest empty state */}
        <Card title="Recent Activity">
          <EmptyState
            title="Live activity feed unavailable"
            body="The activity feed endpoint is not built yet. Incidents are shown in the table below."
            icon="◐"
          />
        </Card>
      </div>

      {/* role-specific second row */}
      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        {role === "RESPONSE_TEAM" ? (
          <>
            <Card title="My Tasks">
              <EmptyState title="Tasks unavailable" body="The task list endpoint is not built yet." icon="◐" />
            </Card>
            <Card title="Team Status">
              <EmptyState title="Team status unavailable" body="The team endpoint is not built yet." icon="◐" />
            </Card>
          </>
        ) : (
          <>
            {/* active incidents table — everyone */}
            <div className="lg:col-span-2">
              <Card
                title="Active Incidents"
                action={
                  <Link href="/incidents" className="text-[11px] text-[var(--primary)] hover:underline">
                    View all →
                  </Link>
                }
                padding={false}
              >
                {loading && items.length === 0 ? (
                  <div className="p-6 text-center text-xs text-[var(--muted)]">
                    Loading incidents…
                  </div>
                ) : recent.length === 0 ? (
                  <div className="p-4">
                    <EmptyState
                      title="No incidents yet"
                      body="New reports will appear here as soon as citizens file them."
                    />
                  </div>
                ) : (
                  <table className="w-full text-left text-[11px]">
                    <thead>
                      <tr className="border-b border-[var(--border)] text-[var(--muted)]">
                        <th className="px-4 py-2.5 font-medium">ID</th>
                        <th className="px-4 py-2.5 font-medium">Category</th>
                        <th className="px-4 py-2.5 font-medium">Location</th>
                        <th className="px-4 py-2.5 font-medium">Severity</th>
                        <th className="px-4 py-2.5 font-medium">Verification</th>
                        <th className="px-4 py-2.5 font-medium">Response</th>
                        <th className="px-4 py-2.5 font-medium">Updated</th>
                      </tr>
                    </thead>
                    <tbody>
                      {recent.map((i) => (
                        <tr
                          key={i.id}
                          className="border-b border-[var(--border)] last:border-0 hover:bg-[var(--surface-2)]"
                        >
                          <td className="px-4 py-2.5">
                            <Link
                              href={`/incidents/${i.id}`}
                              className="font-mono text-[var(--primary)] hover:underline"
                            >
                              {i.id}
                            </Link>
                          </td>
                          <td className="px-4 py-2.5">{i.category}</td>
                          <td className="px-4 py-2.5 text-[var(--muted)]">{i.location_text ?? i.region ?? "—"}</td>
                          <td className="px-4 py-2.5">
                            <StatusBadge value={i.assessment_status} />
                          </td>
                          <td className="px-4 py-2.5">
                            <StatusBadge value={i.verification} />
                          </td>
                          <td className="px-4 py-2.5">
                            <StatusBadge value={i.response_phase} />
                          </td>
                          <td className="px-4 py-2.5 text-[var(--subtle)]">{i.updated_at}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </Card>
            </div>

            {/* departments / quick facts */}
            <Card title={role === "CITIZEN" ? "How ASTRA works" : "Departments"}>
              {role === "CITIZEN" ? (
                <ol className="space-y-3 text-xs text-[var(--muted)]">
                  <li><span className="mr-2 rounded bg-[var(--primary-soft)] px-1.5 py-0.5 text-[10px] font-bold text-[#dbeafe]">1</span> Report an incident with text, photo or voice.</li>
                  <li><span className="mr-2 rounded bg-[var(--primary-soft)] px-1.5 py-0.5 text-[10px] font-bold text-[#dbeafe]">2</span> AI assesses it — the public poll weighs in.</li>
                  <li><span className="mr-2 rounded bg-[var(--primary-soft)] px-1.5 py-0.5 text-[10px] font-bold text-[#dbeafe]">3</span> A verification officer confirms the truth.</li>
                  <li><span className="mr-2 rounded bg-[var(--primary-soft)] px-1.5 py-0.5 text-[10px] font-bold text-[#dbeafe]">4</span> Response teams are coordinated to the scene.</li>
                </ol>
              ) : (
                <ul className="space-y-2 text-xs">
                  {[
                    ["Police", "12 units"],
                    ["Fire & Rescue", "6 units"],
                    ["Medical/EMS", "8 units"],
                    ["Transport & Roads", "4 units"],
                    ["Disaster Management", "3 units"],
                    ["Electricity/Utilities", "5 units"],
                    ["Water & Drainage", "4 units"],
                  ].map(([name, units]) => (
                    <li key={name} className="flex items-center justify-between rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2">
                      <span>{name}</span>
                      <span className="text-[10px] text-[var(--muted)]">{units}</span>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </>
        )}
      </div>

      <p className="mt-4 text-[10px] text-[var(--subtle)]">
        Signed in as {user?.full_name} ({ROLE_LABELS[role]})
      </p>
    </div>
  );
}

function dashboardTitle(role: Role): string {
  switch (role) {
    case "CENTRAL_ADMIN":
      return "Central Admin Dashboard";
    case "DEPARTMENT_HEAD":
      return "Department Head Dashboard";
    case "RESPONSE_TEAM":
      return "Response Team Dashboard";
    case "VERIFICATION_OFFICER":
      return "Verification Officer Dashboard";
    default:
      return "Citizen Dashboard";
  }
}
