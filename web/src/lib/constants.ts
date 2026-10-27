/**
 * ASTRA shared constants — roles, categories, severity, nav, departments.
 * Mirrors backend enums (api/app/core/permissions.py + architecture AD-14/15).
 */

export const ROLES = [
  "CITIZEN",
  "CENTRAL_ADMIN",
  "DEPARTMENT_HEAD",
  "RESPONSE_TEAM",
  "VERIFICATION_OFFICER",
] as const;

export type Role = (typeof ROLES)[number];

export const ROLE_LABELS: Record<Role, string> = {
  CITIZEN: "Citizen",
  CENTRAL_ADMIN: "Central Admin",
  DEPARTMENT_HEAD: "Department Head",
  RESPONSE_TEAM: "Response Team",
  VERIFICATION_OFFICER: "Verification Officer",
};

/** seed/seed.py headline demo logins — password shared: astra-demo-2026 */
export const DEMO_PASSWORD = "astra-demo-2026";
export const DEMO_EMAILS: Record<Role, string> = {
  CENTRAL_ADMIN: "admin@astra.dev",
  DEPARTMENT_HEAD: "dephead@astra.dev",
  RESPONSE_TEAM: "team@astra.dev",
  VERIFICATION_OFFICER: "officer@astra.dev",
  CITIZEN: "citizen@astra.dev",
};
export const DEMO_DEPARTMENTS: Record<Role, string | null> = {
  CENTRAL_ADMIN: null,
  DEPARTMENT_HEAD: "FIRE",
  RESPONSE_TEAM: "FIRE",
  VERIFICATION_OFFICER: null,
  CITIZEN: null,
};

/** AD-14 — 7 departments */
export const DEPARTMENTS = [
  "Police",
  "Fire & Rescue",
  "Medical/EMS",
  "Transport & Roads",
  "Disaster Management",
  "Electricity/Utilities",
  "Water & Drainage",
] as const;

/** AD-15 — 8 incident categories */
export const CATEGORIES = [
  "Fire",
  "Accident",
  "Flood/Waterlogging",
  "Structural collapse",
  "Medical emergency",
  "Crime/Safety",
  "Utility outage",
  "Hazard/Other",
] as const;

export type Category = (typeof CATEGORIES)[number];

export const SEVERITIES = ["Critical", "High", "Major", "Moderate", "Minor"] as const;
export type Severity = (typeof SEVERITIES)[number];

export const SEVERITY_TONE: Record<Severity, string> = {
  Critical: "critical",
  High: "high",
  Major: "high",
  Moderate: "moderate",
  Minor: "minor",
};

/** The 4-axis incident statuses (architecture §3) */
export const ASSESSMENT_STATUSES = [
  "UNASSESSED",
  "DEFINITELY_FALSE",
  "MAYBE_TRUE",
] as const;
export type AssessmentStatus = (typeof ASSESSMENT_STATUSES)[number];

export const VERIFICATION_STATUSES = [
  "UNVERIFIED",
  "VERIFIED",
  "REJECTED",
] as const;
export type VerificationStatus = (typeof VERIFICATION_STATUSES)[number];

export const RESPONSE_PHASES = [
  "NONE",
  "COORDINATING",
  "ACTIVE",
  "RESOLVED",
] as const;
export type ResponsePhase = (typeof RESPONSE_PHASES)[number];

export const LIFECYCLE_STATUSES = ["OPEN", "CLOSED"] as const;
export type LifecycleStatus = (typeof LIFECYCLE_STATUSES)[number];

export type Sensitivity = "PUBLIC" | "RESTRICTED";

/** Task 1.1 — the 4 status display tokens, one badge tone each */
export const STATUS_TONES = {
  UNVERIFIED: "unverified",
  VERIFIED: "verified",
  DEFINITELY_FALSE: "false",
  CLOSED: "closed",
} as const;

/** Sidebar navigation (reference design) — filtered by permission in Sidebar */
export interface NavItem {
  href: string;
  label: string;
  /** permission required to see the item; undefined = everyone */
  permission?: string;
  icon: string;
}

export const NAV_ITEMS: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: "grid" },
  { href: "/incidents", label: "Incidents", icon: "alert", permission: "map.view_public" },
  { href: "/map", label: "Live Map", icon: "map", permission: "map.view_public" },
  { href: "/teams", label: "Teams", icon: "users", permission: "map.view_operational" },
  { href: "/departments", label: "Departments", icon: "building", permission: "analytics.operational" },
  { href: "/reports", label: "Reports", icon: "file", permission: "analytics.operational" },
  { href: "/simulation", label: "Simulation", icon: "play", permission: "simulation.public" },
  { href: "/settings", label: "Settings", icon: "settings" },
];

export const API_URL =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
