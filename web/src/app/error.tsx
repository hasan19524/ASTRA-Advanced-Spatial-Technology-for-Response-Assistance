"use client";
/**
 * Root error boundary — catches errors in auth pages (login/signup)
 * and any route outside the (app) group.
 *
 * Renders status 404 as "not found", everything else as "error with retry".
 * Never leaks raw internals — only the safe message from HttpError.body.detail.
 */
import { useEffect } from "react";
import Link from "next/link";
import { HttpError } from "@/api/client";

function getErrorInfo(error: unknown): { status: number | null; message: string | null } {
  if (error instanceof HttpError) {
    return { status: error.status, message: error.body.detail };
  }
  if (typeof error === "object" && error !== null) {
    const e = error as { status?: unknown; message?: unknown; body?: { detail?: unknown } };
    const status = typeof e.status === "number" ? e.status : null;
    const message =
      (typeof e.body?.detail === "string" && e.body.detail) ||
      (typeof e.message === "string" && e.message) ||
      null;
    return { status, message };
  }
  return { status: null, message: null };
}

export default function GlobalError({
  error,
  retry,
}: {
  error: unknown;
  retry: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  const { status, message } = getErrorInfo(error);
  const isNotFound = status === 404;

  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-6 text-center">
      <div
        className={`flex h-14 w-14 items-center justify-center rounded-full bg-[var(--surface-2)] text-2xl ${
          isNotFound ? "text-[var(--muted)]" : "text-[var(--danger)]"
        }`}
      >
        {isNotFound ? "404" : "!"}
      </div>
      <h1 className="mt-5 text-lg font-semibold text-[var(--foreground)]">
        {isNotFound ? "Page not found" : "Something went wrong"}
      </h1>
      <p className="mt-2 max-w-sm text-sm text-[var(--muted)]">
        {isNotFound
          ? "The page you are looking for doesn't exist or may have been moved."
          : message || "An unexpected error occurred. Please try again."}
      </p>
      <div className="mt-6 flex gap-3">
        {isNotFound ? (
          <>
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
          </>
        ) : (
          <>
            <button
              onClick={() => retry()}
              className="inline-flex items-center justify-center rounded-lg border border-transparent bg-[var(--primary)] px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-[var(--primary-hover)]"
            >
              Try again
            </button>
            <Link
              href="/dashboard"
              className="inline-flex items-center justify-center rounded-lg border border-[var(--border-strong)] bg-[var(--surface-2)] px-4 py-2 text-xs font-semibold text-[var(--foreground)] transition-colors hover:bg-[var(--surface-3)]"
            >
              Go to dashboard
            </Link>
          </>
        )}
      </div>
    </div>
  );
}
