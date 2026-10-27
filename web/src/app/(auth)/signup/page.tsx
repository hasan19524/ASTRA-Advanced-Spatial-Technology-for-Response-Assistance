"use client";
/**
 * Signup (task 2.1) — POST /api/v1/auth/register.
 * Self-registration ALWAYS yields CITIZEN (AD-7; staff roles are seeded).
 */
import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuthSession } from "@/hooks/useAuth";
import { Button } from "@/components/ui/Button";
import { useAlerts } from "@/stores/alerts";

export default function SignupPage() {
  const router = useRouter();
  const { register, isLoading, error, clearError } = useAuthSession();
  const toast = useAlerts((s) => s.toast);

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    clearError();
    const ok = await register({ email, full_name: fullName, password });
    if (ok) {
      toast({ title: "Account created — welcome to ASTRA", tone: "success" });
      router.replace("/dashboard");
    }
  }

  return (
    <div>
      <div className="mb-6 text-center">
        <div className="mb-2 inline-flex items-center gap-2">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-[var(--primary)] text-base font-black text-white">
            A
          </span>
          <span className="text-2xl font-black tracking-widest">ASTRA</span>
        </div>
        <p className="text-xs text-[var(--muted)]">
          Create a citizen account — staff roles are provisioned by authorities.
        </p>
      </div>

      <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5">
        <h1 className="text-sm font-bold">Create account</h1>

        {error && (
          <div
            role="alert"
            className="mt-3 rounded-lg border border-[var(--danger)]/40 bg-[rgba(239,68,68,.1)] px-3 py-2 text-[11px] text-[#fee2e2]"
          >
            {error}
          </div>
        )}

        <form onSubmit={onSubmit} className="mt-4 space-y-3">
          <label className="block">
            <span className="mb-1 block text-[11px] font-medium text-[var(--muted)]">
              Full name
            </span>
            <input
              required
              minLength={2}
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Asha Citizen"
              className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-xs focus:border-[var(--primary)] focus:outline-none"
            />
          </label>
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
              className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-xs focus:border-[var(--primary)] focus:outline-none"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-[11px] font-medium text-[var(--muted)]">
              Password <span className="text-[var(--subtle)]">(min 8)</span>
            </span>
            <input
              type="password"
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-xs focus:border-[var(--primary)] focus:outline-none"
            />
          </label>
          <Button
            type="submit"
            variant="primary"
            disabled={isLoading}
            className="w-full py-2"
          >
            {isLoading ? "Creating…" : "Create account"}
          </Button>
        </form>

        <p className="mt-3 text-center text-[11px] text-[var(--muted)]">
          Already registered?{" "}
          <Link href="/login" className="text-[var(--primary)] hover:underline">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
