"use client";
/**
 * Response Team dashboard — real data only.
 *
 * Everything on this page comes from GET /api/v1/tasks (the role-scoped task
 * list: a response-team member sees only the tasks they are assigned to, a
 * department head sees their department, the central admin sees everything)
 * plus the incident behind the selected task. There are no hard-coded
 * counters, no invented distances and no fake route drawings — an empty board
 * says so instead.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { PageHeader } from "@/components/layout/PageHeader";
import { StatCard } from "@/components/ui/StatCard";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { LinkButton } from "@/components/ui/LinkButton";
import { EmptyState } from "@/components/ui/EmptyState";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { TaskRow } from "@/components/task/TaskRow";
import { useAuthSession } from "@/hooks/useAuth";
import { useTasks } from "@/stores/tasks";
import { request } from "@/api/client";
import type { IncidentDetailOut, TaskOut } from "@/api/openapi-types";

function isToday(iso: string | undefined): boolean {
  if (!iso) return false;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return false;
  const now = new Date();
  return (
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate()
  );
}

/** Fetch the role-scoped task list. Module scope on purpose: the effect below
 *  owns every state write, so loading/error transitions stay in one place. */
async function fetchTasks(token: string | null): Promise<TaskOut[]> {
  const data = await request<TaskOut[]>("/api/v1/tasks?limit=200", { token });
  return Array.isArray(data) ? data : [];
}

export default function TeamsPage() {
  const { user, can, token } = useAuthSession();
  const { patch, addUpdate } = useTasks();

  const [tasks, setTasks] = useState<TaskOut[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  // The fetched incident is stored WITH the task it belongs to, so the panel
  // can tell "not loaded yet" from "the previous task's incident" without
  // clearing state inside the effect.
  const [incidentState, setIncidentState] = useState<{
    taskId: string | null;
    incident: IncidentDetailOut | null;
    error: string | null;
  }>({ taskId: null, incident: null, error: null });

  const load = useCallback(async () => {
    try {
      const list = await fetchTasks(token);
      setTasks(list);
      setError(null);
      setSelectedTaskId((current) => {
        if (current && list.some((t) => t.id === current)) return current;
        return list.find((t) => t.status !== "DONE")?.id ?? list[0]?.id ?? null;
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load tasks");
      setTasks([]);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    let cancelled = false;
    fetchTasks(token)
      .then((list) => {
        if (cancelled) return;
        setTasks(list);
        setError(null);
        setSelectedTaskId((current) => {
          if (current && list.some((t) => t.id === current)) return current;
          return list.find((t) => t.status !== "DONE")?.id ?? list[0]?.id ?? null;
        });
        setLoading(false);
      })
      .catch((e: unknown) => {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : "Failed to load tasks");
        setTasks([]);
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [token]);

  const selectedTask = useMemo(
    () => tasks.find((t) => t.id === selectedTaskId) ?? null,
    [tasks, selectedTaskId],
  );

  // The board is paged: a central admin can have hundreds of tasks and a
  // single long list is neither scannable nor fast to render.
  const PAGE_SIZE = 25;
  const totalPages = Math.max(1, Math.ceil(tasks.length / PAGE_SIZE));
  const pageTasks = useMemo(
    () => tasks.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE),
    [tasks, page],
  );

  // The incident behind the selected task — the dispatch target.
  const selectedIncidentId = selectedTask?.incident_id ?? null;
  useEffect(() => {
    if (!selectedIncidentId) return;
    let cancelled = false;
    request<IncidentDetailOut>(`/api/v1/incidents/${selectedIncidentId}`, { token })
      .then((res) => {
        if (!cancelled) {
          setIncidentState({ taskId: selectedIncidentId, incident: res, error: null });
        }
      })
      .catch((e: unknown) => {
        if (!cancelled) {
          setIncidentState({
            taskId: selectedIncidentId,
            incident: null,
            error: e instanceof Error ? e.message : "Incident unavailable",
          });
        }
      });
    return () => {
      cancelled = true;
    };
  }, [selectedIncidentId, token]);

  // Only show the incident that belongs to the CURRENTLY selected task.
  const incident =
    incidentState.taskId === selectedIncidentId ? incidentState.incident : null;
  const incidentError =
    incidentState.taskId === selectedIncidentId ? incidentState.error : null;

  const stats = useMemo(() => {
    const open = tasks.filter((t) => t.status === "OPEN").length;
    const active = tasks.filter((t) => t.status === "IN_PROGRESS").length;
    const doneToday = tasks.filter((t) => t.status === "DONE" && isToday(t.updated_at)).length;
    const people = new Set<string>();
    for (const t of tasks) {
      if (t.status === "DONE") continue;
      for (const name of t.assignee_names ?? []) people.add(name);
    }
    return { open, active, doneToday, engaged: people.size };
  }, [tasks]);

  const canUpdate = can("task.update");
  const canAssign = can("task.assign");

  return (
    <div>
      <PageHeader
        title={user?.role === "RESPONSE_TEAM" ? "Response Team Dashboard" : "Task Board"}
        subtitle={
          user?.role === "RESPONSE_TEAM"
            ? "Your assigned tasks and dispatch information"
            : "Tasks you can see, scoped to your role"
        }
        actions={
          <div className="flex items-center gap-2">
            <span className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5 text-[11px] text-[var(--muted)]">
              {user?.department ?? "All departments"}
            </span>
            <span className="flex items-center gap-1.5 rounded-lg bg-[var(--primary-soft)] px-3 py-1.5 text-[11px] font-semibold text-[#dbeafe]">
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[var(--primary)] text-[9px] text-white">
                {user?.full_name?.[0] ?? "?"}
              </span>
              {user?.full_name ?? "Signed in"}
            </span>
          </div>
        }
      />

      {error && (
        <div
          role="alert"
          className="mb-4 rounded-lg border border-[var(--danger)]/40 bg-[rgba(239,68,68,.1)] px-4 py-3 text-xs text-[#fee2e2]"
        >
          {error}
        </div>
      )}

      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard icon="📋" value={String(stats.open)} label="Open tasks" tone="moderate" />
        <StatCard icon="🔄" value={String(stats.active)} label="In progress" tone="major" />
        <StatCard icon="✅" value={String(stats.doneToday)} label="Done today" tone="verified" />
        <StatCard
          icon="👥"
          value={String(stats.engaged)}
          label="People engaged"
          tone="verified"
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <Card
            title="Tasks"
            subtitle={`${tasks.length} in your scope · page ${page + 1} of ${totalPages}`}
          >
            {loading && tasks.length === 0 ? (
              <div className="p-6 text-center text-xs text-[var(--muted)]">Loading tasks…</div>
            ) : tasks.length === 0 ? (
              <EmptyState
                title="No tasks assigned"
                body={
                  canAssign
                    ? "No tasks are visible to you yet. Tasks you create against an incident show up here."
                    : "Nothing is assigned to you right now. A central admin assigns tasks from an incident."
                }
                icon="📋"
              />
            ) : (
              <>
                {/* Compact board: one line per task. The full action row is
                    only rendered for the selected task (right panel) — with
                    70+ tasks, an editable row each was unusable. */}
                <ul className="divide-y divide-[var(--border)]">
                  {pageTasks.map((t) => {
                    const active = t.id === selectedTaskId;
                    return (
                      <li key={t.id}>
                        <button
                          type="button"
                          onClick={() => setSelectedTaskId(t.id)}
                          aria-current={active ? "true" : undefined}
                          className={`flex w-full items-center gap-3 px-1 py-2.5 text-left transition-colors hover:bg-[var(--surface-2)] ${
                            active ? "bg-[var(--surface-2)]" : ""
                          }`}
                        >
                          <span
                            className="h-2 w-2 shrink-0 rounded-full"
                            style={{
                              background:
                                t.status === "DONE"
                                  ? "var(--success, #22c55e)"
                                  : t.status === "IN_PROGRESS"
                                    ? "var(--warning, #f59e0b)"
                                    : "var(--primary)",
                            }}
                            aria-hidden="true"
                          />
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-[11px] font-medium">
                              {t.title}
                            </span>
                            <span className="block truncate text-[10px] text-[var(--muted)]">
                              {(t.assignee_names ?? []).join(", ") || "Unassigned"}
                            </span>
                          </span>
                          <span className="hidden shrink-0 text-[9px] font-bold uppercase tracking-wide text-[var(--muted)] sm:block">
                            {t.department}
                          </span>
                          <StatusBadge value={String(t.status)} />
                        </button>
                      </li>
                    );
                  })}
                </ul>

                {totalPages > 1 && (
                  <div className="mt-3 flex items-center justify-between gap-2 border-t border-[var(--border)] pt-3">
                    <Button
                      variant="secondary"
                      disabled={page === 0}
                      onClick={() => setPage((p) => Math.max(0, p - 1))}
                    >
                      Prev
                    </Button>
                    <span className="text-[10px] text-[var(--muted)]">
                      Page {page + 1} / {totalPages}
                    </span>
                    <Button
                      variant="secondary"
                      disabled={page >= totalPages - 1}
                      onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                    >
                      Next
                    </Button>
                  </div>
                )}
              </>
            )}
          </Card>
        </div>

        <div className="space-y-4">
          <Card title="Dispatch target">
            {!selectedTask ? (
              <EmptyState
                title="No task selected"
                body="Select a task to see the incident you are dispatched to."
                icon="🧭"
              />
            ) : (
              <div className="space-y-3">
                <div>
                  <p className="text-[10px] text-[var(--muted)]">Selected task</p>
                  <p className="text-xs font-semibold">{selectedTask.title}</p>
                </div>
                <div>
                  <p className="text-[10px] text-[var(--muted)]">Status</p>
                  <StatusBadge value={String(selectedTask.status)} />
                </div>
                {/* The full action row lives here, for the selected task only. */}
                <TaskRow
                  task={selectedTask}
                  canUpdate={canUpdate}
                  onPatch={async (id, payload) => {
                    const updated = await patch(id, payload, token);
                    if (updated) {
                      setTasks((prev) => prev.map((x) => (x.id === id ? updated : x)));
                    }
                  }}
                  onUpdate={async (id, payload) => {
                    await addUpdate(id, payload, token);
                    await load();
                  }}
                />
                {incidentError ? (
                  <p className="text-[11px] text-[var(--danger)]">{incidentError}</p>
                ) : incident ? (
                  <dl className="space-y-1.5 text-[11px]">
                    <div className="flex justify-between gap-2">
                      <dt className="text-[var(--muted)]">Incident</dt>
                      <dd className="truncate font-medium">{incident.title}</dd>
                    </div>
                    <div className="flex justify-between gap-2">
                      <dt className="text-[var(--muted)]">Category</dt>
                      <dd>{incident.category}</dd>
                    </div>
                    <div className="flex justify-between gap-2">
                      <dt className="text-[var(--muted)]">Location</dt>
                      <dd className="truncate">
                        {incident.location_text ?? incident.region ?? "—"}
                      </dd>
                    </div>
                    <div className="flex justify-between gap-2">
                      <dt className="text-[var(--muted)]">Coordinates</dt>
                      <dd className="font-mono">
                        {incident.latitude.toFixed(4)}, {incident.longitude.toFixed(4)}
                      </dd>
                    </div>
                    <div className="flex justify-between gap-2">
                      <dt className="text-[var(--muted)]">Response phase</dt>
                      <dd>{incident.response_phase}</dd>
                    </div>
                  </dl>
                ) : (
                  <p className="text-[11px] text-[var(--muted)]">Loading incident…</p>
                )}
                <div className="flex gap-2">
                  <LinkButton
                    href={`/incidents/${selectedTask.incident_id}`}
                    variant="secondary"
                    className="flex-1"
                  >
                    Open incident
                  </LinkButton>
                  <LinkButton href="/map" variant="primary" className="flex-1">
                    Open live map
                  </LinkButton>
                </div>
              </div>
            )}
          </Card>

          <Card title="People on live tasks">
            {stats.engaged === 0 ? (
              <EmptyState
                title="Nobody engaged yet"
                body="Assignees appear here as soon as a task is assigned and still open."
                icon="👥"
              />
            ) : (
              <ul className="space-y-1.5 text-[11px]">
                {[...new Set(tasks.flatMap((t) => t.assignee_names ?? []))].map((name) => (
                  <li key={name} className="flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full bg-[var(--primary)]" />
                    {name}
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
