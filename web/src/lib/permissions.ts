/**
 * Role → permission matrix — EXACT mirror of api/app/core/permissions.py.
 * Backend is the source of truth (vision.md §4); this copy exists only so
 * the UI can hide what a role cannot do (UX, never security).
 * If the backend matrix changes, update this file in the same commit.
 */
import type { Role } from "./constants";

export const CITIZEN_PERMS = new Set([
  "report.create",
  "poll.vote",
  "map.view_public",
  "assistant.use",
  "navigation.use",
  "simulation.public",
]);

const ROLE_PERMISSIONS: Record<Role, Set<string>> = {
  CITIZEN: CITIZEN_PERMS,
  VERIFICATION_OFFICER: new Set([
    ...CITIZEN_PERMS,
    "incident.verify",
    "incident.view_restricted",
    "analytics.operational",
  ]),
  DEPARTMENT_HEAD: new Set([
    ...CITIZEN_PERMS,
    "department.view_own",
    "task.assign",
    "progress.update",
    "map.view_operational",
    "analytics.operational",
  ]),
  RESPONSE_TEAM: new Set([
    ...CITIZEN_PERMS,
    "task.update",
    "assignment.view",
    "map.view_operational",
  ]),
  CENTRAL_ADMIN: new Set([
    ...CITIZEN_PERMS,
    "incident.verify",
    "incident.view_restricted",
    "department.view_own",
    "task.assign",
    "progress.update",
    "incident.coordinate",
    "incident.close",
    "alert.manage",
    "analytics.operational",
    "audit.read",
    "simulation.operational",
    "map.view_operational",
  ]),
};

/** Sorted permission list for a role — same shape the API returns. */
export function permissionsFor(role: string): string[] {
  const set = ROLE_PERMISSIONS[role as Role];
  return set ? [...set].sort() : [];
}

export function hasPermission(
  permissions: string[] | undefined,
  permission: string,
): boolean {
  return !!permissions?.includes(permission);
}
