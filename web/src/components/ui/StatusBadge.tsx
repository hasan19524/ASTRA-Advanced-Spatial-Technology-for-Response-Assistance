/**
 * StatusBadge — the 4 locked status colours (task 1.1) + severity/phase tones.
 * Usage: <StatusBadge tone="unverified">UNVERIFIED</StatusBadge>
 *        <StatusBadge value={incident.verification} />  ← derives tone from value
 */
import type { ReactNode } from "react";

export type Tone =
  | "unverified"
  | "verified"
  | "false"
  | "closed"
  | "critical"
  | "high"
  | "moderate"
  | "minor"
  | "info"
  | "neutral";

/** derives a badge tone from any status string the backend sends */
export function toneFor(value: string): Tone {
  const v = value.toUpperCase();
  if (v === "UNVERIFIED" || v === "PENDING") return "unverified";
  if (v === "VERIFIED" || v === "COMPLETED" || v === "RESOLVED" || v === "DONE")
    return "verified";
  if (v === "DEFINITELY_FALSE" || v === "REJECTED" || v === "FALSE") return "false";
  if (v === "CLOSED") return "closed";
  if (v === "CRITICAL") return "critical";
  if (v === "HIGH" || v === "MAJOR") return "high";
  if (v === "MODERATE" || v === "MEDIUM" || v === "COORDINATING") return "moderate";
  if (v === "MINOR" || v === "NONE" || v === "QUEUED") return "minor";
  if (v === "MAYBE_TRUE" || v === "AI PLAUSIBLE" || v === "ACTIVE" || v === "EN ROUTE")
    return "info";
  return "neutral";
}

const BASE =
  "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold leading-none whitespace-nowrap";

export function StatusBadge({
  tone,
  value,
  children,
  className = "",
}: {
  tone?: Tone;
  value?: string;
  children?: ReactNode;
  className?: string;
}) {
  const t = tone ?? (value ? toneFor(value) : "neutral");
  const label = children ?? value;
  return (
    <span className={`${BASE} tone-${t} ${className}`}>
      {typeof label === "string" ? formatLabel(label) : label}
    </span>
  );
}

function formatLabel(s: string) {
  return s
    .split("_")
    .map((w) => w.charAt(0) + w.slice(1).toLowerCase())
    .join(" ");
}
