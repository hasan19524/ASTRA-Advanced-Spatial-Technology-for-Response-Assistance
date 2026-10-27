"use client";
/**
 * Topbar — region pill, search, notifications, user menu (task 1.2).
 * Language selector slot reserved for AD-16 (all Gnani languages, Day 7).
 */
import { useState } from "react";
import { useAlerts } from "@/stores/alerts";
import { useAuthSession } from "@/hooks/useAuth";
import { ROLE_LABELS, type Role } from "@/lib/constants";
import { Button } from "@/components/ui/Button";

export function Topbar() {
  const { user, logout } = useAuthSession();
  const unread = useAlerts((s) => s.unread);
  const markRead = useAlerts((s) => s.markRead);
  const [menuOpen, setMenuOpen] = useState(false);

  const initials = (user?.full_name ?? "?")
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <header
      className="sticky top-0 z-30 flex items-center gap-3 border-b border-[var(--border)] bg-[var(--surface)]/95 px-4 backdrop-blur"
      style={{ height: "var(--topbar-h)" }}
    >
      {/* region pill (AD-13: Delhi NCR) */}
      <button className="flex items-center gap-1 rounded-full border border-[var(--border-strong)] px-2.5 py-1 text-[11px] font-medium text-[var(--muted)] hover:text-[var(--foreground)]">
        <span className="text-[var(--primary)]">◉</span> Delhi NCR
        <span className="text-[9px]">▾</span>
      </button>

      {/* search */}
      <div className="relative min-w-0 flex-1 max-w-md">
        <input
          type="search"
          placeholder="Search incidents, ID, location…"
          className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-1.5 pl-8 text-xs text-[var(--foreground)] placeholder:text-[var(--subtle)] focus:border-[var(--primary)] focus:outline-none"
        />
        <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--subtle)]">
          ⌕
        </span>
      </div>

      <div className="ml-auto flex items-center gap-2">
        {/* notifications */}
        <button
          onClick={markRead}
          aria-label="Notifications"
          className="relative rounded-lg p-2 text-[var(--muted)] hover:bg-[var(--surface-2)] hover:text-[var(--foreground)]"
        >
          🔔
          {unread > 0 && (
            <span className="absolute right-1 top-1 h-2 w-2 rounded-full bg-[var(--danger)]" />
          )}
        </button>

        {/* user menu */}
        <div className="relative">
          <button
            onClick={() => setMenuOpen((v) => !v)}
            className="flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-[var(--surface-2)]"
          >
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[var(--primary)] text-[10px] font-bold text-white">
              {initials}
            </span>
            <span className="hidden text-left sm:block">
              <span className="block text-[11px] font-semibold leading-tight">
                {user?.full_name ?? "Guest"}
              </span>
              <span className="block text-[10px] leading-tight text-[var(--muted)]">
                {user ? ROLE_LABELS[user.role as Role] ?? user.role : ""}
              </span>
            </span>
            <span className="text-[9px] text-[var(--subtle)]">▾</span>
          </button>

          {menuOpen && (
            <>
              <div
                className="fixed inset-0 z-10"
                onClick={() => setMenuOpen(false)}
              />
              <div className="absolute right-0 top-full z-20 mt-1 w-44 rounded-lg border border-[var(--border-strong)] bg-[var(--surface-2)] py-1 shadow-xl">
                <div className="border-b border-[var(--border)] px-3 py-2">
                  <p className="truncate text-[11px] font-semibold">
                    {user?.email}
                  </p>
                  <p className="text-[10px] text-[var(--muted)]">
                    {user?.permissions.length ?? 0} permissions
                  </p>
                </div>
                <button
                  onClick={() => {
                    setMenuOpen(false);
                    logout();
                  }}
                  className="block w-full px-3 py-2 text-left text-xs text-[var(--danger)] hover:bg-[var(--surface-3)]"
                >
                  Sign out
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </header>
  );
}

export { Button };
