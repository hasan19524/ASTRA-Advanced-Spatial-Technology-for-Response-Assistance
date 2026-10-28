"use client";
/**
 * Incident Detail — real API (GET /api/v1/incidents/{id}).
 * 4-axis status cards from IncidentOut + assessment timeline (assessments[])
 * + evidence list (reports[] with photo URLs). 404 → not-found state (hidden
 * rows surface as 404 to unauthorized roles, AD-19).
 */
import Link from "next/link";
import { use, useEffect } from "react";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { useIncidents } from "@/stores/incidents";
import { useAuthSession } from "@/hooks/useAuth";
import { API_URL } from "@/lib/constants";

export default function IncidentDetailPage(props: PageProps<"/incidents/[id]">) {
  const params = use(props.params);
  const id = params.id;
  const { selected, loadOne, loading, error } = useIncidents();
  const { can } = useAuthSession();

  useEffect(() => {
    void loadOne(id);
  }, [id, loadOne]);

  if (loading && !selected) {
    return (
      <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-8 text-center text-xs text-[var(--muted)]">
        Loading incident {id}…
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

  const photoUrl = (p: { media_path: string | null }): string =>
    p.media_path ? `${API_URL}${p.media_path}` : "";

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
                  {r.media_path ? (
                    <img
                      src={photoUrl(r)}
                      alt="Evidence"
                      className="w-16 h-16 rounded object-cover"
                    />
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
