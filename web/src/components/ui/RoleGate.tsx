/**
 * RoleGate — renders children only when the user has `permission`.
 * UX ONLY: the backend enforces the real rule (vision.md §4).
 * Usage: <RoleGate permission="incident.close"><CloseButton/></RoleGate>
 */
"use client";

import type { ReactNode } from "react";
import { useAuthSession } from "@/hooks/useAuth";

export function RoleGate({
  permission,
  children,
  fallback = null,
}: {
  permission: string;
  children: ReactNode;
  fallback?: ReactNode;
}) {
  const { can } = useAuthSession();
  return <>{can(permission) ? children : fallback}</>;
}
