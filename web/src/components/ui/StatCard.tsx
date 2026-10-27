"use client";
/**
 * StatCard — KPI tile from the reference dashboard (icon, value, label, delta).
 */
import type { ReactNode } from "react";

const TONES: Record<string, string> = {
  critical: "bg-[rgba(239,68,68,.15)] text-[#fee2e2]",
  high: "bg-[rgba(249,115,22,.15)] text-[#ffedd5]",
  moderate: "bg-[rgba(245,158,11,.15)] text-[#fef3c7]",
  info: "bg-[var(--primary-soft)] text-[#dbeafe]",
  verified: "bg-[rgba(34,197,94,.15)] text-[#dcfce7]",
};

export function StatCard({
  icon,
  value,
  label,
  delta,
  tone = "info",
}: {
  icon: ReactNode;
  value: ReactNode;
  label: string;
  delta?: string;
  tone?: keyof typeof TONES;
}) {
  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
      <div className="flex items-start gap-3">
        <span
          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-base ${TONES[tone]}`}
        >
          {icon}
        </span>
        <div className="min-w-0">
          <p className="text-xl font-bold leading-none text-[var(--foreground)]">
            {value}
          </p>
          <p className="mt-1 truncate text-[11px] text-[var(--muted)]">{label}</p>
          {delta && (
            <p className="mt-0.5 text-[10px] text-[var(--status-verified)]">
              {delta}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
