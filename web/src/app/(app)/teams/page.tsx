"use client";
/** Response Team dashboard (reference screen 5) — tasks, team status, route. */
import { PageHeader } from "@/components/layout/PageHeader";
import { StatCard } from "@/components/ui/StatCard";
import { Card } from "@/components/ui/Card";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { mockTasks, mockTeams } from "@/lib/mocks/fixtures";
import { useAuthSession } from "@/hooks/useAuth";

export default function TeamsPage() {
  const { user } = useAuthSession();

  return (
    <div>
      <PageHeader
        title="Response Team Dashboard"
        subtitle="Your assigned tasks, team status and dispatch information"
        actions={
          <div className="flex items-center gap-2">
            <span className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5 text-[11px] text-[var(--muted)]">
              Response Team (T-3) ▾
            </span>
            <span className="flex items-center gap-1.5 rounded-lg bg-[var(--primary-soft)] px-3 py-1.5 text-[11px] font-semibold text-[#dbeafe]">
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[var(--primary)] text-[9px] text-white">
                {user?.full_name?.[0] ?? "R"}
              </span>
              Team Member
            </span>
          </div>
        }
      />

      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard icon="📌" value={mockTasks.length} label="Assigned Tasks" tone="info" />
        <StatCard icon="🔄" value="2" label="In Progress" tone="moderate" />
        <StatCard icon="✅" value="1" label="Completed Today" tone="verified" />
        <StatCard icon="👥" value="4 / 6" label="Team Availability" tone="verified" delta="Online" />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card title="My Tasks" action={<span className="text-[11px] text-[var(--primary)]">View all</span>}>
          <ul className="space-y-2.5">
            {mockTasks.map((t) => (
              <li
                key={t.id}
                className="rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2.5"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate font-mono text-xs font-semibold text-[var(--primary)]">
                    {t.id}
                  </span>
                  <StatusBadge tone={t.tone as never}>{t.status}</StatusBadge>
                </div>
                <p className="mt-1 truncate text-[11px] text-[var(--muted)]">{t.title}</p>
                <p className="mt-0.5 text-[10px] text-[var(--subtle)]">{t.eta}</p>
              </li>
            ))}
          </ul>
        </Card>

        <Card title="Team Status" action={<span className="text-[11px] text-[var(--primary)]">View all</span>}>
          <ul className="space-y-2.5">
            {mockTeams.map((t) => (
              <li
                key={t.id}
                className="flex items-center justify-between rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2.5 text-xs"
              >
                <span className="flex items-center gap-2">
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[var(--primary-soft)] text-[10px] font-bold text-[#dbeafe]">
                    {t.id.replace("T-", "")}
                  </span>
                  <span className="font-semibold">{t.id}</span>
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

        <Card title="Current Route — INC-2026-0186">
          <div className="mb-3 flex h-28 items-center justify-center rounded-lg border border-[var(--border)] bg-[#0a1322]">
            <svg viewBox="0 0 200 80" className="h-full w-full">
              <path
                d="M10 60 Q 60 10 110 40 T 190 20"
                stroke="var(--primary)"
                strokeWidth="3"
                fill="none"
                strokeDasharray="6 4"
              />
              <circle cx="10" cy="60" r="5" fill="var(--success)" />
              <circle cx="190" cy="20" r="5" fill="var(--danger)" />
            </svg>
          </div>
          <dl className="space-y-1.5 text-[11px]">
            <div className="flex justify-between">
              <dt className="text-[var(--muted)]">Distance</dt>
              <dd className="font-semibold">4.8 km</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-[var(--muted)]">ETA (approx)</dt>
              <dd className="font-semibold">12 min</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-[var(--muted)]">Next Step</dt>
              <dd className="font-semibold text-[var(--primary)]">Take DND Flyway</dd>
            </div>
          </dl>
          <button className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg bg-[var(--primary)] px-3 py-2 text-xs font-semibold text-white hover:bg-[var(--primary-hover)]">
            🧭 Start Navigation
          </button>
        </Card>
      </div>
    </div>
  );
}
