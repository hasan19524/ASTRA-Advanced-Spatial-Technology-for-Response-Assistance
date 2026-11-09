"use client";
/**
 * Topbar — region pill, incident search, notifications, user menu.
 *
 * The search is real: it queries the live incident list and shows matching
 * incidents (title, id, category, location); picking one opens it. On narrow
 * screens the field collapses into a full-width overlay instead of being
 * squeezed into an unusable 40px sliver.
 */
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { useAlerts } from "@/stores/alerts";
import { useAuthSession } from "@/hooks/useAuth";
import { ROLE_LABELS, type Role } from "@/lib/constants";
import { Button } from "@/components/ui/Button";
import type { IncidentOut } from "@/api/types";

function matches(incident: IncidentOut, q: string): boolean {
  if (!q) return false;
  const needle = q.trim().toLowerCase();
  if (!needle) return false;
  return [
    incident.id,
    incident.title,
    incident.category,
    incident.region ?? "",
    incident.location_text ?? "",
  ]
    .join(" ")
    .toLowerCase()
    .includes(needle);
}

export function Topbar({ onMenuClick }: { onMenuClick?: () => void }) {
  const { user, logout, token } = useAuthSession();
  const unread = useAlerts((s) => s.unread);
  const markRead = useAlerts((s) => s.markRead);
  const [menuOpen, setMenuOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [candidates, setCandidates] = useState<IncidentOut[]>([]);
  const boxRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  // Pull a page of live incidents once, then filter locally — the API has no
  // free-text search parameter.
  useEffect(() => {
    if (!open || !token || candidates.length > 0) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000"}/api/v1/incidents?limit=100`,
          { headers: { Authorization: `Bearer ${token}` } },
        );
        if (!res.ok) return;
        const body = await res.json();
        if (!cancelled && Array.isArray(body?.items)) {
          setCandidates(body.items as IncidentOut[]);
        }
      } catch {
        /* search stays empty — the bar is not a lie, it just finds nothing */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, token, candidates.length]);

  const results = useMemo(() => {
    const found = candidates.filter((i) => matches(i, query)).slice(0, 6);
    return found;
  }, [candidates, query]);

  // Close the dropdown when the user clicks elsewhere.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  const initials = (user?.full_name ?? "?")
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  const searchBox = (placeholder: string) => (
    <div className="relative min-w-0 flex-1">
      <input
        type="search"
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        placeholder={placeholder}
        aria-label="Search incidents"
        className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 pl-8 text-xs text-[var(--foreground)] placeholder:text-[var(--subtle)] focus:border-[var(--primary)] focus:outline-none"
      />
      <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--subtle)]">
        ⌕
      </span>
      {open && query.trim().length > 0 && (
        <div className="absolute left-0 right-0 top-full z-40 mt-1 overflow-hidden rounded-lg border border-[var(--border-strong)] bg-[var(--surface-2)] shadow-xl">
          {results.length === 0 ? (
            <p className="px-3 py-2 text-[11px] text-[var(--muted)]">
              No incident matches “{query.trim()}”.
            </p>
          ) : (
            results.map((r) => (
              <button
                key={r.id}
                onClick={() => {
                  setOpen(false);
                  setMobileOpen(false);
                  setQuery("");
                  router.push(`/incidents/${r.id}`);
                }}
                className="block w-full border-b border-[var(--border)] px-3 py-2 text-left last:border-b-0 hover:bg-[var(--surface-3)]"
              >
                <span className="block truncate text-[11px] font-semibold">{r.title}</span>
                <span className="block truncate text-[10px] text-[var(--muted)]">
                  {r.category} · {r.location_text ?? r.region ?? "Delhi NCR"} ·{" "}
                  <span className="font-mono">{r.id.slice(0, 8)}</span>
                </span>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );

  return (
    <header
      className="sticky top-0 z-30 flex items-center gap-3 border-b border-[var(--border)] bg-[var(--surface)]/95 px-4 backdrop-blur"
      style={{ height: "var(--topbar-h)" }}
    >
      {/* mobile hamburger */}
      {onMenuClick && (
        <button onClick={onMenuClick} className="rounded-lg p-2 text-[var(--muted)] hover:bg-[var(--surface-2)] lg:hidden" aria-label="Open menu">
          ☰
        </button>
      )}
      {/* region pill (AD-13: Delhi NCR) */}
      <button className="flex min-h-10 shrink-0 items-center gap-1 rounded-full border border-[var(--border-strong)] px-2.5 py-1 text-[11px] font-medium text-[var(--muted)] hover:text-[var(--foreground)] [@media(pointer:coarse)]:py-2">
        <span className="text-[var(--primary)]">◉</span> Delhi NCR
        <span className="text-[9px]">▾</span>
      </button>

      {/* search — inline from sm up, overlay on phones */}
      <div ref={boxRef} className="hidden min-w-0 max-w-md flex-1 sm:block">
        {searchBox("Search incidents, ID, location…")}
      </div>
      <button
        onClick={() => setMobileOpen((v) => !v)}
        className="rounded-lg p-2 text-[var(--muted)] hover:bg-[var(--surface-2)] sm:hidden"
        aria-label="Search incidents"
        aria-expanded={mobileOpen}
      >
        ⌕
      </button>

      {mobileOpen && (
        <div className="absolute left-0 right-0 top-full z-40 border-b border-[var(--border)] bg-[var(--surface)] p-3 shadow-xl sm:hidden">
          {searchBox("Search incidents, ID, location…")}
        </div>
      )}

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
                <Link href="/settings" onClick={() => setMenuOpen(false)}>
                  <span className="block w-full px-3 py-2 text-left text-xs hover:bg-[var(--surface-3)]">
                    Settings
                  </span>
                </Link>
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
