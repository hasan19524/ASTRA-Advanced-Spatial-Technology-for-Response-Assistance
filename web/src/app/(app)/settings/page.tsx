"use client";
/** Settings — profile, role/permission inspector, voice language (AD-16). */
import { useEffect } from "react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/Card";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { Button } from "@/components/ui/Button";
import { useAuthSession } from "@/hooks/useAuth";
import { useVoiceLanguage } from "@/stores/voiceLanguage";
import { ROLE_LABELS, type Role } from "@/lib/constants";
import Link from "next/link";

export default function SettingsPage() {
  const { user, can, logout, token } = useAuthSession();
  const {
    languages,
    selected,
    loading,
    error,
    load,
    select,
  } = useVoiceLanguage();

  useEffect(() => {
    void load(token);
  }, [load, token]);

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
          subtitle="AD-16 — the languages the voice proxy accepts, from GET /voice/languages"
        >
          {loading && languages.length <= 2 ? (
            <p className="text-[11px] text-[var(--muted)]">Loading languages…</p>
          ) : (
            <div className="flex flex-wrap gap-1.5">
              {languages.map((l) => {
                const active = l.code === selected;
                return (
                  <button
                    key={l.code}
                    onClick={() => select(l.code)}
                    aria-pressed={active}
                    className={`rounded-md border px-2.5 py-1.5 text-[11px] transition-colors min-h-10 [@media(pointer:coarse)]:py-2 ${
                      active
                        ? "border-[var(--primary)] bg-[var(--primary-soft)] text-[#dbeafe]"
                        : "border-[var(--border)] bg-[var(--background)] text-[var(--muted)] hover:border-[var(--border-strong)] hover:text-[var(--foreground)]"
                    }`}
                  >
                    {l.name}
                  </button>
                );
              })}
            </div>
          )}
          {error && (
            <p className="mt-2 text-[10px] text-[var(--warning)]">{error}</p>
          )}
          <p className="mt-2 text-[10px] text-[var(--subtle)]">
            UI chrome stays English (no i18n framework in scope). Only voice
            features switch language — the report form’s microphone uses{" "}
            <span className="font-mono">
              {languages.find((l) => l.code === selected)?.name ?? selected}
            </span>
            .
          </p>
        </Card>

        {can("audit.read") && (
          <Card title="Audit viewer" subtitle="Admin-only audit log (GET /audit/logs)">
            <Link href="/audit" className="text-[11px] text-[var(--primary)] hover:underline">
              Open audit viewer →
            </Link>
          </Card>
        )}

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
