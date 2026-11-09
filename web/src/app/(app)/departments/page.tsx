"use client";
/**
 * Departments — the real organisation directory.
 *
 * Everything on this page comes from GET /api/v1/departments: the department
 * head on duty, how many active people are attached to the department and
 * how many response tasks are still open. Nothing here is hard-coded.
 */
import { useEffect, useState } from "react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/Card";
import { StatCard } from "@/components/ui/StatCard";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { EmptyState } from "@/components/ui/EmptyState";
import { useAuthSession } from "@/hooks/useAuth";
import { request } from "@/api/client";

interface Department {
  name: string;
  head_name: string | null;
  head_email: string | null;
  personnel_count: number;
  open_tasks: number;
  total_tasks: number;
}

/** Fetch the directory. Module scope on purpose: the effect below owns all
 *  state writes, so the loading/error transitions stay in one place. */
async function fetchDepartments(token: string | null): Promise<Department[]> {
  const data = await request<Department[]>("/api/v1/departments", { token });
  return Array.isArray(data) ? data : [];
}

export default function DepartmentsPage() {
  const { token } = useAuthSession();
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchDepartments(token)
      .then((list) => {
        if (cancelled) return;
        setDepartments(list);
        setError(null);
        setLoading(false);
      })
      .catch((e: unknown) => {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : "Failed to load departments");
        setDepartments([]);
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [token]);

  const totalPersonnel = departments.reduce((a, d) => a + d.personnel_count, 0);
  const totalOpen = departments.reduce((a, d) => a + d.open_tasks, 0);
  const totalTasks = departments.reduce((a, d) => a + d.total_tasks, 0);

  return (
    <div>
      <PageHeader
        title="Departments"
        subtitle="Response departments across Delhi NCR with their real load"
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
        <StatCard icon="🏢" value={String(departments.length)} label="Departments" tone="info" />
        <StatCard icon="👥" value={String(totalPersonnel)} label="Personnel" tone="verified" />
        <StatCard icon="⚠" value={String(totalOpen)} label="Open tasks" tone="moderate" />
        <StatCard icon="📋" value={String(totalTasks)} label="Tasks total" tone="info" />
      </div>

      {loading && departments.length === 0 ? (
        <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-8 text-center text-xs text-[var(--muted)]">
          Loading departments…
        </div>
      ) : departments.length === 0 ? (
        <EmptyState
          title="No departments visible"
          body="Your role does not have access to the organisation directory."
          icon="🏢"
        />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {departments.map((d) => (
            <Card key={d.name} padding={false}>
              <div className="flex items-start justify-between p-4">
                <div className="min-w-0">
                  <h2 className="text-sm font-semibold">{d.name}</h2>
                  <p className="mt-0.5 truncate text-[11px] text-[var(--muted)]">
                    {d.head_name ? `Head: ${d.head_name}` : "No department head assigned"}
                  </p>
                </div>
                <StatusBadge
                  tone={
                    d.open_tasks > 2 ? "critical" : d.open_tasks > 0 ? "moderate" : "verified"
                  }
                >
                  {d.open_tasks} open
                </StatusBadge>
              </div>
              <div className="grid grid-cols-2 border-t border-[var(--border)] text-center text-[11px]">
                <div className="border-r border-[var(--border)] px-3 py-2.5">
                  <p className="font-bold">{d.personnel_count}</p>
                  <p className="text-[var(--muted)]">Personnel</p>
                </div>
                <div className="px-3 py-2.5">
                  <p className="font-bold">
                    {d.total_tasks > 0
                      ? `${Math.round((d.open_tasks / d.total_tasks) * 100)}%`
                      : "—"}
                  </p>
                  <p className="text-[var(--muted)]">Open load</p>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
