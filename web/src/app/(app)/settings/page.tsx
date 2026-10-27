"use client";
/** Settings — profile, role/permission inspector, language slot (AD-16). */
import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/Card";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { Button } from "@/components/ui/Button";
import { useAuthSession } from "@/hooks/useAuth";
import { ROLE_LABELS, type Role } from "@/lib/constants";

const LANGUAGES = [
  "हिन्दी", "বাংলা", "తెలుగు", "मराठी", "தமிழ்", "ગુજરાતી", "ಕನ್ನಡ",
  "മലയാളം", "ଓଡ଼ିଆ", "ਪੰਜਾਬੀ", "অসমীয়া", "English",
];

export default function SettingsPage() {
  const { user, can, logout } = useAuthSession();

  return (
    <div className="max-w-3xl">
      <PageHeader title="Settings" subtitle="Profile, permissions and preferences" />

      <div className="space-y-4">
        <Card title="Profile">
          <div className="flex items-center gap-4">
            <span className="flex h-14 w-14 items-center justify-center rounded-full bg-[var(--primary)] text-lg font-bold text-white">
              {user?.full_name
                ?.split(" ")
                .map((p) => p[0])
                .slice(0, 2)
                .join("")
                .toUpperCase() ?? "?"}
            </span>
            <div>
              <p className="text-sm font-semibold">{user?.full_name}</p>
              <p className="text-[11px] text-[var(--muted)]">{user?.email}</p>
              <div className="mt-1 flex items-center gap-2">
                <StatusBadge tone="info">
                  {user ? ROLE_LABELS[user.role as Role] ?? user.role : ""}
                </StatusBadge>
                {user?.department && (
                  <StatusBadge tone="neutral">{user.department}</StatusBadge>
                )}
              </div>
            </div>
          </div>
        </Card>

        <Card
          title="Your permissions"
          subtitle="Backend-enforced — this list is exactly what the API will allow"
        >
          <div className="flex flex-wrap gap-1.5">
            {(user?.permissions ?? []).map((p) => (
              <span
                key={p}
                className="rounded-md border border-[var(--border)] bg-[var(--background)] px-2 py-1 font-mono text-[10px] text-[var(--muted)]"
              >
                {p}
              </span>
            ))}
            {(user?.permissions ?? []).length === 0 && (
              <p className="text-[11px] text-[var(--muted)]">No permissions loaded.</p>
            )}
          </div>
        </Card>

        <Card
          title="Voice language"
          subtitle="AD-16 — all Indian languages Gnani supports; selector wires up on Day 7"
        >
          <div className="flex flex-wrap gap-1.5">
            {LANGUAGES.map((l, idx) => (
              <button
                key={l}
                disabled={idx !== 0 && idx !== 11}
                className={`rounded-md border px-2.5 py-1.5 text-[11px] ${
                  idx === 0
                    ? "border-[var(--primary)] bg-[var(--primary-soft)] text-[#dbeafe]"
                    : "border-[var(--border)] bg-[var(--background)] text-[var(--muted)] opacity-60"
                }`}
              >
                {l}
              </button>
            ))}
          </div>
          <p className="mt-2 text-[10px] text-[var(--subtle)]">
            UI chrome stays English (no i18n framework in scope). Only voice
            features switch language.
          </p>
        </Card>

        <Card title="Danger zone">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold">Sign out</p>
              <p className="text-[11px] text-[var(--muted)]">
                Discards the access token; refresh token cleared from localStorage.
              </p>
            </div>
            <Button variant="danger" onClick={logout}>
              Sign out
            </Button>
          </div>
          <p className="mt-3 text-[10px] text-[var(--subtle)]">
            Admin-only audit viewer (GET /audit/logs) appears here once you have
            audit.read — currently {can("audit.read") ? "granted" : "not granted"}.
          </p>
        </Card>
      </div>
    </div>
  );
}
