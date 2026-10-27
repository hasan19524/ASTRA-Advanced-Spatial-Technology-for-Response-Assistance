"use client";
/** Departments — the 7 NCR departments (AD-14) with unit counts. */
import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/Card";
import { StatCard } from "@/components/ui/StatCard";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { DEPARTMENTS } from "@/lib/constants";

const UNITS: Record<string, { units: number; open: number; head: string }> = {
  Police: { units: 12, open: 5, head: "Insp. Sharma" },
  "Fire & Rescue": { units: 6, open: 3, head: "ACO Meena" },
  "Medical/EMS": { units: 8, open: 4, head: "Dr. Iyer" },
  "Transport & Roads": { units: 4, open: 2, head: "Er. Khan" },
  "Disaster Management": { units: 3, open: 1, head: "CDM Rao" },
  "Electricity/Utilities": { units: 5, open: 2, head: "Er. Gupta" },
  "Water & Drainage": { units: 4, open: 1, head: "Er. Nair" },
};

export default function DepartmentsPage() {
  const totalUnits = Object.values(UNITS).reduce((a, b) => a + b.units, 0);
  const totalOpen = Object.values(UNITS).reduce((a, b) => a + b.open, 0);

  return (
    <div>
      <PageHeader
        title="Departments"
        subtitle="7 response departments across Delhi NCR (AD-14)"
      />

      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard icon="🏢" value={DEPARTMENTS.length} label="Departments" tone="info" />
        <StatCard icon="🚒" value={totalUnits} label="Total units" tone="verified" />
        <StatCard icon="⚠" value={totalOpen} label="Open tasks" tone="moderate" />
        <StatCard icon="👤" value="14" label="Personnel on shift" tone="critical" />
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {DEPARTMENTS.map((name) => {
          const u = UNITS[name] ?? { units: 0, open: 0, head: "—" };
          return (
            <Card key={name} padding={false}>
              <div className="flex items-start justify-between p-4">
                <div>
                  <h2 className="text-sm font-semibold">{name}</h2>
                  <p className="mt-0.5 text-[11px] text-[var(--muted)]">
                    Head: {u.head}
                  </p>
                </div>
                <StatusBadge tone={u.open > 2 ? "critical" : u.open > 0 ? "moderate" : "verified"}>
                  {u.open} open
                </StatusBadge>
              </div>
              <div className="grid grid-cols-2 border-t border-[var(--border)] text-center text-[11px]">
                <div className="border-r border-[var(--border)] px-3 py-2.5">
                  <p className="font-bold">{u.units}</p>
                  <p className="text-[var(--muted)]">Units</p>
                </div>
                <div className="px-3 py-2.5">
                  <p className="font-bold">{Math.round((u.open / Math.max(u.units, 1)) * 100)}%</p>
                  <p className="text-[var(--muted)]">Load</p>
                </div>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
