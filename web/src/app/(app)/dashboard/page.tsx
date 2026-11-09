"use client";
import Link from "next/link";
/**
 * Dashboard (task 2.4) — one shell, cards switch by role.
 * CENTRAL_ADMIN sees the full reference-design overview; other roles get
 * their own distinct card set. Data from the mock layer (API fallback).
 */
import { useEffect, useMemo, useState } from "react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/Card";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { EmptyState } from "@/components/ui/EmptyState";
import { UnavailableState } from "@/components/ui/UnavailableState";
import LiveMap from "@/components/map/LiveMap";
import { LinkButton } from "@/components/ui/LinkButton";
import { useAuthSession } from "@/hooks/useAuth";
import { useIncidents } from "@/stores/incidents";
import { useStats } from "@/stores/stats";
import { StatGrid } from "@/components/stats/StatGrid";
import { CategoryBreakdown } from "@/components/stats/CategoryBreakdown";
import { ROLE_LABELS, type Role } from "@/lib/constants";
import { request } from "@/api/client";

interface DepartmentLoad {
  name: string;
  head_name: string | null;
  personnel_count: number;
  open_tasks: number;
  total_tasks: number;
}

interface AuditEntry {
  id: string;
  actor_label: string | null;
  action: string;
  method: string;
  path: string;
  status_code: number;
  created_at: string;
}

/** Fetch the department load. Module scope on purpose: the effect below owns
 *  the state write, so the panel never renders stale data from another role. */
async function fetchDepartmentLoad(token: string | null): Promise<DepartmentLoad[]> {
  const data = await request<DepartmentLoad[]>("/api/v1/departments", { token });
  return Array.isArray(data) ? data : [];
}

/** Fetch the newest audit rows — the real activity feed for admins. */
async function fetchActivity(token: string | null): Promise<AuditEntry[]> {
  const data = await request<AuditEntry[]>("/api/v1/audit/logs?limit=8", {
    token,
  });
  return Array.isArray(data) ? data : [];
}

export default function DashboardPage() {
  const { user, can, token } = useAuthSession();
  const { items, load, loading, error } = useIncidents();
  const { stats, load: loadStats } = useStats();
  const [departmentLoad, setDepartmentLoad] = useState<DepartmentLoad[]>([]);
  const [activity, setActivity] = useState<AuditEntry[]>([]);

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
    // The dashboard map needs a wide view of Delhi NCR, not the first page
    // of 20 the incidents table uses.
    void load({ limit: 200 }, token);
    void loadStats(token);
  }, [load, loadStats, token]);

  // Real activity feed — the audit log. Only admins hold `audit.read`,
  // so for every other role the panel keeps its honest "not available"
  // state instead of pretending.
  const canReadAudit = can("audit.read");
  useEffect(() => {
    if (!canReadAudit) return;
    let cancelled = false;
    fetchActivity(token)
      .then((list) => {
        if (!cancelled) setActivity(list);
      })
      .catch(() => {
        if (!cancelled) setActivity([]);
      });
    return () => {
      cancelled = true;
    };
  }, [canReadAudit, token]);

  // Real department load (staff only) — replaces the invented unit counts.
  const canViewDirectory = can("task.view");
  useEffect(() => {
    if (!canViewDirectory) return;
    let cancelled = false;
    fetchDepartmentLoad(token)
      .then((list) => {
        if (!cancelled) setDepartmentLoad(list);
      })
      .catch(() => {
        if (!cancelled) setDepartmentLoad([]);
      });
    return () => {
      cancelled = true;
    };
  }, [canViewDirectory, token]);

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
              <LinkButton href="/report" variant="primary">
                + Report Incident
              </LinkButton>
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
            <LiveMap
              incidents={items}
              selectedId={null}
              onSelect={() => undefined}
              route={null}
              closures={[]}
              showIncidents
              showRoute={false}
              showClosures={false}
              showBasemapSwitcher={false}
              className="h-[320px] rounded-b-xl"
            />
          </Card>
        </div>

        {/* activity feed — the real audit log for admins; honest empty
            state for roles without `audit.read` */}
        <Card title="Recent Activity">
          {canReadAudit && activity.length > 0 ? (
            <ul className="space-y-2.5">
              {activity.map((a) => (
                <li key={a.id} className="border-b border-[var(--border)] pb-2 last:border-0 last:pb-0">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="truncate text-[11px] font-medium">
                      {a.actor_label ?? a.action}
                    </span>
                    <span
                      className={`shrink-0 font-mono text-[9px] ${
                        a.status_code >= 400
                          ? "text-[var(--danger)]"
                          : "text-[var(--subtle)]"
                      }`}
                    >
                      {a.method} {a.status_code}
                    </span>
                  </div>
                  <p className="mt-0.5 truncate font-mono text-[9px] text-[var(--subtle)]">
                    {a.action} · {a.path}
                  </p>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState
              title={
                canReadAudit
                  ? "No activity recorded yet"
                  : "Activity feed is admin-only"
              }
              body={
                canReadAudit
                  ? "Every write action on the platform is logged here as it happens."
                  : "Your role cannot read the audit log. The backend enforces this — the UI is just being polite."
              }
              icon="◐"
            />
          )}
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
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[820px] text-left text-[11px]">
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
                  </div>
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
                  {departmentLoad.length === 0 ? (
                    <li className="text-[11px] text-[var(--muted)]">
                      Department load appears here once the directory is reachable.
                    </li>
                  ) : (
                    departmentLoad.map((d) => (
                      <li
                        key={d.name}
                        className="flex items-center justify-between rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2"
                      >
                        <span>{d.name}</span>
                        <span className="text-[10px] text-[var(--muted)]">
                          {d.open_tasks} open · {d.personnel_count} personnel
                        </span>
                      </li>
                    ))
                  )}
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
