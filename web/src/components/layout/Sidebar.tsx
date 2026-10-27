"use client";
/**
 * Sidebar — left nav from the reference design (task 1.2).
 * Items are filtered by the signed-in user's permissions; the 5 roles
 * therefore look visibly different (task 1.2 verify step).
 */
import Link from "next/link";
import { usePathname } from "next/navigation";
import { NAV_ITEMS } from "@/lib/constants";
import { useAuthSession } from "@/hooks/useAuth";

const ICONS: Record<string, string> = {
  grid: "▦",
  alert: "⚠",
  map: "◎",
  users: "👥",
  building: "🏢",
  file: "📄",
  play: "▶",
  settings: "⚙",
};

export function Sidebar() {
  const pathname = usePathname();
  const { can, user } = useAuthSession();

  const items = NAV_ITEMS.filter((n) => !n.permission || can(n.permission));

  return (
    <aside
      className="flex h-screen shrink-0 flex-col border-r border-[var(--border)] bg-[var(--surface)]"
      style={{ width: "var(--sidebar-w)" }}
    >
      {/* brand */}
      <div className="flex items-center gap-2 px-4 py-4">
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--primary)] text-sm font-black text-white">
          A
        </span>
        <span className="text-lg font-black tracking-widest text-[var(--foreground)]">
          ASTRA
        </span>
      </div>

      {/* nav */}
      <nav className="flex-1 space-y-1 px-2 py-2">
        {items.map((item) => {
          const active =
            pathname === item.href || pathname.startsWith(item.href + "/");
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-2.5 rounded-lg px-3 py-2 text-xs font-medium transition-colors ${
                active
                  ? "bg-[var(--primary)] text-white"
                  : "text-[var(--muted)] hover:bg-[var(--surface-2)] hover:text-[var(--foreground)]"
              }`}
            >
              <span aria-hidden className="w-4 text-center text-sm">
                {ICONS[item.icon]}
              </span>
              {item.label}
            </Link>
          );
        })}
      </nav>

      {/* role chip + theme placeholder (reference shows moon/sun + gear) */}
      <div className="border-t border-[var(--border)] px-3 py-3">
        <p className="truncate text-[11px] font-semibold text-[var(--foreground)]">
          {user?.full_name ?? "Guest"}
        </p>
        <p className="truncate text-[10px] text-[var(--muted)]">
          {user?.role ?? "Not signed in"}
        </p>
      </div>
    </aside>
  );
}
