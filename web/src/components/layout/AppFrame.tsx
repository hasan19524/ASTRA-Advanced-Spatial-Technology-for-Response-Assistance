"use client";
/**
 * AppFrame — client boundary for the authenticated shell
 * (RouteGuard + sidebar/topbar). Used by the server (app)/layout.
 */
import type { ReactNode } from "react";
import { RouteGuard } from "@/components/auth/RouteGuard";
import { AppShell } from "@/components/layout/AppShell";

export function AppFrame({ children }: { children: ReactNode }) {
  return (
    <RouteGuard>
      <AppShell>{children}</AppShell>
    </RouteGuard>
  );
}
