"use client";
/**
 * Dashboard (task 2.4) — one shell, cards switch by role.
 * CENTRAL_ADMIN sees the full reference-design overview; other roles get
 * their own distinct card set. Data from the mock layer (API fallback).
 */
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { PageHeader } from "@/components/layout/PageHeader";
import { StatCard } from "@/components/ui/StatCard";
import { Card } from "@/components/ui/Card";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { EmptyState } from "@/components/ui/EmptyState";
import { MapPlaceholder } from "@/components/map/MapPlaceholder";
import { Button } from "@/components/ui/Button";
import { useAuthSession } from "@/hooks/useAuth";
import { useIncidents } from "@/stores/incidents";
import { mockActivity, mockStats, mockTasks, mockTeams } from "@/lib/mocks/fixtures";
import { ROLE_LABELS, type Role } from "@/lib/constants";

export default function DashboardPage() {
  const { user, can } = useAuthSession();
  const { items, load, loading, error } = useIncidents();
  const [tick, setTick] = useState(0);

  // client-only timestamps (new Date() at module scope breaks prerender)
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
  // recompute every `tick` (30s interval below) so "updated …" stays fresh
  const updated = tick
    ? new Date().toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })
    : new Date().toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });

  useEffect(() => {
    void load();
    const t = setInterval(() => setTick((v) => v + 1), 30_000);
    return () => clearInterval(t);
  }, [load]);

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

      {/* ---- KPI row (differs per role) ---- */}
      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {role === "CITIZEN" ? (
          <>
            <StatCard icon="📋" value={items.length} label="Public incidents visible" tone="info" />
            <StatCard icon="🗳" value="196" label="Poll responses today" tone="moderate" />
            <StatCard icon="📢" value="2" label="Active alerts" tone="critical" />
            <StatCard icon="🧭" value="Live" label="Map & navigation" tone="verified" />
          </>
        ) : role === "RESPONSE_TEAM" ? (
          <>
            <StatCard icon="📌" value={mockTasks.length} label="Assigned Tasks" tone="info" delta="2 in progress" />
            <StatCard icon="🔄" value="2" label="In Progress" tone="moderate" />
            <StatCard icon="✅" value="1" label="Completed Today" tone="verified" />
            <StatCard icon="👥" value="4 / 6" label="Team Availability" tone="verified" delta="Online now" />
          </>
        ) : role === "VERIFICATION_OFFICER" ? (
          <>
            <StatCard icon="⏳" value={mockStats.under_verification} label="Awaiting verification" tone="moderate" delta="+2 today" />
            <StatCard icon="✅" value="14" label="Verified today" tone="verified" />
            <StatCard icon="❌" value="3" label="Rejected today" tone="critical" />
            <StatCard icon="⏱" value="6m" label="Avg. time to verify" tone="info" />
          </>
        ) : role === "DEPARTMENT_HEAD" ? (
          <>
            <StatCard icon="🚨" value="9" label="Department incidents" tone="critical" delta="+2 today" />
            <StatCard icon="👷" value="6" label="Active tasks" tone="moderate" />
            <StatCard icon="🚒" value="4 / 6" label="Units deployed" tone="info" />
            <StatCard icon="📈" value="82%" label="On-time progress" tone="verified" />
          </>
        ) : (
          <>
            <StatCard icon="🚨" value={mockStats.active_incidents} label="Active Incidents" tone="critical" delta={`↑ ${mockStats.deltas.active} today`} />
            <StatCard icon="🔍" value={mockStats.under_verification} label="Under Verification" tone="moderate" delta={`↑ ${mockStats.deltas.verification} today`} />
            <StatCard icon="🚑" value={mockStats.in_response} label="In Response" tone="info" delta={`↑ ${mockStats.deltas.response} today`} />
            <StatCard icon="✅" value={mockStats.resolved_today} label="Resolved Today" tone="verified" delta={mockStats.deltas.resolved} />
          </>
        )}
      </div>

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

        {/* activity feed */}
        <Card
          title="Recent Activity"
          action={
            <span className="text-[11px] text-[var(--primary)]">View all</span>
          }
        >
          <ul className="space-y-3">
            {mockActivity.map((a) => (
              <li key={a.id} className="flex items-start gap-2.5">
                <StatusBadge tone={a.tone as never} className="mt-0.5 shrink-0">
                  {a.time}
                </StatusBadge>
                <div className="min-w-0">
                  <p className="truncate text-xs text-[var(--foreground)]">{a.text}</p>
                </div>
              </li>
            ))}
          </ul>
        </Card>
      </div>

      {/* role-specific second row */}
      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        {role === "RESPONSE_TEAM" ? (
          <>
            <Card title="My Tasks" action={<span className="text-[11px] text-[var(--primary)]">View all</span>}>
              <ul className="space-y-2.5">
                {mockTasks.map((t) => (
                  <li key={t.id} className="rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2">
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate text-xs font-semibold">{t.id}</span>
                      <StatusBadge tone={t.tone as never}>{t.status}</StatusBadge>
                    </div>
                    <p className="mt-0.5 truncate text-[11px] text-[var(--muted)]">{t.title}</p>
                    <p className="mt-0.5 text-[10px] text-[var(--subtle)]">{t.eta}</p>
                  </li>
                ))}
              </ul>
            </Card>
            <Card title="Team Status">
              <ul className="space-y-2.5">
                {mockTeams.map((t) => (
                  <li key={t.id} className="flex items-center justify-between text-xs">
                    <span>
                      <span className="font-semibold">{t.id}</span>{" "}
                      <span className="text-[var(--muted)]">{t.name}</span>
                    </span>
                    <span className="flex items-center gap-2">
                      <span className="text-[10px] text-[var(--muted)]">{t.members}</span>
                      <StatusBadge
                        tone={
                          t.status === "Available"
                            ? "verified"
                            : t.status === "En Route"
                              ? "info"
                              : t.status === "On Task"
                                ? "moderate"
                                : "critical"
                        }
                      >
                        {t.status}
                      </StatusBadge>
                    </span>
                  </li>
                ))}
              </ul>
            </Card>
            <Card title="Availability">
              <div className="flex flex-col items-center py-4">
                <div className="relative flex h-24 w-24 items-center justify-center rounded-full border-4 border-[var(--primary)]">
                  <span className="text-xl font-bold">4/6</span>
                </div>
                <p className="mt-3 text-xs text-[var(--muted)]">Units online</p>
              </div>
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
                          <td className="px-4 py-2.5 text-[var(--muted)]">{i.location}</td>
                          <td className="px-4 py-2.5">
                            <StatusBadge value={i.severity} />
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
        Signed in as {user?.full_name} ({ROLE_LABELS[role]}) — tick index {tick % 2 === 0 ? "even" : "odd"}
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
