"use client";
/**
 * Incident Detail — real API (GET /api/v1/incidents/{id}).
 * 4-axis status cards from IncidentOut + assessment timeline (assessments[])
 * + evidence list (reports[] with photo URLs) + public poll card.
 * 404 → not-found state (hidden rows surface as 404 to unauthorized roles, AD-19).
 */
import Link from "next/link";
import { use, useCallback, useEffect, useState } from "react";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { Modal } from "@/components/ui/Modal";
import { TaskList } from "@/components/task/TaskList";
import { useIncidents } from "@/stores/incidents";
import { useTasks } from "@/stores/tasks";
import { useAuthSession } from "@/hooks/useAuth";
import { API_URL, DEPARTMENTS } from "@/lib/constants";
import { request } from "@/api/client";
import type { IncidentOut, ReportOut } from "@/api/types";
import type { TaskCreateIn, TaskPatchIn, TaskUpdateIn } from "@/api/openapi-types";

interface PollData {
  eligible: boolean;
  reason: string | null;
  my_vote: "genuine" | "fake" | null;
  genuine: number;
  fake: number;
  percent_genuine: number;
}

/** Evidence thumbnail — AD-8 signed URL, with an honest fallback when the
 *  signed link has expired (the API refuses unsigned/expired requests). */
function EvidenceThumb({ report }: { report: ReportOut }) {
  const [failed, setFailed] = useState(false);
  const url = report.media_url ? `${API_URL}${report.media_url}` : "";
  if (!url || failed) {
    return (
      <div className="w-16 h-16 rounded-lg border border-dashed border-[var(--border)] bg-[var(--surface-2)] flex items-center justify-center text-[10px] text-[var(--muted)]">
        {report.source}
      </div>
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={url}
      alt="Evidence"
      onError={() => setFailed(true)}
      className="w-16 h-16 rounded object-cover"
    />
  );
}

export default function IncidentDetailPage(props: PageProps<"/incidents/[id]">) {
  const params = use(props.params);
  const id = params.id;
  const { selected, loadOne, loading, error, notFound } = useIncidents();
  const { can, token } = useAuthSession();
  const {
    items: tasks,
    loadByIncident,
    create: createTask,
    patch: patchTask,
    addUpdate: addTaskUpdate,
  } = useTasks();
  const canAssign = can("task.assign");
  const canUpdate = can("task.update");

  // --- public poll (Day 4) ---
  const [poll, setPoll] = useState<PollData | null>(null);
  const [pollLoading, setPollLoading] = useState(false);
  const [pollError, setPollError] = useState<string | null>(null);

  // --- verification (Day 4) ---
  interface VerificationEvent {
    id: string;
    action: "VERIFIED" | "REJECTED" | "REOPENED";
    reason: string | null;
    officer: string | null;
    created_at: string;
  }
  const [verificationEvents, setVerificationEvents] = useState<VerificationEvent[]>([]);
  const [verdictLoading, setVerdictLoading] = useState(false);
  const [verdictError, setVerdictError] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmVerdict, setConfirmVerdict] = useState<
    "VERIFIED" | "REJECTED" | "REOPENED" | null
  >(null);
  const [verdictReason, setVerdictReason] = useState("");

  const vote = useCallback(
    async (voteType: "genuine" | "fake") => {
      setPollError(null);
      try {
        const data = await request<PollData>(`/api/v1/incidents/${id}/poll/vote`, {
          method: "POST",
          body: { vote: voteType },
          token,
        });
        setPoll(data);
      } catch (e) {
        setPollError(e instanceof Error ? e.message : "Vote not recorded — try again.");
      }
    },
    [id, token],
  );

  const fetchVerificationEvents = useCallback(async () => {
    try {
      const data = await request<{ verification_events?: VerificationEvent[] }>(
        `/api/v1/incidents/${id}`,
        { token },
      );
      setVerificationEvents(data.verification_events ?? []);
    } catch {
      // verification_events may not exist yet on older backend — silent degrade
    }
  }, [id, token]);

  const verifyIncident = useCallback(
    async (verdict: "VERIFIED" | "REJECTED", reason: string) => {
      setVerdictError(null);
      setVerdictLoading(true);
      try {
        await request<IncidentOut>(`/api/v1/incidents/${id}/verify`, {
          method: "POST",
          body: { verdict, reason },
          token,
        });
        setConfirmOpen(false);
        setConfirmVerdict(null);
        setVerdictReason("");
        // refresh detail to get updated verification status
        void loadOne(id, token);
      } catch (e) {
        setVerdictError(e instanceof Error ? e.message : "Verdict not recorded — try again.");
      } finally {
        setVerdictLoading(false);
      }
    },
    [id, token, loadOne],
  );

  const reopenIncident = useCallback(
    async (reason: string) => {
      setVerdictError(null);
      setVerdictLoading(true);
      try {
        await request<IncidentOut>(`/api/v1/incidents/${id}/reopen`, {
          method: "POST",
          body: { reason },
          token,
        });
        setConfirmOpen(false);
        setConfirmVerdict(null);
        setVerdictReason("");
        void loadOne(id, token);
      } catch (e) {
        setVerdictError(e instanceof Error ? e.message : "Reopen not recorded — try again.");
      } finally {
        setVerdictLoading(false);
      }
    },
    [id, token, loadOne],
  );

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPollLoading(true);
    setPollError(null);
    let cancelled = false;
    request<PollData>(`/api/v1/incidents/${id}/poll`, { token }).then(
      (data) => {
        if (!cancelled) setPoll(data);
      },
      (e) => {
        if (!cancelled) setPollError(e instanceof Error ? e.message : "Failed to load poll");
      },
    ).finally(() => {
      if (!cancelled) setPollLoading(false);
    });
    return () => { cancelled = true; };
  }, [id, token]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void fetchVerificationEvents();
  }, [fetchVerificationEvents]);

  useEffect(() => {
    void loadOne(id, token);
  }, [id, loadOne, token]);

  useEffect(() => {
    void loadByIncident(id, token);
  }, [id, loadByIncident, token]);

  const handleCreate = useCallback(
    (payload: TaskCreateIn) => {
      void createTask(id, payload, token);
    },
    [createTask, id, token],
  );

  const handlePatch = useCallback(
    (id: string, payload: TaskPatchIn) => {
      void patchTask(id, payload, token);
    },
    [patchTask, token],
  );

  const handleUpdate = useCallback(
    (id: string, payload: TaskUpdateIn) => {
      void addTaskUpdate(id, payload, token);
    },
    [addTaskUpdate, token],
  );

  const canClose = can("incident.close");
  const [closeConfirmOpen, setCloseConfirmOpen] = useState(false);
  const [closeNote, setCloseNote] = useState("");
  const [phaseErr, setPhaseErr] = useState<string | null>(null);
  const [closeErr, setCloseErr] = useState<string | null>(null);

  const PHASE_ORDER = ["NONE", "COORDINATING", "ACTIVE", "RESOLVED"] as const;
  const currentPhase = (selected?.response_phase ?? "NONE") as (typeof PHASE_ORDER)[number];
  const phaseIdx = PHASE_ORDER.indexOf(currentPhase);
  const nextPhase = phaseIdx >= 0 && phaseIdx < PHASE_ORDER.length - 1 ? PHASE_ORDER[phaseIdx + 1] : null;

  const handleSetPhase = useCallback(() => {
    if (!nextPhase) return;
    setPhaseErr(null);
    void request<IncidentOut>(`/api/v1/incidents/${id}/phase`, {
      method: "POST",
      body: { phase: nextPhase },
      token,
    })
      .then(() => {
        void loadOne(id, token);
      })
      .catch((e) => {
        setPhaseErr(e instanceof Error ? e.message : "Phase change refused by the server.");
      });
  }, [id, nextPhase, token, loadOne]);

  const handleClose = useCallback(() => {
    setCloseErr(null);
    void request<IncidentOut>(`/api/v1/incidents/${id}/close`, {
      method: "POST",
      body: { note: closeNote.trim() || undefined },
      token,
    })
      .then(() => {
        setCloseConfirmOpen(false);
        setCloseNote("");
        void loadOne(id, token);
      })
      .catch((e) => {
        setCloseErr(e instanceof Error ? e.message : "Close refused by the server.");
      });
  }, [id, closeNote, token, loadOne]);

  if (loading && !selected) {
    return (
      <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-8 text-center text-xs text-[var(--muted)]">
        Loading incident {id}…
      </div>
    );
  }

  if (notFound && !selected) {
    return (
      <div>
        <EmptyState
          icon="404"
          title="Incident not found"
          body="This incident doesn't exist or may have been removed."
          action={
            <Link href="/incidents">
              <Button variant="primary">Back to incidents</Button>
            </Link>
          }
        />
      </div>
    );
  }

  if (error && !selected) {
    return (
      <div>
        <EmptyState
          icon="⚠"
          title="Incident could not be loaded"
          body={error}
          action={
            <Link href="/incidents">
              <Button variant="primary">Back to incidents</Button>
            </Link>
          }
        />
      </div>
    );
  }

  const inc = selected;
  if (!inc) return null;

  return (
    <div>
      <div className="mb-4">
        <Link
          href="/incidents"
          className="text-[11px] text-[var(--muted)] hover:text-[var(--foreground)]"
        >
          ← Back to incidents
        </Link>
        <div className="mt-1 flex flex-wrap items-center gap-2">
          <h1 className="font-mono text-lg font-bold">{inc.id}</h1>
          <StatusBadge value={inc.assessment_status} />
          <span className="text-sm text-[var(--muted)]">·</span>
          <span className="text-sm font-semibold">
            {inc.category} — {inc.location_text ?? inc.region ?? "—"}
          </span>
          <div className="ml-auto flex gap-2">
            <Button>↗ Share</Button>
            {can("incident.coordinate") && (
              <Button variant="primary">Update Status</Button>
            )}
          </div>
        </div>
      </div>

      {/* 4-axis status row — assessment ≠ poll ≠ verification ≠ response */}
      <div className="mb-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <AxisCard
          label="AI Assessment"
          value={
            inc.assessment_status === "MAYBE_TRUE"
              ? "Maybe True"
              : inc.assessment_status === "DEFINITELY_FALSE"
                ? "Definitely False"
                : "Unassessed"
          }
          sub={
            inc.assessment_status === "MAYBE_TRUE"
              ? "AI: plausible — not verified"
              : "AI assesses only — it never verifies"
          }
          tone={inc.assessment_status === "MAYBE_TRUE" ? "info" : "false"}
          icon="🤖"
        />
        <AxisCard
          label="Officer Verification"
          value={inc.verification}
          sub={
            inc.verification === "VERIFIED"
              ? "Verified by a Verification Officer"
              : inc.verification === "REJECTED"
                ? "Rejected by an officer"
                : "Awaiting a Verification Officer"
          }
          tone={
            inc.verification === "VERIFIED"
              ? "verified"
              : inc.verification === "REJECTED"
                ? "false"
                : "unverified"
          }
          icon="🛡"
        />
        <AxisCard
          label="Response Phase"
          value={inc.response_phase}
          sub={
            inc.response_phase === "ACTIVE"
              ? "Response team active"
              : inc.response_phase === "RESOLVED"
                ? "Response complete"
                : "No active response yet"
          }
          tone={
            inc.response_phase === "ACTIVE"
              ? "critical"
              : inc.response_phase === "RESOLVED"
                ? "verified"
                : "neutral"
          }
          icon="🚨"
        />
        <AxisCard
          label="Lifecycle Status"
          value={inc.lifecycle}
          sub={
            inc.lifecycle === "OPEN"
              ? "Open — only Central Admin can close"
              : "Closed by Central Admin"
          }
          tone={inc.lifecycle === "OPEN" ? "moderate" : "closed"}
          icon="🔓"
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        {/* left: info + description */}
        <div className="space-y-4">
          <Card title="Incident Information">
            <dl className="space-y-2 text-xs">
              {[
                ["Category", inc.category],
                ["Region", inc.region ?? "—"],
                ["Location", inc.location_text ?? "—"],
                ["Coordinates", `${inc.latitude.toFixed(4)}° N, ${inc.longitude.toFixed(4)}° E`],
                ["Sensitivity", inc.sensitivity],
                ["Reports", String(inc.report_count)],
                ["Updated", inc.updated_at],
              ].map(([k, v]) => (
                <div key={k} className="flex justify-between gap-3 border-b border-[var(--border)] pb-1.5 last:border-0">
                  <dt className="text-[var(--muted)]">{k}</dt>
                  <dd className="text-right font-medium">{v}</dd>
                </div>
              ))}
            </dl>
            <p className="mt-3 text-xs leading-relaxed text-[var(--muted)]">
              {inc.description ?? "No description provided."}
            </p>
            <Button variant="primary" className="mt-3 w-full">
              View on Map →
            </Button>
          </Card>
        </div>

        {/* middle: assessment timeline */}
        <Card title="Assessment Timeline">
          <ol className="relative space-y-4 border-l border-[var(--border-strong)] pl-4">
            {inc.assessments.length === 0 ? (
              <p className="text-[10px] text-[var(--muted)] text-center py-4">
                No AI assessments yet.
              </p>
            ) : (
              inc.assessments.map((a) => (
                <li key={a.id} className="relative">
                  <span
                    className="absolute -left-[21px] top-1 h-2.5 w-2.5 rounded-full border-2 border-[var(--surface)]"
                    style={{
                      background:
                        a.outcome === "MAYBE_TRUE"
                          ? "var(--primary)"
                          : a.outcome === "DEFINITELY_FALSE"
                            ? "var(--danger)"
                            : "var(--subtle)",
                    }}
                  />
                  <p className="text-xs font-medium">{a.outcome}</p>
                  {a.reason && (
                    <p className="text-[10px] text-[var(--muted)]">{a.reason}</p>
                  )}
                  <p className="text-[10px] text-[var(--subtle)]">
                    {a.backend} · {a.created_at}
                  </p>
                </li>
              ))
            )}
          </ol>
        </Card>

        {/* right: evidence */}
        <Card title="Evidence">
          {inc.reports.length === 0 ? (
            <p className="text-[10px] text-[var(--muted)] text-center py-4">
              No evidence attached.
            </p>
          ) : (
            <div className="space-y-3">
              {inc.reports.map((r) => (
                <div
                  key={r.id}
                  className="flex items-center gap-3 rounded-lg border border-[var(--border)] bg-[var(--surface)] p-3"
                >
                  {r.media_path || r.media_url ? (
                    <EvidenceThumb report={r} />
                  ) : (
                    <div className="w-16 h-16 rounded-lg border border-dashed border-[var(--border)] bg-[var(--surface-2)] flex items-center justify-center text-[10px] text-[var(--muted)]">
                      {r.source}
                    </div>
                  )}
                  <div className="flex-1">
                    <p className="text-xs font-medium truncate">{r.content}</p>
                    <p className="text-[10px] text-[var(--muted)]">
                      {r.source} · {r.created_at}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      {/* dispatch tasks — permission-gated (task.assign / task.update) */}
      {canAssign || canUpdate ? (
        <Card
          title="Dispatch Tasks"
          subtitle="Tasks route work to departments and track progress to done."
        >
          <TaskList
            tasks={tasks}
            canAssign={canAssign}
            canUpdate={canUpdate}
            departments={[...DEPARTMENTS]}
            usersByDept={{}}
            onCreate={handleCreate}
            onPatch={handlePatch}
            onUpdate={handleUpdate}
          />
        </Card>
      ) : (
        <EmptyState
          title="Tasks not available"
          body="Your role cannot create or update tasks on this incident."
          icon="◇"
        />
      )}

      {/* public poll — full width below the 3-column grid */}
      <Card title="Public Poll">
        {pollLoading ? (
          <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-8 text-center text-xs text-[var(--muted)]">
            Loading poll…
          </div>
        ) : pollError ? (
          <div
            role="alert"
            className="mb-4 rounded-lg border border-[var(--danger)]/40 bg-[rgba(239,68,68,.1)] px-4 py-2.5 text-xs text-[#fee2e2]"
          >
            {pollError}
          </div>
        ) : poll ? (
          <div className="space-y-3">
            {!poll.eligible && (
              <div className="rounded-lg border border-[var(--border)] bg-[var(--surface-2)] p-3">
                <p className="text-[10px] font-medium text-[var(--muted)]">
                  Not eligible to vote: {poll.reason}
                </p>
              </div>
            )}
            <div className="space-y-2">
              <div>
                <div className="mb-1 flex justify-between text-[11px]">
                  <span className="text-[var(--status-verified)]">✔ Genuine</span>
                  <span className="font-semibold">{poll.percent_genuine}%</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-[var(--surface-3)]">
                  <div
                    className="h-full rounded-full bg-[var(--status-verified)]"
                    style={{ width: `${poll.percent_genuine}%` }}
                  />
                </div>
              </div>
              <div>
                <div className="mb-1 flex justify-between text-[11px]">
                  <span className="text-[var(--danger)]">✘ Fake</span>
                  <span className="font-semibold">{100 - poll.percent_genuine}%</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-[var(--surface-3)]">
                  <div
                    className="h-full rounded-full bg-[var(--danger)]"
                    style={{ width: `${100 - poll.percent_genuine}%` }}
                  />
                </div>
              </div>
            </div>
            <div className="flex gap-2">
              {poll.my_vote === null && poll.eligible ? (
                <>
                  <Button
                    variant="primary"
                    onClick={() => vote("genuine")}
                    disabled={pollLoading}
                  >
                    Vote Genuine
                  </Button>
                  <Button
                    variant="secondary"
                    onClick={() => vote("fake")}
                    disabled={pollLoading}
                  >
                    Vote Fake
                  </Button>
                </>
              ) : poll.my_vote !== null ? (
                <div className="rounded-lg border border-[var(--border)] bg-[var(--surface-2)] p-3 text-center">
                  <p className="text-[10px] font-medium text-[var(--muted)]">
                    You voted: {poll.my_vote === "genuine" ? "Genuine" : "Fake"}
                  </p>
                </div>
              ) : (
                <Button variant="secondary" disabled>
                  Voting closed
                </Button>
              )}
            </div>
            <p className="mt-3 rounded-lg bg-[var(--surface-2)] px-3 py-2 text-[10px] text-[var(--muted)]">
              Public opinion only — polling never verifies an incident.
            </p>
          </div>
        ) : (
          <div className="rounded-lg border border-[var(--border)] bg-[var(--surface-2)] p-3 text-center">
            <p className="text-[10px] text-[var(--muted)]">No poll data available.</p>
          </div>
        )}
      </Card>

      {/* verification timeline — all roles (officer+reason stripped for citizens) */}
      <Card title="Verification Timeline">
      {verificationEvents.length === 0 ? (
        <p className="text-[10px] text-[var(--muted)] text-center py-4">
          No verification events yet.
        </p>
      ) : (
        <ol className="space-y-3">
          {verificationEvents.map((e) => (
            <div
              key={e.id}
              className="flex items-start gap-3 rounded-lg border border-[var(--border)] bg-[var(--surface)] p-3"
            >
              <span
                className="shrink-0 h-2.5 w-2.5 rounded-full border-2 border-[var(--surface)]"
                style={{
                  background:
                    e.action === "VERIFIED"
                      ? "var(--status-verified)"
                      : e.action === "REJECTED"
                        ? "var(--danger)"
                        : "var(--primary)",
                }}
              />
              <div className="flex-1">
                <p className="text-xs font-medium">
                  {e.action.charAt(0) + e.action.slice(1).toLowerCase()}
                </p>
                {e.reason && (
                  <p className="text-[10px] text-[var(--muted)]">{e.reason}</p>
                )}
                <p className="text-[10px] text-[var(--subtle)]">
                  {e.officer ?? "Officer"} · {e.created_at}
                </p>
              </div>
            </div>
          ))}
        </ol>
      )}
    </Card>

    {/* verdict panel — officer + admin only */}
    {can("incident.verify") && (
      <Card title="Officer Verdict">
        {verdictError && (
          <div
            role="alert"
            className="mb-3 rounded-lg border border-[var(--danger)]/40 bg-[rgba(239,68,68,.1)] px-4 py-2.5 text-xs text-[#fee2e2]"
          >
            {verdictError}
          </div>
        )}
        {inc.verification === "VERIFIED" ? (
          <div className="rounded-lg border border-[var(--border)] bg-[var(--surface-2)] p-3 text-center">
            <p className="text-[10px] font-medium text-[var(--status-verified)]">
              Verified — terminal state. No further action possible.
            </p>
          </div>
        ) : inc.verification === "REJECTED" ? (
          <div className="space-y-3">
            <p className="text-xs text-[var(--muted)]">
              Rejected. Reopen to UNVERIFIED if new evidence appears.
            </p>
            <div className="flex gap-2">
              <Button
                variant="secondary"
                onClick={() => {
                  setConfirmVerdict("REOPENED");
                  setConfirmOpen(true);
                }}
                disabled={verdictLoading}
              >
                Reopen Incident
              </Button>
            </div>
          </div>
        ) : (
          // UNVERIFIED — can VERIFIED or REJECTED
          <div className="space-y-3">
            <p className="text-xs text-[var(--muted)]">
              Awaiting verification. Choose a verdict below.
            </p>
            <div className="flex gap-2">
              <Button
                variant="secondary"
                onClick={() => {
                  setConfirmVerdict("VERIFIED");
                  setConfirmOpen(true);
                }}
                disabled={verdictLoading}
              >
                Mark Verified
              </Button>
              <Button
                variant="danger"
                onClick={() => {
                  setConfirmVerdict("REJECTED");
                  setConfirmOpen(true);
                }}
                disabled={verdictLoading}
              >
                Mark Rejected
              </Button>
            </div>
            <div className="rounded-lg border border-[var(--border)] bg-[var(--surface-2)] p-3">
              <p className="text-[10px] text-[var(--muted)]">
                Select Mark Rejected to open the confirmation dialog and enter a reason.
              </p>
            </div>
          </div>
        )}
      </Card>
    )}

    {/* confirm dialog — VERIFIED is terminal */}
    <Modal
      open={confirmOpen}
      onClose={() => setConfirmOpen(false)}
      title="Confirm Verdict"
      width="24rem"
      footer={
        <div className="flex justify-end gap-2">
          <Button
            variant="primary"
            onClick={() => {
              if (confirmVerdict === "REJECTED" && !verdictReason.trim()) {
                setVerdictError("Reason is required for Reject.");
                return;
              }
              if (confirmVerdict === "REOPENED") {
                void reopenIncident(verdictReason);
              } else if (confirmVerdict) {
                void verifyIncident(confirmVerdict, verdictReason);
              }
              setConfirmOpen(false);
            }}
            disabled={verdictLoading || !confirmVerdict}
          >
            Confirm {confirmVerdict}
          </Button>
          <Button variant="ghost" onClick={() => setConfirmOpen(false)}>
            Cancel
          </Button>
        </div>
      }
    >
      <p className="text-sm text-[var(--muted)]">
        Marking as <strong>VERIFIED</strong> is terminal — it cannot be reversed.
        Only a REJECTED verdict can be reopened later.
      </p>
      {confirmVerdict === "REJECTED" && (
        <div className="mt-3">
          <label className="block text-[10px] text-[var(--muted)] mb-1">
            Reason (required for Reject)
          </label>
          <textarea
            value={verdictReason}
            onChange={(e) => setVerdictReason(e.target.value)}
            rows={2}
            className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-xs focus:border-[var(--primary)] focus:outline-none"
            placeholder="Why this verdict?"
          />
        </div>
      )}
    </Modal>

    {canClose && (
      <Modal
        open={closeConfirmOpen}
        onClose={() => setCloseConfirmOpen(false)}
        title="Confirm Close Incident"
        width="24rem"
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setCloseConfirmOpen(false)}>
              Cancel
            </Button>
            <Button variant="danger" disabled={!!closeErr} onClick={handleClose}>
              Confirm Close
            </Button>
          </div>
        }
      >
        <p className="text-sm text-[var(--muted)]">
          Closing is irreversible for a Central Admin. The incident lifecycle becomes CLOSED.
        </p>
        <label className="block text-[10px] text-[var(--muted)] mb-1">
          Closure note (optional)
        </label>
        <textarea
          value={closeNote}
          onChange={(e) => setCloseNote(e.target.value)}
          rows={2}
          className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-xs focus:border-[var(--primary)] focus:outline-none"
          placeholder="Why is this incident being closed?…"
        />
      </Modal>
    )}

    {/* incident lifecycle — phase stepper + close (incident.close only) */}
    {canClose && (
      <Card title="Incident Lifecycle" subtitle="Phase transitions and closure.">
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[10px] text-[var(--muted)]">Response phase</span>
            <StatusBadge value={currentPhase} />
          </div>
          {nextPhase ? (
            <Button
              variant="secondary"
              disabled={phaseErr !== null}
              onClick={handleSetPhase}
            >
              Advance to {nextPhase}
            </Button>
          ) : (
            <span className="text-[10px] text-[var(--muted)]">Phase is terminal (RESOLVED).</span>
          )}
          {phaseErr && <p className="text-[10px] text-[var(--danger)]">{phaseErr}</p>}
          <div className="pt-2 border-t border-[var(--border)]">
            <Button variant="danger" onClick={() => setCloseConfirmOpen(true)}>
              Close incident
            </Button>
            {closeErr && <p className="text-[10px] text-[var(--danger)] mt-1">{closeErr}</p>}
          </div>
        </div>
      </Card>
    )}
  </div>
);
}

function AxisCard({
  label,
  value,
  sub,
  tone,
  icon,
}: {
  label: string;
  value: string;
  sub: string;
  tone: string;
  icon: string;
}) {
  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-[11px] font-medium text-[var(--muted)]">{label}</span>
        <span className="text-sm">{icon}</span>
      </div>
      <StatusBadge tone={tone as never} className="text-xs">
        {value}
      </StatusBadge>
      <p className="mt-2 text-[10px] leading-snug text-[var(--subtle)]">{sub}</p>
    </div>
  );
}
