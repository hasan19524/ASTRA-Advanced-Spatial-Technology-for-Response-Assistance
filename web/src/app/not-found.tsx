/**
 * Root not-found — handles unmatched URLs and notFound() throws.
 * Renders inside root layout (dark theme applies automatically).
 */
import Link from "next/link";

export const metadata = { title: "404 — Not Found | ASTRA" };

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-6 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-[var(--surface-2)] text-2xl text-[var(--muted)]">
        404
      </div>
      <h1 className="mt-5 text-lg font-semibold text-[var(--foreground)]">
        Page not found
      </h1>
      <p className="mt-2 max-w-sm text-sm text-[var(--muted)]">
        The page you are looking for doesn&apos;t exist or may have been moved.
      </p>
      <div className="mt-6 flex gap-3">
        <Link
          href="/dashboard"
          className="inline-flex items-center justify-center rounded-lg border border-transparent bg-[var(--primary)] px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-[var(--primary-hover)]"
        >
          Go to dashboard
        </Link>
        <Link
          href="/"
          className="inline-flex items-center justify-center rounded-lg border border-[var(--border-strong)] bg-[var(--surface-2)] px-4 py-2 text-xs font-semibold text-[var(--foreground)] transition-colors hover:bg-[var(--surface-3)]"
        >
          Home
        </Link>
      </div>
    </div>
  );
}
