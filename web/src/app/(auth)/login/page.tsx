"use client";
/**
 * Login screen (task 2.1) + demo role picker (task 2.2).
 * Real POST /api/v1/auth/login against FastAPI; demo buttons hit the seed
 * accounts (admin@/dephead@/team@/officer@/citizen@ astra.dev) and fall back
 * to a local session if the backend is down.
 */
import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuthSession } from "@/hooks/useAuth";
import { Button } from "@/components/ui/Button";
import { DEMO_EMAILS, DEMO_PASSWORD, ROLE_LABELS, type Role } from "@/lib/constants";
import { useAlerts } from "@/stores/alerts";

const DEMO_ROLES: Role[] = [
  "CENTRAL_ADMIN",
  "DEPARTMENT_HEAD",
  "RESPONSE_TEAM",
  "VERIFICATION_OFFICER",
  "CITIZEN",
];

const DEMO_ICONS: Record<string, string> = {
  CENTRAL_ADMIN: "👑",
  DEPARTMENT_HEAD: "🏢",
  RESPONSE_TEAM: "🚑",
  VERIFICATION_OFFICER: "✅",
  CITIZEN: "🧑",
};

export default function LoginPage() {
  const router = useRouter();
  const { login, demoLogin, isLoading, error, clearError, hydrated, isAuthenticated } =
    useAuthSession();
  const toast = useAlerts((s) => s.toast);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  // already signed in → go to dashboard
  if (hydrated && isAuthenticated) {
    router.replace("/dashboard");
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    clearError();
    const ok = await login({ email, password });
    if (ok) {
      toast({ title: "Signed in", tone: "success" });
      router.replace("/dashboard");
    }
  }

  async function onDemo(role: Role) {
    clearError();
    const ok = await demoLogin(role);
    if (ok) {
      toast({
        title: `Demo login — ${ROLE_LABELS[role]}`,
        body: "Landing on the role dashboard…",
        tone: "info",
      });
      router.replace("/dashboard");
    }
  }

  return (
    <div>
      {/* brand */}
      <div className="mb-6 text-center">
        <div className="mb-2 inline-flex items-center gap-2">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-[var(--primary)] text-base font-black text-white">
            A
          </span>
          <span className="text-2xl font-black tracking-widest">ASTRA</span>
        </div>
        <p className="text-xs text-[var(--muted)]">
          Advanced Spatial Technology for Response Assistance
        </p>
        <p className="mt-1 text-[11px] text-[var(--subtle)]">
          Safer Cities. Faster Response. Stronger Communities.
        </p>
      </div>

      <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5">
        <h1 className="text-sm font-bold">Sign in</h1>
        <p className="mb-4 mt-0.5 text-[11px] text-[var(--muted)]">
          Use your account or pick a demo role below.
        </p>

        {error && (
          <div
            role="alert"
            className="mb-3 rounded-lg border border-[var(--danger)]/40 bg-[rgba(239,68,68,.1)] px-3 py-2 text-[11px] text-[#fee2e2]"
          >
            {error}
          </div>
        )}

        <form onSubmit={onSubmit} className="space-y-3">
          <label className="block">
            <span className="mb-1 block text-[11px] font-medium text-[var(--muted)]">
              Email
            </span>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-xs text-[var(--foreground)] placeholder:text-[var(--subtle)] focus:border-[var(--primary)] focus:outline-none"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-[11px] font-medium text-[var(--muted)]">
              Password
            </span>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-xs text-[var(--foreground)] placeholder:text-[var(--subtle)] focus:border-[var(--primary)] focus:outline-none"
            />
          </label>
          <Button
            type="submit"
            variant="primary"
            disabled={isLoading}
            className="w-full py-2"
          >
            {isLoading ? "Signing in…" : "Sign in"}
          </Button>
        </form>

        <p className="mt-3 text-center text-[11px] text-[var(--muted)]">
          No account?{" "}
          <Link href="/signup" className="text-[var(--primary)] hover:underline">
            Create one
          </Link>
        </p>
      </div>

      {/* ---- demo role picker (task 2.2) ---- */}
      <div className="mt-4 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5">
        <div className="mb-1 flex items-center justify-between">
          <h2 className="text-sm font-bold">Demo login</h2>
          <span className="rounded-full bg-[var(--primary-soft)] px-2 py-0.5 text-[10px] font-semibold text-[#dbeafe]">
            DEMO
          </span>
        </div>
        <p className="mb-3 text-[11px] text-[var(--muted)]">
          One click per role — each lands on that role&apos;s dashboard.
        </p>
        <div className="grid grid-cols-1 gap-2">
          {DEMO_ROLES.map((role) => (
            <button
              key={role}
              onClick={() => onDemo(role)}
              disabled={isLoading}
              className="flex items-center gap-2.5 rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-left transition-colors hover:border-[var(--primary)] hover:bg-[var(--primary-soft)] disabled:opacity-50"
            >
              <span className="text-base">{DEMO_ICONS[role]}</span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-xs font-semibold">
                  {ROLE_LABELS[role]}
                </span>
                <span className="block truncate text-[10px] text-[var(--muted)]">
                  {DEMO_EMAILS[role]}
                </span>
              </span>
              <span className="text-[10px] text-[var(--primary)]">→</span>
            </button>
          ))}
        </div>
        <p className="mt-2 text-[10px] text-[var(--subtle)]">
          Seed accounts (password: {DEMO_PASSWORD}) — falls back to a local
          session if the backend is down.
        </p>
      </div>
    </div>
  );
}
