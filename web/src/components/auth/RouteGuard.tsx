"use client";
/**
 * Route guard (task 2.3) — VISUAL guard only; backend is the real enforcement.
 * No token after silent-refresh attempt → redirect to /login.
 */
import { useEffect, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useAuthSession } from "@/hooks/useAuth";

export function RouteGuard({ children }: { children: ReactNode }) {
  const { isAuthenticated, hydrated } = useAuthSession();
  const router = useRouter();

  useEffect(() => {
    if (hydrated && !isAuthenticated) {
      router.replace("/login");
    }
  }, [hydrated, isAuthenticated, router]);

  // still doing the silent refresh → neutral loading state (never blank)
  if (!hydrated) {
    return (
      <div className="flex h-screen items-center justify-center bg-[var(--background)]">
        <div className="flex flex-col items-center gap-3">
          <span className="h-8 w-8 animate-spin rounded-full border-2 border-[var(--primary)] border-t-transparent" />
          <p className="text-xs text-[var(--muted)]">Restoring session…</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="flex h-screen items-center justify-center bg-[var(--background)]">
        <p className="text-xs text-[var(--muted)]">Redirecting to login…</p>
      </div>
    );
  }

  return <>{children}</>;
}
