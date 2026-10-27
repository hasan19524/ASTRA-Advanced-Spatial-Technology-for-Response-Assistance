"use client";
/**
 * Incident Detail (reference screen 3) — 4-axis status cards, info, timeline,
 * evidence + public poll. The 4 axes are independent (architecture §3).
 */
import Link from "next/link";
import { use, useEffect } from "react";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { useIncidents } from "@/stores/incidents";
import { mockTimeline } from "@/lib/mocks/fixtures";
import { useAuthSession } from "@/hooks/useAuth";

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
          <StatusBadge value={inc.severity} />
          <span className="text-sm text-[var(--muted)]">·</span>
          <span className="text-sm font-semibold">
            {inc.category} — {inc.location}
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
              ? "Plausible"
              : inc.assessment_status === "DEFINITELY_FALSE"
                ? "Definitely False"
                : "Unassessed"
          }
          sub={
            inc.assessment_status === "MAYBE_TRUE"
              ? "Confidence 87% · Assessed 18 min ago"
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
              ? "Verified by Officer-12 · 20 min ago"
              : inc.verification === "REJECTED"
                ? "Rejected by an officer"
                : "Awaiting a Verification Officer"
          }
          tone={inc.verification === "VERIFIED" ? "verified" : inc.verification === "REJECTED" ? "false" : "unverified"}
          icon="🛡"
        />
        <AxisCard
          label="Response Phase"
          value={inc.response_phase}
          sub={
            inc.response_phase === "ACTIVE"
              ? "Team T-4 on site · since 15 min ago"
              : inc.response_phase === "RESOLVED"
                ? "Response complete"
                : "No active response yet"
          }
          tone={inc.response_phase === "ACTIVE" ? "critical" : inc.response_phase === "RESOLVED" ? "verified" : "neutral"}
          icon="🚨"
        />
        <AxisCard
          label="Lifecycle Status"
          value={inc.lifecycle}
          sub={
            inc.lifecycle === "OPEN"
              ? "Started 20 min ago · only Central Admin can close"
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
                ["Severity", inc.severity],
                ["Location", inc.location],
                ["Reported by", inc.reported_by],
                ["Coordinates", `${inc.lat.toFixed(4)}° N, ${inc.lng.toFixed(4)}° E`],
                ["Sensitivity", inc.sensitivity],
                ["Updated", inc.updated_at],
              ].map(([k, v]) => (
                <div key={k} className="flex justify-between gap-3 border-b border-[var(--border)] pb-1.5 last:border-0">
                  <dt className="text-[var(--muted)]">{k}</dt>
                  <dd className="text-right font-medium">{v}</dd>
                </div>
              ))}
            </dl>
            <p className="mt-3 text-xs leading-relaxed text-[var(--muted)]">
              {inc.description}
            </p>
            <Button variant="primary" className="mt-3 w-full">
              View on Map →
            </Button>
          </Card>
        </div>

        {/* middle: timeline */}
        <Card title="Timeline">
          <ol className="relative space-y-4 border-l border-[var(--border-strong)] pl-4">
            {mockTimeline.map((e) => (
              <li key={e.id} className="relative">
                <span
                  className="absolute -left-[21px] top-1 h-2.5 w-2.5 rounded-full border-2 border-[var(--surface)]"
                  style={{
                    background:
                      e.tone === "critical"
                        ? "var(--danger)"
                        : e.tone === "verified"
                          ? "var(--success)"
                          : e.tone === "info"
                            ? "var(--primary)"
                            : e.tone === "high"
                              ? "var(--warning)"
                              : "var(--subtle)",
                  }}
                />
                <p className="text-xs font-medium">{e.text}</p>
                <p className="text-[10px] text-[var(--subtle)]">{e.time}</p>
              </li>
            ))}
          </ol>
        </Card>

        {/* right: evidence + poll */}
        <Card
          title={
            <span className="flex gap-3">
              <span className="border-b-2 border-[var(--primary)] pb-1 text-[var(--foreground)]">
                Evidence (4)
              </span>
              <span className="text-[var(--muted)]">Public Poll (196)</span>
            </span>
          }
        >
          {/* thumbnails */}
          <div className="mb-4 grid grid-cols-3 gap-2">
            {[1, 2, 3].map((n) => (
              <div
                key={n}
                className="aspect-square rounded-lg border border-[var(--border)] bg-gradient-to-br from-[var(--surface-2)] to-[var(--surface-3)]"
              >
                <img
                  alt={`Evidence ${n}`}
                  className="h-full w-full rounded-lg object-cover opacity-80"
                  src={`https://picsum.photos/seed/astra${n}/120/120`}
                  width={120}
                  height={120}
                  loading="lazy"
                />
              </div>
            ))}
          </div>

          {/* poll — crowd signal, NEVER writes to verification (§3) */}
          <p className="mb-2 text-xs font-semibold">Is this report correct?</p>
          <div className="space-y-2">
            <div>
              <div className="mb-1 flex justify-between text-[11px]">
                <span className="text-[var(--status-verified)]">✔ Correct</span>
                <span className="font-semibold">82%</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-[var(--surface-3)]">
                <div className="h-full rounded-full bg-[var(--status-verified)]" style={{ width: "82%" }} />
              </div>
            </div>
            <div>
              <div className="mb-1 flex justify-between text-[11px]">
                <span className="text-[var(--danger)]">✘ Incorrect</span>
                <span className="font-semibold">18%</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-[var(--surface-3)]">
                <div className="h-full rounded-full bg-[var(--danger)]" style={{ width: "18%" }} />
              </div>
            </div>
          </div>
          <p className="mt-3 rounded-lg bg-[var(--surface-2)] px-3 py-2 text-[10px] text-[var(--muted)]">
            Polls are a crowd reliability signal only — they never change the
            official verification status.
          </p>
          <Button variant="primary" className="mt-3 w-full">
            🗳 Vote in poll
          </Button>
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
