/**
 * Permission helpers — the backend is the source of truth (vision.md §4).
 * This module only provides a client-side check used to hide UI affordances
 * (UX, never security).
 */
export function hasPermission(
  permissions: string[] | undefined,
  permission: string,
): boolean {
  return !!permissions?.includes(permission);
}
